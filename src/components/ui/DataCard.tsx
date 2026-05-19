import type { ReactNode } from "react";

import { Card } from "./Card";
import { SectionHeader } from "./SectionHeader";

export function DataCard({
  title,
  description,
  action,
  children,
  className = "",
  contentClassName = "mt-4"
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <Card className={className}>
      <SectionHeader title={title} description={description} action={action} />
      <div className={contentClassName}>{children}</div>
    </Card>
  );
}
