import { Suspense } from "react";
import OrdersClient from "./OrdersClient";

export default function OrdersPage() {
  return (
    <Suspense fallback={<p className="muted">Carregando pedidos...</p>}>
      <OrdersClient />
    </Suspense>
  );
}
