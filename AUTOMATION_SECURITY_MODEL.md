# Zoya Automation Security Model

Zoya is an action-taking Android assistant, not a read-only chatbot. Explicit commands from the signed-in user can perform allowlisted UI automation: open apps/URLs, type into non-password editable fields, click visible UI controls, scroll supported containers, and initiate calls/SMS.

## Direct-command behavior

When the authenticated user explicitly gives a supported command, `directUserCommand=true` allows the local executor to carry out the requested allowlisted action without an extra confirmation prompt. This is intentionally different from Gemini-generated actions.

Examples:
- “Zoya, call Rahul” -> checks local policy and CALL_PHONE permission, then starts the call.
- “Zoya, open WhatsApp” -> launches WhatsApp.
- “Zoya, type hello” -> uses Accessibility to type into a visible non-password editable field.
- “Zoya, click Search” -> clicks an exact visible Search control through Accessibility.
- “Zoya, scroll down” -> scrolls a supported visible scroll container.
- “Zoya, open https://example.com” -> opens the validated URL.
- “Zoya, send WhatsApp to Rahul saying hello” -> opens the WhatsApp composer and, for a direct user command only, attempts a visible `Send` click when Accessibility is enabled.

## Security boundaries

- Android runtime/special permissions are checked before protected actions.
- Accessibility typing excludes password/credential fields.
- Only explicit allowlisted command types can execute.
- Gemini output cannot bypass the local policy. AI-generated sensitive actions continue to require confirmation.
- The master safety switch remains authoritative.
- No claim of absolute exploit immunity is made; the design fails closed when a guard, permission, or target cannot be verified.
