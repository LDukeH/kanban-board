import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import AuthPage from "@/pages/AuthPage";
import WorkspacesPage from "@/pages/WorkspacesPage";
import WorkspacePage from "@/pages/WorkspacePage";
import BoardPage from "@/pages/BoardPage";
import SettingsPage from "@/pages/SettingsPage";
import { ProtectedRoute } from "@/routes/ProtectedRoute";
import { GuestRoute } from "@/routes/GuestRoute";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";

/** How long route switches are held so navigation feels deliberate. */
const NAVIGATION_DELAY_MS = 150;

/**
 * Briefly holds route switches before rendering the destination page.
 * Keeps the app from feeling "fake" when the local API responds instantly.
 */
function PageTransition({ children }: { children: ReactNode }) {
  const location = useLocation();
  const firstRender = useRef(true);
  const [pending, setPending] = useState(true);

  useEffect(() => {
    const id = setTimeout(() => setPending(false), NAVIGATION_DELAY_MS);
    return () => clearTimeout(id);
  }, [location.pathname]);

  // Skip the brief loader when the path doesn't actually change (e.g. the
  // initial render already consumed it, or a same-path re-render fires).
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    setPending(true);
  }, [location.pathname]);

  if (pending) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  return children;
}

function App() {
  return (
    <PageTransition>
      <Routes>
        <Route element={<GuestRoute />}>
          <Route path="/auth" element={<AuthPage />} />
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/workspaces" element={<WorkspacesPage />} />
          <Route path="/workspaces/:workspaceId" element={<WorkspacePage />} />
          <Route path="/boards/:boardId" element={<BoardPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/auth" replace />} />
      </Routes>
    </PageTransition>
  );
}

export default App;
