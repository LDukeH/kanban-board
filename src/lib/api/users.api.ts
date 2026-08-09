import { api } from "./axios";
import type { SearchedUser } from "@/types/workspace";

/**
 * Raw user shape returned by the Go API's `GET /users/search` endpoint.
 * Only `id` and `email` are exposed for membership invitations.
 */
interface SearchedUserApiResponse {
  id: string;
  email: string;
}

function mapSearchedUser(raw: SearchedUserApiResponse): SearchedUser {
  return {
    id: raw.id,
    email: raw.email,
  };
}

/**
 * Search for users by email. Returns at most 10 users.
 */
export const searchUsersByEmail = async (
  email: string,
): Promise<SearchedUser[]> => {
  const response = await api.get<SearchedUserApiResponse[]>("/users/search", {
    params: { email },
  });
  return response.data.map(mapSearchedUser);
};