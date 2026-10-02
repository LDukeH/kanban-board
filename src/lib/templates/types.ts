import type { Board, Column, Label } from "@/types/board";

/** One column a template asks for. `position` is assigned server-side in creation order. */
export interface BoardTemplateColumn {
  name: string;
}

export interface BoardTemplateLabel {
  name: string;
  /** Hex colour from `LABEL_COLORS` (src/lib/colors.ts), or "" for no colour. */
  color: string;
}

/**
 * A static, frontend-owned board preset.
 *
 * The backend has no template resource (see Feature 4 in docs/plan/plan.md), so a
 * template only describes the shape of the board it creates. It is materialised
 * through the ordinary board/column/label endpoints — never through a template
 * payload the server would understand.
 */
export interface BoardTemplate {
  id: string;
  name: string;
  description: string;
  columns: BoardTemplateColumn[];
  labels: BoardTemplateLabel[];
}

/**
 * Exactly what a materialisation created. Board creation either succeeds (and
 * this is returned) or throws; column and label failures are collected rather
 * than thrown, so the caller can tell the user what exists instead of leaving
 * them guessing after a partial failure.
 */
export interface TemplateMaterializeResult {
  board: Board;
  createdColumns: Column[];
  /** Template column names that failed to create, in template order. */
  failedColumns: string[];
  createdLabels: Label[];
  /** Template label names that failed to create, in template order. */
  failedLabels: string[];
}

export interface TemplateOutcome {
  /** True only when every column and label the template asked for was created. */
  complete: boolean;
  /** Human-readable summary of what now exists on the server. */
  message: string;
}
