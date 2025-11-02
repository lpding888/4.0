export function formatCurrency(
  value: number | string | null | undefined,
  fractionDigits = 2
): string {
  const numeric = Number(value);
  if (Number.isNaN(numeric) || !Number.isFinite(numeric)) {
    return Number(0).toFixed(fractionDigits);
  }
  return numeric.toFixed(fractionDigits);
}

export function formatNumber(
  value: number | string | null | undefined,
  fractionDigits = 0
): string {
  const numeric = Number(value);
  if (Number.isNaN(numeric) || !Number.isFinite(numeric)) {
    return Number(0).toFixed(fractionDigits);
  }
  return numeric.toFixed(fractionDigits);
}
