import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useAuth } from "@/hooks/useAuth";
import { useThemeStore } from "@/stores/themeStore";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Settings, Sun, Moon, LogOut, Mail } from "lucide-react";

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useThemeStore();
  const navigate = useNavigate();

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

      <div className="flex-1 p-6">
        <section className="rounded-xl border border-border bg-card p-6">
          <div className="flex items-center gap-2">
            <Mail className="size-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Account</h2>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            Signed in as{" "}
            <span className="font-medium text-foreground">
              {user?.email ?? "..."}
            </span>
          </p>
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
      </div>
    </DashboardLayout>
  );
}
