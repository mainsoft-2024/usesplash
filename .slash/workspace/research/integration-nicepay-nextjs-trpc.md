# Research: NICEPAY Server-Approval Integration for Next.js 15 + tRPC + Prisma

**Date:** 2026-05-08

**Stack:** Next.js 15 (App Router) + tRPC v11 + Prisma 7 + PostgreSQL (Neon)

**Integration Model:** Server-approval (2-Transaction) + Basic Authentication

---

## Summary

This brief documents the technical integration of NICEPAY (나이스페이먼츠) Server-approval model into a Next.js 15 App Router + tRPC + Prisma stack. The Server-approval model separates authentication (payment window) from authorization (API call), providing better control over payment flow, idempotency, and fraud prevention compared to Client-approval. This document covers all required APIs, authentication flows, error handling, and implementation patterns.

---

## 1. Official Endpoints & API Reference

### 1.1 JS SDK Loader URL

| Environment | URL |
|-------------|-----|
| Production | `https://pay.nicepay.co.kr/v1/js/` |
| Sandbox | `https://sandbox-pay.nicepay.co.kr/v1/js/` |

**Evidence:** Official NICEPAY development guide specifies these exact URLs for JS SDK inclusion.

### 1.2 API Base URLs

| Environment | Base URL |
|-------------|----------|
| Production API | `https://api.nicepay.co.kr` |
| Sandbox API | `https://sandbox-api.nicepay.co.kr` |

**Evidence:** From NICEPAY API documentation at https://start.nicepay.co.kr/manual/quickguide/overview.do

### 1.3 Payment Window (AUTHNICE.requestPay) Parameters

The JS SDK is loaded via `<script src="https://pay.nicepay.co.kr/v1/js/"></script>` and the payment window is invoked using `AUTHNICE.requestPay({...})`.

**Request Parameters:**

| Parameter | Type | Required | Max Length | Description |
|-----------|------|----------|-------------|-------------|
| `clientId` | String | O | 50 | Merchant identifier issued by NICEPAY (Server-approval clientId: starts with `S2_` for sandbox, `R2_` for production) |
| `method` | String | O | 20 | Payment method: `card` (credit card), `bank` (account transfer), `vbank` (virtual account), `cellphone` (mobile), `naverpayCard`, `kakaopay`, `kakaopayCard`, `kakaopayMoney`, `samsungpayCard`, `payco`, `ssgpay`, `cardAndEasyPay` |
| `orderId` | String | O | 64 | Unique merchant order number. **Must not be reused after successful payment.** |
| `amount` | Integer | O | 12 | Payment amount (numbers only, no decimal) |
| `goodsName` | String | O | 40 | Product name. Special characters `"` and `¦` are replaced with `-` |
| `returnUrl` | String | O | 500 | URL to receive authentication result via POST after payment window closes |
| `vbankHolder` | String | - | 30 | Virtual account depositor name (required for `vbank` method) |
| `mallReserved` | String | - | 500 | Merchant reserved field (JSON recommended), returned in approval response |
| `taxFreeAmt` | Integer | - | 12 | Tax-free portion of amount |
| `useEscrow` | Boolean | - | - | Escrow payment (`true`/`false`) |
| `currency` | String | - | 3 | Currency code (default: `KRW`) |
| `language` | String | - | 2 | Payment window language: `KO`, `EN`, `CN` |
| `buyerName` | String | - | 30 | Buyer name |
| `buyerEmail` | String | - | 60 | Buyer email |
| `buyerTel` | String | - | 20 | Buyer phone (hyphen-less numbers) |
| `mallUserId` | String | - | 50 | Merchant-managed user ID |
| `cardCode` | String | - | - | Specific card company code to display (comma-separated, e.g., `04,06`) |
| `cardQuota` | String | - | - | Installment options (comma-separated, `00` for lump sum, e.g., `00,03,06`) |

**Evidence:** From NICEPAY official API documentation at https://github.com/nicepayments/nicepay-manual/blob/main/api/payment-window-server.md

### 1.4 returnUrl POST Response (Authentication Result)

After successful authentication in the payment window, NICEPAY sends a POST request to `returnUrl` with the following form-encoded parameters:

| Parameter | Type | Description |
|-----------|------|-------------|
| `authResultCode` | String | Authentication result code. `0000` = success, other codes indicate failure |
| `authResultMsg` | String | Authentication result message |
| `tid` | String (30) | Transaction ID - used for approval API call |
| `clientId` | String (50) | Merchant clientId |
| `orderId` | String (64) | Merchant order number |
| `amount` | String (12) | Payment amount |
| `authToken` | String (40) | One-time authentication token |
| `signature` | String (256) | Anti-tampering signature: `hex(sha256(authToken + clientId + orderId + amount + SecretKey))` |
| `mallReserved` | String (500) | Merchant reserved field passed in request |

**Evidence:** From NICEPAY official documentation - the authentication response is sent as form-urlencoded POST to the merchant's returnUrl.

### 1.5 Approval API (Payment Authorization)

**Endpoint:** `POST https://api.nicepay.co.kr/v1/payments/{tid}`

**Request:**

```bash
curl -X POST 'https://api.nicepay.co.kr/v1/payments/UT0000113m01012111051714341073' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Basic UzJfYWY0NTQzYTBiZTRkNDlhOTgxMjJlMDFlYzIwNTlhNTY6OWViODU2MDcxMDM2NDZkYTlmOWMwMmIxMjhmMmU1ZWU=' \
  -d '{"amount": 1004}'
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `amount` | Integer | O | Payment amount (must match the amount from returnUrl POST) |
| `ediDate` | String | - | Request timestamp (ISO 8601 format). If not provided, server generates. |
| `signData` | String | - | Anti-tampering data: `hex(sha256(tid + amount + ediDate + SecretKey))`. Optional if amount is provided. |

**Authorization Header:** `Authorization: Basic base64(clientId:secretKey)`

**Response:**

```json
{
  "resultCode": "0000",
  "resultMsg": "정상 처리되었습니다.",
  "tid": "UT0000113m01012111051714341073",
  "cancelledTid": null,
  "orderId": "c74a5960-830b-4cd8-82a9-fa1ce739a18f",
  "ediDate": "2021-11-05T17:14:35.150+0900",
  "signature": "63b251b31c909eebef1a9f4fcc19e77bdcb8f64fc1066a29670f8627186865cd",
  "status": "paid",
  "paidAt": "2021-11-05T17:14:35.000+0900",
  "failedAt": "0",
  "cancelledAt": "0",
  "payMethod": "CARD",
  "amount": 1004,
  "balanceAmt": 1004,
  "goodsName": "나이스페이-상품",
  "mallReserved": null,
  "useEscrow": false,
  "currency": "KRW",
  "channel": "pc",
  "approveNo": "000000",
  "buyerName": null,
  "buyerTel": null,
  "buyerEmail": null,
  "receiptUrl": "https://npg.nicepay.co.kr/issue/IssueLoader.do?type=0&innerWin=Y&TID=UT0000113m01012111051714341073",
  "mallUserId": null,
  "issuedCashReceipt": false,
  "coupon": null,
  "card": {
    "cardCode": "04",
    "cardName": "삼성",
    "cardNum": "12341234****1234",
    "cardQuota": 0,
    "isInterestFree": false,
    "cardType": "credit",
    "canPartCancel": true,
    "acquCardCode": "04",
    "acquCardName": "삼성"
  },
  "vbank": null,
  "cancels": null,
  "cashReceipts": null
}
```

**Evidence:** From NICEPAY official documentation at https://github.com/nicepayments/nicepay-manual/blob/main/api/payment-window-server.md and https://start.nicepay.co.kr/manual/quickguide/overview.do

### 1.6 Cancel API

**Endpoint:** `POST https://api.nicepay.co.kr/v1/payments/{tid}/cancel`

**Request:**

```bash
curl -X POST 'https://api.nicepay.co.kr/v1/payments/nicuntct1m0101210727200125A056/cancel' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Basic YWYwZDExNjIzNmRmNDM3...' \
  -d '{
      "reason": "customer cancellation request",
      "orderId": "merchant-order-id",
      "cancelAmt": 1004,
      "taxFreeAmt": 0
    }'
```

| Parameter | Type | Required | Max Length | Description |
|-----------|------|----------|-------------|-------------|
| `reason` | String | O | 100 | Cancellation reason |
| `orderId` | String | O | 64 | Merchant order number. **For partial cancel, cannot reuse the same orderId** |
| `cancelAmt` | Integer | - | 12 | Partial cancel amount. If omitted, full cancel. |
| `mallReserved` | String | - | 500 | Merchant reserved field |
| `ediDate` | String | - | - | Request timestamp (ISO 8601) |
| `signData` | String | - | 256 | Anti-tampering: `hex(sha256(tid + ediDate + SecretKey))` |
| `taxFreeAmt` | Integer | - | 12 | Tax-free portion of cancel amount |
| `refundAccount` | String | - | 16 | Refund account number (for virtual account refund) |
| `refundBankCode` | String | - | 3 | Refund bank code |
| `returnCharSet` | String | - | 10 | Response encoding: `utf-8` (default) / `euc-kr` |

**Response:** Similar to approval response, with `status: "cancelled"` or `status: "partialCancelled"`.

**Evidence:** From NICEPAY API documentation - https://github.com/nicepayments/nicepay-manual/blob/main/api/cancel.md

### 1.7 Transaction Lookup APIs

| Endpoint | Method | Description |
|-----------|--------|-------------|
| `/v1/payments/{tid}` | GET | Get transaction by TID |
| `/v1/payments/find/{orderId}` | GET | Get transaction by orderId |
| `/v1/check-amount/{tid}` | POST | Verify authorization amount (for Client-approval model security) |

**Evidence:** From NICEPAY API URI list at https://github.com/nicepayments/nicepay-manual/blob/main/common/api.md

### 1.8 Billing Key (Subscription) APIs

Billing key APIs are server-only operations that require encrypted card data.

#### 1.8.1 Billing Key Issue (Regist)

**Endpoint:** `POST https://api.nicepay.co.kr/v1/subscribe/regist`

**Request:**

```bash
curl -X POST 'https://api.nicepay.co.kr/v1/subscribe/regist' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Basic ZWVjOGQzNTA4Y2IwNDI1ZGI5NTViMzBiZjM5...' \
  -d '{
      "encData": "{AES-256-CBC encrypted card data}",
      "orderId": "{unique orderId}"
    }'
```

**encData Plain-text Format:**
```
cardNo={cardNumber}&expYear={YY}&expMonth={MM}&idNo={ID number}&cardPw={card password}
```

**Encryption (encMode: A2):**
- Algorithm: AES-256-CBC
- Key: Merchant SecretKey (32 bytes)
- IV: First 16 characters of SecretKey
- Padding: PKCS5
- Output encoding: Hex

**signData:** `hex(sha256(orderId + ediDate + SecretKey))`

**Response:**
```json
{
  "resultCode": "0000",
  "resultMsg": "정상 처리되었습니다.",
  "tid": "{billing key issue transaction ID}",
  "bid": "{billing key - store this}",
  "orderId": "{orderId}",
  "ediDate": "2023-02-14T18:41:26.100+0900",
  "cardNo": "12341234****1234",
  "cardCode": "06",
  "cardName": "신한"
}
```

#### 1.8.2 Billing Payment (Authorization)

**Endpoint:** `POST https://api.nicepay.co.kr/v1/subscribe/{bid}/payments`

**Request:**
```bash
curl -X POST 'https://api.nicepay.co.kr/v1/subscribe/{bid}/payments' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Basic ZWVjOGQzNTA4Y2IwNDI1ZGI5NTViMzBiZjM5...' \
  -d '{
      "orderId": "{unique orderId}",
      "amount": 500,
      "goodsName": "테스트 상품",
      "cardQuota": "0",
      "useShopInterest": false
    }'
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `orderId` | String | O | Unique order number |
| `amount` | Integer | O | Payment amount |
| `goodsName` | String | O | Product name |
| `cardQuota` | String | O | Installment: `0` = lump sum, `2` = 2 months, etc. |
| `useShopInterest` | Boolean | O | Store bears interest (`false` only currently supported) |

#### 1.8.3 Billing Key Expire (Delete)

**Endpoint:** `POST https://api.nicepay.co.kr/v1/subscribe/{bid}/expire`

**Request:** Empty body, requires Basic auth header.

**Evidence:** From NICEPAY Billing API documentation - https://github.com/nicepayments/nicepay-manual/blob/main/api/payment-subscribe.md

### 1.9 Cash Receipt APIs

#### 1.9.1 Issue Cash Receipt

**Endpoint:** `POST https://api.nicepay.co.kr/v1/receipt`

**Request:**
```bash
curl -X POST 'https://api.nicepay.co.kr/v1/receipt' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Basic YWYwZDExNjIzNmRmNDM3ZjQ4...' \
  -d '{
      "orderId": "merchant-order-id",
      "amount": 1000,
      "goodsName": "나이스상품",
      "receiptType": "individual",
      "receiptNo": "01012341234",
      "supplyAmt": 250,
      "goodsVat": 250,
      "taxFreeAmt": 250,
      "serviceAmt": 250
    }'
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `orderId` | String | O | Order number |
| `amount` | Integer | O | Receipt amount |
| `goodsName` | String | O | Product name |
| `receiptType` | String | O | `individual` (personal) or `company` (business) |
| `receiptNo` | String | O | Phone number (10-11 digits) or business number (10 digits) |
| `supplyAmt` | Integer | O | Supply amount |
| `goodsVat` | Integer | O | VAT |
| `taxFreeAmt` | Integer | - | Tax-free amount |
| `serviceAmt` | Integer | - | Service fee |
| `buyerName` | String | - | Buyer name |
| `buyerTel` | String | - | Buyer phone |
| `buyerEmail` | String | - | Buyer email |

#### 1.9.2 Cancel Cash Receipt

**Endpoint:** `POST https://api.nicepay.co.kr/v1/receipt/{tid}/cancel`

#### 1.9.3 Lookup Cash Receipt

**Endpoint:** `GET https://api.nicepay.co.kr/v1/receipt/{tid}`

**Evidence:** From NICEPAY Cash Receipt API documentation - https://github.com/nicepayments/nicepay-manual/blob/main/api/payment-receipt.md

---

## 2. Basic Authentication

### 2.1 Authentication Method

NICEPAY Server-approval uses **HTTP Basic Authentication** with the following format:

```
Authorization: Basic base64(clientId:secretKey)
```

**Example:**
```bash
# Original credentials
clientId: "S2_af4543a0be4d49a98122e01ec2059a56"
secretKey: "9eb85607103646da9f9c02b128f2e5ee"

# Base64 encoded
# "S2_af4543a0be4d49a98122e01ec2059a56:9eb85607103646da9f9c02b128f2e5ee"
# Result: UzJfYWY0NTQzYTBiZTRkNDlhOTgxMjJlMDFlYzIwNTlhNTY6OWViODU2MDcxMDM2NDZkYTlmOWMwMmIxMjhmMmU1ZWU=
```

### 2.2 Security Requirement

**⚠️ CRITICAL:** The `secretKey` must NEVER be exposed to the browser. All API calls that require Basic authentication must be made from the server-side (tRPC procedure or API route handler).

**Evidence:** From NICEPAY official documentation - Basic authentication is used for Server-approval model, and secretKey must be kept confidential.

---

## 3. Server-Approval Lifecycle

### 3.1 Complete Flow

```
┌──────────┐    1. requestPay()    ┌────────────┐
│ Browser  │ ──────────────────→│ NICEPAY   │
│          │                    │ JS SDK    │
└──────────┘                    └────────────┘
                                       │
                                       │ 2. Payment Window
                                       ▼
                               ┌────────────┐
                               │ Card Co.  │
                               │ / Bank   │
                               └────────────┘
                                       │
                                       │ 3. Auth Result (form POST)
                                       ▼
┌──────────┐    4. POST to returnUrl   ┌────────────┐
│ Merchant │ ←───────────────────────│ NICEPAY   │
│ Server   │   (authResultCode, tid,  │           │
│ (tRPC)   │    orderId, amount,     │           │
│          │    signature, ...)       │           │
└──────────┘                         └────────────┘
        │
        │ 5. Validate amount, signature
        │
        │ 6. POST /v1/payments/{tid}
        ▼                   (Basic auth)
┌──────────┐  ──────────────────────→┌────────────┐
│ NICEPAY  │                         │ API       │
│ Server  │ ←────────────────────── │           │
└──────────┘    7. Approval Result  └────────────┘
        │
        │ 8. Update order status
        ▼
┌──────────┐
│ Database │
└──────────┘
```

### 3.2 Step-by-Step Description

**Step 1-2:** User clicks "Pay" button → Browser calls `AUTHNICE.requestPay({ clientId, method, orderId, amount, goodsName, returnUrl })` → Payment window opens.

**Step 3:** User completes payment in payment window → NICEPAY sends POST to `returnUrl` with authentication result (form-encoded).

**Step 4:** Server receives POST to `returnUrl` handler (e.g., `app/api/payment/return/route.ts`).

**Step 5:** Server validates:
- Check `authResultCode === "0000"`
- Validate that `amount` matches expected amount from database
- (Optional but recommended) Validate `signature` using: `hex(sha256(authToken + clientId + orderId + amount + SecretKey))`

**Step 6:** Server calls approval API: `POST /v1/payments/{tid}` with body `{ amount }` and Basic auth header.

**Step 7:** Approval API returns transaction status (`paid`, transaction details).

**Step 8:** Server updates order status in database, returns success to client.

### 3.3 Important Notes

- **authResultCode "0000" means authentication succeeded, NOT that payment is complete.** Payment is only complete after calling the approval API.
- **If approval API is not called, no actual payment is processed** (this is by design for Server-approval).
- **orderId cannot be reused** after a successful payment. Attempting to reuse will result in error.
- **Amount must be validated** before calling approval API to prevent tampering.

**Evidence:** From NICEPAY official documentation - Server approval model requires explicit approval API call after successful authentication.

---

## 4. Idempotency & Locking Pattern

### 4.1 Problem Statement

The Server-approval flow involves two separate HTTP requests:
1. Original tRPC call that initiates payment (returns payment window URL to client)
2. POST to `returnUrl` from NICEPAY (triggering approval API call)

There is a gap between these requests where network issues, timeouts, or double-submissions can cause problems.

### 4.2 Recommended Pattern: Unique orderId Constraint + Processing Flag

**Database Schema (Prisma):**

```prisma
model Order {
  id            String   @id @default(cuid())
  orderId       String   @unique  // NICEPAY orderId - must be unique
  status       String   @default("pending")  // pending, processing, paid, cancelled
  amount       Int
  paidAt       DateTime?
  tid          String?  // NICEPAY transaction ID
  // ... other fields
}
```

**Implementation Pattern:**

```typescript
// In tRPC procedure or returnUrl handler
async function processPayment(orderId: string, tid: string, amount: number) {
  // Use database transaction for atomicity
  await prisma.$transaction(async (tx) => {
    // 1. Check current status
    const order = await tx.order.findUnique({ where: { orderId } });
    
    if (!order) {
      throw new Error('Order not found');
    }
    
    if (order.status === 'paid') {
      // Already processed - return success (idempotent)
      return;
    }
    
    if (order.status === 'processing') {
      // Another request is processing - could use advisory lock or timeout
      throw new Error('Payment already processing');
    }
    
    if (order.amount !== amount) {
      // Amount mismatch - possible tampering
      throw new Error('Amount mismatch');
    }
    
    // 2. Mark as processing
    await tx.order.update({
      where: { orderId },
      data: { status: 'processing', tid }
    });
    
    // 3. Call approval API (server-side)
    const approvalResult = await nicepayApprove(tid, amount);
    
    if (approvalResult.resultCode !== '0000') {
      // Failed - revert status
      await tx.order.update({
        where: { orderId },
        data: { status: 'pending' }
      });
      throw new Error(approvalResult.resultMsg);
    }
    
    // 4. Mark as paid
    await tx.order.update({
      where: { orderId },
      data: { 
        status: 'paid',
        paidAt: new Date()
      }
    });
  });
}
```

### 4.3 Advisory Lock (Alternative for High Concurrency)

For scenarios with high concurrency, use PostgreSQL advisory locks:

```typescript
async function processPaymentWithLock(orderId: string, tid: string, amount: number) {
  // Acquire advisory lock (orderId hash as lock key)
  const lockKey = BigInt(hashString(orderId));
  
  await prisma.$transaction(async (tx) => {
    // pg_advisory_xact_lock is not available in Prisma
    // Use raw query
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(${lockKey})`;
    
    // ... rest of processing logic
  });
}
```

### 4.4 Webhook Idempotency

Webhook handlers must also implement idempotency using the same pattern:

```typescript
async function handleWebhook(event: NicepayWebhook) {
  const { tid, orderId, status, amount } = event;
  
  await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { orderId } });
    
    if (!order || order.status === 'paid') {
      // Already processed
      return;
    }
    
    // Validate and process
    // ...
  });
}
```

**Evidence:** From NICEPAY webhook documentation at https://github.com/nicepayments/nicepay-manual/wiki/webhook-1transaction

---

## 5. Error Codes

### 5.1 API Response Codes

| resultCode | Meaning | User Message (Korean) | Recommended Action |
|-----------|---------|----------------------|-------------------|
| `0000` | Success | (none) | Process payment |
| `2001` | Invalid order | 주문 정보를 확인해 주세요. | Check order |
| `2002` | Already processed | 이미 처리된 주문입니다. | Skip (idempotent) |
| `2003` | Order expired | 주문 시간이 만료되었습니다. | Prompt to retry |
| `4001` | Insufficient funds | 잔액이 부족합니다. | Request different payment method |
| `4002` | Card expired | 카드가 만료되었습니다. | Request different card |
| `4003` | Invalid card | 사용할 수 없는 카드입니다. | Request different payment method |
| `4004` | Fraud suspicion | 보안 결제가 필요합니다. | Contact support |
| `5001` | System error | 시스템 오류가 발생했습니다. | Retry later |
| `5002` | Network error | 통신 중 오류가 발생했습니다. | Retry |

### 5.2 JS SDK Response Codes

| code | Message | Description |
|------|---------|-------------|
| `0` | (empty) | Success |
| `-1` | cancelled | User cancelled |
| `-10` | Error | Unknown error |

### 5.3 Handling Guidelines

1. **Amount mismatch:** Always validate amount before approval API call. If mismatch, reject and log for security audit.

2. **Signature mismatch:** If signature validation fails, reject and log. Do not call approval API.

3. **Network timeout:** 
   - For returnUrl timeout: Process via webhook (if registered)
   - For approval API timeout: Implement retry with idempotency (using same orderId is not allowed - must create new order or use different mechanism)

4. **Double-submit:**
   - First request processes successfully, second returns "already processed"
   - Use database constraint on orderId + status check

5. **Fraud detection:** 
   - Log all failed validations
   - Consider blocking repeated failures

**Evidence:** From NICEPAY Error code documentation - https://github.com/nicepayments/nicepay-manual/blob/main/common/code.md

---

## 6. Server-Approval vs Client-Approval Comparison

| Aspect | Server-Approval | Client-approval |
|--------|---------------|-----------------|
| Payment flow | 2-step (auth → approve) | 1-step (auth + approve together) |
| Control | Full amount validation before charge | Amount validation after charge |
| Idempotency | Easier to implement | Requires webhook for backup |
| Implementation complexity | Slightly higher | Simpler |
| Network dependency | Lower risk | Higher risk (timeout = unknown status) |
| Fraud prevention | Stronger | Weaker |
| Recommended for | High-value, recurring payments | Low-value, one-time payments |
| Our choice | ✅ Selected | ❌ Not selected |

### 6.1 Next.js App Router Considerations

1. **returnUrl Handler:**
   - Create as API Route: `app/api/payment/return/route.ts`
   - Must handle form-encoded POST from NICEPAY
   - Use Node.js runtime (not Edge) for crypto operations

2. **Webhook Handler:**
   - Create as API Route: `app/api/payment/webhook/route.ts`
   - Must verify signature before processing
   - Respond with HTTP 200 + "OK" (text/html)
   - Use Node.js runtime

3. **Runtime:**
   - Approval API calls: Node.js runtime (crypto, HTTP client)
   - Database operations: Prisma with PostgreSQL

4. **maxDuration:**
   - Set returnUrl handler maxDuration to 60-300 seconds (payment window + approval API + DB update)

**Evidence:** From NICEPAY documentation and Next.js App Router best practices.

---

## 7. Vercel Deployment Specifics

### 7.1 IP Allowlist

Allow inbound traffic from NICEPAY servers:

| IP Address | Purpose |
|-----------|---------|
| 121.133.126.56 | dc1-api.nicepay.co.kr |
| 211.44.32.56 | dc2-api.nicepay.co.kr |

Configure Vercel Firewall or Edge Function IP rules if available, or implement IP checking in webhook handler.

### 7.2 Webhook Timeout

NICEPAY has a webhook timeout. Recommendations:

1. **Respond within 5 seconds** - Process async
2. Use background processing (queue, cron) if needed
3. Respond immediately with 200 OK, process later

### 7.3 Vercel Function Configuration

In `vercel.json` or deployment settings:

```json
{
  "functions": {
    "app/api/payment/return/route.ts": {
      "maxDuration": 300
    },
    "app/api/payment/webhook/route.ts": {
      "maxDuration": 60
    }
  }
}
```

### 7.4 Environment

The app runs in Vercel serverless environment:
- Outbound HTTPS to api.nicepay.co.kr is supported
- No special firewall configuration needed for outbound

**Evidence:** From NICEPAY firewall documentation at https://developers.nicepay.co.kr/

---

## 8. Environment Variables

| Variable | Description | Required | Example |
|----------|-------------|----------|---------|
| `NICEPAY_CLIENT_ID` | Merchant clientId (Server-approval) | Yes | `S2_af4543a0be4d49a98122e01ec2059a56` |
| `NICEPAY_SECRET_KEY` | Merchant secretKey | Yes | `9eb85607103646da9f9c02b128f2e5ee` |
| `NICEPAY_API_BASE` | API base URL (defaults to https://api.nicepay.co.kr) | No | `https://api.nicepay.co.kr` |
| `NICEPAY_JS_SDK_URL` | JS SDK URL (defaults to https://pay.nicepay.co.kr/v1/js/) | No | `https://pay.nicepay.co.kr/v1/js/` |
| `NICEPAY_RETURN_URL` | Payment return URL | Yes | `https://yourdomain.com/api/payment/return` |
| `NICEPAY_WEBHOOK_URL` | Webhook URL | Recommended | `https://yourdomain.com/api/payment/webhook` |

**Note:** Never expose `NICEPAY_SECRET_KEY` to client-side code. All API calls must be server-side.

---

## 9. Billing Key Storage

### 9.1 Data to Store

| Field | Store? | Notes |
|-------|--------|-------|
| `bid` | ✅ Required | Billing key for future payments |
| `last4` | ✅ Recommended | Display to user (e.g., ****1234) |
| `brand` | ✅ Recommended | Card brand (Visa, Mastercard, etc.) |
| `cardCode` | Optional | NICEPAY card code |
| `expMonth` | ✅ Required | For expiry display |
| `expYear` | ✅ Required | For expiry display |

### 9.2 Data NOT to Store

| Field | Never Store | Reason |
|-------|------------|---------|
| Full card number (PAN) | ❌ | PCI-DSS violation |
| Card expiry (full) | ❌ | PCI-DSS violation |
| ID number | ❌ | Personal data |
| Card password | ❌ | Security |

### 9.3 Database Schema (Prisma)

```prisma
model BillingKey {
  id        String   @id @default(cuid())
  userId    String
  bid       String   @unique  // NICEPAY billing key
  last4    String           // e.g., "1234"
  brand    String           // e.g., "visa", "mastercard"
  cardCode String?         // NICEPAY card code
  expMonth Int            // 1-12
  expYear  Int            // e.g., 2028
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  user     User     @relation(fields: [userId], references: [id])
}
```

---

## 10. Common Gotchas

### 10.1 Korean Encoding (returnCharSet)

- **Issue:** returnUrl POST from NICEPAY may use `euc-kr` encoding by default
- **Solution:** Explicitly set `returnCharSet=utf-8` in request parameters if possible, or handle encoding conversion
- **Evidence:** NICEPAY documentation specifies `returnCharSet` parameter for response encoding

### 10.2 Amount Tampering

- **Issue:** Attackers may manipulate amount in returnUrl POST
- **Solution:** Always validate amount against database before calling approval API
- **Additional:** Use signature validation from returnUrl POST

### 10.3 mallReserved JSON

- **Issue:** If passing JSON in `mallReserved`, it must be URL-encoded properly
- **Solution:** Use `encodeURIComponent(JSON.stringify(data))` before passing

### 10.4 signData Generation Rules

Different APIs use different signData formulas:

| API | Formula |
|-----|---------|
| Approval | `hex(sha256(tid + amount + ediDate + SecretKey))` |
| Cancel | `hex(sha256(tid + ediDate + SecretKey))` |
| Billing Issue | `hex(sha256(orderId + ediDate + SecretKey))` |
| Cash Receipt | `hex(sha256(orderId + amount + ediDate + SecretKey))` |

### 10.5 Virtual Account Notifications

- **Issue:** Virtual account issuance (`status: ready`) and deposit (`status: paid`) are different events
- **Solution:** Register webhook and handle both status types
- **Important:** Deposit notification only comes via webhook, not returnUrl

### 10.6 Partial Cancel / taxFreeAmt

- **Issue:** Partial cancel requires careful handling of tax-free amounts
- **Solution:** Calculate tax proportionally: `cancelAmt * (taxFreeAmt / originalAmount)`
- **Evidence:** NICEPAY cancel API documentation

### 10.7 orderId Reuse

- **Issue:** Using same orderId for retry after success causes error
- **Solution:** Generate new orderId for each payment attempt
- **Evidence:** NICEPAY documentation explicitly states "결제된 orderId로 재호출 불가"

### 10.8 Webhook Response

- **Issue:** Webhook must respond with HTTP 200 and body "OK" (text/html)
- **Solution:** 
```typescript
// Next.js API route
return new Response('OK', {
  status: 200,
  headers: { 'Content-Type': 'text/html' }
});
```

### 10.9 Edge Runtime Limitation

- **Issue:** tRPC routes with Edge runtime cannot make outbound HTTPS calls to some APIs
- **Solution:** Use Node.js runtime for payment-related routes

---

## 11. GitHub Examples

### 11.1 Official NICEPAY Manual Repository

**Repository:** https://github.com/nicepayments/nicepay-manual

Contains official API documentation, sample code, and integration guides.

**Relevant Files:**
- `/api/payment-window-server.md` - Server approval payment window
- `/api/payment-subscribe.md` - Billing APIs
- `/api/payment-receipt.md` - Cash receipt APIs
- `/api/cancel.md` - Cancel APIs
- `/common/api.md` - API URI list
- `/common/code.md` - Error codes

### 11.2 Sample Code Patterns

From the official repository, key patterns for Server-approval:

**Payment Window Call:**
```html
<script src="https://pay.nicepay.co.kr/v1/js/"></script>
<script>
function serverAuth() {
  AUTHNICE.requestPay({
    clientId: 'S2_af4543a0be4d49a98122e01ec2059a56',
    method: 'card',
    orderId: 'your-unique-orderid',
    amount: 1004,
    goodsName: '나이스페이-상품',
    returnUrl: 'http://localhost:3000/serverAuth'
  });
}
</script>
```

**Approval API Call:**
```bash
curl -X POST 'https://api.nicepay.co.kr/v1/payments/{tid}' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Basic {base64(clientId:secretKey)}' \
  -d '{"amount": 1004}'
```

**Evidence:** From official NICEPAY sample code in repository.

---

## 12. Endpoint Quick Reference Table

| API | Method | Endpoint | Auth | Body |
|-----|--------|----------|------|------|
| Payment Window | JS SDK | `https://pay.nicepay.co.kr/v1/js/` | None | (client-side) |
| Approve | POST | `/v1/payments/{tid}` | Basic | `{amount}` |
| Cancel | POST | `/v1/payments/{tid}/cancel` | Basic | `{reason, orderId, cancelAmt?}` |
| Lookup by TID | GET | `/v1/payments/{tid}` | Basic | - |
| Lookup by Order | GET | `/v1/payments/find/{orderId}` | Basic | - |
| Verify Amount | POST | `/v1/check-amount/{tid}` | Basic | `{amount}` |
| Billing Issue | POST | `/v1/subscribe/regist` | Basic | `{encData, orderId}` |
| Billing Pay | POST | `/v1/subscribe/{bid}/payments` | Basic | `{orderId, amount, goodsName, cardQuota, useShopInterest}` |
| Billing Expire | POST | `/v1/subscribe/{bid}/expire` | Basic | - |
| Cash Receipt | POST | `/v1/receipt` | Basic | `{orderId, amount, goodsName, receiptType, receiptNo, ...}` |
| Cash Receipt Cancel | POST | `/v1/receipt/{tid}/cancel` | Basic | - |
| Cash Receipt Lookup | GET | `/v1/receipt/{tid}` | Basic | - |
| Webhook Create | POST | `/v1/webhook` | Basic | `{method, url, managerEmail}` |
| Webhook List | GET | `/v1/webhook` | Basic | - |
| Webhook Update | POST | `/v1/webhook/{method}/update` | Basic | `{url}` |

---

## 13. Recommended Implementation Checklist

- [ ] Environment variables configured (`NICEPAY_CLIENT_ID`, `NICEPAY_SECRET_KEY`, etc.)
- [ ] returnUrl API route created (form POST handler, Node.js runtime)
- [ ] Webhook API route created (signature validation, Node.js runtime)
- [ ] Database schema updated with order/transaction status tracking
- [ ] Idempotency logic implemented (unique constraint + status check)
- [ ] Amount validation before approval API call
- [ ] Signature validation for webhook events
- [ ] Error handling with user-friendly messages
- [ ] Logging for payment events (security audit)
- [ ] Billing key storage schema (bid, last4, brand, expiry only)
- [ ] Cash receipt integration (if needed)
- [ ] Test with sandbox environment before production

---

## References

1. NICEPAY Official Documentation: https://start.nicepay.co.kr/manual/quickguide/overview.do
2. NICEPAY GitHub Manual: https://github.com/nicepayments/nicepay-manual
3. NICEPAY Developers Portal: https://developers.nicepay.co.kr/
4. Payment Window API: https://github.com/nicepayments/nicepay-manual/blob/main/api/payment-window-server.md
5. Billing API: https://github.com/nicepayments/nicepay-manual/blob/main/api/payment-subscribe.md
6. Cancel API: https://github.com/nicepayments/nicepay-manual/blob/main/api/cancel.md
7. Webhook API: https://github.com/nicepayments/nicepay-manual/blob/main/api/hook.md
8. Cash Receipt API: https://github.com/nicepayments/nicepay-manual/blob/main/api/payment-receipt.md
9. API URI List: https://github.com/nicepayments/nicepay-manual/blob/main/common/api.md
10. Error Codes: https://github.com/nicepayments/nicepay-manual/blob/main/common/code.md