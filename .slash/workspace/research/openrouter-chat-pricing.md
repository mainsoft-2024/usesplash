# Research: OpenRouter Chat Pricing for AI Logo Design

**Date:** 2026-04-15

## Summary

This research analyzes the cost of running an AI-powered logo design consultation chatbot using OpenRouter. The two primary model options are Google's Gemini Flash (budget-friendly, multimodal) and Anthropic's Claude Sonnet (high-quality reasoning). OpenRouter adds a 5.5% platform fee on top of provider pricing, but offers unified API access, model routing, and failover capabilities.

---

## 1. Cost Per 1M Tokens

### Google Gemini Models

| Model | Provider | Context | Input / 1M | Output / 1M |
|-------|----------|--------|------------|-------------|
| `google/gemini-2.0-flash` | Direct (Google) | 1M | **$0.10** | **$0.40** |
| `google/gemini-2.0-flash` | OpenRouter | 1M | **$0.11** | **$0.42** |
| `google/gemini-2.5-flash` | Direct (Google) | 1M | $0.30 | $2.50 |
| `google/gemini-2.5-flash` | OpenRouter | 1M | $0.32 | $2.64 |
| `google/gemini-3-flash-preview` | OpenRouter | 1M | **$0.50** | **$3.00** |

> **Note:** Gemini 2.0 Flash is deprecated (scheduled shutdown June 1, 2026). For production, use Gemini 2.5 Flash or newer.

**Source:** [Gemini Pricing - Google AI](https://ai.google.dev/gemini-api/docs/pricing), [OpenRouter Pricing](https://pricepertoken.com/endpoints/openrouter)

### Anthropic Claude Models

| Model | Provider | Context | Input / 1M | Output / 1M |
|-------|----------|--------|------------|-------------|
| `anthropic/claude-sonnet-4.6` | Direct (Anthropic) | 1M | **$3.00** | **$15.00** |
| `anthropic/claude-sonnet-4.6` | OpenRouter | 1M | **$3.17** | **$15.83** |
| `anthropic/claude-sonnet-4.5` | Direct (Anthropic) | 200K | $3.00 | $15.00 |
| `anthropic/claude-sonnet-4.5` | OpenRouter | 200K | $3.17 | $15.83 |
| `anthropic/claude-3.5-sonnet` | OpenRouter | 200K | $3.17 | $15.83 |

**Source:** [Anthropic Claude Pricing](https://docs.anthropic.com/en/docs/about-claude/pricing), [OpenRouter Claude Pricing](https://pricepertoken.com/pricing-page/model/anthropic-claude-sonnet-4)

---

## 2. OpenRouter Markup Analysis

| Aspect | Details |
|--------|---------|
| **Platform Fee** | 5.5% on credit card purchases, 5% on cryptocurrency |
| **Minimum Purchase** | $0.80 |
| **Free Tier** | 25+ free models, 50 requests/day (no credit card required) |
| **BYOK (Bring Your Own Key)** | 1M free requests/month, then 5% fee |

### Markup Calculation

```
OpenRouter Price = Provider Price × 1.055
```

| Model | Direct Price (In/Out) | OpenRouter Price (In/Out) | Markup |
|-------|----------------------|---------------------------|--------|
| Claude Sonnet 4.6 | $3.00 / $15.00 | $3.17 / $15.83 | +$0.17 / +$0.83 |
| Gemini 2.0 Flash | $0.10 / $0.40 | $0.11 / $0.42 | +$0.01 / +$0.02 |

**Verdict:** The 5.5% markup is minimal for most use cases. OpenRouter's value comes from unified API, failover, and routing—not price.

**Source:** [OpenRouter Pricing 2026 - ZenMux](https://zenmux.ai/blog/openrouter-api-pricing-2026-full-breakdown-of-rates-tiers-and-usage-costs)

---

## 3. Token Estimates for Logo Design Chat

### Typical Conversation Structure

A logo design consultation involves:
1. **System prompt** (brand guidelines, logo design expertise, tool usage)
2. **User messages** (describe brand, style preferences, feedback on designs)
3. **AI responses** (questions, explanations, design suggestions)
4. **Tool calls** (image generation with descriptions)

### Estimated Tokens Per Message

| Message Type | Est. Input Tokens | Est. Output Tokens | Notes |
|-------------|-------------------|---------------------|-------|
| System prompt (cached) | 500-1,500 | — | Static; cached after first call |
| User query | 50-200 | — | Short text, e.g., "I want a modern tech logo" |
| AI response | — | 100-300 | Explanation + next steps |
| Tool call (generation) | 200-500 | 50-150 | JSON with image prompt |
| Tool result | 100-300 | — | Image URL + metadata |

### Average Per Exchange (Round-Trip)

| Metric | Conservative | Typical | Generous |
|--------|--------------|---------|----------|
| Input tokens | 400 | 600 | 900 |
| Output tokens | 150 | 250 | 400 |
| **Total tokens** | **550** | **850** | **1,300** |

**Source:** [Claude Sonnet 4.6 Token Usage](https://docs.anthropic.com/en/docs/about-claude/pricing) - Tool calls add ~346 tokens

---

## 4. Cost Per Chat Conversation

### Scenario: 10-message conversation (~5 back-and-forth exchanges with tool calls)

| Model | Tokens/Conv | Input Cost | Output Cost | Total Cost |
|-------|-------------|------------|-------------|------------|
| **Gemini 2.0 Flash** (OpenRouter) | 8,500 | $0.00094 | $0.00357 | **$0.00451** |
| **Gemini 2.5 Flash** (OpenRouter) | 8,500 | $0.00272 | $0.02244 | **$0.02516** |
| **Claude Sonnet 4.6** (OpenRouter) | 8,500 | $0.02695 | $0.13456 | **$0.16151** |

### Cost Breakdown Calculation (Gemini 2.0 Flash via OpenRouter)

```
Input: 8,500 tokens × $0.11/1M = $0.000935
Output: 8,500 tokens × $0.42/1M = $0.003570
Total: $0.004505 ≈ $0.0045 per conversation
```

### Monthly Cost Estimates

Assuming 100 conversations/day (light usage):

| Model | Daily Cost | Monthly Cost (30 days) | Annual Cost |
|-------|------------|----------------------|-------------|
| Gemini 2.0 Flash | $0.45 | $13.50 | $162 |
| Gemini 2.5 Flash | $2.52 | $75.60 | $907 |
| Claude Sonnet 4.6 | $16.15 | $484.50 | $5,814 |

> **Note:** Gemini 2.0 Flash is deprecated. Budget for Gemini 2.5 Flash migration ($18-75/month range).

**Source:** [OpenRouter Cost Calculator](https://costgoat.com/pricing/openrouter)

---

## 5. Free Tiers & Credits

### OpenRouter Free Tier

| Feature | Details |
|---------|---------|
| **Free Models** | 25+ models (Llama, DeepSeek, Qwen variants) |
| **Rate Limits** | 20 requests/min, 200 requests/day |
| **Credit Card** | Not required |
| **Best For** | Testing, prototyping |

### Google Gemini Free Tier

| Feature | Details |
|---------|---------|
| **Free Tokens** | Generous allocation on most models |
| **Models Included** | Gemini 2.5 Flash, Flash-Lite, 2.0 Flash |
| **Best For** | Development with direct API |

### Anthropic Claude Free Tier

| Feature | Details |
|---------|---------|
| **Claude AI Free** | Limited access to Sonnet |
| **Claude Pro** | $20/month (includes Sonnet 4.6) |
| **Best For** | Interactive chat, not API |

**Source:** [OpenRouter Free Tier 2026](https://pricepertoken.com/endpoints/openrouter/free), [Gemini Pricing](https://www.tldl.io/resources/google-gemini-api-pricing)

---

## 6. Recommendations for Logo Design Chat

### Recommendation: Use Gemini 2.5 Flash (via OpenRouter)

| Criteria | Winner |
|----------|--------|
| **Cost efficiency** | ✅ Gemini 2.5 Flash ($0.025/conversation) |
| **Image generation** | ✅ Native multimodal support |
| **Tool use** | ✅ Strong function calling |
| **Context** | ✅ 1M token context (vs 200K Claude) |

### Alternative: Claude Sonnet 4.6 (for complex reasoning)

| When to Use | Why |
|------------|-----|
| Complex brand strategy questions | Superior reasoning |
| Detailed design feedback analysis | Better understanding |
| Budget allows $16/conversation | Premium quality |

### Cost Optimization Tips

1. **Cache system prompt** - Reduces input tokens by ~500-1,500 per request
2. **Use Gemini 2.5 Flash-Lite** - $0.14/conversation (50% savings)
3. **Prompt caching** - Claude/Gemini support; reuse context
4. **Batch image generations** - Reduce chat round-trips

---

## Appendix: Quick Reference Tables

### Cost Per 1,000 Tokens

| Model | Input (per 1K) | Output (per 1K) |
|-------|---------------|-----------------|
| Gemini 2.0 Flash | $0.00010 | $0.00040 |
| Gemini 2.5 Flash | $0.00030 | $0.00250 |
| Claude Sonnet 4.6 | $0.00300 | $0.01500 |

### Cost Per Message (Average)

| Model | Cost/Message |
|-------|--------------|
| Gemini 2.0 Flash | $0.00045 |
| Gemini 2.5 Flash | $0.00252 |
| Claude Sonnet 4.6 | $0.01615 |

---

## Sources

- [OpenRouter Pricing](https://openrouter.ai/pricing)
- [Google Gemini Pricing](https://ai.google.dev/gemini-api/docs/pricing)
- [Anthropic Claude Pricing](https://docs.anthropic.com/en/docs/about-claude/pricing)
- [OpenRouter Claude Pricing](https://pricepertoken.com/pricing-page/model/anthropic-claude-sonnet-4)
- [Gemini Flash Pricing Comparison](https://langcopilot.com/gemini-2-0-flash-vs-gemini-2-5-flash-pricing)
- [OpenRouter Cost Calculator](https://costgoat.com/pricing/openrouter)
