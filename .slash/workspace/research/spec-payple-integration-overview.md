# Payple 결제 시스템 통합 개요

**문서 작성일**: 2026-04-27  
**조사 범위**: Payple 국내 결제 (PCD), Payple Global (해외 결제), Next.js 15 연동 패턴, 데이터 모델, 보안/규제, 통합 전략  
**프로젝트 컨텍스트**: Splash (Next.js 15 + Prisma 7 + tRPC v11 + NextAuth v5)

---

## 1. Payple 국내 결제 (PCD 기반)

### 1.1 가맹점 가입 절차

**절차 개요**:
1. 페이플 웹사이트에서 서비스 가입 문의 (https://www.payple.kr/join-inquiry)
2. 담당자 배정 및 가입 심사 (약 1영업일)
3. 전자계약 진행 및 가입비 납부
4. 개발 연동 (계약 전에도 테스트 가능)
5. 서비스 오픈

**필요 서류**: 사업자등록증, 통신판매업 신고증 등 (업종별 상이)

**참고 링크**:
- 페이플 서비스 가입안내: https://www.payple.kr/join-inquiry

---

### 1.2 테스트 cpid 발급 방법

**테스트 환경 정보** (공식 개발자센터):

| 구분 | 값 |
|------|-----|
| 접속 도메인 | https://democpay.payple.kr |
| cst_id (파트너 ID) | test |
| custKey | abcd1234567890 |
| clientKey | test_DF55F29DA654A8CBC0F0A9DD4B556486 |
| PCD_REFUND_KEY | a41ce010ede9fcbfb3be86b24858806596a9db68b79d138b147c3e563e1829a0 |

**참고 링크**:
- 연동준비 국내카드/계좌결제: https://docs.payple.kr/preparation/domestic-payment

**테스트 카드**: 테스트 환경에서는 실제 결제가 진행되지 않으며, 가상으로 처리됨. 국내 카드 테스트 시 페이플 고객센터(help@payple.kr)로 요청하여 화이트리스트에 카드 등록 필요 (파트너당 1장만 등록 가능)

---

### 1.3 실가맹점 전환 절차

1. 계약 완료 후 페이플 담당자로부터 라이브 환경 정보 수령
2. cst_id, custKey, clientKey를 라이브 값으로 교체
3. API 엔드포인트 변경:
   - 테스트: `democpay.payple.kr` → 라이브: `cpay.payple.kr`
4. Referer 헤더에 등록된 도메인 확인 (도메인 불일치 시 AUTH0004 오류)

---

### 1.4 정기결제(빌링키) 플로우

**전체 플로우**:

```
[사용자] → [결제창 호출] → [카드 등록 (AUTH)] → [빌링키 발급] → [재결제 시 빌링키로 결제]
```

**1단계: 파트너 인증 (서버)**

```http
POST https://democpay.payple.kr/php/auth.php (테스트)
Content-Type: application/json
Referer: https://your-domain.com

{
  "cst_id": "test",
  "custKey": "abcd1234567890",
  "PCD_PAY_WORK": "AUTH"  // 또는 "CERT"
}
```

응답:
```json
{
  "PCD_CST_ID": "UFVNNVZ...",
  "PCD_CUST_KEY": "T3JzRkp5L...",
  "PCD_AUTH_KEY": "a688ccb3555..."
}
```

**2단계: 결제창 호출 (클라이언트)**

```javascript
const obj = {
  clientKey: "test_DF55F29DA654A8CBC0F0A9DD4B556486",
  PCD_PAY_TYPE: "card",
  PCD_PAY_WORK: "AUTH",        // 카드 등록만: AUTH, 등록+결제: CERT
  PCD_CARD_VER: "01",          // 정기결제: "01", 앱카드: "02"
  PCD_PAY_GOODS: "테스트 상품",
  PCD_PAY_TOTAL: 1000,
  PCD_RST_URL: "/result",
  callbackFunction: "getResult"  // SPA에서 결과 수신 시
};
PaypleCpayAuthCheck(obj);
```

**주요 파라미터 설명**:

| 파라미터 | 필수 | 설명 |
|----------|------|------|
| PCD_PAY_WORK | Y | AUTH: 카드 등록만, CERT: 등록+동시 결제 |
| PCD_CARD_VER | Y | 01: 정기(빌링), 02: 앱카드 |
| PCD_PAYER_AUTHTYPE | - | pwd: 비밀번호 간편결제 |
| PCD_SIMPLE_FLAG | - | Y: 비밀번호 간편결제 사용 시 |

**3단계: 빌링키로 승인 요청 (서버)**

```http
POST https://democpay.payple.kr/php/SimplePayCardAct.php?ACT_=PAYM
Content-Type: application/json
Referer: https://your-domain.com

{
  "PCD_CST_ID": "UFVNNVZ...",
  "PCD_CUST_KEY": "T3JzRkp5L...",
  "PCD_AUTH_KEY": "a688ccb3555...",
  "PCD_PAY_TYPE": "card",
  "PCD_PAYER_ID": "OVA3...",  // 빌링키
  "PCD_PAY_GOODS": "테스트 상품",
  "PCD_PAY_TOTAL": "1000",
  "PCD_SIMPLE_FLAG": "Y"
}
```

**응답 예시**:
```json
{
  "PCD_PAY_RST": "success",
  "PCD_PAY_CODE": "PAYC0000",
  "PCD_PAY_MSG": "결제성공",
  "PCD_PAY_OID": "order12345",
  "PCD_PAYER_ID": "OVA3...",
  "PCD_PAY_CARDRECEIPT": "https://www.danalpay.com/receipt/..."
}
```

**참고 링크**:
- 결제창연동 국내카드 정기결제: https://docs.payple.kr/integration/domestic-card/billing
- 파라미터 국내카드 정기결제: https://docs.payple.kr/parameters/domestic-card/billing

---

### 1.5 단건결제 플로우 (CERT/PAY)

**CERT 방식**: 카드 등록과 동시에 결제가 진행됨

```javascript
const obj = {
  clientKey: "test_DF55F29DA654A8CBC0F0A9DD4B556486",
  PCD_PAY_TYPE: "card",
  PCD_PAY_WORK: "CERT",        // 등록+결제 동시
  PCD_CARD_VER: "01",
  PCD_PAY_GOODS: "테스트 상품",
  PCD_PAY_TOTAL: 1000,
  PCD_RST_URL: "/result"
};
PaypleCpayAuthCheck(obj);
```

**PAY 방식**: 이미 등록된 빌링키로 즉시 결제

위 "빌링키로 승인 요청" 섹션 참조

---

### 1.6 카드 + 카카오페이 + 네이버페이 간편결제 별도 가입/세팅 차이

**간편페이 연동 체크리스트** (공식 문서):

1. 기존 페이플 사용 파트너는 페이플에서简便페이 사용을 위한 설정 변경 요청 필요
2. JavaScript 파일 변경 필요 (clientKey 방식 사용)
3. 기존: AUTH_KEY 사용 → 변경: clientKey 직접 사용

**주요 차이점**:

| 구분 | 카드 | 카카오페이 | 네이버페이 |
|------|------|------------|------------|
| PCD_PAY_METHOD | card | kakao | naver |
| 인증방식 | 카드번호+유효기간 | 앱 인증 | 앱 인증 |
| 별도 계약 | 기본 포함 | 추가 계약 필요 | 추가 계약 필요 |

**참고 링크**:
- 간편페이 추가 연동: https://docs.payple.kr/preparation/easypay-integration

---

### 1.7 결제 결과 통보(웹훅) 스펙

**PCD_RST_URL 설정**:

| 환경 | PCD_RST_URL 방식 | 결제창 호출 방식 |
|------|------------------|-----------------|
| PC | 상대경로 (권장) | 레이어 팝업 |
| PC | 절대경로 | 다이렉트 |
| 모바일 | 상대경로 | 새 탭(새 창) |
| 모바일 | 절대경로 (권장) | 다이렉트 |

**SPA(Single Page Application) 대응**:
- PCD_RST_URL을 상대경로로 설정
- callbackFunction 파라미터 추가

**웹훅 이벤트 유형**:

| 이벤트 | 설명 |
|--------|------|
| 결제 완료 | 결제 완료 결과를 수신 |
| 취소 완료 | 결제 취소 결과 (파트너 관리자에서 직접 취소한 건도 포함) |
| 결제수단 등록 | 카드/계좌 등록 결과 |
| 결제수단 해지 | 파트너 관리자에서 직접 해지 시 (API 해지는 미포함) |

**참고 링크**:
- PCD_RST_URL 및 callbackFunction: https://github.com/PAYPLECORP/payple-genie/discussions/11
- 연동준비 (웹훅): https://docs.payple.kr/preparation/domestic-payment

**IP 화이트리스트**: 확인되지 않음. 페이플 개발자센터에서 공식 IP 목록을 찾을 수 없음. Vercel serverless 환경에서는 IP 화이트리스트 대신 서명 검증 기반 방식을 권장함.

---

### 1.8 환불/부분환불 API

**환불 요청**:

```http
POST https://democpay.payple.kr/php/SimplePayCardAct.php?ACT_=PAYC
Content-Type: application/json
Referer: https://your-domain.com

{
  "PCD_CST_ID": "UFVNNVZ...",
  "PCD_CUST_KEY": "T3JzRkp5L...",
  "PCD_AUTH_KEY": "a688ccb3555...",
  "PCD_REFUND_KEY": "a41ce010e...",
  "PCD_PAYCANCEL_FLAG": "Y",
  "PCD_PAY_OID": "order12345",
  "PCD_PAY_DATE": "20231219",
  "PCD_REFUND_TOTAL": "1000"
}
```

**주요 파라미터**:

| 파라미터 | 필수 | 설명 |
|----------|------|------|
| PCD_REFUND_KEY | Y | 환불 인증 키 (파트너 관리자에서 확인) |
| PCD_PAY_OID | Y | 원거래 주문번호 |
| PCD_PAY_DATE | Y | 원거래 결제일자 (YYYYMMDD) |
| PCD_REFUND_TOTAL | Y | 취소 요청금액 |
| PCD_REFUND_TAXTOTAL | - | 복합과세 취소 시 부가세 |

**응답 예시**:
```json
{
  "PCD_PAY_RST": "success",
  "PCD_PAY_CODE": "PAYC0000",
  "PCD_PAY_MSG": "승인취소성공",
  "PCD_PAY_OID": "test06881335001623242176279",
  "PCD_REFUND_TOTAL": "1000",
  "PCD_PAY_CARDRECEIPT": "https://www.danalpay.com/receipt/..."
}
```

**응답 코드**:
- 0001: 인증실패
- 0002: PCD_REFUND_KEY 오류
- 0007: 결제정보를 찾을 수 없음 / 이미 취소된 거래
- 0011: 환불가능금액 초과

**참고 링크**:
- 운영 국내카드 취소: https://docs.payple.kr/operation/domestic-card/cancel
- 응답코드: https://docs.payple.kr/response-code

---

### 1.9 영수증/매출전표 URL 가져오는 방법

결제 응답 또는 환불 응답에서 `PCD_PAY_CARDRECEIPT` 필드를 통해 매출전표 URL 수신:

```json
{
  "PCD_PAY_CARDRECEIPT": "https://www.danalpay.com/receipt/creditcard/..."
}
```

이 URL을 클라이언트에 노출하거나 링크로 제공하면 사용자가 직접 영수증을 확인 가능.

---

### 1.10 payple-js 라이브러리 vs REST 직접 호출 비교

**공식 SDK 현황**:
- 공식 JavaScript 라이브러리(payple-js)는 찾을 수 없음
- 페이플에서 제공하는 공식 샘플: PHP, Node.js, Java, Python (GitHub)
- 대부분의 개발자가 REST API를 직접 호출하는 방식 사용

**REST 직접 호출 장점**:
- Next.js App Router와 완벽한 호환
- tRPC와 같은 타입 세이프한 API 계층과 결합 용이
- 커스터마이징 유연성 높음

**참고 링크**:
- 페이플 Node.js 샘플: https://github.com/PAYPLECORP/sample_nodejs
- 페이플 PHP 샘플: https://github.com/PAYPLECORP/sample_php

---

### 1.11 자주 터지는 함정

**1. CSP (Content Security Policy) 문제**:
- 결제창 스크립트 로드 시 CSP 설정 필요
- `script-src`에 페이플 도메인 추가 필요

**2. 도메인 등록**:
- Referer 헤더의 도메인이 페이플에 등록된 도메인과 일치해야 함
- 불일치 시 AUTH0004 오류 발생

**3. 모바일 팝업 차단**:
- 모바일 환경에서 팝업 차단이 활성화되어 있으면 결제창이 열리지 않음
- 해결: PCD_RST_URL을 절대경로로 설정하여 다이렉트 방식 사용

**4. 인앱 브라우저 (카카오톡, 페이스북 등)**:
- 인앱 브라우저에서는 팝업이 차단됨
- 해결: 다이렉트 방식 사용 권장

**5. 카드 할부**:
- 카드 할부는 앱카드 결제에서만 가능
- 정기(빌링) 및 비밀번호 간편결제에는 할부 불가

**참고 링크**:
- 자주묻는질문: https://docs.payple.kr/faq

---

## 2. Payple Global (해외 결제)

### 2.1 가입/심사 절차, 국내 Payple과의 관계

**해외결제 별도 가입**:
- 국내 페이플과 별도로海外결제 서비스 가입 필요
- https://global.payple.kr/ (해외결제 파트너 관리자)
- 국내 결제와 동일한 가입 절차, 별도 계약

**국내/해외 관계**:
- 동일한 페이플 플랫폼이지만 별도의 service_id, service_key 사용
- 국내: cst_id, custKey 사용
- 해외: service_id, service_key 사용

---

### 2.2 지원 결제수단 (해외 신용카드 범위)

**지원 결제수단**: 해외 신용카드 (Visa, MasterCard, AMEX 등)

**참고 링크**:
- 페이플 서비스 소개: https://team.payple.kr/service

**수수료**:
- 해외카드: 5.0%

---

### 2.3 API 엔드포인트 차이

**국내 vs 해외 엔드포인트 비교**:

| 구분 | 국내 | 해외 |
|------|------|------|
| 도메인 | cpay.payple.kr | api.payple.kr |
| 인증 경로 | /php/auth.php | /gpay/oauth/1.0/token |
| 결제 경로 | /php/SimplePayCardAct.php | /gpay/payment |
| 빌링키 경로 | /php/SimplePayCardAct.php?ACT_=PAYM | /gpay/billingKey |

**테스트 환경**:
- 국내: `democpay.payple.kr`
- 해외: `demo-api.payple.kr`

---

### 2.4 해외 구독(자동 정기결제) 지원 여부

**결론**: **지원함**

공식 개발자센터 문서에서 해외 카드 정기결제(빌링) 지원 확인:

> "구매자가 페이플 결제창에서 카드를 한 번 등록하면 이후부터는 별도 인증없이 결제 요청이 가능합니다."

**해외 정기결제 플로우**:

1. **파트너 인증**:
```http
POST https://demo-api.payple.kr/gpay/oauth/1.0/token
Content-Type: application/json

{
  "service_id": "demo",
  "service_key": "abcd1234567890",
  "code": "as12345678"  // 영문+숫자 10자리
}
```

2. **결제창 호출** (clientKey 대신 Authorization 헤더 사용):
```javascript
const obj = {
  service_id: "demo",
  Authorization: "Bearer " + access_token,
  PCD_PAY_TYPE: "card",
  PCD_PAY_WORK: "AUTH",
  PCD_PAY_GOODS: "테스트 상품",
  PCD_PAY_TOTAL: "0.10",
  currency: "USD",
  resultUrl: "/result"
};
paypleGpayPaymentRequest(obj);
```

3. **빌링키로 승인 요청**:
```http
POST https://demo-api.payple.kr/gpay/billingKey
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "service_id": "demo",
  "comments": "테스트 상품",
  "billing_key": "MlNCQ0pHMn...",
  "totalAmount": "0.10",
  "currency": "USD",
  "resultUrl": "/result"
}
```

**주요 파라미터**:

| 파라미터 | 필수 | 설명 |
|----------|------|------|
| service_id | Y | 파트너 ID |
| service_key | Y | 파트너 키 (외부 노출 금지) |
| code | Y | 영문+숫자 10자리 토큰 |
| billing_key | Y | 빌링키 |
| totalAmount | Y | 결제 금액 |
| currency | Y | USD 또는 KRW |

**참고 링크**:
- 결제창연동 해외카드 정기결제: https://docs.payple.kr/integration/international-card/billing
- 파라미터 해외카드 정기결제: https://docs.payple.kr/parameters/international-card/billing

---

### 2.5 통화/환율 처리, 정산 통화

**지원 통화**: USD, KRW (외화 결제 시 원화 정산 가능)

**정산 정보**:
- 해외카드 정산 주기: 3일
- KRW 정산 시 환전 수수료 무료 (멤버십 서비스)

**참고 링크**:
- 멤버십 서비스: https://www.payple.kr/services/membership/

---

### 2.6 해외 결제 웹훅/노티 차이점

**국내와 동일한 웹훅机制**:
- resultUrl로 POST 방식 결과 수신
- 웹훅 등록 시 등록한 URL로도 결과 수신

**주요 응답 필드**:

| 필드 | 설명 |
|------|------|
| service_oid | 주문번호 |
| pay_id | 결제 고유 ID |
| totalAmount | 결제 금액 |
| currency | 통화 |
| billing_key | 빌링키 |
| submitTimeUtc | UTC 결제 시간 |
| score_result | 이상거래 탐지 점수 |

**참고 링크**:
- 운영 해외카드 결과조회: https://docs.payple.kr/operation/international-card/result

---

## 3. Next.js 15 App Router 연동 패턴

### 3.1 payple-js를 Next 15에서 로드하는 방법

**문제**: 페이플은 공식 JavaScript 라이브러리가 없음. 결제창은 스크립트 로드 방식 사용.

**대안 1: Script 컴포넌트 사용**:

```tsx
// components/PayplePaymentButton.tsx
'use client';

import { useEffect, useRef } from 'react';

declare global {
  interface Window {
    PaypleCpayAuthCheck: (obj: any) => void;
  }
}

export function PayplePaymentButton({ children, onSuccess }: { children: React.ReactNode; onSuccess: (result: any) => void }) {
  const scriptLoaded = useRef(false);

  useEffect(() => {
    if (!scriptLoaded.current) {
      const script = document.createElement('script');
      script.src = 'https://democpay.payple.kr/js/cpay.js';
      script.async = true;
      script.onload = () => {
        scriptLoaded.current = true;
      };
      document.body.appendChild(script);
    }
  }, []);

  const handlePayment = async () => {
    // 서버에서 인증 토큰 가져오기
    const authData = await fetch('/api/payple/auth').then(r => r.json());
    
    const obj = {
      clientKey: authData.clientKey,
      PCD_PAY_TYPE: 'card',
      PCD_PAY_WORK: 'CERT',
      PCD_CARD_VER: '01',
      PCD_PAY_GOODS: 'Splash Pro 구독',
      PCD_PAY_TOTAL: 9900,
      PCD_RST_URL: '/api/payple/result',
      callbackFunction: 'onPaypleResult'
    };
    
    window.PaypleCpayAuthCheck(obj);
  };

  return (
    <button onClick={handlePayment}>
      {children}
    </button>
  );
}
```

**대안 2: Dynamic Import (권장)**:

```tsx
// components/PaypleCheckout.tsx
'use client';

import dynamic from 'next/dynamic';

const PaypleCheckoutButton = dynamic(
  () => import('./PaypleCheckoutButtonInner'),
  { ssr: false, loading: () => <span>결제 버튼 로딩 중...</span> }
);

export default function PaypleCheckout() {
  return <PaypleCheckoutButton />;
}
```

**CSP 설정** (next.config.js):

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: "script-src 'self' 'unsafe-inline' https://democpay.payple.kr https://cpay.payple.kr;"
          }
        ]
      }
    ];
  }
};

module.exports = nextConfig;
```

---

### 3.2 API Route에서 결과 통보 처리 패턴

**API Route 생성** (app/api/payple/result/route.ts):

```typescript
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  
  const PCD_PAY_RST = formData.get('PCD_PAY_RST');
  const PCD_PAY_CODE = formData.get('PCD_PAY_CODE');
  const PCD_PAY_MSG = formData.get('PCD_PAY_MSG');
  const PCD_PAY_OID = formData.get('PCD_PAY_OID');
  const PCD_PAYER_ID = formData.get('PCD_PAYER_ID');  // 빌링키
  const PCD_PAY_CARDRECEIPT = formData.get('PCD_PAY_CARDRECEIPT');
  
  if (PCD_PAY_RST === 'success') {
    // 1. 빌링키(PCD_PAYER_ID) 저장
    // 2. 사용자 구독 상태 업데이트
    // 3. 결제 완료 처리
    
    console.log('결제 성공:', PCD_PAY_OID, PCD_PAYER_ID);
    
    return NextResponse.json({ isOk: true });
  } else {
    console.error('결제 실패:', PCD_PAY_CODE, PCD_PAY_MSG);
    return NextResponse.json({ 
      isOk: false, 
      code: PCD_PAY_CODE, 
      message: PCD_PAY_MSG 
    });
  }
}
```

**SPA를 위한 콜백 처리**:

```typescript
// 클라이언트 사이드
window.onPaypleResult = function(result) {
  if (result.PCD_PAY_RST === 'success') {
    // 구독 페이지로 리다이렉트 또는 상태 업데이트
    router.push('/projects?payment=success');
  } else {
    // 에러 메시지 표시
    toast.error(result.PCD_PAY_MSG);
  }
};
```

---

### 3.3 tRPC와 함께 쓸 때 권장 구조

**아키텍처**:

```
[클라이언트]
    ↓ (tRPC mutation: subscription.create)
[tPC Server]
    ↓ (빌링키 저장, 구독 생성)
[Prisma DB]
    ↓ (비동기)
[Payple API] ←→ [결제창]
```

**권장 패턴**:

1. **결제 시작**: tRPC mutation으로 결제 세션 생성
2. **결제창 호출**: 클라이언트에서 페이플 결제창 표시
3. **결과 수신**: API Route (non-tRPC)에서 웹훅/결과 처리
4. **상태 업데이트**: 처리 완료 후 tRPC를 통해 최신 상태 조회

**예시**:

```typescript
// src/server/routers/payment.ts
import { z } from 'zod';
import { router, protectedProcedure } from '@/lib/trpc/server';

export const paymentRouter = router({
  // 결제 세션 생성
  createSession: protectedProcedure
    .input(z.object({ planId: z.enum(['pro', 'enterprise']) }))
    .mutation(async ({ ctx, input }) => {
      // 1. 결제 세션 레코드 생성
      // 2. 클라이언트에 반환할 인증 토큰 생성
      return { sessionId: '...', clientKey: '...' };
    }),
    
  // 빌링키 저장 (결제창에서 카드 등록 후 호출)
  saveBillingKey: protectedProcedure
    .input(z.object({ payerId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // 사용자 테이블에 빌링키 저장
      await ctx.prisma.user.update({
        where: { id: ctx.session.user.id },
        data: { billingKey: input.payerId }
      });
    }),
    
  // 정기결제 실행
  chargeSubscription: protectedProcedure
    .mutation(async ({ ctx }) => {
      // 저장된 빌링키로 결제 요청
      const result = await paypleCharge({
        payerId: ctx.user.billingKey,
        amount: 9900
      });
      return result;
    })
});
```

---

### 3.4 Vercel serverless에서 IP 화이트리스트 우회

**문제**: Vercel serverless의 IP는 동적으로 변경되어 IP 화이트리스트 사용 어려움

**대안 1: 서명 검증 기반** (권장)

```typescript
// lib/payple-verify.ts
import crypto from 'crypto';

export function verifyPaypleWebhook(body: string, signature: string, secret: string): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex');
    
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}
```

**참고**: 페이플의 웹훅 서명 검증 방법에 대한 공식 문서는 **확인되지 않음**. 타 PG사(포트원, 아젠 등)의 HMAC 검증 방식을 참고할 것.

**대안 2: 결제 결과 조회 API로 검증**

```typescript
// 웹훅 수신 후 직접 조회
async function verifyPayment(orderId: string) {
  const auth = await paypleAuth();
  const result = await fetch('https://democpay.payple.kr/php/payInfo.php', {
    method: 'POST',
    body: JSON.stringify({
      PCD_CST_ID: auth.PCD_CST_ID,
      PCD_CUST_KEY: auth.PCD_CUST_KEY,
      PCD_AUTH_KEY: auth.PCD_AUTH_KEY,
      PCD_PAY_OID: orderId
    })
  });
  return result.json();
}
```

---

### 3.5 실제 GitHub 예제

**공식 샘플 코드**:

1. **PAYPLECORP/sample_nodejs** (Node.js):
   - https://github.com/PAYPLECORP/sample_nodejs
   - 결제, 취소, 정기결제, 링크결제 등 다양한 예제

2. **PAYPLECORP/sample_php** (PHP):
   - https://github.com/PAYPLECORP/sample_php

3. **PAYPLECORP/sample_java** (Java):
   - https://github.com/PAYPLECORP/sample_java

4. **Karoid/payple-rest-client-ruby** (Ruby):
   - https://github.com/Karoid/payple-rest-client-ruby
   - 국내 결제 + 해외 결제 예제 포함

**검색 키워드** (GitHub에서 추가 검색):
- `payple` + `typescript`
- `PCD_PAYER_ID` + `billing`
- `payple` + `next.js`

---

## 4. 데이터 모델 권장

### 4.1 Subscription 테이블 필드 스케치

**현재 스키마** (prisma/schema.prisma):

```prisma
model Subscription {
  id               String   @id @default(cuid())
  userId           String   @unique
  tier             String   @default("free")  // free, pro, demo, enterprise
  dailyGenerations Int      @default(0)
  dailyResetAt     DateTime @default(now())
  user             User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
}
```

**결제 연동을 위한 확장**:

```prisma
model Subscription {
  id               String    @id @default(cuid())
  userId           String    @unique
  tier             String    @default("free")
  dailyGenerations Int       @default(0)
  dailyResetAt     DateTime  @default(now())
  
  // 결제 관련 필드 추가
  billingKey       String?   // 빌링키 (Payple에서 발급)
  billingKeyType   String?   // card, transfer, gpay (해외)
  paymentMethod    String?   // card, kakao, naver
  nextBillingDate  DateTime? // 다음 결제일
  subscriptionId  String?   // 구독 고유 ID (Payple 또는 내부)
  
  // 해외 결제용
  currency         String?   // KRW, USD
  countryCode      String?   // 결제 국가
  
  // 해지 관련
  canceledAt       DateTime? // 해지 요청일
  cancelReason     String?   // 해지 사유
  
  user             User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt
}
```

---

### 4.2 Payment 테이블 (결제 이력)

```prisma
model Payment {
  id              String   @id @default(cuid())
  subscriptionId  String
  userId          String
  
  // Payple 응답 필드
  paypleOrderId   String?  @unique  // PCD_PAY_OID
  payplePayId     String?  //海外결제 시 pay_id
  payerId         String?  // 빌링키 (PCD_PAYER_ID)
  
  // 결제 정보
  amount          Int
  currency        String   @default("KRW")
  status          String   // pending, completed, failed, refunded
  
  // 결제 수단
  paymentType     String   // card, kakao, naver, gpay (해외)
  cardName        String?  // 카드사명
  cardNum         String?  // 마스킹된 카드번호
  
  // 영수증
  receiptUrl      String?
  
  // timestamps
  paidAt          DateTime?
  refundedAt      DateTime?
  createdAt       DateTime @default(now())
  
  subscription    Subscription @relation(fields: [subscriptionId], references: [id])
  
  @@index([userId])
  @@index([subscriptionId])
  @@index([status])
}
```

---

### 4.3 BillingKey 테이블 (결제수단 관리)

```prisma
model BillingKey {
  id              String   @id @default(cuid())
  userId          String
  
  // 빌링키 정보
  payerId         String   // PCD_PAYER_ID 또는 billing_key
  type            String   // domestic_card, domestic_transfer, international_card
  
  // 결제수단 정보
  cardName        String?  // 카드사
  cardNum         String?  // 마스킹 번호
  bankName        String?  // 은행명 (계좌결제 시)
  
  // 상태
  isActive        Boolean  @default(true)
  
  // timestamps
  createdAt       DateTime @default(now())
  lastUsedAt      DateTime?
  
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@unique([userId, payerId])
  @@index([userId])
}
```

---

### 4.4 Invoice 테이블 (청구서)

```prisma
model Invoice {
  id              String   @id @default(cuid())
  subscriptionId  String
  userId          String
  
  // 청구 정보
  periodStart     DateTime // 청구 기간 시작
  periodEnd       DateTime // 청구 기간 끝
  amount          Int
  currency        String   @default("KRW")
  
  // 상태
  status          String   // draft, issued, paid, failed, canceled
  
  // 결제 정보
  paymentId       String?
  
  // PDF URL
  invoiceUrl      String?
  
  createdAt       DateTime @default(now())
  
  subscription    Subscription @relation(fields: [subscriptionId], references: [id])
  payment         Payment?     @relation(fields: [paymentId], references: [id])
  
  @@index([userId])
  @@index([subscriptionId])
  @@index([status])
}
```

---

### 4.5 국내+해외 동시 지원 시 통합 모델 패턴

**통합 결제 레코드 패턴**:

```prisma
// Payment 테이블에 type 필드로 구분
model Payment {
  // ... 기존 필드 ...
  
  // 구분 필드
  paymentRegion   String   @default("domestic") // domestic, international
  
  // 해외 결제 시 추가 필드
  exchangeRate    Decimal? @db.Decimal(10, 4)  // 환율
  originalAmount  String?  // 원화 금액
  submitTimeUtc   DateTime? // UTC 결제 시간
  riskScore       Int?     // 이상거래 탐지 점수
}
```

**빌링키 관리**:

| 구분 | 필드명 | 설명 |
|------|--------|------|
| 국내 | payerId | PCD_PAYER_ID |
| 해외 | billing_key | billing_key |

**결제 API 분기**:

```typescript
async function charge(userId: string, amount: number) {
  const subscription = await prisma.subscription.findUnique({
    where: { userId }
  });
  
  if (subscription.billingKeyType === 'international') {
    // Payple Global API 호출
    return await paypleGlobalCharge({
      billing_key: subscription.billingKey,
      totalAmount: amount,
      currency: 'USD'
    });
  } else {
    // Payple 국내 API 호출
    return await paypleDomesticCharge({
      PCD_PAYER_ID: subscription.billingKey,
      PCD_PAY_TOTAL: amount
    });
  }
}
```

---

## 5. 보안/규제

### 5.1 빌링키/카드토큰 저장 정책

**페이플 정책** (공식 문서):
- PCD_CUST_KEY, service_key는 "외부에 노출되면 안되는 정보입니다. 보안에 유의해주세요."
- 빌링키(PCD_PAYER_ID, billing_key)는 사용자 식별자로 저장 필요

**권장 방식**:
- **PG에 보관**: 빌링키 자체는 암호화하여 저장하거나 DB에 저장 시 암호화
- **카드 정보 직접 저장 금지**: 카드 번호, 유효기간 등 직접 저장 금지
- **빌링키만 저장**: 결제 시 빌링키를 사용하여 PG에서 처리

**참고 링크**:
- 연동준비 (보안): https://docs.payple.kr/preparation/domestic-payment

---

### 5.2 개인정보보호법/PCI-DSS 준수 가이드

**개인정보보호법 준수**:
- 결제 정보는 개인정보 처리 목적에 따라 최소한으로 수집
- 결제 완료 후 불필요한 정보는 즉시 삭제 또는 익명화
- 개인정보 처리方針에 결제 정보 처리 내용 명시

**PCI-DSS 고려**:
- 페이플을 통한 결제이므로 직접적인 PCI-DSS 인증 불필요
- 단, 빌링키를 직접 관리하는 경우 최소한의 보안措施 적용
- 서버 간 TLS v1.2 이상 통신 필수 (공식 문서에서 필수 요구)

**참고 링크**:
- 연동준비 (보안): https://docs.payple.kr/preparation/domestic-payment

---

### 5.3 웹훅 위변조 방지

**확인된 사항**:
- 페이플 개발자센터에서 웹훅 서명 검증에 대한 공식 문서를 **찾을 수 없음**
- 응답 코드 문서에도 서명 검증 관련 정보 없음

**대안적 검증 방법**:

1. **결제 결과 조회 API 활용**:
   - 웹훅을 받으면 PCD_PAY_OID로 직접 조회하여 검증
   - https://docs.payple.kr/operation/domestic-card/result

2. **IP 화이트리스트** (제한적):
   - 페이플 서버 IP를 화이트리스트에 추가
   - 단, Vercel 등 serverless 환경에서는 동적 IP로 인해 제한적

3. **타 PG사 참조**:
   - 포트원: signature_hash 기반 HMAC 검증
   - 아젠: HMAC-SHA256 서명 검증
   - 페이플도 유사한 방식일 것으로 추정되나 공식 문서 확인 필요

**결론**: 웹훅 서명 검증 방법은 **확인되지 않음**. 페이플 고객센터(help@payple.kr)에 직접 문의 필요.

---

## 6. 권장 통합 전략

### 6.1 Splash (Next.js + Prisma SaaS)에 가장 안정적인 통합 순서

**1차 MVP에 빠뜨리면 안 되는 항목**:

| 순서 | 항목 | 설명 |
|------|------|------|
| 1 | 테스트 cpid 발급 | 테스트 환경 구축 |
| 2 | 국내 카드 정기결제 (빌링키) | Pro 월구독의 핵심 기능 |
| 3 | 빌링키 저장 + 구독 상태 관리 | DB 연동 |
| 4 | PCD_RST_URL 결과 처리 | 결제 완료 처리 |
| 5 | 환불 API 연동 | 해지 시 환불 |
| 6 | 영수증 URL 노출 | 매출전표 링크 |

**2차로 미뤄도 되는 항목**:

| 순서 | 항목 | 설명 |
|------|------|------|
| 1 | 카카오페이/네이버페이 | 추가 계약 필요 |
| 2 | 해외 결제 (Payple Global) | 별도 계약 + 테스트 |
| 3 | 부분환불 | 전체환불로 우선 구현 |
| 4 | 웹훅 서명 검증 | 조회 API로 대체 가능 |
| 5 | 자동 정기결제 스케줄러 | 수동 트리거로 우선 |

---

### 6.2 구체적인 구현 로드맵

**Phase 1: 테스트 환경 구축** (1-2일)
1. 테스트 cpid (test/abcd1234567890) 설정
2. .env.local에 환경 변수 추가
3. 테스트 카드 등록 (필요시)

**Phase 2: 결제창 연동** (2-3일)
1. PaypleCheckoutButton 컴포넌트 생성
2. Script 로드 및 CSP 설정
3. PCD_RST_URL로 결과 수신

**Phase 3: 서버 연동** (2-3일)
1. /api/payple/auth 엔드포인트 (파트너 인증)
2. /api/payple/result 엔드포인트 (결과 처리)
3. 빌링키 저장 로직

**Phase 4: 구독 상태 관리** (2-3일)
1. Subscription 테이블 확장
2. tRPC mutation 추가 (upgradeTier, downgradeTier)
3. 일일 카운터와 연계

**Phase 5: 환불/해지** (1-2일)
1. 환불 API 연동
2. 해지 로직 (다음 결제일까지 Pro 유지 후 free 전환)

**Phase 6: 운영 전환** (1일)
1. 라이브 cpid로 전환
2. 도메인 등록 확인

---

### 6.3 환경 변수 권장 구조

```env
# 국내 결제 (테스트)
PAYPLE_TEST_CST_ID=test
PAYPLE_TEST_CUST_KEY=abcd1234567890
PAYPLE_TEST_CLIENT_KEY=test_DF55F29DA654A8CBC0F0A9DD4B556486
PAYPLE_TEST_REFUND_KEY=a41ce010ede9fcbfb3be86b24858806596a9db68b79d138b147c3e563e1829a0

# 국내 결제 (라이브) - 계약 후 발급
PAYPLE_LIVE_CST_ID=
PAYPLE_LIVE_CUST_KEY=
PAYPLE_LIVE_CLIENT_KEY=
PAYPLE_LIVE_REFUND_KEY=

# 해외 결제 (테스트)
PAYPLE_GLOBAL_TEST_SERVICE_ID=demo
PAYPLE_GLOBAL_TEST_SERVICE_KEY=abcd1234567890

# 해외 결제 (라이브) - 계약 후 발급
PAYPLE_GLOBAL_LIVE_SERVICE_ID=
PAYPLE_GLOBAL_LIVE_SERVICE_KEY=

# 가격 설정 (외부화)
PRICE_PRO_MONTH_KRW=9900
PRICE_PRO_MONTH_USD=7.99

# 해지 정책
SUBSCRIPTION_GRACE_PERIOD_DAYS=0  # 다음 결제일까지 유지
```

---

### 6.4 주의사항 요약

1. **도메인 등록**: Referer 도메인이 페이플에 등록되어야 AUTH0004 오류 없음
2. **CSP 설정**: 결제 스크립트 로드를 위해 CSP 설정 필요
3. **모바일**: 인앱 브라우저에서 다이렉트 방식 사용 권장
4. **테스트 카드**: 국내 카드 테스트 시 화이트리스트 등록 필요
5. **웹훅 서명**: 공식 문서 없음, 조회 API로 검증 우회
6. **해외 정기결제**: 지원함, 별도 계약 필요

---

## 부록: 참고 링크 모음

### 공식 문서
- 페이플 개발자센터: https://docs.payple.kr/
- 페이플 서비스 가입: https://www.payple.kr/join-inquiry
- 해외결제 파트너 관리자: https://global.payple.kr/
- 페이플 서비스 소개: https://team.payple.kr/service

### GitHub 샘플 코드
- PAYPLECORP/sample_nodejs: https://github.com/PAYPLECORP/sample_nodejs
- PAYPLECORP/sample_php: https://github.com/PAYPLECORP/sample_php
- PAYPLECORP/sample_java: https://github.com/PAYPLECORP/sample_java
- PAYPLECORP/sample_python: https://github.com/PAYPLECORP/sample_python
- Karoid/payple-rest-client-ruby: https://github.com/Karoid/payple-rest-client-ruby

### 주요 기능별 문서
- 국내카드 정기결제: https://docs.payple.kr/integration/domestic-card/billing
- 해외카드 정기결제: https://docs.payple.kr/integration/international-card/billing
- 환불 API: https://docs.payple.kr/operation/domestic-card/cancel
- 응답코드: https://docs.payple.kr/response-code
- 자주묻는질문: https://docs.payple.kr/faq

---

**문서 작성자**: Research Agent  
**최종 업데이트**: 2026-04-27