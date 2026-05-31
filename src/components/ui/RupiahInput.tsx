"use client";

import { useState, type ChangeEvent, type InputHTMLAttributes } from "react";

import { formatRupiahInput, parseRupiahInput } from "@/lib/format/rupiah-input";

type RupiahInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "defaultValue" | "inputMode" | "name" | "onChange" | "type" | "value"
> & {
  defaultValue?: number | string | null;
  error?: string;
  label?: string;
  name?: string;
  onValueChange?: (value: string) => void;
  value?: number | string | null;
};

export function RupiahInput({
  className = "",
  defaultValue,
  error,
  label,
  name,
  onValueChange,
  value,
  ...props
}: RupiahInputProps) {
  const isControlled = value !== undefined;
  const [internalValue, setInternalValue] = useState(() => formatRupiahInput(defaultValue));
  const displayValue = isControlled ? formatRupiahInput(value) : internalValue;
  const numericValue = parseRupiahInput(displayValue)?.toString() ?? "";

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const digitCountBeforeCaret = input.value.slice(0, input.selectionStart ?? input.value.length).replace(/\D/g, "").length;
    const formattedValue = formatRupiahInput(input.value);
    const nextNumericValue = parseRupiahInput(formattedValue)?.toString() ?? "";

    if (!isControlled) {
      setInternalValue(formattedValue);
    }

    onValueChange?.(nextNumericValue);

    requestAnimationFrame(() => {
      const nextCaretPosition = getCaretPositionAfterDigits(input.value, digitCountBeforeCaret);
      input.setSelectionRange(nextCaretPosition, nextCaretPosition);
    });
  }

  return (
    <>
      <label className="grid gap-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">
        {label ? <span>{label}</span> : null}
        <input
          className={`min-h-10 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-brand-500 dark:focus:ring-brand-900/40 ${className}`}
          inputMode="numeric"
          onChange={handleChange}
          type="text"
          value={displayValue}
          {...props}
        />
        {error ? <span className="text-xs text-red-600 dark:text-red-400">{error}</span> : null}
      </label>
      {name ? <input name={name} type="hidden" value={numericValue} /> : null}
    </>
  );
}

function getCaretPositionAfterDigits(value: string, digitCount: number) {
  if (digitCount === 0) {
    return 0;
  }

  let seenDigits = 0;

  for (let index = 0; index < value.length; index += 1) {
    if (/\d/.test(value[index])) {
      seenDigits += 1;
    }

    if (seenDigits === digitCount) {
      return index + 1;
    }
  }

  return value.length;
}
