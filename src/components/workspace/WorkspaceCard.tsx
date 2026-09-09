import { cn } from "@/lib/utils";
import { getGradient } from "@/lib/colors";
import { Users, LayoutGrid, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import type { Workspace } from "@/types/workspace";
import { EditWorkspaceDialog } from "@/components/dialog/EditWorkspaceDialog";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useWorkspaces } from "@/hooks/useWorkspaces";
import { useState } from "react";

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
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <div
      className={cn(
        "group relative cursor-pointer overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-md",
        className,
      )}
    >
      {/* Identity band */}
      <div
        className={cn(
          "flex h-16 items-center justify-between bg-gradient-to-br px-4",
          gradient,
        )}
      >
        <span className="flex size-9 items-center justify-center rounded-lg bg-white/25 text-base font-bold text-white backdrop-blur-sm">
          {workspace.name.charAt(0).toUpperCase()}
        </span>

        {(canEdit || canDelete) && (
          <div onClick={(e) => e.stopPropagation()}>
            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label={`Actions for ${workspace.name}`}
                className="flex size-8 cursor-pointer items-center justify-center rounded-lg bg-black/20 text-white transition-colors hover:bg-black/30"
              >
                <MoreHorizontal className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {canEdit && (
                  <DropdownMenuItem
                    onClick={() => setEditOpen(true)}
                    className="cursor-pointer"
                  >
                    <Pencil />
                    Edit workspace
                  </DropdownMenuItem>
                )}
                {canDelete && (
                  <>
                    {canEdit && <DropdownMenuSeparator />}
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => setDeleteOpen(true)}
                      className="cursor-pointer"
                    >
                      <Trash2 />
                      Delete workspace
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="px-4 py-5">
        <h3 className="truncate text-sm font-semibold text-foreground">
          {workspace.name}
        </h3>
        {workspace.description && (
          <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
            {workspace.description}
          </p>
        )}

        {/* Meta Info */}
        {(typeof memberCount === "number" || typeof boardCount === "number") && (
          <div className="mt-3 flex items-center gap-4">
            {typeof memberCount === "number" && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Users className="size-3.5" />
                <span>{memberCount} members</span>
              </div>
            )}
            {typeof boardCount === "number" && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <LayoutGrid className="size-3.5" />
                <span>{boardCount} boards</span>
              </div>
            )}
          </div>
        )}
      </div>

      {canEdit && (
        <EditWorkspaceDialog
          workspace={workspace}
          open={editOpen}
          onOpenChange={setEditOpen}
        />
      )}
      {canDelete && (
        <ConfirmDeleteDialog
          title="Delete Workspace"
          description={`Are you sure you want to delete "${workspace.name}"? This will permanently delete all boards, columns, and tasks within this workspace.`}
          onConfirm={() => deleteWorkspace(workspace.id)}
          isLoading={isDeleting}
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
        />
      )}
    </div>
  );
}
