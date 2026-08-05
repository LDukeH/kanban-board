import { useParams } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { BoardGrid } from "@/components/dashboard/BoardGrid";
import { FeaturedSection } from "@/components/dashboard/FeaturedSection";
import { CreateBoardDialog } from "@/components/workspace/CreateBoardDialog";
import { useWorkspaces } from "@/hooks/useWorkspaces";
import { useBoards } from "@/hooks/useBoards";
import { useWorkspaceAccess } from "@/hooks/useWorkspaceAccess";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { useEffect } from "react";
import { Loader2, LayoutGrid } from "lucide-react";
import { describeLoadError } from "@/lib/httpStatus";

export default function WorkspacePage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const { workspaces, isLoading: isLoadingWorkspaces } = useWorkspaces();
  const { setSelectedWorkspaceId } = useWorkspaceStore();
  const {
    boards,
    isLoading: isLoadingBoards,
    isError: isBoardsError,
    error: boardsError,
  } = useBoards(workspaceId);
  const { canManageBoards, isLoadingRole } = useWorkspaceAccess(workspaceId);

  const workspace = workspaces.find((w) => w.id === workspaceId);

  // Keep the selected workspace in sync with the URL
  useEffect(() => {
    if (workspaceId) {
      setSelectedWorkspaceId(workspaceId);
    }
  }, [workspaceId, setSelectedWorkspaceId]);

  return (
    <DashboardLayout>
      <header className="flex items-center justify-between bg-background px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-lg font-semibold text-primary">
            {workspace?.name.charAt(0).toUpperCase() ?? "W"}
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground">
              {isLoadingWorkspaces
                ? "Loading..."
                : (workspace?.name ?? "Workspace")}
            </h1>
            <p className="text-sm text-muted-foreground">
              {workspace?.description ?? "Boards in this workspace."}
            </p>
          </div>
        </div>
        {workspaceId && canManageBoards && !isLoadingRole && (
          <CreateBoardDialog workspaceId={workspaceId} />
        )}
      </header>

      <div className="flex-1 p-6">
        <FeaturedSection />
        {isLoadingBoards ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : isBoardsError ? (
          <div className="flex flex-col items-center justify-center gap-2 py-20 text-muted-foreground">
            <p>{describeLoadError(boardsError)}</p>
          </div>
        ) : boards.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <LayoutGrid className="size-6" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">
                No boards yet
              </h2>
              <p className="text-sm text-muted-foreground">
                Create your first board to start organizing tasks.
              </p>
            </div>
            {workspaceId && canManageBoards && !isLoadingRole && (
              <CreateBoardDialog workspaceId={workspaceId} />
            )}
          </div>
        ) : (
          <>
            <h2 className="mb-3 text-sm font-semibold text-foreground">
              Your boards
            </h2>
            <BoardGrid
              boards={boards}
              canEdit={canManageBoards && !isLoadingRole}
              canDelete={canManageBoards && !isLoadingRole}
            />
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
