import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { InlineAlert } from "@/components/ui/inline-alert";
import { describeLoadError } from "@/lib/httpStatus";
import { cn } from "@/lib/utils";
import { usePersistentFlag } from "@/hooks/usePersistentFlag";
import { emailInitial, avatarGradient, avatarSeed } from "@/lib/memberDisplay";
import type { TaskSummary } from "@/lib/summary";
import { BarChart3, ChevronDown, Info, Loader2 } from "lucide-react";

/** Caps the workload list so a workspace with many members cannot stretch the summary. */
const MAX_WORKLOAD_ROWS = 5;

/** One breakdown row: a column on a board, or a board in a workspace. */
export interface ProgressRow {
  id: string;
  label: string;
  total: number;
  completed: number;
  /** When set, the row links to that destination (workspace boards -> board page). */
  href?: string;
}

interface ProgressSummaryProps {
  /** Human label for the surface, e.g. "Board progress". */
  heading: string;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  onRetry: () => void;
  /** Roll-up numbers; undefined while loading. */
  totals?: TaskSummary;
  /** Per-column (board) or per-board (workspace) rows, in display order. */
  rows?: ProgressRow[];
  /** localStorage key backing the expanded/collapsed disclosure (default collapsed). */
  storageKey: string;
  className?: string;
}

function percent(completed: number, total: number): number {
  return total === 0 ? 0 : Math.round((completed / total) * 100);
}

type StatTone = "neutral" | "danger" | "warning";

/** Inline stat chip: the value and label carry the meaning, so colour is never the only signal. */
function StatChip({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number;
  tone?: StatTone;
}) {
  const active = value > 0;
  const toneClass: Record<StatTone, string> = {
    neutral: "text-foreground",
    danger: "border-danger/30 bg-danger/10 text-danger",
    warning: "border-warning/30 bg-warning/10 text-warning",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-control border border-border px-2 py-1 text-xs",
        active ? toneClass[tone] : "text-muted-foreground",
      )}
    >
      <span className="font-semibold tabular-nums">{value}</span>
      {label}
    </span>
  );
}

/** Slim progress track; the numeric readout beside it is the accessible value. */
function Bar({ value, className }: { value: number; className?: string }) {
  return (
    <span
      className={cn("h-2 overflow-hidden rounded-full bg-muted", className)}
      aria-hidden
    >
      <span
        className="block h-full rounded-full bg-primary"
        style={{ width: `${value}%` }}
      />
    </span>
  );
}

/** Compact progress/workload summary (Feature 5), shared by the board and workspace pages. */
export function ProgressSummary({
  heading,
  isLoading,
  isError,
  error,
  onRetry,
  totals,
  rows = [],
  storageKey,
  className,
}: ProgressSummaryProps) {
  const { value: expanded, toggle } = usePersistentFlag(storageKey, false);

  if (isLoading) {
    return (
      <div
        role="status"
        aria-label={`Loading ${heading.toLowerCase()}`}
        className={cn(
          "flex items-center gap-2 rounded-card border border-border bg-card px-3 py-2.5 text-muted-foreground",
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
          "flex items-center gap-3 rounded-card border border-border bg-card px-3 py-2.5",
          className,
        )}
      >
        <BarChart3 className="size-4 text-muted-foreground" aria-hidden />
        <p className="text-sm text-muted-foreground">
          No tasks to summarise yet.
        </p>
      </div>
    );
  }

  const overall = percent(totals.completed, totals.total);

  return (
    <section
      aria-label={heading}
      className={cn(
        "rounded-card border border-border bg-card px-3 py-2",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <StatChip label="Tasks" value={totals.total} />
        <StatChip label="Completed" value={totals.completed} />
        <StatChip label="Overdue" value={totals.overdue} tone="danger" />
        <StatChip label="Unassigned" value={totals.unassigned} tone="warning" />

        <div className="flex min-w-[140px] flex-1 items-center gap-2">
          <Bar value={overall} className="flex-1" />
          <span className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
            {overall}%
          </span>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={toggle}
          aria-expanded={expanded}
          className="gap-1.5"
        >
          <ChevronDown
            className={cn(
              "size-3.5 transition-transform",
              expanded && "rotate-180",
            )}
            aria-hidden
          />
          Details
        </Button>
      </div>

      {expanded && (
        <div className="mt-2 border-t border-border pt-2">
          {rows.length > 0 && (
            <ul className="flex flex-col gap-1">
              {rows.map((row) => {
                const rowPercent = percent(row.completed, row.total);
                const content = (
                  <>
                    <span
                      className="w-28 shrink-0 truncate text-xs text-muted-foreground sm:w-40"
                      title={row.label}
                    >
                      {row.label}
                    </span>
                    <Bar value={rowPercent} className="min-w-0 flex-1" />
                    <span className="w-24 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                      {row.completed}/{row.total} · {rowPercent}%
                    </span>
                  </>
                );

                return (
                  <li key={row.id}>
                    {row.href ? (
                      <Link
                        to={row.href}
                        className="flex items-center gap-2 rounded-control px-1 py-0.5 outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {content}
                      </Link>
                    ) : (
                      <div className="flex items-center gap-2 px-1 py-0.5">
                        {content}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {totals.byAssignee.length > 0 && (
            <div className="mt-2 border-t border-border pt-2">
              <p className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Workload by assignee
                <span
                  className="inline-flex cursor-help"
                  title="Computed in your browser from loaded tasks."
                  aria-label="Computed in your browser from loaded tasks."
                >
                  <Info className="size-3" aria-hidden />
                </span>
              </p>
              <ul className="mt-1.5 flex flex-col gap-1.5">
                {totals.byAssignee.slice(0, MAX_WORKLOAD_ROWS).map((entry) => {
                  const localPart = entry.email.split("@")[0] || entry.email;
                  const entryPercent = percent(entry.completed, entry.total);
                  return (
                    <li
                      key={entry.email}
                      className="flex items-center gap-2 text-xs"
                    >
                      <span
                        className={cn(
                          "flex size-5 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-xs font-semibold text-white",
                          avatarGradient(avatarSeed({ email: entry.email })),
                        )}
                        aria-hidden
                      >
                        {emailInitial(entry.email)}
                      </span>
                      <span
                        className="w-28 shrink-0 truncate text-foreground sm:w-40"
                        title={entry.email}
                      >
                        {localPart}
                      </span>
                      <Bar value={entryPercent} className="min-w-0 flex-1" />
                      <span className="w-24 shrink-0 text-right tabular-nums text-muted-foreground">
                        {entry.completed}/{entry.total} done
                      </span>
                    </li>
                  );
                })}
                {totals.byAssignee.length > MAX_WORKLOAD_ROWS && (
                  <li className="text-xs text-muted-foreground">
                    +{totals.byAssignee.length - MAX_WORKLOAD_ROWS} more
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

