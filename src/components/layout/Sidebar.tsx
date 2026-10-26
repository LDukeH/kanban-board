import { cn } from "@/lib/utils";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import {
  Settings,
  LayoutGrid,
  Plus,
  FolderKanban,
  X,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspaceStore } from "@/stores/workspaceStore";
import { useRecentStore } from "@/stores/recentStore";
import { CreateWorkspaceDialog } from "@/components/dialog/CreateWorkspaceDialog";
import { NotificationBell } from "@/components/layout/NotificationBell";
import { useNavigate, useLocation } from "react-router-dom";
import { emailInitial, avatarGradient, avatarSeed } from "@/lib/memberDisplay";
import { getBoardColor } from "@/lib/colors";

interface SidebarProps {
  className?: string;
  /** Whether the sidebar is open (mobile only). */
  isOpen?: boolean;
  /** Callback when the sidebar should close (mobile only). */
  onClose?: () => void;
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
        "flex w-full items-center gap-3 rounded-control border-l-2 border-transparent px-2 py-1.5 text-left text-sm font-medium text-sidebar-foreground outline-none transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring",
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

export function Sidebar({
  className,
  isOpen = false,
  onClose,
}: SidebarProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { selectedWorkspaceId, setSelectedWorkspaceId } = useWorkspaceStore();
  const { recentWorkspaces, recentBoards } = useRecentStore();

  // Close the sidebar when resizing up to desktop, and track mobile state.
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth < 768 : false,
  );

  useEffect(() => {
    const onResize = () => {
      setIsMobile(window.innerWidth < 768);
      if (window.innerWidth >= 768 && onClose) {
        onClose();
      }
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [onClose]);

  // The workspace the boards section is scoped to.
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

  // Recent boards are tied to the workspace being viewed — never an account-wide list — so only that workspace's entries are rendered.
  const activeWorkspaceBoards = activeWorkspaceId
    ? recentBoards.filter((board) => board.workspaceId === activeWorkspaceId)
    : [];
  const activeWorkspaceName =
    recentWorkspaces.find((w) => w.id === activeWorkspaceId)?.name ??
    "Workspace";

  return (
    <>
      {/* Mobile backdrop: dims content when the drawer is open. */}
      {isMobile && isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
          onClick={onClose}
          aria-hidden
        />
      )}
      <aside
        className={cn(
          "flex h-full flex-col border-r border-border bg-sidebar",
          // Desktop: always visible, fixed width.
          "sm:flex sm:w-64",
          // Mobile: hidden by default, slide-in drawer.
          isMobile && !isOpen && "hidden",
          isMobile && isOpen &&
            "fixed inset-y-0 left-0 z-50 w-64 transform transition-transform duration-300 ease-in-out",
          className,
        )}
      >
        <div className="flex items-center justify-between gap-2.5 px-5 py-4">
        <div className="flex items-center gap-2.5">
          <img
            src="/kanvas-logo-wo-tagline.png"
            alt="Kanvas logo"
            className="size-8 shrink-0 rounded-lg bg-white object-contain shadow-sm"
          />
          <span className="text-base font-semibold tracking-tight">
            Kanvas
          </span>
        </div>
        {isMobile && (
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-control p-1 text-sidebar-foreground outline-none transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring"
            aria-label="Close sidebar"
          >
            <X className="size-5" />
          </button>
        )}
        {!isMobile && <NotificationBell className="ml-auto" />}
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
                Recent workspaces
              </span>
              <CreateWorkspaceDialog
                trigger={
                  <button
                    type="button"
                    className="cursor-pointer rounded-control p-0.5 text-muted-foreground outline-none transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring"
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
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-control bg-primary/10 text-xs font-semibold text-primary">
                      {workspace.name.charAt(0).toUpperCase()}
                    </span>
                  }
                />
              ))}
            </nav>
          </div>
        )}

        {/* Current workspace: the section the sidebar's board list belongs to. */}
        {activeWorkspaceId && (
          <div className="mt-4 border-t border-border pt-3">
            <div className="mb-1.5 flex min-w-0 items-center gap-2 px-2">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-control bg-primary/10 text-xs font-semibold text-primary">
                {activeWorkspaceName.charAt(0).toUpperCase()}
              </span>
              <span
                className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground"
                title={activeWorkspaceName}
              >
                {activeWorkspaceName}
              </span>
            </div>
            {activeWorkspaceBoards.length > 0 ? (
              <nav className="space-y-0.5">
                {activeWorkspaceBoards.map((board) => (
                  <NavButton
                    key={board.id}
                    label={board.name}
                    active={location.pathname === `/boards/${board.id}`}
                    onClick={() => navigate(`/boards/${board.id}`)}
                    className="pl-7"
                    leading={
                      <span
                        className="size-2 shrink-0 rounded-full"
                        style={{ backgroundColor: getBoardColor(board.id) }}
                      />
                    }
                  />
                ))}
              </nav>
            ) : (
              <p className="pl-7 text-xs text-muted-foreground">
                No boards opened yet.
              </p>
            )}
          </div>
        )}
      </div>

      <div className="space-y-0.5 border-t border-border p-3">
        <button
          type="button"
          onClick={() => navigate("/settings")}
          className="flex w-full items-center gap-3 rounded-control border-l-2 border-transparent px-2 py-1.5 text-left text-sm font-medium text-sidebar-foreground outline-none transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring"
          aria-label={`Account${user?.displayName || user?.email ? `: ${user.displayName || user.email}` : ""}`}
          title={user?.displayName || user?.email || "Account"}
        >
          <span
            className={cn(
              "flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br text-xs font-semibold text-white",
              !user?.avatarUrl && avatarGradient(avatarSeed({ email: user?.email })),
            )}
          >
            {user?.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt=""
                className="size-full object-cover"
              />
            ) : (
              emailInitial(user?.displayName || user?.email || "?")
            )}
          </span>
          <span className="min-w-0 flex-1 truncate">
            {user?.displayName || user?.email || "Account"}
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
    </>
  );
}
