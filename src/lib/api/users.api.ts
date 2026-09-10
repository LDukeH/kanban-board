import { api } from "./axios";
import type { SearchedUser } from "@/types/workspace";

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

export const searchUsersByEmail = async (
  email: string,
): Promise<SearchedUser[]> => {
  const response = await api.get<SearchedUserApiResponse[]>("/users/search", {
    params: { email },
  });
  return response.data.map(mapSearchedUser);
};
