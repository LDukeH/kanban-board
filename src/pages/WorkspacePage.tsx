import { useParams } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { BoardGrid } from "@/components/dashboard/BoardGrid";
import { FeaturedSection } from "@/components/dashboard/FeaturedSection";
import { WorkspaceMembersDialog } from "@/components/dialog/WorkspaceMembersDialog";
import { ProgressSummary } from "@/components/summary/ProgressSummary";
import {
  useWorkspaces,
  useWorkspaceDetail,
  useWorkspaceMembers,
} from "@/hooks/useWorkspaces";
import { useBoards } from "@/hooks/useBoards";
import { useWorkspaceSummary } from "@/hooks/useWorkspaceSummary";
import { useWorkspaceAccess } from "@/hooks/useWorkspaceAccess";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { useRecentStore } from "@/stores/recentStore";
import { useEffect, useState } from "react";
import { Loader2, LayoutGrid, Users } from "lucide-react";
import { describeLoadError } from "@/lib/httpStatus";
import { cn } from "@/lib/utils";
import { emailInitial, avatarGradient } from "@/lib/memberDisplay";
import { Button } from "@/components/ui/button";

/** How many member avatars render before collapsing into "+N". */
const MAX_AVATARS = 5;

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
  const { canManageBoards, isLoadingRole, role } = useWorkspaceAccess(workspaceId);
  const { recordWorkspace } = useRecentStore();
  const membersQuery = useWorkspaceMembers(workspaceId);
  const [membersOpen, setMembersOpen] = useState(false);

  const workspaceSummary = useWorkspaceSummary(workspaceId);

  // The detail route is the authoritative source for the header name and the workspace description, and the workspace mutations keep it in sync.
  const workspaceDetail = useWorkspaceDetail(workspaceId, {
    // Skip a request the backend is guaranteed to reject: the route answers 403 for non-members, and `role` stays undefined without a membership.
    enabled: !isLoadingRole && role !== undefined,
  });

  const workspace =
    workspaceDetail.data ?? workspaces.find((w) => w.id === workspaceId);
  const isLoadingWorkspace =
    !workspace && (isLoadingWorkspaces || workspaceDetail.isLoading);
  const members = membersQuery.data ?? [];
  const visibleMembers = members.slice(0, MAX_AVATARS);

  useEffect(() => {
    if (workspaceId) {
      setSelectedWorkspaceId(workspaceId);
    }
  }, [workspaceId, setSelectedWorkspaceId]);

  // Remember this workspace as recently accessed for the sidebar.
  useEffect(() => {
    if (workspace) {
      recordWorkspace({ id: workspace.id, name: workspace.name });
    }
  }, [workspace, recordWorkspace]);

  return (
    <DashboardLayout>
      <header className="flex items-center justify-between bg-background px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-lg font-semibold text-primary">
            {workspace?.name.charAt(0).toUpperCase() ?? "W"}
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground">
              {isLoadingWorkspace
                ? "Loading..."
                : (workspace?.name ?? "Workspace")}
            </h1>
            <p className="text-sm text-muted-foreground">
              {/* `description` is a plain string; an empty one falls back to the generic subtitle. */}
              {workspace?.description || "Boards in this workspace."}
            </p>
          </div>
        </div>

        {/* Member management lives in the dashboard header (opposite the title), not buried in the sidebar. */}
        <div className="flex items-center gap-3">
          {workspaceId && (
            <>
              <button
                onClick={() => setMembersOpen(true)}
                className="flex cursor-pointer items-center -space-x-2"
                aria-label={`${members.length} members`}
                title="View members"
              >
                {visibleMembers.map((member) => (
                  <span
                    key={member.id}
                    className={cn(
                      "flex size-7 items-center justify-center rounded-full bg-linear-to-br text-xs font-semibold text-white ring-2 ring-background transition-transform hover:-translate-y-0.5",
                      avatarGradient(member.userId || member.email),
                    )}
                  >
                    {emailInitial(member.email)}
                  </span>
                ))}
                {members.length > MAX_AVATARS && (
                  <span className="flex size-7 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground ring-2 ring-background">
                    +{members.length - MAX_AVATARS}
                  </span>
                )}
              </button>
              <Button variant="outline" onClick={() => setMembersOpen(true)}>
                <Users className="size-4" />
                Members
                {members.length > 0 && (
                  <span className="rounded-full bg-muted px-1.5 text-xs font-semibold text-muted-foreground">
                    {members.length}
                  </span>
                )}
              </Button>
            </>
          )}
        </div>
      </header>

      <div className="flex-1 p-6">
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
              <div className="w-full max-w-72">
                <BoardGrid boards={[]} workspaceId={workspaceId} canCreate />
              </div>
            )}
          </div>
        ) : (
          <>
            <h2 className="mb-3 text-sm font-semibold text-foreground">
              Boards
            </h2>
            <BoardGrid
              boards={boards}
              taskCounts={Object.fromEntries(
                (workspaceSummary.summary?.boards ?? []).map(
                  ({ board, summary }) => [board.id, summary.total],
                ),
              )}
              canEdit={canManageBoards && !isLoadingRole}
              canDelete={canManageBoards && !isLoadingRole}
              workspaceId={workspaceId}
              canCreate={canManageBoards && !isLoadingRole}
            />
          </>
        )}

        <ProgressSummary
          heading="Workspace progress"
          isLoading={workspaceSummary.isLoadingSummary}
          isError={workspaceSummary.isSummaryError}
          error={workspaceSummary.summaryError}
          onRetry={workspaceSummary.refetchSummary}
          totals={workspaceSummary.summary?.totals}
          rows={(workspaceSummary.summary?.boards ?? []).map(
            ({ board, summary }) => ({
              id: board.id,
              label: board.name,
              total: summary.total,
              completed: summary.completed,
              href: `/boards/${board.id}`,
            }),
          )}
          storageKey={`kanban-summary:workspace:${workspaceId}`}
          className="mt-5"
        />

        <FeaturedSection className="mt-5" />
      </div>

      {workspaceId && (
        <WorkspaceMembersDialog
          workspaceId={workspaceId}
          open={membersOpen}
          onOpenChange={setMembersOpen}
        />
      )}
    </DashboardLayout>
  );
}
