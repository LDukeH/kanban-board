import { cn } from "@/lib/utils";
import { getGradient } from "@/lib/colors";
import { Users, LayoutGrid, Trash2 } from "lucide-react";
import type { Workspace } from "@/types/workspace";
import { EditWorkspaceDialog } from "@/components/workspace/EditWorkspaceDialog";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import { Button } from "@/components/ui/button";
import { useWorkspaces } from "@/hooks/useWorkspaces";

interface WorkspaceCardProps {
  workspace: Workspace;
  memberCount?: number;
  boardCount?: number;
  canEdit?: boolean;
  canDelete?: boolean;
  className?: string;
}

export function WorkspaceCard({
  workspace,
  memberCount,
  boardCount,
  canEdit = false,
  canDelete = false,
  className,
}: WorkspaceCardProps) {
  const gradient = getGradient(workspace.id);
  const { deleteWorkspace, isDeleting } = useWorkspaces();

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
        <div className="flex items-center gap-1">
          {canEdit && (
            <div onClick={(e) => e.stopPropagation()}>
              <EditWorkspaceDialog workspace={workspace} />
            </div>
          )}
          {canDelete && (
            <div onClick={(e) => e.stopPropagation()}>
              <ConfirmDeleteDialog
                title="Delete Workspace"
                description={`Are you sure you want to delete "${workspace.name}"? This will permanently delete all boards, columns, and tasks within this workspace.`}
                onConfirm={() => deleteWorkspace(workspace.id)}
                isLoading={isDeleting}
                trigger={
                  <Button variant="ghost" size="icon-xs" className="text-white">
                    <Trash2 className="size-3" />
                  </Button>
                }
              />
            </div>
          )}
          <span className="flex size-8 items-center justify-center rounded-lg bg-white/20 text-sm font-bold text-white backdrop-blur-sm">
            {workspace.name.charAt(0).toUpperCase()}
          </span>
        </div>
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
