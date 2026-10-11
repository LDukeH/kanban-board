import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogTrigger,
  DialogPopup,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Check, LayoutTemplate, Loader2 } from "lucide-react";
import { describeMutationError } from "@/lib/httpStatus";
import { useBoardTemplates } from "@/hooks/useBoardTemplates";
import {
  BOARD_TEMPLATES,
  describeTemplateOutcome,
  getBoardTemplate,
  type BoardTemplate,
  type TemplateOutcome,
} from "@/lib/templates";
import { cn } from "@/lib/utils";

interface CreateBoardFromTemplateDialogProps {
  workspaceId: string;
  trigger?: React.ReactElement;
}

const FIRST_TEMPLATE: BoardTemplate | undefined = BOARD_TEMPLATES[0];

/** Board creation from a static preset (Feature 4). */
export function CreateBoardFromTemplateDialog({
  workspaceId,
  trigger,
}: CreateBoardFromTemplateDialogProps) {
  const { createBoardFromTemplate, isCreatingFromTemplate } =
    useBoardTemplates(workspaceId);

  const [open, setOpen] = useState(false);
  // Defaults are optional so an empty preset list degrades to an explicit "no templates" state instead of crashing on BOARD_TEMPLATES[0].
  const [selectedId, setSelectedId] = useState<string>(
    FIRST_TEMPLATE?.id ?? "",
  );
  const [name, setName] = useState(FIRST_TEMPLATE?.name ?? "");
  const [description, setDescription] = useState(
    FIRST_TEMPLATE?.description ?? "",
  );
  const [error, setError] = useState<string | null>(null);
  // Set only when the board was created but some template rows were not; the dialog then stays open so the outcome cannot be missed.
  const [outcome, setOutcome] = useState<TemplateOutcome | null>(null);

  const selected = getBoardTemplate(selectedId) ?? FIRST_TEMPLATE;

  function reset() {
    setSelectedId(FIRST_TEMPLATE?.id ?? "");
    setName(FIRST_TEMPLATE?.name ?? "");
    setDescription(FIRST_TEMPLATE?.description ?? "");
    setError(null);
    setOutcome(null);
  }

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) reset();
    setOpen(nextOpen);
  }

  function selectTemplate(next: BoardTemplate) {
    const previous = getBoardTemplate(selectedId);
    // Carry the user's typed values across a switch, but swap any value that still matches the previous template's default for the new template's.
    setName((current) =>
      previous && current === previous.name ? next.name : current,
    );
    setDescription((current) =>
      previous && current === previous.description ? next.description : current,
    );
    setSelectedId(next.id);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) {
      setError("Choose a template to start from.");
      return;
    }
    if (!name.trim()) {
      setError("Board name is required.");
      return;
    }
    setError(null);
    try {
      const result = await createBoardFromTemplate({
        template: selected,
        name: name.trim(),
        description: description.trim() || undefined,
      });
      const nextOutcome = describeTemplateOutcome(result);
      if (nextOutcome.complete) {
        setOpen(false);
        return;
      }
      setOutcome(nextOutcome);
    } catch (err) {
      // materializeBoardTemplate only rejects when createBoard rejects, which happens before any column or label call — so nothing was created. describeMutationError keeps 401/403/404 and network failures distinct.
      setError(describeMutationError(err, "Failed to create board."));
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          trigger ?? (
            <Button>
              <LayoutTemplate />
              New Board from Template
            </Button>
          )
        }
      />
      {/* Cap the height and scroll the body: the template list makes this dialog tall, and without a bound it would touch the top/bottom of the viewport. */}
      <DialogPopup className="mt-4 flex max-h-[min(75vh,36rem)] flex-col overflow-hidden">
        <DialogTitle>Create Board from Template</DialogTitle>
        <DialogDescription>
          Start from a ready-made workflow. Columns and labels are created on
          the new board for you.
        </DialogDescription>

        <form
          onSubmit={handleSubmit}
          className="mt-4 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain pr-1"
        >
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium" id="template-picker-label">
              Template
            </span>
            <div
              role="group"
              aria-labelledby="template-picker-label"
              className="flex flex-col gap-2"
            >
              {BOARD_TEMPLATES.length === 0 && (
                <p className="rounded-lg border border-border bg-muted px-3 py-4 text-center text-sm text-muted-foreground">
                  No board templates are available right now. Use “Create New
                  Board” to start from scratch instead.
                </p>
              )}
              {BOARD_TEMPLATES.map((template) => {
                const isSelected = template.id === selectedId;
                return (
                  <button
                    key={template.id}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => selectTemplate(template)}
                    className={cn(
                      "rounded-lg border p-3 text-left transition-colors",
                      isSelected
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50",
                    )}
                  >
                    <span className="flex items-start justify-between gap-2">
                      <span className="text-sm font-semibold">
                        {template.name}
                      </span>
                      {isSelected && (
                        <Check
                          className="mt-0.5 size-4 shrink-0 text-primary"
                          aria-hidden
                        />
                      )}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {template.description}
                    </span>
                    <span className="mt-2 block text-[11px] text-muted-foreground">
                      {template.columns.length} columns ·{" "}
                      {template.labels.length} labels
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">Columns</span>
            <div className="flex flex-wrap gap-1.5">
              {(selected?.columns ?? []).map((column) => (
                <span
                  key={column.name}
                  className="rounded-md border border-border bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                >
                  {column.name}
                </span>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="template-board-name">Name</Label>
            <Input
              id="template-board-name"
              placeholder="e.g. Product Launch"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="template-board-description">
              Description (optional)
            </Label>
            <Textarea
              id="template-board-description"
              placeholder="What is this board for?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          {outcome && !outcome.complete && (
            <InlineAlert message={outcome.message} tone="error" />
          )}
          {error && <p className="text-xs text-red-500">{error}</p>}

          <div className="flex justify-end gap-2">
            {outcome && !outcome.complete ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setOutcome(null);
                  setOpen(false);
                }}
              >
                Close
              </Button>
            ) : (
              <>
                <DialogClose render={<Button variant="ghost" />}>
                  Cancel
                </DialogClose>
                <Button
                  type="submit"
                  disabled={isCreatingFromTemplate || !selected}
                >
                  {isCreatingFromTemplate && (
                    <Loader2 className="size-4 animate-spin" />
                  )}
                  Create
                </Button>
              </>
            )}
          </div>
        </form>
      </DialogPopup>
    </Dialog>
  );
}
