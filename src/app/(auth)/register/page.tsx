import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { registerUserAction } from "@/features/auth/actions";
import { getCurrentSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

type RegisterPageSearchParams = Promise<{
  error?: string;
}>;

export default async function RegisterPage({
  searchParams
}: {
  searchParams: RegisterPageSearchParams;
}) {
  const params = await searchParams;
  const session = await getCurrentSession();

  if (session?.user) {
    redirect("/dashboard");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-8">
      <Card className="w-full max-w-md">
        <div className="mb-6">
          <p className="text-sm font-semibold text-brand-700">ScanHemat</p>
          <h1 className="mt-2 text-2xl font-bold text-slate-950">Daftar</h1>
          <p className="mt-1 text-sm text-slate-500">Buat akun untuk mulai mencatat pengeluaran.</p>
        </div>
        {params.error ? <p className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{params.error}</p> : null}
        <form action={registerUserAction} className="grid gap-4">
          <Input autoComplete="name" label="Nama" name="name" required />
          <Input autoComplete="email" label="Email" name="email" required type="email" />
          <Input autoComplete="new-password" label="Kata sandi" minLength={8} name="password" required type="password" />
          <Button type="submit">Daftar</Button>
        </form>
        <p className="mt-6 text-center text-sm text-slate-500">
          Sudah punya akun?{" "}
          <Link className="font-semibold text-brand-700" href="/login">
            Masuk
          </Link>
        </p>
      </Card>
    </main>
  );
}
