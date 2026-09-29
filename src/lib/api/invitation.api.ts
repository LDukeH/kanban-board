import { api } from "./axios";
import type {
  WorkspaceInvitation,
  WorkspaceInvitationStatus,
} from "@/types/workspace";

// Membership is created by accepting an invitation; there is no direct membership-create request and no client-controlled role.
// Status codes seen live: 201 create, 200 list/accept/decline/cancel, 403 non-owner/admin or non-invitee, 409 duplicate/pending/already-final.
interface WorkspaceInvitationApiResponse {
  id: string;
  workspace_id: string;
  invitee_user_id: string;
  invited_by_user_id: string;
  status: WorkspaceInvitationStatus;
  invitee_email?: string;
  created_at: string;
  updated_at: string;
  expires_at: string;
}

function mapInvitation(
  raw: WorkspaceInvitationApiResponse,
): WorkspaceInvitation {
  return {
    id: raw.id,
    workspaceId: raw.workspace_id,
    inviteeUserId: raw.invitee_user_id,
    invitedByUserId: raw.invited_by_user_id,
    status: raw.status,
    inviteeEmail: raw.invitee_email,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
    expiresAt: raw.expires_at,
  };
}

/** Owner/Admin: invite a registered user. Never sends a role. */
export const createInvitation = async (
  workspaceId: string,
  data: { userId: string },
): Promise<WorkspaceInvitation> => {
  const response = await api.post<WorkspaceInvitationApiResponse>(
    `/workspaces/${workspaceId}/invitations`,
    { user_id: data.userId },
  );
  return mapInvitation(response.data);
};

/** Lists every invitation ever created, in any status — callers wanting pending only must filter themselves. A pending invitee gets 403. */
export const getWorkspaceInvitations = async (
  workspaceId: string,
): Promise<WorkspaceInvitation[]> => {
  const response = await api.get<WorkspaceInvitationApiResponse[]>(
    `/workspaces/${workspaceId}/invitations`,
  );
  return response.data.map(mapInvitation);
};

/** Invitee only: accept a pending invitation, creating the membership. */
export const acceptInvitation = async (
  invitationId: string,
): Promise<WorkspaceInvitation> => {
  const response = await api.post<WorkspaceInvitationApiResponse>(
    `/invitations/${invitationId}/accept`,
  );
  return mapInvitation(response.data);
};

/** Invitee only: decline a pending invitation. Grants no workspace access. */
export const declineInvitation = async (
  invitationId: string,
): Promise<WorkspaceInvitation> => {
  const response = await api.post<WorkspaceInvitationApiResponse>(
    `/invitations/${invitationId}/decline`,
  );
  return mapInvitation(response.data);
};

/** Owner/Admin: cancel a pending invitation. */
export const cancelInvitation = async (
  workspaceId: string,
  invitationId: string,
): Promise<WorkspaceInvitation> => {
  const response = await api.post<WorkspaceInvitationApiResponse>(
    `/workspaces/${workspaceId}/invitations/${invitationId}/cancel`,
  );
  return mapInvitation(response.data);
};
