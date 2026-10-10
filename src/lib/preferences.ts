export type DateFormat = "MM/DD/YYYY" | "DD/MM/YYYY";

export function getDateFormat(): DateFormat {
  const raw = localStorage.getItem("kanban-date-format");
  return raw === "MM/DD/YYYY" ? raw : "DD/MM/YYYY";
}

export function setDateFormat(format: DateFormat): void {
  localStorage.setItem("kanban-date-format", format);
  window.dispatchEvent(new CustomEvent("kanban-preferences-changed"));
}
