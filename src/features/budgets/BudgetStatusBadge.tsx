export function getBudgetStatus(usedPercentage: number) {
  if (usedPercentage > 100) {
    return "Melebihi Anggaran";
  }

  if (usedPercentage >= 80) {
    return "Mendekati Batas";
  }

  return "Aman";
}

export function BudgetStatusBadge({ usedPercentage }: { usedPercentage: number }) {
  const status = getBudgetStatus(usedPercentage);
  const className =
    status === "Melebihi Anggaran"
      ? "bg-red-50 text-red-700"
      : status === "Mendekati Batas"
        ? "bg-amber-50 text-amber-700"
        : "bg-brand-50 text-brand-700";

  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${className}`}>{status}</span>;
}
