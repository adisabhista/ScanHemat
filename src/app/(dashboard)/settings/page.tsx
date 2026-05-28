import { PageHeader } from "@/components/app/PageHeader";
import { Card } from "@/components/ui/Card";
import { DataCard } from "@/components/ui/DataCard";
import { StatusBadge, type StatusBadgeTone } from "@/components/ui/StatusBadge";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { settingsSections } from "@/features/settings/settings-sections";
import { getCurrentSession } from "@/lib/auth";

export default async function SettingsPage() {
  const session = await getCurrentSession();
  const accountInitial = (session?.user?.name || session?.user?.email || "P").slice(0, 1).toUpperCase();
  const ocrProvider = process.env.OCR_PROVIDER?.trim() || "google-document-ai";
  const aiGenerationProvider = process.env.AI_GENERATION_PROVIDER?.trim() || "gemini-api";
  const geminiModel =
    process.env.GEMINI_VISION_MODEL?.trim() ||
    process.env.GEMINI_RECEIPT_MODEL?.trim() ||
    "gemini-3.5-flash";
  const isGeminiConfigured =
    aiGenerationProvider === "vertex-ai"
      ? Boolean(process.env.GOOGLE_VERTEX_AI_PROJECT_ID?.trim() && process.env.GOOGLE_VERTEX_AI_LOCATION?.trim())
      : Boolean(process.env.GEMINI_API_KEY?.trim());

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader title="Pengaturan" description="Kelola akun, tampilan, fitur AI, dan preferensi aplikasi." />

      <Card>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-brand-600 text-xl font-bold text-white shadow-sm shadow-brand-900/20">
              {accountInitial}
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-950">{settingsSections[0]}</h2>
              <p className="mt-1 text-sm text-slate-500">Informasi akun yang sedang digunakan.</p>
            </div>
          </div>
          <StatusBadge tone="emerald">Aktif</StatusBadge>
        </div>
        <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
          <InfoRow label="Nama" value={session?.user?.name ?? "Tidak tersedia"} />
          <InfoRow label="Email" value={session?.user?.email ?? "Tidak tersedia"} />
        </dl>
      </Card>

      <DataCard title={settingsSections[1]} description="Pilih mode tampilan yang nyaman digunakan di perangkat ini.">
        <div className="grid gap-4">
          <ThemeToggle />
          <SettingRow title="Sidebar" description="Preferensi default sidebar akan disimpan setelah fitur ini tersedia." status="Terbuka / Mini" tone="slate" />
        </div>
      </DataCard>

      <DataCard title={settingsSections[2]} description="Status fitur pembacaan struk dan bantuan AI tanpa menampilkan kredensial atau nilai privat.">
        <div className="grid gap-3">
          <SettingRow title="OCR aktif" description={`Provider pembacaan struk: ${ocrProvider}.`} status="Aktif" tone="emerald" />
          <SettingRow title="Gemini aktif" description={`Provider generasi AI: ${aiGenerationProvider}. Digunakan untuk ekstraksi pintar, verifikasi visual, pengingat, dan bantuan asisten jika konfigurasi tersedia.`} status={isGeminiConfigured ? "Aktif" : "Belum aktif"} tone={isGeminiConfigured ? "emerald" : "amber"} />
          <SettingRow title="Model" description="Nama model aman untuk ditampilkan dan tidak berisi kredensial." status={geminiModel} tone="slate" />
        </div>
      </DataCard>

      <DataCard title={settingsSections[3]} description="Akses data penting aplikasi. Semua opsi di bawah ini bersifat aman dan non-destruktif.">
        <div className="grid gap-3">
          <SettingRow title="Ekspor data" description="Gunakan Ekspor CSV di halaman Transaksi sesuai filter yang dipilih." status="Tersedia" tone="emerald" />
          <SettingRow title="Import data" description="Import data belum tersedia dari pengaturan." status="Segera hadir" tone="slate" />
          <SettingRow title="Hapus data" description="Aksi destruktif belum tersedia dari pengaturan untuk mencegah tindakan tidak sengaja." status="Segera hadir" tone="slate" />
        </div>
      </DataCard>

      <DataCard title={settingsSections[4]} description="Preferensi awal yang aman ditampilkan tanpa mengubah data.">
        <div className="grid gap-3">
          <SettingRow title="Periode default dasbor" description="Dasbor saat ini dibuka dengan periode bulan berjalan." status="Bulan ini" />
          <SettingRow title="Kategori fallback" description="Transaksi yang belum cocok tetap diarahkan ke kategori umum." status="Lainnya" />
          <SettingRow title="Mata Uang" description="Saat ini laporan menggunakan Rupiah." status="Rupiah" />
        </div>
      </DataCard>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
      <dt className="font-medium text-slate-500">{label}</dt>
      <dd className="mt-1 break-words font-semibold text-slate-950">{value}</dd>
    </div>
  );
}

function SettingRow({
  title,
  description,
  status,
  tone = "brand"
}: {
  title: string;
  description: string;
  status: string;
  tone?: StatusBadgeTone;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-start sm:justify-between dark:border-slate-700 dark:bg-slate-800">
      <div>
        <p className="font-semibold text-slate-950">{title}</p>
        <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
      </div>
      <StatusBadge tone={tone}>{status}</StatusBadge>
    </div>
  );
}
