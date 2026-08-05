import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { WorkspaceCard } from "@/components/workspace/WorkspaceCard";
import { CreateWorkspaceDialog } from "@/components/workspace/CreateWorkspaceDialog";
import { useWorkspaces } from "@/hooks/useWorkspaces";
import { useWorkspaceAccess } from "@/hooks/useWorkspaceAccess";
import { useNavigate } from "react-router-dom";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { Plus, Loader2, LayoutGrid } from "lucide-react";
import type { Workspace } from "@/types/workspace";

/**
 * Wrapper that checks the current user's role for a single workspace and
 * passes the `canEdit` and `canDelete` flags to the WorkspaceCard.
 *
 * `useWorkspaceAccess` is per-workspace, so it cannot be called inside a
 * `.map()` loop. This wrapper component isolates the hook call.
 */
function WorkspaceCardWithAccess({
  workspace,
  onClick,
}: {
  workspace: Workspace;
  onClick: () => void;
}) {
  const { canManageWorkspace, canDeleteWorkspace, isLoadingRole } =
    useWorkspaceAccess(workspace.id);

  return (
    <div onClick={onClick}>
      <WorkspaceCard
        workspace={workspace}
        canEdit={canManageWorkspace && !isLoadingRole}
        canDelete={canDeleteWorkspace && !isLoadingRole}
      />
    </div>
  );
}

export default function WorkspacesPage() {
  const { workspaces, isLoading, isError } = useWorkspaces();
  const navigate = useNavigate();
  const { setSelectedWorkspaceId } = useWorkspaceStore();

  function openWorkspace(id: string) {
    setSelectedWorkspaceId(id);
    navigate(`/workspaces/${id}`);
  }

  return (
    <DashboardLayout>
      <header className="flex items-center justify-between bg-background px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-sm">
            <LayoutGrid className="size-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground">
              Workspaces
            </h1>
            <p className="text-sm text-muted-foreground">
              Your workspaces and their boards.
            </p>
          </div>
        </div>
        <CreateWorkspaceDialog />
      </header>

      <div className="flex-1 p-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center gap-2 py-20 text-muted-foreground">
            <p>Failed to load workspaces.</p>
          </div>
        ) : workspaces.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Plus className="size-6" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">
                No workspaces yet
              </h2>
              <p className="text-sm text-muted-foreground">
                Create your first workspace to get started.
              </p>
            </div>
            <CreateWorkspaceDialog />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {workspaces.map((workspace) => (
              <WorkspaceCardWithAccess
                key={workspace.id}
                workspace={workspace}
                onClick={() => openWorkspace(workspace.id)}
              />
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
