import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Search, Plus, Bell } from "lucide-react";

interface DashboardHeaderProps {
  className?: string;
}

export function DashboardHeader({ className }: DashboardHeaderProps) {
  return (
    <header
      className={cn(
        "flex items-center justify-between border-b border-border bg-background px-6 py-3",
        className,
      )}
    >
      {/* Left: Title */}
      <div>
        <h1 className="text-lg font-semibold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Welcome back! Here are your boards.
        </p>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-3">
        {/* Search Input (visual only) */}
        <div className="relative hidden sm:block">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search boards..."
            className="h-8 w-48 rounded-lg border border-border bg-muted pl-8 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50"
            readOnly
          />
        </div>

        {/* New Board Button (visual only) */}
        <Button variant="default" size="sm" className="gap-1.5">
          <Plus className="size-4" />
          <span className="hidden sm:inline">New Board</span>
        </Button>

        {/* Notifications Bell (visual only) */}
        <button className="relative flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
          <Bell className="size-4" />
          <span className="absolute right-2 top-2 size-1.5 rounded-full bg-destructive" />
        </button>

        {/* User Avatar Placeholder */}
        <div className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
          JD
        </div>
      </div>
    </header>
  );
}
