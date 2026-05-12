import Link from "next/link";
import { redirect } from "next/navigation";

import { Card } from "@/components/ui/Card";
import { LoginForm } from "@/features/auth/LoginForm";
import { getCurrentSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const session = await getCurrentSession();

  if (session?.user) {
    redirect("/dashboard");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-8">
      <Card className="w-full max-w-md">
        <div className="mb-6">
          <p className="text-sm font-semibold text-brand-700">ScanHemat</p>
          <h1 className="mt-2 text-2xl font-bold text-slate-950">Masuk</h1>
          <p className="mt-1 text-sm text-slate-500">Kelola pengeluaran dari struk belanja Anda.</p>
        </div>
        <LoginForm />
        <p className="mt-6 text-center text-sm text-slate-500">
          Belum punya akun?{" "}
          <Link className="font-semibold text-brand-700" href="/register">
            Daftar
          </Link>
        </p>
      </Card>
    </main>
  );
}
