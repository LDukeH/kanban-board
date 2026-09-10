import { cn } from "@/lib/utils";
import { LABEL_COLORS, LABEL_NO_COLOR } from "@/lib/colors";
import { X } from "lucide-react";

interface LabelColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  disabled?: boolean;
}

export function LabelColorPicker({
  value,
  onChange,
  disabled = false,
}: LabelColorPickerProps) {
  const current = value || LABEL_NO_COLOR;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {LABEL_COLORS.map((color) => {
        const selected = current === color;
        return (
          <button
            key={color}
            type="button"
            onClick={() => onChange(color)}
            disabled={disabled}
            className={cn(
              "size-7 shrink-0 rounded-md transition-transform hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
              selected && "ring-2 ring-ring ring-offset-1",
              disabled && "cursor-not-allowed opacity-50",
            )}
            style={{ backgroundColor: color }}
            aria-label={`Select color ${color}`}
            aria-pressed={selected}
          />
        );
      })}
      <button
        type="button"
        onClick={() => onChange(LABEL_NO_COLOR)}
        disabled={disabled}
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-md border border-dashed border-border text-muted-foreground transition-colors hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
          current === LABEL_NO_COLOR && "ring-2 ring-ring ring-offset-1",
          disabled && "cursor-not-allowed opacity-50",
        )}
        aria-label="No color"
        aria-pressed={current === LABEL_NO_COLOR}
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
