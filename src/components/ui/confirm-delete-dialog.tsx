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

interface ConfirmDeleteDialogProps {
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => Promise<void>;
  isLoading?: boolean;
  trigger: ReactElement;
}

/**
 * A reusable confirmation dialog for destructive delete actions.
 * Wraps the base-ui Dialog with a destructive confirm button.
 */
export function ConfirmDeleteDialog({
  title,
  description,
  confirmText = "Delete",
  cancelText = "Cancel",
  onConfirm,
  isLoading = false,
  trigger,
}: ConfirmDeleteDialogProps) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await onConfirm();
      setOpen(false);
    } catch (err) {
      setError("Failed to delete. Please try again.");
      console.error("Delete failed:", err);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogPopup>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
        <form onSubmit={handleConfirm} className="mt-4 flex flex-col gap-4">
          {error && <p className="text-xs text-red-500">{error}</p>}
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
