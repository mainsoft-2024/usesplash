import { Text } from "@react-email/components";
import { BaseLayout } from "./BaseLayout";

export type AutoDowngradeEmailProps = {
  name?: string;
};

export const autoDowngradeSubject = "Free 플랜으로 자동 전환되었어요";

export function AutoDowngradeEmail({ name }: AutoDowngradeEmailProps) {
  const displayName = name?.trim() ? `${name}님` : "고객님";

  return (
    <BaseLayout preview="결제 실패로 Free 플랜으로 전환되었어요" title="자동 플랜 전환 안내">
      <Text className="m-0 text-base leading-7 text-slate-800">
        {displayName}, 결제 실패로 Free 플랜으로 자동 전환되었어요.
      </Text>
      <Text className="m-0 mt-4 text-sm leading-6 text-slate-600">
        프로젝트와 로고 기록은 그대로 유지되며, 언제든 다시 구독할 수 있어요.
      </Text>
    </BaseLayout>
  );
}