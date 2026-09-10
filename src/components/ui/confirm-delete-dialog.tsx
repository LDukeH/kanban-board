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
import { toast } from "react-toastify";

interface ConfirmDeleteDialogProps {
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  successMessage?: string;
  onConfirm: () => Promise<void>;
  isLoading?: boolean;
  trigger?: ReactElement;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function ConfirmDeleteDialog({
  title,
  description,
  confirmText = "Delete",
  cancelText = "Cancel",
  successMessage,
  onConfirm,
  isLoading = false,
  trigger,
  open: controlledOpen,
  onOpenChange: setControlledOpen,
}: ConfirmDeleteDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;

  const handleOpenChange = (nextOpen: boolean) => {
    if (isControlled) {
      setControlledOpen?.(nextOpen);
    } else {
      setInternalOpen(nextOpen);
    }
  };

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault();
    try {
      await onConfirm();
      handleOpenChange(false);
      if (successMessage) {
        toast.success(successMessage);
      }
    } catch (err) {
      toast.error("Failed to delete. Please try again.");
      console.error("Delete failed:", err);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {trigger && <DialogTrigger render={trigger} />}
      <DialogPopup>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
        <form onSubmit={handleConfirm} className="mt-4 flex flex-col gap-4">
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
