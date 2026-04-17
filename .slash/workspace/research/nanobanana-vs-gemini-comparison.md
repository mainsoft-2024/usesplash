# Research: nanobanana Skill vs gemini.ts Implementation Comparison

**Date:** 2026-04-13

## Summary

The nanobanana skill and the `gemini.ts` implementation are **two separate, independent implementations** that both generate images using Gemini but are NOT integrated with each other:

- **nanobanana skill**: Python-based, uses `gemini-3-pro-image-preview` model, runs as CLI scripts
- **gemini.ts**: TypeScript-based, uses `gemini-2.0-flash-preview-image-generation` model, integrated into the web app

The current web application uses `gemini.ts` directly and does NOT invoke the nanobanana skill.

---

## Findings

### 1. nanobanana Skill

| Aspect | Details |
|--------|---------|
| **Language** | Python 3.10+ |
| **Package** | `google-genai` (PyPI) |
| **Model** | `gemini-3-pro-image-preview` ("Nano Banana Pro") |
| **Invocation** | CLI scripts in `scripts/generate.py`, `scripts/batch_generate.py` |
| **Output** | Saves PNG files to disk |
| **Dependencies** | `GEMINI_API_KEY` env var |

**Code reference** (SKILL.md lines 1-201):
```python
# scripts/generate.py usage
python3 <skill_dir>/scripts/generate.py "a cute robot" -o robot.png
python3 <skill_dir>/scripts/generate.py "make it blue" -i input.jpg -o output.png
```

**Response parsing**: The Python script saves the API response directly as an image file.

---

### 2. gemini.ts Implementation

| Aspect | Details |
|--------|---------|
| **Language** | TypeScript |
| **Package** | `@google/genai` (npm) |
| **Model** | `gemini-2.0-flash-preview-image-generation` |
| **Invocation** | Direct function calls: `generateLogoImage()`, `editLogoImage()`, `batchGenerateLogos()` |
| **Output** | Returns `{ imageBuffer: Buffer; mimeType: string }` |
| **Dependencies** | `GEMINI_API_KEY` env var |

**Code reference** (gemini.ts lines 23-43):
```typescript
const response = await ai.models.generateContent({
  model: MODEL_NAME,
  contents: prompt,
  config: {
    responseModalities: ["IMAGE", "TEXT"],
    imageConfig: { aspectRatio: aspectRatio as AspectRatio },
  },
})

// Parses response for inlineData
for (const part of candidates[0].content.parts) {
  if (part.inlineData?.data) {
    return {
      imageBuffer: Buffer.from(part.inlineData.data, "base64"),
      mimeType: part.inlineData.mimeType ?? "image/png",
    }
  }
}
```

---

### 3. Key Differences

| Feature | nanobanana (Python) | gemini.ts (TypeScript) |
|---------|---------------------|----------------------|
| **Model** | `gemini-3-pro-image-preview` | `gemini-2.0-flash-preview-image-generation` |
| **Language** | Python | TypeScript |
| **Package** | `google-genai` | `@google/genai` |
| **Output** | File (PNG) | Buffer + mimeType |
| **Batch** | Built-in (`batch_generate.py`) | Built-in (`batchGenerateLogos()`) |
| **Edit support** | Yes (`-i` flag) | Yes (`editLogoImage()`) |
| **Resolution** | `--size 2K/4K` option | Not built-in (depends on model) |
| **Search grounding** | `--search` flag | Not available |

---

### 4. Usage in Codebase

The web application uses `gemini.ts` directly:

| File | Usage |
|------|-------|
| `src/server/routers/generation.ts` | Calls `generateLogoImage()`, `editLogoImage()` |
| `src/app/api/chat/route.ts` | Calls `generateLogoImage()`, `editLogoImage()` |

**NOT used:**
- The nanobanana skill is NOT called from anywhere in the web app
- The logo-creator skill depends on nanobanana but the web app doesn't uselogo-creator either

---

### 5. logo-creator Skill Dependency

The `logo-creator` skill explicitly depends on nanobanana (SKILL.md line 18):

```markdown
**Required Skills:**
- `nanobanana` - AI image generation (Gemini 3 Pro Image)
```

It calls it like this (SKILL.md lines 87-92):
```bash
python3 <nanobanana_skill_dir>/scripts/generate.py "{prompt}" --ratio 1:1 -o logo.png
python3 <nanobanana_skill_dir>/scripts/batch_generate.py "{prompt}" -n 20 -d ./output -p logo
```

---

## Analysis

### Why Two Implementations?

1. **nanobanana**: Agent/CLI tool - designed for interactive skill usage by the agent system
2. **gemini.ts**: Application library - designed for programmatic API usage in the Next.js app

They serve different purposes and contexts.

### Model Version Differences

- **nanobanana**: `gemini-3-pro-image-preview` (the newer "Nano Banana Pro" model)
- **gemini.ts**: `gemini-2.0-flash-preview-image-generation` (older Flash model with image generation)

This is a significant difference - the nanobanana skill may use a more capable model.

---

## Recommendations

1. **For the web app**: Consider upgrading `gemini.ts` to use `gemini-3-pro-image-preview` if that model is available via `@google/genai` package

2. **For batch generation**: Both implementations have built-in delays (nanobanana: `--delay`, gemini.ts: `delayMs`)

3. **For feature parity**: The nanobanana skill has `--size 2K/4K` and `--search` grounding that gemini.ts doesn't have

4. **Integration**: If the agent system needs to use Gemini image generation, it could either:
   - Call the nanobanana Python scripts via child_process
   - Use gemini.ts directly if running in the same process context