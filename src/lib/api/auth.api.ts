import { api } from "./axios";
import type { User } from "@/types/auth";
import { supabase } from "@/lib/supabase";

import type {
  ForgotPasswordFormSchema,
  RegisterFormSchema,
  LoginFormSchema,
} from "../validations/auth.schema";

const SIGNUP_COOLDOWN_MS = 60_000;
const signupCooldownKey = "supabase-signup-cooldown";

interface SupabaseAuthErrorLike {
  message: string;
  status?: number;
  code?: string;
}

function normalizeAuthError(error: SupabaseAuthErrorLike): Error & {
  status?: number;
  code?: string;
} {
  const normalized = Object.assign(new Error(error.message), {
    status: error.status,
    code: error.code,
  });
  return normalized;
}

function enforceSignupCooldown(): void {
  const raw = sessionStorage.getItem(signupCooldownKey);
  const cooldown = raw ? Number(raw) : 0;
  if (Number.isFinite(cooldown) && cooldown > Date.now()) {
    const seconds = Math.ceil((cooldown - Date.now()) / 1000);
    throw Object.assign(
      new Error(`Please wait ${seconds} seconds before trying again.`),
      { status: 429, code: "signup_rate_limited" },
    );
  }
  sessionStorage.removeItem(signupCooldownKey);
}

interface UserApiResponse {
  id: string;
  email: string;
  created_at: string;
  updated_at: string;
}

function mapUser(raw: UserApiResponse): User {
  return {
    id: raw.id,
    email: raw.email,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
}

export const getCurrentUser = async (): Promise<User> => {
  const response = await api.get<UserApiResponse>("/auth/me");
  const mapped = mapUser(response.data);
  const { data } = await supabase.auth.getUser();
  const metadata = data.user?.user_metadata ?? {};
  return {
    ...mapped,
    displayName: String(
      metadata.display_name ?? metadata.full_name ?? metadata.name ?? "",
    ),
    avatarUrl: String(metadata.avatar_url ?? metadata.picture ?? ""),
  };
};

export const syncAuthUser = async (): Promise<void> => {
  await api.post("/auth/sync");
};

export const registerUser = async (
  data: RegisterFormSchema,
  captchaToken: string,
): Promise<{ requiresEmailConfirmation: boolean }> => {
  const email = data.email.trim().toLowerCase();
  enforceSignupCooldown();

  const { data: result, error } = await supabase.auth.signUp({
    email,
    password: data.password,
    options: { captchaToken },
  });
  if (error) {
    const normalized = normalizeAuthError(error);
    if (normalized.status === 429) {
      sessionStorage.setItem(
        signupCooldownKey,
        String(Date.now() + SIGNUP_COOLDOWN_MS),
      );
    }
    throw normalized;
  }
  if (!result.session) {
    return { requiresEmailConfirmation: true };
  }
  await syncAuthUser();
  return { requiresEmailConfirmation: false };
};

export const loginUser = async (data: LoginFormSchema, captchaToken: string) => {
  const { error } = await supabase.auth.signInWithPassword({
    email: data.email.trim().toLowerCase(),
    password: data.password,
    options: { captchaToken },
  });
  if (error) throw normalizeAuthError(error);
  await syncAuthUser();
};

export const loginWithGoogle = async (): Promise<void> => {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${window.location.origin}/auth` },
  });
  if (error) throw normalizeAuthError(error);
};

/** Shared Supabase `/recover` call: emails `email` a link back to `/auth/reset-password`. */
async function sendPasswordResetEmail(
  email: string,
  captchaToken?: string,
): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(
    email.trim().toLowerCase(),
    {
      redirectTo: `${window.location.origin}/auth/reset-password`,
      ...(captchaToken ? { captchaToken } : {}),
    },
  );
  if (error) throw normalizeAuthError(error);
}

export const requestPasswordReset = async (
  data: ForgotPasswordFormSchema,
  captchaToken: string,
): Promise<void> => sendPasswordResetEmail(data.email, captchaToken);

/**
 * Sends the reset link to the address on the signed-in user (Settings →
 * Security). `captchaToken` stays optional so the first attempt can go out
 * without a challenge; callers retry with a token only when Supabase's bot
 * protection rejects the request.
 */
export const sendPasswordResetToCurrentUser = async (
  captchaToken?: string,
): Promise<void> => {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw normalizeAuthError(error);
  const email = data.user?.email;
  if (!email) {
    throw normalizeAuthError({
      message: "This account has no email address to send a reset link to.",
      status: 400,
    });
  }
  await sendPasswordResetEmail(email, captchaToken);
};

export const updatePassword = async (password: string): Promise<void> => {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw normalizeAuthError(error);
};

export const updateProfile = async (profile: {
  displayName: string;
  avatarUrl?: string;
}): Promise<void> => {
  const { error } = await supabase.auth.updateUser({
    data: {
      display_name: profile.displayName.trim(),
      ...(profile.avatarUrl !== undefined && { avatar_url: profile.avatarUrl }),
    },
  });
  if (error) throw normalizeAuthError(error);
};

export const logoutUser = async (): Promise<void> => {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
};

// Ownership lives in `workspace_memberships`, not an owner column, and deleting a user cascades every referencing table.
export const deleteAccount = async (): Promise<void> => {
  await api.delete("/auth/me");
  await supabase.auth.signOut();
};
