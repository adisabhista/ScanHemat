"use client";

export type ReceiptInputMode = "manual" | "file" | "camera";

type ReceiptInputModeSelectorProps = {
  disabled?: boolean;
  mode: ReceiptInputMode;
  onModeChange: (mode: ReceiptInputMode) => void;
};

const modes: Array<{ value: ReceiptInputMode; label: string }> = [
  { value: "manual", label: "Input Manual" },
  { value: "file", label: "Unggah File" },
  { value: "camera", label: "Pindai Kamera" }
];

export function ReceiptInputModeSelector({ disabled = false, mode, onModeChange }: ReceiptInputModeSelectorProps) {
  return (
    <div className="grid gap-2">
      <p className="text-sm font-medium text-slate-700">Pilih cara menambahkan transaksi</p>
      <div className="grid gap-2 sm:grid-cols-3">
        {modes.map((inputMode) => {
          const isSelected = inputMode.value === mode;

          return (
            <button
              aria-pressed={isSelected}
              className={`min-h-10 rounded-md border px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                isSelected
                  ? "border-brand-600 bg-brand-50 text-brand-700"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
              disabled={disabled}
              key={inputMode.value}
              onClick={() => onModeChange(inputMode.value)}
              type="button"
            >
              {inputMode.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
