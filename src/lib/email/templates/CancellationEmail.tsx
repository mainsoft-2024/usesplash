import { Text } from "@react-email/components";
import { BaseLayout } from "./BaseLayout";

export type CancellationEmailProps = {
  name?: string;
  accessUntil: Date;
};

const dateFormatter = new Intl.DateTimeFormat("ko-KR", { dateStyle: "long" });

export const cancellationSubject = "구독 취소가 완료되었어요";

export function CancellationEmail({ name, accessUntil }: CancellationEmailProps) {
  const displayName = name?.trim() ? `${name}님` : "고객님";

  return (
    <BaseLayout preview="남은 기간까지 Pro 기능을 사용할 수 있어요" title="구독 취소가 완료되었어요">
      <Text className="m-0 text-base leading-7 text-slate-800">
        {displayName}, 구독 취소가 완료되었어요.
      </Text>
      <Text className="m-0 mt-4 text-sm leading-6 text-slate-600">
        Pro 기능은 <strong>{dateFormatter.format(accessUntil)}</strong>까지 사용할 수 있어요.
      </Text>
    </BaseLayout>
  );
}