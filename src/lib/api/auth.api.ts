import { api } from "./axios";
import type { User } from "@/types/auth";

import type {
  RegisterFormSchema,
  LoginFormSchema,
} from "../validations/auth.schema";

interface UserApiResponse {
  id: string;
  email: string;
  password_hash: string;
  created_at: string;
  updated_at: string;
}

function mapUser(raw: UserApiResponse): User {
  return {
    id: raw.id,
    email: raw.email,
    passwordHash: raw.password_hash,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
}

export const getCurrentUser = async (): Promise<User> => {
  const response = await api.get<UserApiResponse>("/auth/me");
  return mapUser(response.data);
};

export const registerUser = async (data: RegisterFormSchema) => {
  const response = await api.post("/auth/register", data);
  return response.data;
};

export const loginUser = async (data: LoginFormSchema) => {
  const response = await api.post("/auth/login", data);
  return response.data;
};

export const logoutUser = async (): Promise<void> => {
  await api.post("/auth/logout");
};

// Ownership lives in `workspace_memberships`, not an owner column, and deleting a user cascades every referencing table.
// A workspace whose owner is deleted survives ownerless, so delete the workspace first. Not exposed in the UI; the live suite uses it for teardown.
export const deleteAccount = async (): Promise<void> => {
  await api.delete("/auth/me");
};
