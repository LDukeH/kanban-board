import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogTrigger,
  DialogPopup,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlignLeft,
  Check,
  Circle,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import { useColumnTasks } from "@/hooks/useColumnTasks";
import { useBoard } from "@/hooks/useBoard";
import { useWorkspaceAccess } from "@/hooks/useWorkspaceAccess";
import { useAuth } from "@/hooks/useAuth";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import { InlineAlert } from "@/components/ui/inline-alert";
import { CreateLabelDialog } from "@/components/dialog/CreateLabelDialog";
import { EditTaskAssigneePicker } from "@/components/picker/EditTaskAssigneePicker";
import { TaskComments } from "@/components/task/TaskComments";
import { TaskDescriptionEditor } from "@/components/task/TaskDescriptionEditor";
import {
  descriptionsEqual,
  isEmptyDescription,
  isTaskDescriptionDoc,
  textToTaskDescription,
  type TaskDescription,
} from "@/lib/description";
import { describeMutationError } from "@/lib/httpStatus";
import type { Task } from "@/types/board";

interface EditTaskDialogProps {
  task: Task;
  boardId: string;
  canDelete?: boolean;
  trigger: React.ReactElement;
}
function normalizeSnapshotDescription(
  description: TaskDescription | string | undefined,
): TaskDescription | undefined {
  if (!description) return undefined;
  if (typeof description === "string") {
    return description.trim() ? textToTaskDescription(description) : undefined;
  }
  if (isTaskDescriptionDoc(description)) return description;
  return undefined;
}

function ActionButton({
  icon,
  label,
  onClick,
  disabled,
  title,
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="h-7 gap-1.5 px-2.5 text-xs font-medium"
    >
      {icon}
      {label}
    </Button>
  );
}

export function EditTaskDialog({
  task,
  boardId,
  canDelete = false,
  trigger,
}: EditTaskDialogProps) {
  const {
    updateTask,
    isUpdatingTask,
    addLabelToTask,
    removeLabelFromTask,
    deleteTask,
    isDeletingTask,
  } = useColumnTasks(boardId, task.columnId);
  const { board, columns, labels, isLoadingLabels } = useBoard(boardId);
  const { canAssignLabels, isOwner, isAdmin } = useWorkspaceAccess(board?.workspaceId);
  const { user } = useAuth();

  const columnName =
    columns.find((c) => c.id === task.columnId)?.name ?? "Task";

  // Single-draft save: one [Save] PATCHes title + description together; nothing persists until Save or flush-on-close.
  const savedTitle = task.title;
  const savedDescription = useMemo(
    () => normalizeSnapshotDescription(task.description),
    [task.description],
  );

  const [open, setOpen] = useState(false);
  const [draftTitle, setDraftTitle] = useState(task.title);
  const [draftDescription, setDraftDescription] = useState<TaskDescription | undefined>(
    () => normalizeSnapshotDescription(task.description),
  );
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingDescription, setEditingDescription] = useState(false);
  const [isMembersPickerOpen, setIsMembersPickerOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isLabelMenuOpen, setIsLabelMenuOpen] = useState(false);
  const [isCreateLabelOpen, setIsCreateLabelOpen] = useState(false);
  const [togglingLabelId, setTogglingLabelId] = useState<string | null>(null);
  // Save/label failures are reported in a banner under the header so the draft
  // stays visible and the reason the save did not happen is never lost.
  const [actionError, setActionError] = useState<string | null>(null);

  // Guards double submission and lets a close attempt await an in-flight
  // save (rapid close-while-saving re-enters the same flush path instead of
  // firing a second PATCH).
  const pendingSaveRef = useRef<Promise<boolean> | null>(null);

  const isDirty =
    draftTitle !== savedTitle ||
    !descriptionsEqual(draftDescription, savedDescription);

  const assignedLabelIds = useMemo(
    () => new Set((task.labels ?? []).map((l) => l.id)),
    [task.labels],
  );

  const previewEmpty = isEmptyDescription(draftDescription);

  function resetDraft() {
    setDraftTitle(savedTitle);
    setDraftDescription(savedDescription);
    setEditingTitle(false);
    setEditingDescription(false);
  }
  function handleOpenChange(
    nextOpen: boolean,
    eventDetails?: { cancel: () => void },
  ) {
    if (nextOpen) {
      setDraftTitle(task.title);
      setDraftDescription(normalizeSnapshotDescription(task.description));
      setEditingTitle(false);
      setEditingDescription(false);
      setIsMembersPickerOpen(false);
      setActionError(null);
      setOpen(nextOpen);
      return;
    }
    if (pendingSaveRef.current) {
      // Prevent the native close; a save is already in flight, so await it
      // and then close only on success.
      eventDetails?.cancel();
      void flushSaveAndClose();
      return;
    }
    if (isDirty) {
      // Prevent the native close (ESC / overlay / wrapper Close) and
      // flush-save first. On success we close for real; on failure the modal
      // stays open with the draft intact.
      eventDetails?.cancel();
      void flushSaveAndClose();
      return;
    }
    setOpen(nextOpen);
  }

  function saveDraft(): Promise<boolean> {
    if (pendingSaveRef.current) return pendingSaveRef.current;
    const run = (async () => {
      const title = draftTitle.trim();
      if (!title) {
        setActionError("Task title is required.");
        return false;
      }
      if (!isDirty) return true;
      setActionError(null);
      try {
        await updateTask({
          taskId: task.id,
          data: { title, description: draftDescription },
        });
        setEditingTitle(false);
        setEditingDescription(false);
        return true;
      } catch (err) {
        setActionError(
          describeMutationError(err, "Failed to update task. Please try again."),
        );
        console.error("Update task failed:", err);
        return false;
      }
    })();
    pendingSaveRef.current = run;
    void run.finally(() => {
      if (pendingSaveRef.current === run) pendingSaveRef.current = null;
    });
    return run;
  }

  async function handleSave() {
    await saveDraft();
  }

  function handleCancel() {
    resetDraft();
  }

  async function flushSaveAndClose() {
    const ok = await saveDraft();
    if (ok) {
      setOpen(false);
    }
  }


  async function handleToggleLabel(labelId: string) {
    setTogglingLabelId(labelId);
    setActionError(null);
    try {
      if (assignedLabelIds.has(labelId)) {
        await removeLabelFromTask({ taskId: task.id, labelId });
      } else {
        await addLabelToTask({ taskId: task.id, labelId });
      }
    } catch (err) {
      setActionError(
        describeMutationError(err, "Failed to update label. Please try again."),
      );
      console.error("Label toggle failed:", err);
    } finally {
      setTogglingLabelId(null);
    }
  }

  async function handleDelete() {
    try {
      await deleteTask(task.id);
      setIsDeleteOpen(false);
      setOpen(false);
    } catch (err) {
      // Re-throw so ConfirmDeleteDialog keeps the confirmation open and renders
      // its own inline error, instead of closing over a silent failure.
      console.error("Delete task failed:", err);
      throw err;
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={trigger} />
      <DialogPopup
        hideClose
        className="flex max-h-[min(88vh,56rem)] w-[min(56rem,calc(100vw-2rem))] max-w-4xl flex-col gap-0 overflow-hidden p-0"
      >
        <DialogTitle className="sr-only">{task.title}</DialogTitle>
        <DialogDescription className="sr-only">
          Task details, description, labels, members, and activity.
        </DialogDescription>

        <div className="flex shrink-0 items-center gap-2 border-b border-border px-5 py-3">
          <span
            className="inline-flex max-w-64 items-center truncate rounded-md bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground"
            title={`List: ${columnName}`}
          >
            {columnName}
          </span>
          <div className="ml-auto flex items-center gap-1">
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button type="button" variant="ghost" size="icon-sm" aria-label="More actions">
                    <MoreHorizontal className="size-4" />
                  </Button>
                }
              />
              <DropdownMenuContent align="end" className="w-48">
                {canDelete ? (
                  <DropdownMenuItem variant="destructive" onClick={() => setIsDeleteOpen(true)}>
                    <Trash2 className="size-3.5" />
                    Delete task
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem disabled>No actions available</DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Close"
              onClick={() => handleOpenChange(false)}
            >
              <X className="size-4" />
            </Button>
          </div>
        </div>

        {actionError && (
          <div className="shrink-0 px-5 pt-3">
            <InlineAlert
              message={actionError}
              onDismiss={() => setActionError(null)}
            />
          </div>
        )}

        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] md:overflow-hidden">
          <div className="min-w-0 px-5 py-4 md:overflow-y-auto">
            <div className="flex items-start gap-2.5">
              <Circle
                className="mt-1.5 size-5 shrink-0 text-muted-foreground/60"
                aria-label="Task status (display only)"
              />
              {editingTitle ? (
                <Input
                  value={draftTitle}
                  autoFocus
                  onChange={(e) => setDraftTitle(e.target.value)}
                  onBlur={() => setEditingTitle(false)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") setEditingTitle(false);
                    if (e.key === "Escape") {
                      setDraftTitle(savedTitle);
                      setEditingTitle(false);
                    }
                  }}
                  className="h-9 border-transparent px-1 text-xl font-bold shadow-none focus-visible:border-ring"
                  aria-label="Task title"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setEditingTitle(true)}
                  className="group flex min-w-0 flex-1 items-center gap-2 rounded-md px-1 py-0.5 text-left"
                  title="Click to edit title"
                >
                  <span className="min-w-0 flex-1 truncate text-xl font-bold tracking-tight">
                    {draftTitle || savedTitle}
                  </span>
                  <Pencil className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </button>
              )}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {board?.workspaceId ? (
                <EditTaskAssigneePicker
                  taskId={task.id}
                  workspaceId={board.workspaceId}
                  boardId={boardId}
                  columnId={task.columnId}
                  open={isMembersPickerOpen}
                  onOpenChange={setIsMembersPickerOpen}
                />
              ) : (
                <ActionButton
                  icon={<UserPlus className="size-3.5" />}
                  label="Members"
                  disabled
                  title="Members require a workspace"
                />
              )}
            </div>

            <div className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Labels
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                {(task.labels ?? []).map((label) => (
                  <span
                    key={label.id}
                    className="inline-flex h-6 items-center rounded-md px-2.5 text-xs font-medium text-white"
                    style={label.color ? { backgroundColor: label.color } : undefined}
                    title={label.name}
                  >
                    {label.name || " "}
                  </span>
                ))}
                {canAssignLabels && (
                  <DropdownMenu open={isLabelMenuOpen} onOpenChange={setIsLabelMenuOpen}>
                    <DropdownMenuTrigger
                      render={
                        <button
                          type="button"
                          className="flex size-6 items-center justify-center rounded-md bg-muted text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                          aria-label="Add label"
                          title="Add label"
                        >
                          <Plus className="size-3.5" />
                        </button>
                      }
                    />
                    <DropdownMenuContent align="start" className="w-64">
                    {isLoadingLabels ? (
                      <div className="flex justify-center py-3">
                        <Loader2 className="size-4 animate-spin text-muted-foreground" />
                      </div>
                    ) : labels.length === 0 ? (
                      <p className="px-2 py-2 text-xs text-muted-foreground">
                        No labels on this board yet.
                      </p>
                    ) : (
                      labels.map((label) => {
                        const assigned = assignedLabelIds.has(label.id);
                        const busy = togglingLabelId === label.id;
                        return (
                          <DropdownMenuItem
                            key={label.id}
                            disabled={busy}
                            onClick={() => handleToggleLabel(label.id)}
                            closeOnClick={false}
                            className="gap-2"
                          >
                            <span
                              className="size-3 shrink-0 rounded-full"
                              style={
                                label.color
                                  ? { backgroundColor: label.color }
                                  : undefined
                              }
                            />
                            <span className="min-w-0 flex-1 truncate">
                              {label.name}
                            </span>
                            {busy ? (
                              <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" />
                            ) : assigned ? (
                              <Check className="size-3.5 shrink-0 text-primary" />
                            ) : null}
                          </DropdownMenuItem>
                        );
                      })
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setIsCreateLabelOpen(true)}>
                      <Plus className="size-3.5" />
                      Create new label
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                )}
              </div>
            </div>

            <div className="mt-5">
              <div className="flex items-center gap-2">
                <AlignLeft className="size-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold">Description</h3>
              </div>
              <div className="mt-2">
                {!editingDescription && previewEmpty ? (
                  <button
                    type="button"
                    onClick={() => setEditingDescription(true)}
                    className="w-full rounded-lg bg-muted/60 px-3 py-2.5 text-left text-sm text-muted-foreground transition-colors hover:bg-muted"
                  >
                    Add a more detailed description…
                  </button>
                ) : (
                  <TaskDescriptionEditor
                    description={savedDescription}
                    draftDescription={draftDescription}
                    onDraftChange={setDraftDescription}
                    editing={editingDescription}
                    onEditingChange={setEditingDescription}
                  />
                )}
                {editingDescription && (
                  <div className="mt-2 flex items-center gap-2">
                    <Button type="button" size="sm" onClick={handleSave} disabled={isUpdatingTask}>
                      {isUpdatingTask && <Loader2 className="size-3.5 animate-spin" />}
                      Save
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onClick={handleCancel}>
                      Cancel
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {isDirty && !editingDescription && (
              <div className="mt-4 flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2">
                <p className="flex-1 text-xs text-muted-foreground">
                  You have unsaved changes.
                </p>
                <Button type="button" size="sm" onClick={handleSave} disabled={isUpdatingTask}>
                  {isUpdatingTask && <Loader2 className="size-3.5 animate-spin" />}
                  Save
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={handleCancel}>
                  Discard
                </Button>
              </div>
            )}
          </div>

          <aside className="min-w-0 border-t border-border bg-muted/30 px-5 py-4 md:overflow-y-auto md:border-l md:border-t-0">
            <TaskComments
              key={task.id}
              taskId={task.id}
              enabled={open}
              currentUserId={user?.id}
              currentUserEmail={user?.email ?? ""}
              canDeleteAnyComment={isOwner || isAdmin}
            />
          </aside>
        </div>
      </DialogPopup>
      <CreateLabelDialog
        boardId={boardId}
        open={isCreateLabelOpen}
        onOpenChange={setIsCreateLabelOpen}
      />
      {canDelete && (
        <ConfirmDeleteDialog
          open={isDeleteOpen}
          onOpenChange={setIsDeleteOpen}
          title="Delete Task"
          description={`Are you sure you want to delete "${task.title}"? This action cannot be undone.`}
          onConfirm={handleDelete}
          isLoading={isDeletingTask}
        />
      )}
    </Dialog>
  );
}
