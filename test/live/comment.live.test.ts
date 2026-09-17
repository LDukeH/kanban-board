import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Task } from "@/types/board";
import {
  createTaskComment,
  deleteComment,
  getTaskComments,
} from "@/lib/api/comment.api";
import { createTask } from "@/lib/api/task.api";
import { createMembership } from "@/lib/api/workspace.api";
import { provisionChain, tearDownChain, type ProvisionedChain } from "./helpers/chain";
import { assertBackendReachable } from "./helpers/env";
import { expectStatus, UUID_RE } from "./helpers/http";
import {
  actingAs,
  clearSession,
  installSessionManager,
  provisionUser,
  type LiveAccount,
} from "./helpers/session";

describe("live comment API (authorization matrix)", () => {
  let chain: ProvisionedChain;
  let admin: LiveAccount;
  let member: LiveAccount;
  let outsider: LiveAccount;
  let task: Task;

  beforeAll(async () => {
    installSessionManager();
    await assertBackendReachable();

    admin = await provisionUser("comment-admin");
    member = await provisionUser("comment-member");
    outsider = await provisionUser("comment-outsider");
    chain = await provisionChain("comment");

    await actingAs(chain.owner, async () => {
      await createMembership(chain.workspace.id, { email: admin.email, role: "admin" });
      await createMembership(chain.workspace.id, { email: member.email, role: "member" });
      task = await createTask(chain.columns[0].id, { title: "Commented task" });
    });
  });

  afterAll(async () => {
    if (!chain) return; // setup aborted (backend down); nothing to clean up
    await tearDownChain(chain);
  });

  it("creates a comment as the authenticated author", async () => {
    const comment = await actingAs(chain.owner, async () =>
      createTaskComment(task.id, "Ready for review"),
    );

    expect(comment.id).toMatch(UUID_RE);
    expect(comment.taskId).toBe(task.id);
    expect(comment.authorId).toBe(chain.owner.id);
    expect(comment.authorEmail).toBe(chain.owner.email);
    expect(comment.content).toBe("Ready for review");
  });

  it("lists comments oldest-first with both authors mapped", async () => {
    await actingAs(member, async () => {
      const memberComment = await createTaskComment(task.id, "Looks good to me");
      expect(memberComment.authorId).toBe(member.id);

      const comments = await getTaskComments(task.id);
      expect(comments.map((c) => c.content)).toEqual(
        expect.arrayContaining(["Ready for review", "Looks good to me"]),
      );
      const sortedAscending = comments.every(
        (c, index) => index === 0 || comments[index - 1].createdAt <= c.createdAt,
      );
      expect(sortedAscending).toBe(true);
      // Comments are immutable in v1: updated_at always mirrors created_at.
      expect(comments.every((c) => c.updatedAt === c.createdAt)).toBe(true);
    });
  });

  it("lets a member delete their own comment", async () => {
    const comment = await actingAs(member, async () => {
      const created = await createTaskComment(task.id, "Temporary note");
      return created;
    });

    await actingAs(member, async () => {
      await deleteComment(comment.id);
      const comments = await getTaskComments(task.id);
      expect(comments.map((c) => c.id)).not.toContain(comment.id);
    });
  });

  it("blocks a member from deleting another user's comment (403)", async () => {
    const ownerComment = await actingAs(chain.owner, async () =>
      createTaskComment(task.id, "Owned by owner"),
    );

    await actingAs(member, async () => {
      await expectStatus(deleteComment(ownerComment.id), 403);
    });
  });

  it("lets the owner delete any comment", async () => {
    const ownerComment = await actingAs(chain.owner, async () =>
      createTaskComment(task.id, "Owned by owner"),
    );

    await actingAs(member, async () => {
      await expectStatus(deleteComment(ownerComment.id), 403);
    });

    await actingAs(chain.owner, async () => {
      await deleteComment(ownerComment.id);
      const comments = await getTaskComments(task.id);
      expect(comments.map((c) => c.id)).not.toContain(ownerComment.id);
    });
  });

  it("lets an admin delete any comment", async () => {
    const ownerComment = await actingAs(chain.owner, async () =>
      createTaskComment(task.id, "Another owner comment"),
    );

    await actingAs(admin, async () => {
      await deleteComment(ownerComment.id);
      const comments = await getTaskComments(task.id);
      expect(comments.map((c) => c.id)).not.toContain(ownerComment.id);
    });
  });

  it("blocks a non-member outsider (403)", async () => {
    await actingAs(outsider, async () => {
      await expectStatus(getTaskComments(task.id), 403);
      await expectStatus(createTaskComment(task.id, "Intrusion"), 403);
    });
  });

  it("requires authentication (401)", async () => {
    clearSession();

    await expectStatus(getTaskComments(task.id), 401);
  });

  it("validates comment content (1-5000 trimmed chars)", async () => {
    await actingAs(chain.owner, async () => {
      await expectStatus(createTaskComment(task.id, "   "), 400);
      await expectStatus(createTaskComment(task.id, "x".repeat(5001)), 400);

      const boundary = await createTaskComment(task.id, "x".repeat(5000));
      expect(boundary.content).toHaveLength(5000);
    });
  });

  it("answers 400 for an invalid task id", async () => {
    await actingAs(chain.owner, async () => {
      await expectStatus(createTaskComment("not-a-uuid", "x"), 400);
    });
  });
});