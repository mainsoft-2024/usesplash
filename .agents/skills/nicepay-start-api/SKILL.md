---
name: nicepay-start-api
description: NICEPAY 결제 연동 (결제창·승인·취소·빌링·현금영수증·조회·QnA) — MCP가 vendor/에 번들됨, mcp-to-skill exec로 호출
license: MIT
compatibility: opencode
metadata:
  bundled-mcp: "@nicepay/start-api-mcp@0.0.10"
  bundled-location: vendor/nicepay-start-api-mcp
  generator: mcp-to-skill
  generator-repo: https://github.com/larkinwc/ts-mcp-to-skill
---

# nicepay-start-api

NICEPAY **start.nicepay.co.kr** 연동용 MCP입니다. **네트워크로 `npx @nicepay/...`를 받지 않습니다.** `@nicepay/start-api-mcp@0.0.10` 전체(런타임 의존성 포함)가 `vendor/nicepay-start-api-mcp/`에 들어 있고, `launch-start-api.cjs`가 올바른 `cwd`로 `dist/index.js`를 띄웁니다.

도구 목록·호출 방식은 `mcp-to-skill exec`를 사용합니다 (전역 설치 불필요, `npx -y mcp-to-skill@0.2.2`).

## Available Tools

- `create_payment_window`, `approve_payment`, `cancel_payment`
- `create_billing_key`, `approve_billing_payment`, `expire_billing_key`
- `create_cash_receipt`, `cancel_cash_receipt`, `get_cash_receipt_status`
- `find_payment_by_order_id`, `get_terms`, `get_card_promotions`, `list_interest_free_installments`
- `search_nicepay_qna`

`SKILL_DIR` = 이 디렉터리 (`SKILL.md`가 있는 폴더).

```bash
npx -y mcp-to-skill@0.2.2 exec --config "$SKILL_DIR/mcp-config.json" --list
npx -y mcp-to-skill@0.2.2 exec --config "$SKILL_DIR/mcp-config.json" --call '{"tool": "search_nicepay_qna", "arguments": {"userQuestion": "결제 취소"}}'
```

---

*MCP package: [@nicepay/start-api-mcp](https://www.npmjs.com/package/@nicepay/start-api-mcp). 스킬 레이어: [mcp-to-skill](https://www.npmjs.com/package/mcp-to-skill).*
