import { cn } from "@/lib/utils";
import type { ReactNode } from "react";
import {
  Settings,
  Kanban,
  LayoutGrid,
  Plus,
  FolderKanban,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { useRecentStore } from "@/stores/recentStore";
import { CreateWorkspaceDialog } from "@/components/dialog/CreateWorkspaceDialog";
import { NotificationBell } from "@/components/layout/NotificationBell";
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

export function Sidebar({ className }: SidebarProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { selectedWorkspaceId, setSelectedWorkspaceId } = useWorkspaceStore();
  const { recentWorkspaces, recentBoards } = useRecentStore();

  // The workspace the boards section is scoped to. Derived from the route so
  // it mirrors what the user is actually viewing: a workspace page resolves
  // directly, a board page resolves through the board's recorded workspace
  // (falling back to the last opened workspace while it loads).
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

  // Recent boards are tied to the workspace being viewed — never an
  // account-wide list — so only that workspace's entries are rendered.
  const activeWorkspaceBoards = activeWorkspaceId
    ? recentBoards.filter((board) => board.workspaceId === activeWorkspaceId)
    : [];
  const activeWorkspaceName =
    recentWorkspaces.find((w) => w.id === activeWorkspaceId)?.name ??
    "Workspace";

  return (
    <aside
      className={cn(
        "flex h-full w-64 flex-col border-r border-border bg-sidebar",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2.5 px-5 py-4">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-sm">
            <Kanban className="size-4" />
          </div>
          <span className="text-base font-semibold tracking-tight">
            Kanban Board
          </span>
        </div>
        <NotificationBell className="ml-auto" />
      </div>

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

      <div className="flex-1 overflow-y-auto px-3 py-4">
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

        {/* Boards: recent boards of the workspace being viewed — same recents
            logic as Recent Workspaces, scoped to that workspace. The list is
            capped at RECENT_LIMIT entries for the workspace: opening a board
            that is not listed yet pushes it to the top and evicts the
            workspace's oldest entry; already-listed boards keep their
            position. BoardPage records each visit, deletions forget their
            entry, renames update names in place. */}
        {activeWorkspaceId && activeWorkspaceBoards.length > 0 && (
          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between gap-2 px-2">
              <span className="flex min-w-0 items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                <FolderKanban className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate">{activeWorkspaceName}</span>
              </span>
            </div>
            <nav className="space-y-0.5">
              {activeWorkspaceBoards.map((board) => (
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
          </div>
        )}
      </div>

      <div className="space-y-0.5 border-t border-border p-3">
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
