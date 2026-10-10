import { createBoard } from "@/lib/api/board.api";
import { createColumn } from "@/lib/api/column.api";
import { createLabel } from "@/lib/api/label.api";
import { reportMutationError } from "@/lib/httpStatus";
import type { Column, Label } from "@/types/board";
import type {
  BoardTemplate,
  TemplateMaterializeResult,
  TemplateOutcome,
} from "./types";

/** Creates a board from a template using only the existing board/column/label endpoints, sequentially and non-atomically. */
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
      reportMutationError(`Template column "${column.name}" was not created`, error);
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
      reportMutationError(`Template label "${label.name}" was not created`, error);
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

/** Turns a materialisation result into the message shown to the user. */
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
