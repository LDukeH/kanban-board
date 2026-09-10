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
  try {
    const response = await api.post("/auth/register", data);
    return response.data;
  } catch (error) {
    console.error("Error during registration:", error);
    throw error;
  }
};

export const loginUser = async (data: LoginFormSchema) => {
  try {
    const response = await api.post("/auth/login", data);
    return response.data;
  } catch (error) {
    console.error("Error during login:", error);
    throw error;
  }
};

export const logoutUser = async (): Promise<void> => {
  await api.post("/auth/logout");
};
