import { beforeEach, describe, expect, it } from "vitest";
import { useInvitationStore } from "@/stores/invitationStore";

beforeEach(() => {
  useInvitationStore.getState().reset();
});

describe("invitationStore", () => {
  it("starts empty, so every invitation is still pending", () => {
    expect(useInvitationStore.getState().resolved).toEqual({});
  });

  it("records how an invitation was resolved", () => {
    useInvitationStore.getState().markResolved("inv1", "accepted");
    useInvitationStore.getState().markResolved("inv2", "declined");

    expect(useInvitationStore.getState().resolved).toEqual({
      inv1: "accepted",
      inv2: "declined",
    });
  });

  it("keeps earlier resolutions when another one is recorded", () => {
    useInvitationStore.getState().markResolved("inv1", "accepted");
    useInvitationStore.getState().markResolved("inv2", "declined");

    expect(useInvitationStore.getState().resolved).toEqual({
      inv1: "accepted",
      inv2: "declined",
    });
  });

  it("overwrites a re-recorded outcome for the same invitation", () => {
    useInvitationStore.getState().markResolved("inv1", "accepted");
    useInvitationStore.getState().markResolved("inv1", "declined");

    expect(useInvitationStore.getState().resolved).toEqual({
      inv1: "declined",
    });
  });

  it("ignores a blank id and leaves the existing entries untouched", () => {
    useInvitationStore.getState().markResolved("inv1", "accepted");
    useInvitationStore.getState().markResolved("", "accepted");

    expect(useInvitationStore.getState().resolved).toEqual({
      inv1: "accepted",
    });
  });

  it("reset drops every resolution, as required when the account changes", () => {
    useInvitationStore.getState().markResolved("inv1", "accepted");
    useInvitationStore.getState().markResolved("inv2", "declined");

    useInvitationStore.getState().reset();

    expect(useInvitationStore.getState().resolved).toEqual({});
  });
});
