import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Task } from "@/types/board";
import type { Notification } from "@/types/notification";
import {
  getNotifications,
  getUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/api/notification.api";
import { createTask, assignUserToTask } from "@/lib/api/task.api";
import { provisionChain, tearDownChain, type ProvisionedChain } from "./helpers/chain";
import { assertBackendReachable } from "./helpers/env";
import { expectStatus, UUID_RE } from "./helpers/http";
import { inviteAndAccept, inviteUser } from "./helpers/invitations";
import {
  actingAs,
  deleteAccounts,
  installSessionManager,
  provisionUser,
  type LiveAccount,
} from "./helpers/session";

// Discriminated-union narrowing for the notification payloads.
const isTaskAssigned = (n: Notification): n is Extract<Notification, { type: "task_assigned" }> =>
  n.type === "task_assigned";
const isWorkspaceInvited = (n: Notification): n is Extract<Notification, { type: "workspace_invited" }> =>
  n.type === "workspace_invited";

describe("live notification API", () => {
  let chain: ProvisionedChain;
  let assignee: LiveAccount;
  let invitee: LiveAccount;
  let task: Task;

  beforeAll(async () => {
    installSessionManager();
    await assertBackendReachable();

    // Provision extra users first; provisionChain re-logs in as the owner.
    assignee = await provisionUser("notif-assignee");
    invitee = await provisionUser("notif-invitee");
    chain = await provisionChain("notif");

    await actingAs(chain.owner, async () => {
      // The assignee must be a real member (task assignment is workspace
      // bound), and inviting them is what emits workspace_invited (§12.2: the
      // notification is created with the pending invitation, not on accept).
      await inviteAndAccept(chain.workspace.id, assignee, chain.owner);
      task = await createTask(chain.columns[0].id, { title: "Notifying task" });
    });
  });

  afterAll(async () => {
    if (!chain) return; // setup aborted (backend down); nothing to clean up
    // Delete the workspace first (cascades boards/columns/tasks/labels/
    // comments/memberships), then the accounts. Deleting an owner does NOT
    // cascade to their workspaces — ownership lives in
    // `workspace_memberships` and migration 012 is unimplemented — so the
    // order is required. Account deletion cascades the notifications the
    // assignee/invitee received, so the run leaves no user-owned residue.
    // `tearDownChain` already removes the chain owner; the extra accounts this
    // file provisioned are removed here.
    await tearDownChain(chain);
    await deleteAccounts([assignee, invitee]);
  });

  it("notifies the assignee when someone else assigns them a task", async () => {
    await actingAs(chain.owner, async () => {
      await assignUserToTask(task.id, assignee.id);
    });

    await actingAs(assignee, async () => {
      const notifications = await getNotifications();
      const assigned = notifications.find(isTaskAssigned);
      expect(assigned).toBeDefined();
      expect(assigned?.readAt).toBeNull();
      expect(assigned?.payload.taskId).toBe(task.id);
      expect(assigned?.payload.taskTitle).toBe("Notifying task");

      // The setup accepted the invitation, so resolved invitation
      // notifications are intentionally excluded from the notification list.
      expect(notifications.some(isWorkspaceInvited)).toBe(false);

      // Newest first (created_at descending, per §12.3).
      const newestFirst = notifications.every(
        (n, index) => index === 0 || notifications[index - 1].createdAt >= n.createdAt,
      );
      expect(newestFirst).toBe(true);
    });
  });

  it("unread count decreases when a notification is marked read", async () => {
    await actingAs(assignee, async () => {
      const before = await getUnreadNotificationCount();
      const assigned = (await getNotifications()).find(isTaskAssigned);
      expect(assigned).toBeDefined();

      await markNotificationRead(assigned!.id);

      const after = await getUnreadNotificationCount();
      expect(after).toBe(before - 1);
    });
  });

  it("marks all notifications read (idempotently)", async () => {
    await actingAs(assignee, async () => {
      await markAllNotificationsRead();
      await markAllNotificationsRead(); // idempotent

      expect(await getUnreadNotificationCount()).toBe(0);
      expect(await getNotifications({ unreadOnly: true })).toEqual([]);
    });
  });

  it("notifies the invitee when invited to a workspace (before acceptance)", async () => {
    await actingAs(chain.owner, async () => {
      // Creation only — no acceptance — so the notification must already exist
      // while the invitation is still pending.
      await inviteUser(chain.workspace.id, invitee);
    });

    await actingAs(invitee, async () => {
      const invited = (await getNotifications()).find(isWorkspaceInvited);
      expect(invited).toBeDefined();
      expect(invited?.payload.workspaceId).toBe(chain.workspace.id);
      expect(invited?.payload.workspaceName).toBe(chain.workspace.name);
      // The payload is the invitee's only route to the invitation id, so it
      // must be present and usable (docs/api/invitations.md).
      expect(invited?.payload.invitationId).toMatch(UUID_RE);
    });
  });

  it("cannot touch someone else's notification (404) and rejects bad ids (400)", async () => {
    await actingAs(assignee, async () => {
      await expectStatus(markNotificationRead(crypto.randomUUID()), 404);
      await expectStatus(markNotificationRead("not-a-uuid"), 400);
    });
  });
});