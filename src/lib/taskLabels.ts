import type { Label } from "@/types/board";

/** Max label chips shown on a task card; the rest collapse into a "+N" chip. Cards are narrow, so 2 keeps one line. */
export const MAX_VISIBLE_TASK_LABELS = 2;

/** Splits a task's labels into visible chips and overflow hidden behind "+N". */
export function splitTaskLabels(labels: Label[]): {
  visible: Label[];
  hidden: Label[];
} {
  return {
    visible: labels.slice(0, MAX_VISIBLE_TASK_LABELS),
    hidden: labels.slice(MAX_VISIBLE_TASK_LABELS),
  };
}
