import { Button } from "@/components/ui/button";
import { InlineAlert } from "@/components/ui/inline-alert";
import { describeLoadError } from "@/lib/httpStatus";
import { cn } from "@/lib/utils";
import type { SummaryBucket, TaskSummary } from "@/lib/summary";
import { Loader2, BarChart3 } from "lucide-react";

/** Caps the workload list so a workspace with many members cannot stretch the summary. */
const MAX_WORKLOAD_ROWS = 5;

interface ProgressSummaryProps {
  heading: string;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  onRetry: () => void;
  /** Roll-up numbers; undefined while loading. */
  totals?: TaskSummary;
  /** Per-column (board) or per-board (workspace) rows, in display order. */
  breakdown?: SummaryBucket[];
  /** States plainly that the numbers are computed in the client. */
  note?: string;
  className?: string;
}

function Stat({
  label,
  value,
  alert = false,
}: {
  label: string;
  value: number;
  alert?: boolean;
}) {
  return (
    <div className="rounded-lg bg-muted/60 px-3 py-2">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      {/* The label carries the meaning, so the colour is never the only signal. */}
      <p
        className={cn(
          "text-lg leading-tight font-semibold tabular-nums",
          alert && value > 0 && "text-destructive",
        )}
      >
        {value}
      </p>
    </div>
  );
}

/**
 * Compact progress/workload roll-up (Feature 5).
 *
 * Owns its own loading, error and empty states so it never blocks the surface
 * it sits on, and renders the numbers as text alongside any bar so they are
 * readable without relying on colour.
 */
export function ProgressSummary({
  heading,
  isLoading,
  isError,
  error,
  onRetry,
  totals,
  breakdown = [],
  note,
  className,
}: ProgressSummaryProps) {
  if (isLoading) {
    return (
      <div
        role="status"
        aria-label={`Loading ${heading.toLowerCase()}`}
        className={cn(
          "flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-4 text-muted-foreground",
          className,
        )}
      >
        <Loader2 className="size-4 animate-spin" aria-hidden />
        <span className="text-sm">Loading {heading.toLowerCase()}…</span>
      </div>
    );
  }

  if (isError) {
    return (
      <InlineAlert
        message={`Could not load ${heading.toLowerCase()}. ${describeLoadError(error)}`}
        className={className}
      >
        <div className="mt-2">
          <Button variant="outline" size="sm" onClick={onRetry}>
            Retry
          </Button>
        </div>
      </InlineAlert>
    );
  }

  if (!totals || totals.total === 0) {
    return (
      <div
        className={cn(
          "flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-4",
          className,
        )}
      >
        <BarChart3 className="size-4 text-muted-foreground" aria-hidden />
        <div>
          <p className="text-sm font-medium text-foreground">
            Nothing to summarise yet
          </p>
          <p className="text-xs text-muted-foreground">
            This view has no tasks.
          </p>
        </div>
      </div>
    );
  }

  return (
    <section
      aria-label={heading}
      className={cn(
        "rounded-xl border border-border bg-card px-4 py-3",
        className,
      )}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground">{heading}</h2>
        {note && <span className="text-[11px] text-muted-foreground">{note}</span>}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Tasks" value={totals.total} />
        <Stat label="Completed" value={totals.completed} />
        <Stat label="Overdue" value={totals.overdue} alert />
        <Stat label="Unassigned" value={totals.unassigned} />
      </div>

      {breakdown.length > 0 && (
        <div className="mt-3 flex flex-col gap-1.5">
          {breakdown.map((row) => {
            const percent =
              row.total === 0 ? 0 : Math.round((row.completed / row.total) * 100);
            return (
              <div key={row.id} className="flex items-center gap-2">
                <span
                  className="w-24 shrink-0 truncate text-xs text-muted-foreground sm:w-36"
                  title={row.label}
                >
                  {row.label}
                </span>
                <span
                  className="h-2 flex-1 overflow-hidden rounded-full bg-muted"
                  aria-hidden
                >
                  <span
                    className="block h-full rounded-full bg-primary"
                    style={{ width: `${percent}%` }}
                  />
                </span>
                <span className="w-16 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                  {row.completed}/{row.total}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {totals.byAssignee.length > 0 && (
        <div className="mt-3 border-t border-border pt-2">
          <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            Workload by assignee
          </p>
          <ul className="mt-1 flex flex-col gap-1">
            {totals.byAssignee.slice(0, MAX_WORKLOAD_ROWS).map((entry) => (
              <li
                key={entry.email}
                className="flex items-baseline justify-between gap-3 text-xs"
              >
                <span className="min-w-0 truncate text-foreground" title={entry.email}>
                  {entry.email}
                </span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {entry.completed}/{entry.total} done
                </span>
              </li>
            ))}
            {totals.byAssignee.length > MAX_WORKLOAD_ROWS && (
              <li className="text-xs text-muted-foreground">
                +{totals.byAssignee.length - MAX_WORKLOAD_ROWS} more
              </li>
            )}
          </ul>
        </div>
      )}
    </section>
  );
}
