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

/** A static, frontend-owned board preset. */
export interface BoardTemplate {
  id: string;
  name: string;
  description: string;
  columns: BoardTemplateColumn[];
  labels: BoardTemplateLabel[];
}

/** Exactly what a materialisation created. */
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
