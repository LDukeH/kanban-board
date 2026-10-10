import { cn } from "@/lib/utils";
import { getLabelContrastText } from "@/lib/colors";
import type { Label } from "@/types/board";

interface LabelBadgeProps {
  label: Label;
  className?: string;
}

export function LabelBadge({ label, className }: LabelBadgeProps) {
  const hasColor = !!label.color;
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1 truncate rounded px-2 py-0.5 text-xs font-semibold leading-tight",
        !hasColor &&
          "border border-border bg-muted text-muted-foreground dark:bg-muted/50",
        className,
      )}
      style={
        hasColor
          ? { backgroundColor: label.color, color: getLabelContrastText(label.color) }
          : undefined
      }
      title={label.name}
    >
      <span className="min-w-0 truncate">{label.name}</span>
    </span>
  );
}
