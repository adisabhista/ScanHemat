import { PageHeader } from "@/components/app/PageHeader";
import { Card } from "@/components/ui/Card";
import { getCurrentSession } from "@/lib/auth";

export default async function SettingsPage() {
  const session = await getCurrentSession();

  return (
    <>
      <PageHeader title="Pengaturan" description="Informasi akun dan preferensi aplikasi." />
      <Card>
        <h2 className="text-base font-semibold text-slate-950">Akun</h2>
        <dl className="mt-4 grid gap-3 text-sm">
          <div>
            <dt className="font-medium text-slate-500">Nama</dt>
            <dd className="text-slate-950">{session?.user?.name ?? "Tidak tersedia"}</dd>
          </div>
          <div>
            <dt className="font-medium text-slate-500">Email</dt>
            <dd className="text-slate-950">{session?.user?.email ?? "Tidak tersedia"}</dd>
          </div>
        </dl>
      </Card>
    </>
  );
}
