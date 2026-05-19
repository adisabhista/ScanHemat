export const sidebarStorageKey = "scanhemat-sidebar-collapsed";

export function parseSidebarCollapsedValue(value: string | null): boolean {
  return value === "true";
}

export function serializeSidebarCollapsedValue(isCollapsed: boolean): string {
  return isCollapsed ? "true" : "false";
}
