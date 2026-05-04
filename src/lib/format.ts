export const currencyFormatter = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR"
});

export function formatCurrency(value: number): string {
  return currencyFormatter.format(value);
}

export function formatDate(value: string | null): string {
  if (!value) return "-";

  const normalizedValue = value.includes("T") ? value : `${value}T00:00:00`;
  const date = new Date(normalizedValue);

  if (!Number.isFinite(date.getTime())) return "-";

  return new Intl.DateTimeFormat("fr-FR").format(date);
}
