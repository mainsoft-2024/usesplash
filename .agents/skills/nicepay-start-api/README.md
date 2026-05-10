# opencode-skill-nicepay-start-api

OpenCode / Claude용 스킬. **MCP 본체(`@nicepay/start-api-mcp@0.0.10`)와 production `node_modules`를 이 레포의 `vendor/`에 포함**합니다. 사용자 환경에서 `npx -y @nicepay/start-api-mcp`로 받지 않습니다.

도구 호출 안내·메타는 [mcp-to-skill](https://www.npmjs.com/package/mcp-to-skill) 사용.

## 설치

```bash
npx -y skills add paulp-o/opencode-skill-nicepay-start-api -g -a opencode -y
```

또는:

```bash
git clone https://github.com/paulp-o/opencode-skill-nicepay-start-api.git ~/.config/opencode/skills/nicepay-start-api
```

## 검증

```bash
cd ~/.config/opencode/skills/nicepay-start-api   # 또는 클론한 경로
npx -y mcp-to-skill@0.2.2 exec --config ./mcp-config.json --list
```

## 용량

`vendor/` 약 28MB (`node_modules` 포함). 갱신은 `scripts/refresh-vendor.sh` 참고.

## 라이선스

MIT — 스킬 파일. 번들된 MCP는 `@nicepay/start-api-mcp` 라이선스(MIT)를 따릅니다.
