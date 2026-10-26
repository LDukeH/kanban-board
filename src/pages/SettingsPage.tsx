import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useAuth } from "@/hooks/useAuth";
import { useThemeStore } from "@/stores/themeStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InlineAlert } from "@/components/ui/inline-alert";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import {
  deleteAccount,
  sendPasswordResetToCurrentUser,
  updateProfile,
} from "@/lib/api/auth.api";
import {
  describeAuthFormError,
  describeMutationError,
  isCaptchaError,
} from "@/lib/httpStatus";
import { setDateFormat, type DateFormat } from "@/lib/preferences";
import CaptchaField from "@/components/auth/CaptchaField";
import type HCaptcha from "@hcaptcha/react-hcaptcha";
import { useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Settings,
  Sun,
  Moon,
  LogOut,
  Mail,
  UserRound,
  Shield,
  Bell,
  Trash2,
  Camera,
  Loader2,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

const settingsKey = (userId: string) => `kanban-settings:${userId}`;

interface LocalSettings {
  emailAssignments: boolean;
  inAppAssignments: boolean;
  comments: boolean;
  deadlineReminders: boolean;
  language: "en" | "vi";
  dateFormat: "MM/DD/YYYY" | "DD/MM/YYYY";
}

const defaultSettings: LocalSettings = {
  emailAssignments: true,
  inAppAssignments: true,
  comments: true,
  deadlineReminders: true,
  language: "en",
  dateFormat: "DD/MM/YYYY",
};

function readSettings(userId: string): LocalSettings {
  try {
    const stored = JSON.parse(
      localStorage.getItem(settingsKey(userId)) ?? "{}",
    );
    return { ...defaultSettings, ...stored };
  } catch {
    return defaultSettings;
  }
}

function SettingToggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 py-2">
      <span>
        <span className="block text-sm font-medium text-foreground">
          {label}
        </span>
        <span className="block text-xs text-muted-foreground">
          {description}
        </span>
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="size-4 accent-primary"
      />
    </label>
  );
}

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useThemeStore();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [settings, setSettings] = useState<LocalSettings>(
    user ? readSettings(user.id) : defaultSettings,
  );
  const [notice, setNotice] = useState<{
    tone: "info" | "error";
    message: string;
  } | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);
  const [resetNotice, setResetNotice] = useState<{
    tone: "info" | "error";
    message: string;
  } | null>(null);
  const [resetCaptchaRequired, setResetCaptchaRequired] = useState(false);
  const [resetCaptchaToken, setResetCaptchaToken] = useState("");
  const resetCaptcha = useRef<HCaptcha>(null);

  useEffect(() => {
    if (!user) return;
    const stored = readSettings(user.id);
    queueMicrotask(() => setSettings(stored));
    setDateFormat(stored.dateFormat);
    document.documentElement.lang = stored.language;
    void supabase.auth.getUser().then(({ data, error }) => {
      if (error) return;
      const metadata = data.user.user_metadata ?? {};
      setDisplayName(
        String(
          metadata.display_name ?? metadata.full_name ?? metadata.name ?? "",
        ),
      );
      setAvatarUrl(String(metadata.avatar_url ?? metadata.picture ?? ""));
    });
  }, [user]);

  useEffect(() => {
    const handlePreferencesChanged = () => {
      if (user) setSettings(readSettings(user.id));
    };
    window.addEventListener(
      "kanban-preferences-changed",
      handlePreferencesChanged,
    );
    return () =>
      window.removeEventListener(
        "kanban-preferences-changed",
        handlePreferencesChanged,
      );
  }, [user]);

  function updateSetting<K extends keyof LocalSettings>(
    key: K,
    value: LocalSettings[K],
  ) {
    const next = { ...settings, [key]: value };
    setSettings(next);
    if (user) localStorage.setItem(settingsKey(user.id), JSON.stringify(next));
    if (key === "dateFormat") setDateFormat(value as DateFormat);
    if (key === "language") document.documentElement.lang = value as string;
  }

  async function saveProfile(event: React.FormEvent) {
    event.preventDefault();
    if (!displayName.trim()) {
      setNotice({ tone: "error", message: "Display name cannot be empty." });
      return;
    }
    setSavingProfile(true);
    setNotice(null);
    try {
      await updateProfile({ displayName, avatarUrl });
      queryClient.setQueryData(["currentUser"], (current: typeof user) =>
        current
          ? { ...current, displayName: displayName.trim(), avatarUrl }
          : current,
      );
      setNotice({ tone: "info", message: "Profile updated." });
    } catch (error) {
      setNotice({
        tone: "error",
        message: describeMutationError(error, "Could not update your profile."),
      });
    } finally {
      setSavingProfile(false);
    }
  }

  function handleAvatar(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 512_000) {
      setNotice({
        tone: "error",
        message: "Choose an image smaller than 500 KB.",
      });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setAvatarUrl(String(reader.result));
    reader.onerror = () =>
      setNotice({ tone: "error", message: "Could not read that image." });
    reader.readAsDataURL(file);
  }

  // Sends the reset link to the signed-in address. Supabase may demand a captcha
  // on /recover; the first attempt goes out without one and the widget only
  // appears if the API rejects the request for that reason.
  async function sendResetLink() {
    setResetNotice(null);
    if (resetCaptchaRequired && !resetCaptchaToken) {
      setResetNotice({
        tone: "error",
        message: "Please complete the hCaptcha challenge.",
      });
      return;
    }
    setSendingReset(true);
    try {
      await sendPasswordResetToCurrentUser(
        resetCaptchaRequired ? resetCaptchaToken : undefined,
      );
      resetCaptcha.current?.resetCaptcha();
      setResetCaptchaToken("");
      setResetNotice({
        tone: "info",
        message: `If an account exists for ${
          user?.email ?? "that email"
        }, a password reset link has been sent. Check your inbox and spam folder.`,
      });
    } catch (error) {
      if (!resetCaptchaRequired && isCaptchaError(error)) {
        setResetCaptchaRequired(true);
        setResetNotice({
          tone: "error",
          message: "hCaptcha is required to send the reset link.",
        });
      } else {
        setResetNotice({
          tone: "error",
          message: describeAuthFormError(error, "Send reset email"),
        });
      }
    } finally {
      setSendingReset(false);
    }
  }

  const initials = (displayName || user?.email || "?")
    .slice(0, 1)
    .toUpperCase();

  return (
    <DashboardLayout>
      <header className="flex items-center justify-between bg-background px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Settings className="size-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground">Settings</h1>
            <p className="text-sm text-muted-foreground">
              Your account and appearance preferences.
            </p>
          </div>
        </div>
      </header>

      <div className="flex-1 p-4 md:p-6">
        {notice && (
          <div className="mb-4">
            <InlineAlert
              message={notice.message}
              tone={notice.tone}
              onDismiss={() => setNotice(null)}
            />
          </div>
        )}

        <section className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-center gap-2">
            <UserRound className="size-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Profile</h2>
          </div>
          <form onSubmit={saveProfile} className="mt-4 space-y-4">
            <div className="flex items-center gap-4 w-full">
              <div className="flex size-16 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-xl font-semibold text-primary">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt=""
                    className="size-full object-cover"
                  />
                ) : (
                  initials
                )}
              </div>
              <label className="cursor-pointer">
                <span className="inline-flex h-8 items-center gap-2 rounded-lg border border-border px-2.5 text-sm font-medium hover:bg-muted">
                  <Camera className="size-4" /> Upload avatar
                </span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAvatar}
                  className="sr-only"
                />
              </label>
            </div>
            <label className="block text-sm font-medium text-foreground">
              Display name
              <Input
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="How should teammates see you?"
                className="mt-1"
              />
            </label>
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Mail className="size-4" /> {user?.email ?? "..."}
            </p>
            <Button type="submit" disabled={savingProfile}>
              {savingProfile && <Loader2 className="size-4 animate-spin" />}{" "}
              Save profile
            </Button>
          </form>
        </section>

        <section className="mt-4 rounded-xl border border-border bg-card p-6">
          <h2 className="text-sm font-semibold text-foreground">Appearance</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Switch between light and dark mode. Your choice is remembered.
          </p>
          <Button
            onClick={toggleTheme}
            variant="outline"
            className="mt-4 w-full justify-start gap-2"
          >
            {theme === "dark" ? (
              <Sun className="size-4" />
            ) : (
              <Moon className="size-4" />
            )}
            {theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          </Button>
        </section>

        <section className="mt-4 rounded-xl border border-border bg-card p-6">
          <div className="flex items-center gap-2">
            <Bell className="size-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">
              Notifications
            </h2>
          </div>
          <div className="mt-3 divide-y divide-border">
            <SettingToggle
              label="Task assignments"
              description="When you are assigned to a task."
              checked={settings.inAppAssignments}
              onChange={(value) => updateSetting("inAppAssignments", value)}
            />
            <SettingToggle
              label="Email notifications"
              description="Receive assignment updates by email."
              checked={settings.emailAssignments}
              onChange={(value) => updateSetting("emailAssignments", value)}
            />
            <SettingToggle
              label="New comments"
              description="When someone comments on your task."
              checked={settings.comments}
              onChange={(value) => updateSetting("comments", value)}
            />
            <SettingToggle
              label="Deadline reminders"
              description="Reminders for upcoming due dates."
              checked={settings.deadlineReminders}
              onChange={(value) => updateSetting("deadlineReminders", value)}
            />
          </div>
        </section>

        <section className="mt-4 rounded-xl border border-border bg-card p-6">
          <div className="flex items-center gap-2">
            <Shield className="size-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Security</h2>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            We&apos;ll email{" "}
            <span className="font-medium text-foreground">
              {user?.email ?? "your address"}
            </span>{" "}
            a secure link to choose a new password.
          </p>
          {resetNotice && (
            <div className="mt-3">
              <InlineAlert
                message={resetNotice.message}
                tone={resetNotice.tone}
                onDismiss={() => setResetNotice(null)}
              />
            </div>
          )}
          {resetCaptchaRequired && (
            <div className="mt-3">
              <CaptchaField
                ref={resetCaptcha}
                onTokenChange={setResetCaptchaToken}
              />
            </div>
          )}
          <Button
            type="button"
            variant="outline"
            className="mt-4 gap-2"
            disabled={sendingReset}
            onClick={sendResetLink}
          >
            {sendingReset ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Mail className="size-4" aria-hidden />
            )}
            {sendingReset ? "Sending…" : "Reset password"}
          </Button>
        </section>

        <section className="mt-4 rounded-xl border border-border bg-card p-6">
          <h2 className="text-sm font-semibold text-foreground">Session</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Sign out of this device. You will need to log in again to continue.
          </p>
          <Button
            variant="destructive"
            className="mt-4 w-full justify-start gap-2"
            onClick={async () => {
              try {
                await logout();
              } finally {
                navigate("/auth");
              }
            }}
          >
            <LogOut className="size-4" />
            Log out
          </Button>
        </section>

        <section className="mt-4 rounded-xl border border-destructive/30 bg-card p-6">
          <div className="flex items-center gap-2 text-destructive">
            <Trash2 className="size-4" />
            <h2 className="text-sm font-semibold">Danger zone</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Permanently delete your account and all data owned by it.
          </p>
          <ConfirmDeleteDialog
            title="Delete your account?"
            description="This action cannot be undone. All your workspaces, boards, and tasks will be permanently deleted."
            confirmText="Delete account"
            onConfirm={async () => {
              await deleteAccount();
              if (user) localStorage.removeItem(settingsKey(user.id));
              navigate("/auth");
            }}
            requiredConfirmation={displayName.trim() || user?.email || ""}
            confirmationLabel={`Type "${displayName.trim() || user?.email || ""}" to confirm.`}
            trigger={
              <Button variant="destructive" className="mt-4">
                <Trash2 className="size-4" /> Delete account
              </Button>
            }
          />
        </section>
      </div>
    </DashboardLayout>
  );
}
