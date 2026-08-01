import { cn } from "@/lib/utils";
import { getGradient } from "@/lib/colors";
import { Users, LayoutGrid } from "lucide-react";
import type { Workspace } from "@/types/workspace";

interface WorkspaceCardProps {
  workspace: Workspace;
  memberCount?: number;
  boardCount?: number;
  className?: string;
}

export function WorkspaceCard({
  workspace,
  memberCount,
  boardCount,
  className,
}: WorkspaceCardProps) {
  const gradient = getGradient(workspace.id);

  return (
    <div
      className={cn(
        "group relative cursor-pointer overflow-hidden rounded-xl bg-gradient-to-br shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lg",
        gradient,
        className,
      )}
    >
      {/* Decorative top area */}
      <div className="flex h-24 items-start justify-end p-3">
        <span className="flex size-8 items-center justify-center rounded-lg bg-white/20 text-sm font-bold text-white backdrop-blur-sm">
          {workspace.name.charAt(0).toUpperCase()}
        </span>
      </div>

      {/* Footer with workspace name */}
      <div className="bg-black/25 px-4 py-3 backdrop-blur-sm">
        <h3 className="truncate text-sm font-semibold text-white">
          {workspace.name}
        </h3>
        {workspace.description && (
          <p className="mt-0.5 line-clamp-1 text-xs text-white/80">
            {workspace.description}
          </p>
        )}

        {/* Meta Info */}
        <div className="mt-2 flex items-center gap-4">
          {typeof memberCount === "number" && (
            <div className="flex items-center gap-1.5 text-xs text-white/85">
              <Users className="size-3.5" />
              <span>{memberCount} members</span>
            </div>
          )}
          {typeof boardCount === "number" && (
            <div className="flex items-center gap-1.5 text-xs text-white/85">
              <LayoutGrid className="size-3.5" />
              <span>{boardCount} boards</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
