export function getSidebarTooltipLabel(label: string, isCollapsed: boolean) {
  return isCollapsed ? label : undefined;
}

export function getSidebarActiveMarkerClassName(active: boolean, isCollapsed: boolean) {
  return active && isCollapsed ? "absolute left-0 h-6 w-1 rounded-r-full bg-brand-600 dark:bg-brand-400" : "";
}
