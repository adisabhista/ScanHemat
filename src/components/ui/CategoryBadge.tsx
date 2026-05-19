import { StatusBadge } from "./StatusBadge";

export function CategoryBadge({
  name,
  color
}: {
  name: string;
  color?: string | null;
}) {
  return (
    <StatusBadge tone="slate" className="gap-1.5">
      <span className="size-2 rounded-full" style={{ backgroundColor: color ?? "#64748b" }} aria-hidden="true" />
      {name}
    </StatusBadge>
  );
}
