import { redirect } from "next/navigation";

import { DashboardShell } from "@/components/app/DashboardShell";
import { getCurrentSession } from "@/lib/auth";

export default async function DashboardLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getCurrentSession();

  if (!session?.user) {
    redirect("/login");
  }

  return <DashboardShell userName={session.user.name ?? session.user.email}>{children}</DashboardShell>;
}
