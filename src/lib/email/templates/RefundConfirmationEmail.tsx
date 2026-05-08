import { Text } from "@react-email/components";
import { BaseLayout } from "./BaseLayout";
import { formatKrw } from "../format";

export type RefundConfirmationEmailProps = {
  name?: string;
  amount: number;
  orderId: string;
  refundedAt: Date;
};

export const refundConfirmationSubject = "환불이 완료되었어요";

const dateFormatter = new Intl.DateTimeFormat("ko-KR", { dateStyle: "long", timeStyle: "short" });

export function RefundConfirmationEmail({ name, amount, orderId, refundedAt }: RefundConfirmationEmailProps) {
  const displayName = name?.trim() ? `${name}님` : "고객님";

  return (
    <BaseLayout preview="환불이 완료되었어요" title="환불 완료 안내">
      <Text className="m-0 text-base leading-7 text-slate-800">
        {displayName}, 환불이 완료되었어요.
      </Text>
      <Text className="m-0 mt-4 text-sm leading-6 text-slate-600">
        환불 금액: {formatKrw(amount)}
        <br />
        주문번호: {orderId}
        <br />
        환불 시각: {dateFormatter.format(refundedAt)}
      </Text>
    </BaseLayout>
  );
}
