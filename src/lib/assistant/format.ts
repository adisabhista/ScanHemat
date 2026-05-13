export function formatAssistantCurrency(value: number | string) {
  const amount = Math.round(Number(value) || 0);

  return `Rp${amount.toLocaleString("id-ID")}`;
}

export const formatRupiah = formatAssistantCurrency;

export function formatAssistantDate(value: Date | string) {
  let date: Date;

  if (value instanceof Date) {
    date = value;
  } else {
    const [year, month, day] = value.split("-").map(Number);
    date = year && month && day ? new Date(Date.UTC(year, month - 1, day)) : new Date(value);
  }

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC"
  }).format(date);
}

export const formatIndonesianDate = formatAssistantDate;

export function formatMonthLabel(month: number, year: number) {
  return new Intl.DateTimeFormat("id-ID", {
    month: "long",
    year: "numeric",
    timeZone: "UTC"
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}
