import { cn } from "@/lib/utils";
import type { ReactNode } from "react";
import {
  Settings,
  Kanban,
  LayoutGrid,
  Plus,
  FolderKanban,
  SquareKanban,
  Loader2,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { useRecentStore } from "@/stores/recentStore";
import { useBoards } from "@/hooks/useBoards";
import { CreateWorkspaceDialog } from "@/components/dialog/CreateWorkspaceDialog";
import { useNavigate, useLocation } from "react-router-dom";
import { emailInitial, avatarGradient } from "@/lib/memberDisplay";

interface SidebarProps {
  className?: string;
}

function NavButton({
  label,
  icon,
  active,
  onClick,
  leading,
  root,
  className,
}: {
  label: string;
  icon?: LucideIcon;
  active?: boolean;
  onClick?: () => void;
  leading?: ReactNode;
  root?: boolean;
  className?: string;
}) {
  const Icon = icon;
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg border-l-2 border-transparent px-2 py-1.5 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        root && "font-semibold",
        active &&
          "border-primary bg-sidebar-accent text-sidebar-accent-foreground",
        className,
      )}
    >
      {Icon && (
        <Icon
          className={cn(
            "size-4",
            active ? "text-primary" : "text-muted-foreground",
          )}
        />
      )}
      {leading}
      <span className="min-w-0 flex-1 truncate">{label}</span>
    </button>
  );
}

function WorkspaceBoardsNav({ workspaceId }: { workspaceId: string }) {
  const { boards, isLoading } = useBoards(workspaceId);
  const navigate = useNavigate();
  const location = useLocation();
  const { recentWorkspaces } = useRecentStore();
  const workspace = recentWorkspaces.find((w) => w.id === workspaceId);

  return (
    <div className="mt-4">
      <div className="mb-2 flex items-center justify-between gap-2 px-2">
        <span className="flex min-w-0 items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          <FolderKanban className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate">{workspace?.name ?? "Workspace"}</span>
        </span>
        <span className="shrink-0 text-xs text-muted-foreground">
          {isLoading ? "…" : boards.length}
        </span>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-4 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
        </div>
      ) : boards.length === 0 ? (
        <p className="px-2 py-2 text-xs text-muted-foreground">
          No boards yet. To create one, open this workspace and use "New Board".
        </p>
      ) : (
        <nav className="space-y-0.5">
          {boards.map((board) => (
            <NavButton
              key={board.id}
              label={board.name}
              active={location.pathname === `/boards/${board.id}`}
              onClick={() => navigate(`/boards/${board.id}`)}
              className="pl-4"
              leading={
                <span className="size-2 shrink-0 rounded-full bg-primary" />
              }
            />
          ))}
        </nav>
      )}
    </div>
  );
}

export function Sidebar({ className }: SidebarProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { selectedWorkspaceId, setSelectedWorkspaceId } = useWorkspaceStore();
  const { recentWorkspaces, recentBoards } = useRecentStore();

  // The workspace whose boards the sidebar shows. Derived from the route so
  // the section mirrors what the user is actually viewing: a workspace page
  // resolves directly, a board page resolves through the board's recorded
  // workspace (falling back to the last opened workspace while it loads).
  const activeWorkspaceId = (() => {
    if (location.pathname.startsWith("/workspaces/")) {
      return location.pathname.split("/")[2];
    }
    if (location.pathname.startsWith("/boards/")) {
      const boardId = location.pathname.split("/")[2];
      return (
        recentBoards.find((b) => b.id === boardId)?.workspaceId ??
        selectedWorkspaceId
      );
    }
    return null;
  })();

  return (
    <aside
      className={cn(
        "flex h-full w-64 flex-col border-r border-border bg-sidebar",
        className,
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-4">
        <div className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-sm">
          <Kanban className="size-4" />
        </div>
        <span className="text-base font-semibold tracking-tight">
          Kanban Board
        </span>
      </div>

      {/* Navigation */}
      <nav className="border-b border-border px-3 py-3">
        <div className="space-y-0.5">
          <NavButton
            label="Workspaces"
            icon={LayoutGrid}
            root
            active={location.pathname === "/workspaces"}
            onClick={() => navigate("/workspaces")}
          />
        </div>
      </nav>

      {/* Recents */}
      <div className="flex-1 overflow-y-auto px-3 py-4">
        {/* Recent Workspaces */}
        {recentWorkspaces.length > 0 && (
          <div>
            <div className="mb-2 flex items-center justify-between px-2">
              <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                <FolderKanban className="size-3.5 text-muted-foreground" />
                Recent Workspaces
              </span>
              <CreateWorkspaceDialog
                trigger={
                  <button
                    className="cursor-pointer text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    aria-label="Create workspace"
                  >
                    <Plus className="size-3.5" />
                  </button>
                }
              />
            </div>
            <nav className="space-y-0.5">
              {recentWorkspaces.map((workspace) => (
                <NavButton
                  key={workspace.id}
                  label={workspace.name}
                  active={location.pathname === `/workspaces/${workspace.id}`}
                  onClick={() => {
                    setSelectedWorkspaceId(workspace.id);
                    navigate(`/workspaces/${workspace.id}`);
                  }}
                  leading={
                    <span className="flex size-5 shrink-0 items-center justify-center rounded bg-primary/10 text-[10px] font-semibold text-primary">
                      {workspace.name.charAt(0).toUpperCase()}
                    </span>
                  }
                />
              ))}
            </nav>
          </div>
        )}

        {/* Boards: the open workspace's boards, or recent boards as a fallback
            when no workspace is open (root /workspaces or /settings). */}
        {activeWorkspaceId ? (
          <WorkspaceBoardsNav workspaceId={activeWorkspaceId} />
        ) : recentBoards.length > 0 ? (
          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between px-2">
              <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                <SquareKanban className="size-3.5 text-muted-foreground" />
                Recent Boards
              </span>
            </div>
            <nav className="space-y-0.5">
              {recentBoards.map((board) => (
                <NavButton
                  key={board.id}
                  label={board.name}
                  active={location.pathname === `/boards/${board.id}`}
                  onClick={() => navigate(`/boards/${board.id}`)}
                  leading={
                    <span className="size-2 shrink-0 rounded-full bg-primary" />
                  }
                />
              ))}
            </nav>
          </div>
        ) : null}
      </div>

      {/* Bottom: Account + Settings */}
      <div className="space-y-0.5 border-t border-border p-3">
        {/* Account */}
        <button
          onClick={() => navigate("/settings")}
          className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          aria-label="Account"
          title="Account"
        >
          <span
            className={cn(
              "flex size-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-xs font-semibold text-white",
              avatarGradient(user?.id ?? user?.email ?? ""),
            )}
          >
            {emailInitial(user?.email ?? "?")}
          </span>
          <span className="min-w-0 flex-1 truncate">
            {user?.email ?? "Account"}
          </span>
        </button>

        {/* Settings */}
        <NavButton
          label="Settings"
          icon={Settings}
          active={location.pathname === "/settings"}
          onClick={() => navigate("/settings")}
        />
      </div>
    </aside>
  );
}
