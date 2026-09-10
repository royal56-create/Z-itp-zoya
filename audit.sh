#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

required=(
  app/src/main/AndroidManifest.xml
  app/build.gradle.kts
  app/src/main/java/com/royalankit/zoya/core/DeveloperProfile.kt
  app/src/main/java/com/royalankit/zoya/core/SecureStore.kt
  app/src/main/java/com/royalankit/zoya/core/ActionPolicy.kt
  app/src/main/java/com/royalankit/zoya/memory/HistoryStore.kt
  app/src/main/java/com/royalankit/zoya/ai/GeminiClient.kt
  reference-original-zoya/firestore.rules
)
for f in "${required[@]}"; do test -f "$f" || { echo "MISSING: $f"; exit 1; }; done

if grep -RniE 'allow (read|write): if true' reference-original-zoya --include='*.rules'; then echo 'FAIL: permissive Firestore rule'; exit 1; fi
if grep -n 'isMinifyEnabled = false' app/build.gradle.kts; then echo 'FAIL: release minification disabled'; exit 1; fi
if grep -RniE 'http://(localhost|127\.0\.0\.1)|REDACTED_(GEMINI|TELEGRAM)_API_KEY|AIza[0-9A-Za-z_-]{20,}' app/src reference-original-zoya --exclude='bun.lock'; then echo 'FAIL: insecure endpoint or live secret pattern'; exit 1; fi

grep -n 'isPassword' app/src/main/java/com/royalankit/zoya/service/ZoyaAccessibilityService.kt >/dev/null || { echo 'FAIL: password field guard missing'; exit 1; }
grep -n 'needsConfirmation' app/src/main/java/com/royalankit/zoya/commands/ActionExecutor.kt >/dev/null || { echo 'FAIL: sensitive action confirmation missing'; exit 1; }
grep -n 'directUserCommand' app/src/main/java/com/royalankit/zoya/commands/ActionExecutor.kt >/dev/null || { echo 'FAIL: direct user automation gate missing'; exit 1; }
grep -n 'ClickText' app/src/main/java/com/royalankit/zoya/commands/ZoyaCommand.kt >/dev/null || { echo 'FAIL: auto-click command missing'; exit 1; }
grep -n 'clickText' app/src/main/java/com/royalankit/zoya/service/ZoyaAccessibilityService.kt >/dev/null || { echo 'FAIL: accessibility click handler missing'; exit 1; }
grep -n 'x-goog-api-key' app/src/main/java/com/royalankit/zoya/ai/GeminiClient.kt >/dev/null || { echo 'FAIL: Gemini key is not sent via header'; exit 1; }
grep -n 'zoya_history.enc' app/src/main/java/com/royalankit/zoya/memory/HistoryStore.kt >/dev/null || { echo 'FAIL: encrypted history store missing'; exit 1; }
grep -n 'local.properties' .gitignore >/dev/null || { echo 'FAIL: local.properties not ignored'; exit 1; }

python3 - <<'PY'
from pathlib import Path
ks=list(Path('app/src/main/java').rglob('*.kt'))
assert ks
for p in ks:
    s=p.read_text()
    if s.count('{') != s.count('}'):
        raise SystemExit(f'FAIL: brace imbalance: {p}')
print(f'Kotlin structural scan: {len(ks)} files OK')
print('Security guards: OK')
print('Firestore permissive-rule scan: OK')
print('Secret pattern scan: OK')
PY

echo 'STATIC SECURITY AUDIT: PASS'
