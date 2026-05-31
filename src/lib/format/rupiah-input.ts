export function parseRupiahInput(value: number | string | null | undefined) {
  if (value === null || value === undefined) {
    return undefined;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) && value >= 0 ? Math.trunc(value) : undefined;
  }

  const trimmedValue = value.trim();

  if (!trimmedValue || trimmedValue.includes("-")) {
    return undefined;
  }

  const digits = trimmedValue.replace(/\D/g, "");

  if (!digits) {
    return undefined;
  }

  return Number(digits);
}

export function formatRupiahInput(value: number | string | null | undefined) {
  const parsedValue = parseRupiahInput(value);

  return parsedValue === undefined ? "" : parsedValue.toLocaleString("id-ID");
}
