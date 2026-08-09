import { cn } from "@/lib/utils";
import type { Label } from "@/types/board";

interface LabelBadgeProps {
  label: Label;
  className?: string;
}

/**
 * Compact colored badge used to display a Label (board list + task cards).
 * Falls back to a muted outlined pill when the label has no color.
 */
export function LabelBadge({ label, className }: LabelBadgeProps) {
  const hasColor = !!label.color;
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1 truncate rounded px-2 py-0.5 text-xs font-semibold leading-tight",
        hasColor
          ? "text-white"
          : "border border-border bg-muted text-muted-foreground dark:bg-muted/50",
        className,
      )}
      style={hasColor ? { backgroundColor: label.color } : undefined}
      title={label.name}
    >
      <span className="min-w-0 truncate">{label.name}</span>
    </span>
  );
}
