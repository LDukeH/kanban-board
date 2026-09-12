import { Routes, Route, Navigate } from "react-router-dom";
import { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";
import { ProtectedRoute } from "@/routes/ProtectedRoute";
import { GuestRoute } from "@/routes/GuestRoute";

const AuthPage = lazy(() => import("@/pages/AuthPage"));
const WorkspacesPage = lazy(() => import("@/pages/WorkspacesPage"));
const WorkspacePage = lazy(() => import("@/pages/WorkspacePage"));
const BoardPage = lazy(() => import("@/pages/BoardPage"));
const SettingsPage = lazy(() => import("@/pages/SettingsPage"));

/** Full-screen spinner shown while a lazy route chunk is downloading. */
function RouteLoader() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
    </div>
  );
}

function App() {
  return (
    <Suspense fallback={<RouteLoader />}>
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
    </Suspense>
  );
}

export default App;
