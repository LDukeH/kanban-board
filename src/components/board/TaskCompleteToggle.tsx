import { cn } from "@/lib/utils";

interface TaskCompleteToggleProps {
  completed: boolean;
  taskTitle: string;
  onToggle: () => void;
  disabled?: boolean;
  className?: string;
}

/**
 * Radio-style completion circle shared by the task card and the task detail
 * dialog. Renders as a button (Space/Enter toggle by default), reports state
 * via aria-pressed, and never triggers the surrounding card/dialog open.
 */
export function TaskCompleteToggle({
  completed,
  taskTitle,
  onToggle,
  disabled = false,
  className,
}: TaskCompleteToggleProps) {
  return (
    <button
      type="button"
      aria-pressed={completed}
      disabled={disabled}
      title={
        completed
          ? `Mark "${taskTitle}" as incomplete`
          : `Mark "${taskTitle}" as completed`
      }
      aria-label={
        completed
          ? `Mark "${taskTitle}" as incomplete`
          : `Mark "${taskTitle}" as completed`
      }
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
      onPointerDown={(event) => {
        // Keep dnd-kit from treating the press as the start of a card drag.
        event.stopPropagation();
      }}
      onKeyDown={(event) => {
        // Space/Enter already activate a button; stop the card's key handlers.
        event.stopPropagation();
      }}
      className={cn(
        // Visual circle is 16px (checkbox-sized); the ::before hit area keeps the tap target at ~24px.
        "relative flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-full border-2 outline-none transition-colors",
        "before:absolute before:-inset-2 before:rounded-full before:content-['']",
        "hover:border-primary hover:bg-primary/10",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "disabled:cursor-not-allowed disabled:opacity-50",
        completed
          ? "border-primary bg-primary text-primary-foreground"
          : "border-muted-foreground/40 bg-transparent",
        className,
      )}
    >
      {completed && (
        <svg
          viewBox="0 0 12 12"
          className="size-2.5"
          fill="none"
          stroke="currentColor"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M2.5 6.2 4.8 8.5 9.5 3.5" />
        </svg>
      )}
    </button>
  );
}
