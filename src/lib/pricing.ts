/** Taxa de serviço cobrada sobre o subtotal dos itens */
export const SERVICE_RATE = 0.1;

export function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export function sumItemsSubtotal(
  items: { quantity: number; unit_price: number }[]
) {
  return roundMoney(
    items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0)
  );
}

export function calculateOrderTotals(subtotal: number) {
  const safeSubtotal = roundMoney(Math.max(0, subtotal));
  const serviceFee = roundMoney(safeSubtotal * SERVICE_RATE);
  const total = roundMoney(safeSubtotal + serviceFee);

  return {
    subtotal: safeSubtotal,
    serviceFee,
    total,
  };
}

export function servicePercentLabel() {
  return `${Math.round(SERVICE_RATE * 100)}%`;
}

export function isOrderEditable(status: string) {
  return status !== "closed" && status !== "cancelled";
}
