import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Settings,
  LogOut,
  Kanban,
  LayoutGrid,
  Plus,
  Users,
  Sun,
  Moon,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspaces } from "@/hooks/useWorkspaces";
import { useBoards } from "@/hooks/useBoards";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { useThemeStore } from "@/stores/themeStore";
import { CreateWorkspaceDialog } from "@/components/workspace/CreateWorkspaceDialog";
import { useNavigate } from "react-router-dom";

interface SidebarProps {
  className?: string;
}

export function Sidebar({ className }: SidebarProps) {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const { workspaces, isLoading } = useWorkspaces();
  const { selectedWorkspaceId, setSelectedWorkspaceId } = useWorkspaceStore();
  const { boards } = useBoards(selectedWorkspaceId ?? undefined);
  const { theme, toggleTheme } = useThemeStore();

  const selectedWorkspace = workspaces.find(
    (w) => w.id === selectedWorkspaceId,
  );

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
          <button className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
            <LayoutGrid className="size-4 text-muted-foreground" />
            Boards
          </button>
          <button className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
            <Users className="size-4 text-muted-foreground" />
            Members
          </button>
          <button className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
            <Settings className="size-4 text-muted-foreground" />
            Settings
          </button>
        </div>
      </nav>

      {/* Workspace Switcher */}
      <div className="flex-1 overflow-y-auto px-3 py-4">
        <div className="mb-2 flex items-center justify-between px-2">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Workspaces
          </span>
          <CreateWorkspaceDialog
            trigger={
              <button
                className="flex size-5 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                aria-label="Create workspace"
              >
                <Plus className="size-3.5" />
              </button>
            }
          />
        </div>

        {isLoading ? (
          <div className="space-y-1 px-2">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-7 animate-pulse rounded-lg bg-sidebar-accent"
              />
            ))}
          </div>
        ) : (
          <nav className="space-y-0.5">
            {workspaces.map((workspace) => (
              <button
                key={workspace.id}
                onClick={() => {
                  setSelectedWorkspaceId(workspace.id);
                  navigate(`/workspaces/${workspace.id}`);
                }}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  workspace.id === selectedWorkspaceId &&
                    "bg-sidebar-accent text-sidebar-accent-foreground",
                )}
              >
                <span className="flex size-5 shrink-0 items-center justify-center rounded bg-primary/10 text-[10px] font-semibold text-primary">
                  {workspace.name.charAt(0).toUpperCase()}
                </span>
                <span className="truncate">{workspace.name}</span>
              </button>
            ))}
          </nav>
        )}

        {/* Boards of selected workspace */}
        {selectedWorkspace && (
          <div className="mt-6">
            <div className="mb-2 flex items-center justify-between px-2">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Boards
              </span>
              <LayoutGrid className="size-3.5 text-muted-foreground" />
            </div>
            <nav className="space-y-0.5">
              {boards.length === 0 ? (
                <p className="px-2 text-xs text-muted-foreground">
                  No boards yet.
                </p>
              ) : (
                boards.map((board) => (
                  <button
                    key={board.id}
                    className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  >
                    <span className="size-2 shrink-0 rounded-full bg-primary" />
                    <span className="truncate">{board.name}</span>
                  </button>
                ))
              )}
            </nav>
          </div>
        )}
      </div>

      {/* Bottom Actions */}
      <div className="space-y-2 border-t border-border p-3">
        <Button
          onClick={toggleTheme}
          variant="ghost"
          className="w-full justify-start gap-2 text-sm text-muted-foreground"
        >
          {theme === "dark" ? (
            <Sun className="size-4" />
          ) : (
            <Moon className="size-4" />
          )}
          {theme === "dark" ? "Light mode" : "Dark mode"}
        </Button>
        <Button
          onClick={() => logout()}
          variant="ghost"
          className="w-full justify-start gap-2 text-sm text-muted-foreground cursor-pointer"
        >
          <LogOut className="size-4" />
          Logout
        </Button>
      </div>
    </aside>
  );
}
