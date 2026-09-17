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
import { createMembership } from "@/lib/api/workspace.api";
import { provisionChain, tearDownChain, type ProvisionedChain } from "./helpers/chain";
import { assertBackendReachable } from "./helpers/env";
import { expectStatus } from "./helpers/http";
import {
  actingAs,
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
      // Adding the assignee by a different user triggers workspace_invited.
      await createMembership(chain.workspace.id, { email: assignee.email, role: "member" });
      task = await createTask(chain.columns[0].id, { title: "Notifying task" });
    });
  });

  afterAll(async () => {
    if (!chain) return; // setup aborted (backend down); nothing to clean up
    // Deleting the workspace cascades the shared resources; the notifications
    // the assignee/invitee received stay behind as user-owned rows (accepted
    // dev-DB residue, per docs/plan/plan.md).
    await tearDownChain(chain);
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

      const invited = notifications.find(isWorkspaceInvited);
      expect(invited?.payload.workspaceId).toBe(chain.workspace.id);

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

  it("notifies the invitee when added to a workspace", async () => {
    await actingAs(chain.owner, async () => {
      await createMembership(chain.workspace.id, { email: invitee.email, role: "member" });
    });

    await actingAs(invitee, async () => {
      const invited = (await getNotifications()).find(isWorkspaceInvited);
      expect(invited).toBeDefined();
      expect(invited?.payload.workspaceId).toBe(chain.workspace.id);
      expect(invited?.payload.workspaceName).toBe(chain.workspace.name);
    });
  });

  it("cannot touch someone else's notification (404) and rejects bad ids (400)", async () => {
    await actingAs(assignee, async () => {
      await expectStatus(markNotificationRead(crypto.randomUUID()), 404);
      await expectStatus(markNotificationRead("not-a-uuid"), 400);
    });
  });
});