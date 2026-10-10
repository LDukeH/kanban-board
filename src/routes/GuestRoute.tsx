import { Navigate, Outlet } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "react-router-dom";

export function GuestRoute() {
  const { isLoading, isAuthenticated } = useAuth();
  const location = useLocation();
  const isPasswordReset = location.state?.mode === "forgot";

  if (isLoading) {
    return (
      <div
        className="flex h-screen w-full items-center justify-center bg-background"
        role="status"
        aria-label="Checking your session"
      >
        <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden />
      </div>
    );
  }

  if (isAuthenticated && !isPasswordReset) {
    return <Navigate to="/workspaces" replace />;
  }

  return <Outlet />;
}
