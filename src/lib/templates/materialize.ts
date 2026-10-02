import { createBoard } from "@/lib/api/board.api";
import { createColumn } from "@/lib/api/column.api";
import { createLabel } from "@/lib/api/label.api";
import type { Column, Label } from "@/types/board";
import type {
  BoardTemplate,
  TemplateMaterializeResult,
  TemplateOutcome,
} from "./types";

/**
 * Creates a board from a template using only existing endpoints:
 *
 *   POST /workspaces/{id}/boards
 *   POST /boards/{id}/columns   (once per template column, in order)
 *   POST /boards/{id}/labels    (once per template label, in order)
 *
 * There is no template endpoint and no transaction, so this is deliberately
 * sequential and non-atomic:
 *
 * - A `createBoard` failure throws, and **nothing else is attempted** — because
 *   every later call needs the board id, a throw here always means "nothing was
 *   created", which lets the caller show a plain failure message.
 * - Column and label failures are caught and collected instead of thrown. The
 *   call keeps going so one bad row does not abandon the rest, and the returned
 *   result enumerates exactly what succeeded and what failed.
 *
 * Sequential rather than parallel so the server assigns positions/creation order
 * predictably and a transient failure does not open N concurrent writes.
 */
export async function materializeBoardTemplate(
  workspaceId: string,
  template: BoardTemplate,
  name: string,
  description?: string,
): Promise<TemplateMaterializeResult> {
  const board = await createBoard(workspaceId, {
    name,
    description: description ?? template.description,
  });

  const createdColumns: Column[] = [];
  const failedColumns: string[] = [];
  for (const column of template.columns) {
    try {
      createdColumns.push(await createColumn(board.id, { name: column.name }));
    } catch (error) {
      failedColumns.push(column.name);
      console.error(`Template column "${column.name}" was not created:`, error);
    }
  }

  const createdLabels: Label[] = [];
  const failedLabels: string[] = [];
  for (const label of template.labels) {
    try {
      createdLabels.push(
        await createLabel(board.id, { name: label.name, color: label.color }),
      );
    } catch (error) {
      failedLabels.push(label.name);
      console.error(`Template label "${label.name}" was not created:`, error);
    }
  }

  return {
    board,
    createdColumns,
    failedColumns,
    createdLabels,
    failedLabels,
  };
}

/**
 * Turns a materialisation result into the message shown to the user.
 *
 * The wording always states what now exists on the server, so a partial failure
 * never leaves the user guessing whether the board, its columns or its labels
 * were created.
 */
export function describeTemplateOutcome(
  result: TemplateMaterializeResult,
): TemplateOutcome {
  const totalColumns =
    result.createdColumns.length + result.failedColumns.length;
  const totalLabels = result.createdLabels.length + result.failedLabels.length;

  const failures: string[] = [];
  if (result.failedColumns.length > 0) {
    failures.push(`columns: ${result.failedColumns.join(", ")}`);
  }
  if (result.failedLabels.length > 0) {
    failures.push(`labels: ${result.failedLabels.join(", ")}`);
  }

  if (failures.length === 0) {
    return {
      complete: true,
      message:
        `Board "${result.board.name}" created with ` +
        `${result.createdColumns.length} columns and ` +
        `${result.createdLabels.length} labels.`,
    };
  }

  return {
    complete: false,
    message:
      `Board "${result.board.name}" was created, but not everything in the ` +
      `template was. It now has ${result.createdColumns.length} of ` +
      `${totalColumns} columns and ${result.createdLabels.length} of ` +
      `${totalLabels} labels. Failed to create — ${failures.join("; ")}.`,
  };
}
