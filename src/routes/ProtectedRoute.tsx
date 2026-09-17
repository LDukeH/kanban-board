import { Navigate, Outlet } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { describeLoadError } from "@/lib/httpStatus";
import { Button } from "@/components/ui/button";

/** Full-screen spinner while the session is being checked on startup. */
function SessionLoading() {
  return (
    <div
      className="flex h-screen w-full flex-col items-center justify-center gap-3 bg-background"
      role="status"
      aria-label="Checking your session"
    >
      <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden />
      <p className="text-sm text-muted-foreground">Checking your session…</p>
    </div>
  );
}

export function ProtectedRoute() {
  const {
    isLoading,
    isAuthenticated,
    sessionCheckFailed,
    sessionCheckError,
    retrySessionCheck,
  } = useAuth();

  if (isLoading) {
    return <SessionLoading />;
  }

  // The session check failed with something other than 401 (network error,
  // 5xx): the user may still be authenticated. Show a retry screen instead of
  // bouncing them to the auth page and treating it as logged out.
  if (sessionCheckFailed) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center gap-3 bg-background px-6 text-center">
        <p className="text-sm font-medium text-foreground">
          Couldn't check your session
        </p>
        <p className="max-w-sm text-sm text-muted-foreground">
          {describeLoadError(sessionCheckError)}
        </p>
        <Button
          variant="outline"
          onClick={() => {
            void retrySessionCheck();
          }}
        >
          Retry
        </Button>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  return <Outlet />;
}