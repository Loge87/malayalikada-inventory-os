export function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-NZ", { style: "currency", currency }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}
