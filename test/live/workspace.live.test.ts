import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Workspace } from "@/types/workspace";
import {
  changeMemberRole,
  createWorkspace,
  deleteWorkspace,
  getWorkspace,
  getWorkspaceMembers,
  getWorkspaces,
  leaveWorkspace,
  removeMember,
  transferWorkspaceOwnership,
  updateWorkspace,
} from "@/lib/api/workspace.api";
import { assertBackendReachable } from "./helpers/env";
import { expectStatus } from "./helpers/http";
import { inviteAndAccept } from "./helpers/invitations";
import { WORKSPACE_DESCRIPTION_MAX_BYTES } from "@/lib/validations/workspace.schema";
import {
  actingAs,
  deleteAccounts,
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
  let transferTarget: LiveAccount;
  let workspace: Workspace;

  beforeAll(async () => {
    installSessionManager();
    await assertBackendReachable();

    owner = await provisionUser("ws-owner");
    admin = await provisionUser("ws-admin");
    guest = await provisionUser("ws-guest");
    transferTarget = await provisionUser("ws-transfer");

    await actingAs(owner, async () => {
      workspace = await createWorkspace({ name: uniqueName("Live workspace") });
    });
  });

  afterAll(async () => {
    if (!owner || !workspace) return; // setup aborted (backend down); nothing to clean up
    // Ownership is reverted to `owner` by the transfer test before this runs.
    // Workspace first (ownership lives in `workspace_memberships` and the
    // backend has no ownership-transfer trigger), then every account.
    await loginAs(owner);
    await deleteWorkspace(workspace.id);
    await deleteAccounts([owner, admin, guest, transferTarget]);
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

  it("stores a description on create and reads it back from both read routes", async () => {
    const created = await actingAs(owner, async () =>
      createWorkspace({
        name: uniqueName("Live described workspace"),
        description: "Everything the platform team ships",
      }),
    );

    // A workspace whose description was never set reads back as "", never null.
    try {
      expect(created.description).toBe("Everything the platform team ships");

      const detail = await actingAs(owner, async () => getWorkspace(created.id));
      expect(detail.description).toBe("Everything the platform team ships");

      const list = await actingAs(owner, async () => getWorkspaces());
      expect(list.find((w) => w.id === created.id)?.description).toBe(
        "Everything the platform team ships",
      );
    } finally {
      await actingAs(owner, async () => deleteWorkspace(created.id));
    }
  });

  it("sets, clears and preserves the description according to the patch body", async () => {
    const name = uniqueName("Live description workspace");
    const created = await actingAs(owner, async () => createWorkspace({ name }));

    try {
      expect(created.description).toBe("");

      // A value sets the description, and the response already carries it.
      const set = await actingAs(owner, async () =>
        updateWorkspace(created.id, { name, description: "Platform roadmap" }),
      );
      expect(set.description).toBe("Platform roadmap");
      expect(
        (await actingAs(owner, async () => getWorkspace(created.id))).description,
      ).toBe("Platform roadmap");

      // An omitted `description` key leaves the stored value untouched.
      const omitted = await actingAs(owner, async () =>
        updateWorkspace(created.id, { name }),
      );
      expect(omitted.description).toBe("Platform roadmap");

      // An empty string clears it back to "".
      const cleared = await actingAs(owner, async () =>
        updateWorkspace(created.id, { name, description: "" }),
      );
      expect(cleared.description).toBe("");
      expect(
        (await actingAs(owner, async () => getWorkspace(created.id))).description,
      ).toBe("");
    } finally {
      await actingAs(owner, async () => deleteWorkspace(created.id));
    }
  });

  it("rejects a description over the 2000 byte limit", async () => {
    const name = uniqueName("Live oversized workspace");
    const created = await actingAs(owner, async () => createWorkspace({ name }));

    try {
      await expectStatus(
        updateWorkspace(created.id, {
          name,
          description: "a".repeat(WORKSPACE_DESCRIPTION_MAX_BYTES + 1),
        }),
        400,
      );

      // Multi-byte text is well under the limit in characters but over it in
      // bytes, which is why the frontend guards on encoded length.
      await expectStatus(
        updateWorkspace(created.id, {
          name,
          description: "€".repeat(WORKSPACE_DESCRIPTION_MAX_BYTES),
        }),
        400,
      );
    } finally {
      await actingAs(owner, async () => deleteWorkspace(created.id));
    }
  });

  it("rejects a patch with a blank name", async () => {
    // `name` stays mandatory even for a description-only edit, so the frontend
    // always resends it.
    await actingAs(owner, async () => {
      await expectStatus(
        updateWorkspace(workspace.id, { name: "   ", description: "Platform roadmap" }),
        400,
      );
    });
  });

  it("invites a user who accepts as a member, then promotes them to admin", async () => {
    await actingAs(owner, async () => {
      // An accepted invitation always produces a `member` membership; the
      // admin role is a separate owner promotion (§19.5).
      const { membership } = await inviteAndAccept(workspace.id, admin, owner);
      expect(membership.workspaceId).toBe(workspace.id);
      expect(membership.userId).toBe(admin.id);
      expect(membership.role).toBe("member");

      const promoted = await changeMemberRole(workspace.id, membership.id, "admin");
      expect(promoted.role).toBe("admin");
    });

    await actingAs(owner, async () => {
      const members = await getWorkspaceMembers(workspace.id);
      expect(members.find((m) => m.userId === admin.id)?.role).toBe("admin");
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

  it("lets an invited member leave the workspace and loses access", async () => {
    await actingAs(owner, async () => {
      await inviteAndAccept(workspace.id, guest, owner);
    });

    await actingAs(guest, async () => {
      const members = await getWorkspaceMembers(workspace.id);
      expect(members.find((m) => m.userId === guest.id)?.role).toBe("member");

      await leaveWorkspace(workspace.id);
      await expectStatus(getWorkspaceMembers(workspace.id), 403);
    });
  });

  it("transfers ownership to an invited member and back", async () => {
    await actingAs(owner, async () => {
      // A plain member is enough: transfer promotes them to owner (§5.2).
      await inviteAndAccept(workspace.id, transferTarget, owner);
      await transferWorkspaceOwnership(workspace.id, transferTarget.id);
    });

    await actingAs(transferTarget, async () => {
      const members = await getWorkspaceMembers(workspace.id);
      expect(members.find((m) => m.userId === transferTarget.id)?.role).toBe("owner");
      expect(members.find((m) => m.userId === owner.id)?.role).toBe("member");

      await transferWorkspaceOwnership(workspace.id, owner.id);
    });

    await actingAs(owner, async () => {
      const members = await getWorkspaceMembers(workspace.id);
      expect(members.find((m) => m.userId === owner.id)?.role).toBe("owner");
    });
  });

  it("rejects ownership transfer by a non-owner member", async () => {
    // After the revert above `transferTarget` is a plain member again: the
    // backend reports this as a 5xx today (see docs/api/transfer-ownership.md),
    // so any rejection counts.
    await actingAs(transferTarget, async () => {
      await expect(transferWorkspaceOwnership(workspace.id, guest.id)).rejects.toBeTruthy();
    });
  });

  it("rejects a description update by a member who is not the owner", async () => {
    // Same 5xx-for-a-non-owner quirk as ownership transfer, which is why the
    // edit UI is gated on the owner role instead of on 4xx handling. The failed
    // patch must leave the stored description untouched.
    await actingAs(owner, async () => {
      await updateWorkspace(workspace.id, { name: workspace.name, description: "kept" });
    });

    await actingAs(transferTarget, async () => {
      await expect(
        updateWorkspace(workspace.id, {
          name: workspace.name,
          description: "hijacked",
        }),
      ).rejects.toBeTruthy();
    });

    await actingAs(owner, async () => {
      const after = await getWorkspace(workspace.id);
      expect(after.description).toBe("kept");
      await updateWorkspace(workspace.id, { name: workspace.name, description: "" });
    });
  });

  it("answers 400 for an invalid workspace id", async () => {
    await actingAs(owner, async () => {
      await expectStatus(getWorkspaceMembers("not-a-uuid"), 400);
    });
  });
});