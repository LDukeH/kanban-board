import { LABEL_COLORS } from "@/lib/colors";
import type { BoardTemplate } from "./types";

const RED = LABEL_COLORS[0];
const ORANGE = LABEL_COLORS[1];
const GREEN = LABEL_COLORS[3];
const BLUE = LABEL_COLORS[4];
const PURPLE = LABEL_COLORS[5];
const VIOLET = LABEL_COLORS[6];
const FUCHSIA = LABEL_COLORS[7];

/** Built-in board templates. */
export const BOARD_TEMPLATES: readonly BoardTemplate[] = [
  {
    id: "basic-kanban",
    name: "Basic Kanban",
    description: "The classic three-stage flow. A good default for small teams.",
    columns: [{ name: "To Do" }, { name: "In Progress" }, { name: "Done" }],
    labels: [
      { name: "Bug", color: RED },
      { name: "Feature", color: BLUE },
      { name: "Urgent", color: ORANGE },
    ],
  },
  {
    id: "software-development",
    name: "Software Development",
    description: "Backlog through review, with labels for defect and debt tracking.",
    columns: [
      { name: "Backlog" },
      { name: "Ready" },
      { name: "In Progress" },
      { name: "Code Review" },
      { name: "Done" },
    ],
    labels: [
      { name: "Bug", color: RED },
      { name: "Feature", color: BLUE },
      { name: "Tech Debt", color: PURPLE },
      { name: "Urgent", color: ORANGE },
    ],
  },
  {
    id: "content-calendar",
    name: "Content Calendar",
    description: "Plan, write, edit and schedule content across channels.",
    columns: [
      { name: "Ideas" },
      { name: "Writing" },
      { name: "Editing" },
      { name: "Scheduled" },
      { name: "Published" },
    ],
    labels: [
      { name: "Article", color: GREEN },
      { name: "Video", color: VIOLET },
      { name: "Social", color: FUCHSIA },
      { name: "Urgent", color: ORANGE },
    ],
  },
];

/** Looks up a built-in template by id, or undefined when it does not exist. */
export function getBoardTemplate(id: string): BoardTemplate | undefined {
  return BOARD_TEMPLATES.find((template) => template.id === id);
}
