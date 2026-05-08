import { Text } from "@react-email/components";
import { BaseLayout } from "./BaseLayout";

export type PaymentFailureEmailProps = {
  name?: string;
  reason: string;
  retryDate?: Date;
};

const dateFormatter = new Intl.DateTimeFormat("ko-KR", { dateStyle: "long" });

export const paymentFailureSubject = "Splash Pro 결제에 실패했어요";

export function PaymentFailureEmail({ name, reason, retryDate }: PaymentFailureEmailProps) {
  const displayName = name?.trim() ? `${name}님` : "고객님";

  return (
    <BaseLayout preview="자동 결제에 실패했어요" title="결제 실패 안내">
      <Text className="m-0 text-base leading-7 text-slate-800">
        {displayName}, 자동 결제에 실패했어요.
      </Text>
      <Text className="m-0 mt-4 text-sm leading-6 text-slate-600">
        사유: {reason}
        <br />
        {retryDate
          ? `다음 재시도 예정일: ${dateFormatter.format(retryDate)}`
          : "결제 수단을 확인한 뒤 다시 시도해 주세요."}
      </Text>
    </BaseLayout>
  );
}