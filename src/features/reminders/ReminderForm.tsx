"use client";

import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import {
  allowedReminderOffsets,
  defaultReminderOffsetsByType,
  formatReminderOffset,
  reminderTypeLabels,
  repeatTypeLabels
} from "@/lib/reminders/format";

const reminderTypes = [
  "SUBSCRIPTION",
  "BILL",
  "VEHICLE_TAX",
  "STNK",
  "SIM",
  "WARRANTY",
  "LICENSE",
  "DOCUMENT",
  "OTHER"
] as const;
const repeatTypes = ["NONE", "WEEKLY", "MONTHLY", "YEARLY", "CUSTOM"] as const;

type ReminderTypeValue = (typeof reminderTypes)[number];
type RepeatTypeValue = (typeof repeatTypes)[number];
type ReminderStatusValue = "ACTIVE" | "DONE" | "DISMISSED" | "EXPIRED";

export type ReminderFormValues = {
  title?: string;
  type?: ReminderTypeValue;
  amount?: number | null;
  dueDate?: string;
  repeatType?: RepeatTypeValue;
  reminderOffsets?: number[];
  status?: ReminderStatusValue;
  notes?: string | null;
  relatedMerchant?: string | null;
  relatedDocumentName?: string | null;
};

export function ReminderForm({
  action,
  initialValues = {},
  mode = "create"
}: {
  action: (formData: FormData) => void | Promise<void>;
  initialValues?: ReminderFormValues;
  mode?: "create" | "edit";
}) {
  const initialType = initialValues.type ?? "SUBSCRIPTION";
  const [values, setValues] = useState<Required<ReminderFormValues>>({
    title: initialValues.title ?? "",
    type: initialType,
    amount: initialValues.amount ?? null,
    dueDate: initialValues.dueDate ?? "",
    repeatType: initialValues.repeatType ?? "MONTHLY",
    reminderOffsets:
      initialValues.reminderOffsets && initialValues.reminderOffsets.length > 0
        ? initialValues.reminderOffsets
        : [...defaultReminderOffsetsByType[initialType]],
    status: initialValues.status ?? "ACTIVE",
    notes: initialValues.notes ?? "",
    relatedMerchant: initialValues.relatedMerchant ?? "",
    relatedDocumentName: initialValues.relatedDocumentName ?? ""
  });
  const [quickText, setQuickText] = useState("");
  const [quickStatus, setQuickStatus] = useState<string | null>(null);
  const [isSuggesting, setIsSuggesting] = useState(false);

  function updateValue<Key extends keyof ReminderFormValues>(key: Key, value: Required<ReminderFormValues>[Key]) {
    setValues((current) => ({
      ...current,
      [key]: value
    }));
  }

  function updateType(type: ReminderTypeValue) {
    setValues((current) => ({
      ...current,
      type,
      reminderOffsets: [...defaultReminderOffsetsByType[type]]
    }));
  }

  function toggleReminderOffset(offset: number) {
    setValues((current) => {
      const selected = current.reminderOffsets.includes(offset)
        ? current.reminderOffsets.filter((item) => item !== offset)
        : [...current.reminderOffsets, offset];

      return {
        ...current,
        reminderOffsets: selected.sort((a, b) => b - a)
      };
    });
  }

  async function handleSuggest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!quickText.trim() || isSuggesting) {
      return;
    }

    setIsSuggesting(true);
    setQuickStatus(null);

    try {
      const response = await fetch("/api/reminders/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: quickText })
      });
      const payload = (await response.json()) as {
        draft?: ReminderFormValues;
        error?: string;
      };

      if (!response.ok || !payload.draft) {
        throw new Error(payload.error ?? "Gagal membuat saran pengingat.");
      }

      setValues((current) => ({
        ...current,
        title: payload.draft?.title ?? current.title,
        type: payload.draft?.type ?? current.type,
        amount: payload.draft?.amount ?? current.amount,
        dueDate: payload.draft?.dueDate ?? current.dueDate,
        repeatType: payload.draft?.repeatType ?? current.repeatType,
        reminderOffsets: payload.draft?.type ? [...defaultReminderOffsetsByType[payload.draft.type]] : current.reminderOffsets,
        notes: payload.draft?.notes ?? current.notes,
        relatedMerchant: payload.draft?.relatedMerchant ?? current.relatedMerchant,
        relatedDocumentName: payload.draft?.relatedDocumentName ?? current.relatedDocumentName
      }));
      setQuickStatus("Saran pengingat sudah diterapkan. Periksa kembali sebelum menyimpan.");
    } catch (error) {
      setQuickStatus(error instanceof Error ? error.message : "Gagal membuat saran pengingat.");
    } finally {
      setIsSuggesting(false);
    }
  }

  return (
    <Card>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-950">{mode === "edit" ? "Edit Pengingat" : "Tambah Pengingat"}</h2>
          <p className="mt-1 text-sm text-slate-500">Isi manual atau gunakan teks cepat lalu periksa hasilnya.</p>
        </div>
        {mode === "edit" ? (
          <a className="text-sm font-semibold text-brand-700" href="/reminders">
            Batal
          </a>
        ) : null}
      </div>

      <form className="mt-4 grid gap-3 rounded-md bg-slate-50 p-4 md:grid-cols-[1fr_auto]" onSubmit={handleSuggest}>
        <Input
          label="Tulis cepat"
          name="quickText"
          onChange={(event) => setQuickText(event.target.value)}
          placeholder="ingatkan bayar YouTube Premium 59 ribu tiap tanggal 10"
          value={quickText}
        />
        <div className="flex items-end">
          <Button className="w-full" disabled={isSuggesting} type="submit" variant="secondary">
            {isSuggesting ? "Membaca..." : "Buat Saran"}
          </Button>
        </div>
        {quickStatus ? <p className="text-sm text-slate-600 md:col-span-2">{quickStatus}</p> : null}
      </form>

      <form action={action} className="mt-4 grid gap-4 md:grid-cols-2">
        <input name="status" type="hidden" value={values.status} />
        <Input
          label="Judul"
          name="title"
          onChange={(event) => updateValue("title", event.target.value)}
          required
          value={values.title}
        />
        <Select
          label="Jenis pengingat"
          name="type"
          onChange={(event) => updateType(event.target.value as ReminderTypeValue)}
          required
          value={values.type}
        >
          {reminderTypes.map((type) => (
            <option key={type} value={type}>
              {reminderTypeLabels[type]}
            </option>
          ))}
        </Select>
        <Input
          label="Tanggal jatuh tempo"
          name="dueDate"
          onChange={(event) => updateValue("dueDate", event.target.value)}
          required
          type="date"
          value={values.dueDate}
        />
        <Input
          label="Estimasi biaya"
          min="1"
          name="amount"
          onChange={(event) => updateValue("amount", event.target.value ? Number(event.target.value) : null)}
          placeholder="350000"
          step="1"
          type="number"
          value={values.amount ?? ""}
        />
        <Select
          label="Pengulangan"
          name="repeatType"
          onChange={(event) => updateValue("repeatType", event.target.value as RepeatTypeValue)}
          required
          value={values.repeatType}
        >
          {repeatTypes.map((repeatType) => (
            <option key={repeatType} value={repeatType}>
              {repeatTypeLabels[repeatType]}
            </option>
          ))}
        </Select>
        <fieldset className="grid gap-3 rounded-md border border-slate-200 p-4 md:col-span-2">
          <legend className="px-1 text-sm font-semibold text-slate-900">Ingatkan sebelum jatuh tempo</legend>
          <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {allowedReminderOffsets.map((offset) => (
              <label className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700" key={offset}>
                <input
                  checked={values.reminderOffsets.includes(offset)}
                  className="size-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                  name="reminderOffsets"
                  onChange={() => toggleReminderOffset(offset)}
                  type="checkbox"
                  value={offset}
                />
                {formatReminderOffset(offset)}
              </label>
            ))}
          </div>
        </fieldset>
        <Input
          label="Merchant"
          name="relatedMerchant"
          onChange={(event) => updateValue("relatedMerchant", event.target.value)}
          value={values.relatedMerchant ?? ""}
        />
        <Input
          label="Nama dokumen"
          name="relatedDocumentName"
          onChange={(event) => updateValue("relatedDocumentName", event.target.value)}
          value={values.relatedDocumentName ?? ""}
        />
        <label className="grid gap-1.5 text-sm font-medium text-slate-700 md:col-span-2">
          <span>Catatan</span>
          <textarea
            className="min-h-24 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            name="notes"
            onChange={(event) => updateValue("notes", event.target.value)}
            value={values.notes ?? ""}
          />
        </label>
        <div className="md:col-span-2">
          <Button type="submit">Simpan</Button>
        </div>
      </form>
    </Card>
  );
}
