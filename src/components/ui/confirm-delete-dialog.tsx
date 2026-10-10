import { useState, type ReactElement } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogTrigger,
  DialogPopup,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { InlineAlert } from "@/components/ui/inline-alert";
import { describeMutationError, reportMutationError } from "@/lib/httpStatus";

interface ConfirmDeleteDialogProps {
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => Promise<void>;
  isLoading?: boolean;
  trigger?: ReactElement;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  requiredConfirmation?: string;
  confirmationLabel?: string;
}

export function ConfirmDeleteDialog({
  title,
  description,
  confirmText = "Delete",
  cancelText = "Cancel",
  onConfirm,
  isLoading = false,
  trigger,
  open: controlledOpen,
  onOpenChange: setControlledOpen,
  requiredConfirmation,
  confirmationLabel = "Type the confirmation text to continue.",
}: ConfirmDeleteDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  // A failed delete keeps the dialog open and reports inline so the user can
  // retry without losing the confirmation context.
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState("");

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setError(null);
      setConfirmation("");
    }
    if (isControlled) {
      setControlledOpen?.(nextOpen);
    } else {
      setInternalOpen(nextOpen);
    }
  };

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (requiredConfirmation && confirmation !== requiredConfirmation) {
      setError(`Enter "${requiredConfirmation}" exactly to confirm.`);
      return;
    }
    try {
      await onConfirm();
      handleOpenChange(false);
    } catch (err) {
      setError(
        describeMutationError(err, "Failed to delete. Please try again."),
      );
      reportMutationError("Delete failed", err);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {trigger && <DialogTrigger render={trigger} />}
      <DialogPopup>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
        <form onSubmit={handleConfirm} className="mt-4 flex flex-col gap-4">
          {error && <InlineAlert message={error} />}
          {requiredConfirmation && (
            <label className="text-sm font-medium">
              {confirmationLabel}
              <Input
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                className="mt-1"
                autoComplete="off"
              />
            </label>
          )}
          <div className="flex justify-end gap-2">
            <DialogClose render={<Button variant="ghost" />}>
              {cancelText}
            </DialogClose>
            <Button type="submit" variant="destructive" disabled={isLoading}>
              {isLoading && <Loader2 className="size-4 animate-spin" />}
              {confirmText}
            </Button>
          </div>
        </form>
      </DialogPopup>
    </Dialog>
  );
}
