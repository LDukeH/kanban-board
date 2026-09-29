import type { ReactNode } from "react";
import { AlertCircle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type InlineAlertTone = "error" | "info";

interface InlineAlertProps {
  /** The message shown next to the tone icon. */
  message: string;
  /** `error` for failed actions, `info` for guidance (default: `error`). */
  tone?: InlineAlertTone;
  /** When provided, renders a dismiss button that calls this callback. */
  onDismiss?: () => void;
  className?: string;
  /** Extra content rendered under the message (lists, retry buttons…). */
  children?: ReactNode;
}

/** In-place feedback owned by the triggering surface; error tone announces assertively via `role="alert"`, info politely. */
export function InlineAlert({
  message,
  tone = "error",
  onDismiss,
  className,
  children,
}: InlineAlertProps) {
  const isError = tone === "error";
  const Icon = isError ? AlertCircle : Info;

  return (
    <div
      role={isError ? "alert" : "status"}
      className={cn(
        "rounded-lg border px-3 py-2",
        isError
          ? "border-destructive/40 bg-destructive/10"
          : "border-border bg-muted",
        className,
      )}
    >
      <div className="flex items-start gap-2">
        <p
          className={cn(
            "flex min-w-0 flex-1 items-start gap-2 text-sm font-medium",
            isError ? "text-destructive" : "text-foreground",
          )}
        >
          <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span className="min-w-0 break-words">{message}</span>
        </p>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss message"
            className={cn(
              "shrink-0 rounded-md p-0.5 transition-colors",
              isError
                ? "text-destructive/70 hover:bg-destructive/10 hover:text-destructive"
                : "text-muted-foreground hover:bg-background hover:text-foreground",
            )}
          >
            <X className="size-4" aria-hidden />
          </button>
        )}
      </div>
      {children}
    </div>
  );
}