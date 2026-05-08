import { Text } from "@react-email/components";
import { BaseLayout } from "./BaseLayout";
import { formatKrw } from "../format";

export type PaymentSuccessEmailProps = {
  name?: string;
  plan: string;
  amount: number;
  orderId: string;
  paidAt: Date;
  providerPaymentId: string;
};

export const paymentSuccessSubject = "Splash Pro 결제가 완료되었어요";

const dateFormatter = new Intl.DateTimeFormat("ko-KR", { dateStyle: "long", timeStyle: "short" });

export function PaymentSuccessEmail({
  name,
  plan,
  amount,
  orderId,
  paidAt,
  providerPaymentId,
}: PaymentSuccessEmailProps) {
  const displayName = name?.trim() ? `${name}님` : "고객님";

  return (
    <BaseLayout preview={`${formatKrw(amount)} 결제가 완료되었어요`} title="결제가 완료되었어요">
      <Text className="m-0 text-base leading-7 text-slate-800">
        {displayName}, Splash Pro 결제가 정상적으로 완료되었어요.
      </Text>
      <Text className="m-0 mt-4 text-sm leading-6 text-slate-600">
        플랜: {plan}
        <br />
        결제 금액(부가세 포함): {formatKrw(amount)}
        <br />
        주문번호: {orderId}
        <br />
        결제 시각: {dateFormatter.format(paidAt)}
        <br />
        결제사 거래번호: {providerPaymentId}
      </Text>
    </BaseLayout>
  );
}