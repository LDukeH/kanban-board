import { api } from "./axios";

import type {
  RegisterFormSchema,
  LoginFormSchema,
} from "../validations/auth.schema";

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
