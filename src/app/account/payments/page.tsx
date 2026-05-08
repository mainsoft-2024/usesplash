import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { env } from "@/lib/env";
import { PaymentsDisabledPlaceholder } from "@/components/payments-disabled-placeholder";
import { SubscriptionPanel } from "@/components/account/subscription-panel";
import { PaymentHistoryTable } from "@/components/account/payment-history-table";

export default async function AccountPaymentsPage() {
  if (!env.NEXT_PUBLIC_PAYMENTS_ENABLED || env.NEXT_PUBLIC_PAYMENTS_ENABLED === "false") {
    return <PaymentsDisabledPlaceholder />;
  }

  const session = await auth();
  if (!session?.user) {
    redirect("/login?redirect=/account/payments");
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="mb-8 text-2xl font-semibold">결제 관리</h1>

      <div className="space-y-8">
        <SubscriptionPanel />

        <section>
          <h2 className="mb-4 text-lg font-semibold">결제 내역</h2>
          <PaymentHistoryTable />
        </section>
      </div>
    </main>
  );
}
