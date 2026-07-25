import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Plus, Settings, LogOut, Kanban } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const mockBoards = [
  { id: "1", name: "Product Launch", color: "#4f46e5" },
  { id: "2", name: "Design Sprint", color: "#0ea5e9" },
  { id: "3", name: "Bug Tracker", color: "#ef4444" },
  { id: "4", name: "Marketing Q3", color: "#10b981" },
  { id: "5", name: "Feature Requests", color: "#8b5cf6" },
];

interface SidebarProps {
  className?: string;
}

export function Sidebar({ className }: SidebarProps) {
  const { logout } = useAuth();

  return (
    <aside
      className={cn(
        "flex h-full w-64 flex-col border-r border-border bg-sidebar",
        className,
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 border-b border-border px-5 py-4">
        <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Kanban className="size-4" />
        </div>
        <span className="text-base font-semibold tracking-tight">
          Kanban Board
        </span>
      </div>

      {/* Board List */}
      <div className="flex-1 overflow-y-auto px-3 py-4">
        <div className="mb-2 flex items-center justify-between px-2">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Boards
          </span>
        </div>
        <nav className="space-y-0.5">
          {mockBoards.map((board) => (
            <button
              key={board.id}
              className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            >
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: board.color }}
              />
              <span className="truncate">{board.name}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Bottom Actions */}
      <div className="border-t border-border p-3 space-y-1">
        <Button variant="ghost" className="w-full justify-start gap-2 text-sm">
          <Plus className="size-4" />
          Create New Board
        </Button>
        <Button
          variant="ghost"
          className="w-full justify-start gap-2 text-sm text-muted-foreground"
        >
          <Settings className="size-4" />
          Settings
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
