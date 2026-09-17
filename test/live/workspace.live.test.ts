import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Workspace } from "@/types/workspace";
import {
  changeMemberRole,
  createMembership,
  createWorkspace,
  deleteWorkspace,
  getWorkspaceMembers,
  getWorkspaces,
  leaveWorkspace,
  removeMember,
  transferWorkspaceOwnership,
  updateWorkspace,
} from "@/lib/api/workspace.api";
import { assertBackendReachable } from "./helpers/env";
import { expectStatus } from "./helpers/http";
import {
  actingAs,
  installSessionManager,
  loginAs,
  provisionUser,
  type LiveAccount,
} from "./helpers/session";
import { uniqueName } from "./helpers/uniq";

describe("live workspace API", () => {
  let owner: LiveAccount;
  let admin: LiveAccount;
  let guest: LiveAccount;
  let workspace: Workspace;

  beforeAll(async () => {
    installSessionManager();
    await assertBackendReachable();

    owner = await provisionUser("ws-owner");
    admin = await provisionUser("ws-admin");
    guest = await provisionUser("ws-guest");

    await actingAs(owner, async () => {
      workspace = await createWorkspace({ name: uniqueName("Live workspace") });
    });
  });

  afterAll(async () => {
    if (!owner || !workspace) return; // setup aborted (backend down); nothing to clean up
    // Ownership is reverted to `owner` by the transfer test before this runs.
    await loginAs(owner);
    await deleteWorkspace(workspace.id);
  });

  it("shows the created workspace in getWorkspaces", async () => {
    await actingAs(owner, async () => {
      const list = await getWorkspaces();
      expect(list.map((w) => w.id)).toContain(workspace.id);
    });
  });

  it("renames the workspace", async () => {
    const renamed = await actingAs(owner, async () =>
      updateWorkspace(workspace.id, { name: uniqueName("Live workspace renamed") }),
    );

    expect(renamed.id).toBe(workspace.id);
    expect(renamed.name).not.toBe(workspace.name);
  });

  it("adds an admin member and lists members", async () => {
    await actingAs(owner, async () => {
      const member = await createMembership(workspace.id, { email: admin.email, role: "admin" });
      expect(member.workspaceId).toBe(workspace.id);
      expect(member.userId).toBe(admin.id);
      expect(member.role).toBe("admin");
    });

    await actingAs(owner, async () => {
      const members = await getWorkspaceMembers(workspace.id);
      expect(members.map((m) => m.userId)).toContain(admin.id);
      expect(members.map((m) => m.userId)).toContain(owner.id);
    });
  });

  it("changes a member role and removes the membership", async () => {
    await actingAs(owner, async () => {
      const adminMembership = (await getWorkspaceMembers(workspace.id)).find(
        (m) => m.userId === admin.id,
      );
      expect(adminMembership).toBeDefined();

      const demoted = await changeMemberRole(workspace.id, adminMembership!.id, "member");
      expect(demoted.role).toBe("member");

      await removeMember(workspace.id, adminMembership!.id);
      const members = await getWorkspaceMembers(workspace.id);
      expect(members.map((m) => m.userId)).not.toContain(admin.id);
    });
  });

  it("lets a member leave the workspace and loses access", async () => {
    await actingAs(owner, () => createMembership(workspace.id, { email: guest.email, role: "member" }));

    await actingAs(guest, async () => {
      await leaveWorkspace(workspace.id);
      await expectStatus(getWorkspaceMembers(workspace.id), 403);
    });
  });

  it("transfers ownership to the admin member and back", async () => {
    await actingAs(owner, async () => {
      await createMembership(workspace.id, { email: admin.email, role: "admin" });
      await transferWorkspaceOwnership(workspace.id, admin.id);
    });

    await actingAs(admin, async () => {
      const members = await getWorkspaceMembers(workspace.id);
      expect(members.find((m) => m.userId === admin.id)?.role).toBe("owner");
      expect(members.find((m) => m.userId === owner.id)?.role).toBe("member");

      await transferWorkspaceOwnership(workspace.id, owner.id);
    });

    await actingAs(owner, async () => {
      const members = await getWorkspaceMembers(workspace.id);
      expect(members.find((m) => m.userId === owner.id)?.role).toBe("owner");
    });
  });

  it("rejects ownership transfer by a non-owner member", async () => {
    // After the revert above, `admin` is a plain member: the backend reports
    // this as a 5xx today (see docs/api/transfer-ownership.md), so any
    // rejection counts.
    await actingAs(admin, async () => {
      await expect(transferWorkspaceOwnership(workspace.id, guest.id)).rejects.toBeTruthy();
    });
  });

  it("answers 400 for an invalid workspace id", async () => {
    await actingAs(owner, async () => {
      await expectStatus(getWorkspaceMembers("not-a-uuid"), 400);
    });
  });
});