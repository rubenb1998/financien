const euro = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' });
const whole = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const quantity = new Intl.NumberFormat('nl-NL');

export const money = (cents: number) => euro.format(cents / 100);
export const roundedMoney = (cents: number) => whole.format(cents / 100);
export const signedMoney = (cents: number) => (cents > 0 ? '+' : '') + money(cents);
export const count = (value: number) => quantity.format(value);

export function inputCents(value: string) {
  if (!value.trim()) return 0;
  return Math.round(Number(value.replace(',', '.')) * 100);
}
