export function formatDate(value: Date | string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(value));
}

export function toInputDate(value: Date | string) {
  return new Date(value).toISOString().slice(0, 10);
}
