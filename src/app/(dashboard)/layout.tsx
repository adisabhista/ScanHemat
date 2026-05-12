import { redirect } from "next/navigation";

import { AppSidebar } from "@/components/app/AppSidebar";
import { MobileNav } from "@/components/app/MobileNav";
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

  return (
    <div className="min-h-screen bg-slate-50">
      <AppSidebar userName={session.user.name ?? session.user.email} />
      <MobileNav />
      <main className="px-4 py-6 lg:ml-64 lg:px-8">
        <div className="mx-auto max-w-7xl space-y-6">{children}</div>
      </main>
    </div>
  );
}
