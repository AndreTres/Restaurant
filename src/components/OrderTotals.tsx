import { formatMoney } from "@/lib/format";
import { servicePercentLabel } from "@/lib/pricing";

type OrderTotalsProps = {
  subtotal: number;
  serviceFee: number;
  total: number;
};

export function OrderTotals({ subtotal, serviceFee, total }: OrderTotalsProps) {
  return (
    <div className="order-totals">
      <div className="order-totals-row">
        <span>Subtotal</span>
        <span>{formatMoney(subtotal)}</span>
      </div>
      <div className="order-totals-row muted">
        <span>Serviço ({servicePercentLabel()})</span>
        <span>{formatMoney(serviceFee)}</span>
      </div>
      <div className="order-total">
        <span>Total</span>
        <span>{formatMoney(total)}</span>
      </div>
    </div>
  );
}
