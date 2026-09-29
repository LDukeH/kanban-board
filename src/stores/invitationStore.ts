import { create } from "zustand";

/** How a user resolved an invitation they were the invitee of. */
export type InvitationOutcome = "accepted" | "declined";

interface InvitationState {
  // Deliberately in-memory and never persisted: the backend owns the real status, and persisting would leak resolutions across accounts.
  resolved: Record<string, InvitationOutcome>;
  // Record the outcome so the prompt stops offering buttons that would 409; a blank id is ignored since it can only come from a backend without `invitation_id`.
  markResolved: (invitationId: string, outcome: InvitationOutcome) => void;
  reset: () => void;
}

export const useInvitationStore = create<InvitationState>((set) => ({
  resolved: {},

  // The blank-id guard sits outside `set`: returning state from an updater still yields a new reference and would notify subscribers.
  markResolved: (invitationId, outcome) => {
    if (!invitationId) return;
    set((state) => ({ resolved: { ...state.resolved, [invitationId]: outcome } }));
  },

  reset: () => set({ resolved: {} }),
}));