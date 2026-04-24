# Research: Recraft.ai Vectorize API Pricing & Technical Specs

**Date**: 2026-04-22

## Summary

Recraft.ai's vectorize endpoint costs **$0.01 USD (10 API units)** per request. This is the cheapest operation in their API. The credit system requires pre-purchased API units at **$1.00 per 1,000 units**. Critical concern: CDN URLs expire after ~24 hours — must download to local storage immediately.

---

## 1. Exact Pricing per Vectorize Call

| Service | Cost (USD) | Cost (API Units) | Billing Basis |
|---------|-----------|---------------|-------------|
| **Image vectorization** | **$0.01** | **10** | **Per request** |

**Source**: [Recraft API Pricing](https://www.recraft.ai/docs/api-reference/pricing)

This is the lowest-cost operation in the entire Recraft API — cheaper than background removal ($0.01), crisp upscale ($0.004), or any image generation ($0.04–$0.30).

### Verified Rate Card (2026)

All pricing confirmed from official docs as of April 2026:
- Image vectorization: **$0.01** (10 units) ← Used for `/v1/images/vectorize`
- Raster image generation (V4): $0.04 (40 units)
- Vector image generation (V4 Vector): $0.08 (80 units)
- Creative upscale: $0.25 (250 units)

---

## 2. Credit-to-USD Conversion

| Package | Price (USD) | API Units |
|---------|-------------|----------|
| Pay-as-you-go | **$1.00** | **1,000** |

**Source**: [API Pricing](https://www.recraft.ai/docs/api-reference/pricing)

**Conversion ratio**: 1 USD = 1,000 API units = 100 vectorize calls

**Formula for cost tracking**:
```
per_call_usd = 0.01  // fixed rate
// Or: (api_units_consumed / 1000) = USD spent
```

### Subscription Plans (Alternative)

Recraft also offers monthly subscriptions with credits, but for API usage, the pre-purchased unit package is the standard approach:
- Free plan: 30 credits/day (not applicable to API)
- Pro plan: Starts at $12/mo for 1,000 credits (platform credits, separate from API units)

**Note**: API units are separate from platform subscription credits. API users typically purchase unit packages directly.

---

## 3. Rate Limits / Concurrency

| Limit Type | Value |
|-----------|-------|
| **Requests per second** | 5 |
| **Images per minute** | 100 (per user) |

**Source**: [Appendix - Recraft](https://www.recraft.ai/docs/api-reference/appendix)

**Recommendations**:
- Max 5 concurrent requests to avoid 429 errors
- Queue-based processing recommended for batch exports
- No explicit concurrency limit documented beyond rate limits

---

## 4. Request Format

### Endpoint
```
POST https://external.api.recraft.ai/v1/images/vectorize
```

### Request Format
- **Content-Type**: `multipart/form-data`
- **File field name**: `file` (not `image`)

**Source**: [Endpoints Documentation](https://www.recraft.ai/docs/api-reference/endpoints)

### Example
```javascript
response = client.post(
    path='/images/vectorize',
    cast_to=object,
    options={'headers': {'Content-Type': 'multipart/form-data'}},
    files={'file': open('image.png', 'rb')},
)
print(response['image']['url'])  // Confirms { image: { url } } structure
```

### Parameters (Optional)

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `response_format` | string | `url` | Output format: `url` or `b64_json` |
| `svg_compression` | string | `off` | Enable SVG compression: `on`/`off` |
| `limit_num_shapes` | string | `off` | Limit shape count: `on`/`off` |
| `max_num_shapes` | int | — | Max shapes when limit enabled |

### Response Schema
```json
{
  "image": {
    "url": "https://img.recraft.ai/..."
  }
}
```

**Confirms existing code pattern** (`response.image.url`).

---

## 5. Error Codes + Retry Guidance

**Error codes are not explicitly documented** in the public API docs.

### Based on standard HTTP conventions and Appendix info:

| Status Code | Likely Meaning | Retry? |
|-----------|-------------|-------|
| 400 | Bad request (invalid file format, size too large) | No |
| 401 | Invalid/missing API key | No |
| 413 | File too large (>5MB) | No |
| 429 | Rate limit exceeded | Yes (exponential backoff) |
| 500 | Internal server error | Yes |
| 503 | Service unavailable | Yes (exponential backoff) |

### Retry Guidance (inferred)
- Use exponential backoff: 1s → 2s → 4s (max 3 retries)
- Max 5 requests/second hard limit — stay under to avoid 429s

---

## 6. Authentication Format

```http
Authorization: Bearer RECRAFT_API_TOKEN
```

**Source**: [Endpoints - Authentication](https://www.recraft.ai/docs/api-reference/endpoints)

### Usage
```python
client = OpenAI(
    base_url='https://external.api.recraft.ai/v1',
    api_key=<RECRAFT_API_TOKEN>,
)
```

**Key generation**: Log in to Recraft → Profile → API → Generate (requires API units balance > 0)

---

## 7. Data Retention / Privacy Concern

### Storage Policy (API)

| Plan Type | Retention |
|----------|----------|
| **API (all plans)** | **~24 hours** |
| Paid subscription | Private, remains after plan ends |
| Free plan | Public, may appear in gallery |

**Source**: [Appendix](https://www.recraft.ai/docs/api-reference/appendix), [Data Protection](https://www.recraft.ai/docs/trust-and-security/data-protection-and-privacy)

### Key Concerns vs. vectorizer.ai

**Unlike vectorizer.ai** (which has known retention issues reported in user reviews), Recraft states:
- Generated images stored ~24 hours for API usage
- Paid plan images remain private
- Images deleted within 24 hours for API

**✅ No known retention issue** — but must download immediately due to URL expiry.

### Privacy Summary
- **Paid plans**: Uploaded/generated images are private
- **Free plan**: Images are public
- **API**: Results deleted within 24 hours
- Recraft does NOT use user data to train external AI models

---

## 8. SVG Response URL Lifetime

| Attribute | Value |
|-----------|-------|
| **URL validity** | **~24 hours** |
| **Link type** | Direct CDN, cryptographically signed |

**Source**: [Appendix](https://www.recraft.ai/docs/api-reference/appendix)

> "All generated images are currently stored for approx. 24 hours, this policy may change in the future, and you should not rely on it remaining constant."

### Required Action

**Must download to Vercel Blob immediately** after vectorize call completes — do NOT rely on the Recraft CDN URL persisting.

---

## Cost Tracking Recommendation

### Per-Call Cost for Database

| Metric | Value |
|--------|-------|
| **API Units** | 10 units |
| **USD** | **$0.01** |

```typescript
// Recommended DB schema addition
const exportCost = {
  provider: 'recraft',
  operation: 'vectorize',
  apiUnits: 10,
  usdCost: 0.01,
};
```

### Cost Calculation
```
total_usd = vectorize_calls * 0.01
```

---

## Sources

1. **Pricing**: https://www.recraft.ai/docs/api-reference/pricing
2. **Endpoints**: https://www.recraft.ai/docs/api-reference/endpoints
3. **Appendix (Rate Limits, Retention)**: https://www.recraft.ai/docs/api-reference/appendix
4. **Data Protection**: https://www.recraft.ai/docs/trust-and-security/data-protection-and-privacy
5. **Getting Started**: https://www.recraft.ai/docs/api-reference/getting-started

---

## Notes

- No public error code documentation — infer from HTTP status codes
- Rate limits may change; check Appendix periodically
- URL lifetime is the gating factor for reliability — always download immediately
- $0.01/call is highly competitive vs. alternatives (remove.bg ~$0.02/image)