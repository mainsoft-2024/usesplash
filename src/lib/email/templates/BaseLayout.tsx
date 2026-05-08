import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Preview,
  Section,
  Tailwind,
  Text,
} from "@react-email/components";
import type { ReactNode } from "react";

type BaseLayoutProps = {
  preview: string;
  title: string;
  children: ReactNode;
};

export function BaseLayout({ preview, title, children }: BaseLayoutProps) {
  return (
    <Html lang="ko">
      <Head />
      <Preview>{preview}</Preview>
      <Tailwind>
        <Body className="m-0 bg-slate-50 px-4 py-8 font-sans text-slate-900">
          <Container className="mx-auto w-full max-w-[600px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <Section
              style={{
                background:
                  "linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)",
              }}
              className="px-6 py-6 text-white"
            >
              <Text className="m-0 text-xs font-semibold uppercase tracking-[0.2em] text-blue-100">
                Splash
              </Text>
              <Text className="m-0 mt-2 text-2xl font-bold">Splash</Text>
              <Text className="m-0 mt-1 text-sm text-blue-100">{title}</Text>
            </Section>

            <Section className="px-6 py-7">{children}</Section>

            <Hr className="m-0 border-slate-200" />
            <Section className="px-6 py-5">
              <Text className="m-0 text-xs leading-5 text-slate-500">
                문의가 필요하면 언제든 답장 주세요. / Need help? Just reply to this
                email.
              </Text>
              <Text className="m-0 mt-2 text-xs text-slate-400">
                © {new Date().getFullYear()} Splash. All rights reserved.
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}
