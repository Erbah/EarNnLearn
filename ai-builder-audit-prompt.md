# Full-Site Audit & Hardening Prompt for AI App Builder
**Use case:** Educational website with payment/money transactions
**Format:** Multi-agent task breakdown — paste the whole thing, or run agent-by-agent if your builder supports sub-tasks/sessions.

---

## How to use this

Paste the master instruction below first, then run each AGENT block as a separate pass (most AI builders do better with focused passes than one giant ask). After each agent finishes, ask it to **list every file it changed and why** before moving to the next agent — that list is your paper trail.

---

## MASTER INSTRUCTION (paste first)

> You are auditing and hardening an existing AI-built website before it handles real users and real money. Do not just say things "look fine" — actually open the relevant files, search the codebase for the specific patterns listed below, and show me what you found before you fix it. If something can't be fixed automatically (e.g. it needs a real API key, a legal policy decision, or a business decision), stop and tell me explicitly instead of guessing or inventing a placeholder that looks finished. Work through the agents in order. After each agent, give me a short report: what was found, what was fixed, and what still needs my decision.

---

## AGENT 1 — Secrets & Credentials Auditor

**Goal:** Find anything that should never be in the codebase or browser.

- Search the entire repo (including git history if possible) for API keys, secret keys, database connection strings, and tokens hardcoded in source files.
- Confirm all secrets live in environment variables / a secrets manager, never in frontend code, never committed to version control.
- Check that `.env` (or equivalent) is in `.gitignore` and was never previously committed.
- Confirm the frontend only ever talks to a public/anon key (if using a backend-as-a-service), and that any key with elevated privileges is backend-only.
- Check for hallucinated or non-existent npm/pip packages in dependency files (AI builders sometimes invent plausible-looking package names — verify every dependency actually exists and is the real, official package, not a typosquat).
- Report every secret found exposed, where, and confirm once moved/rotated.

---

## AGENT 2 — Authentication & Access Control Auditor

**Goal:** Catch the #1 most common AI-builder failure: broken or missing access control.

- For every page and every API endpoint, confirm there is a server-side check for "is this user allowed to do this" — not just a frontend check (frontend-only checks are not security, they're UI hints).
- Specifically check: can a logged-in regular user access admin routes by guessing the URL? Can User A view, edit, or delete User B's data (account info, payment history, course progress, certificates) by changing an ID in the URL or request?
- If using a database with row-level security (RLS) features (Supabase, Firebase, etc.), confirm RLS is actually **enabled and enforced** on every table — this is disabled by default in a large share of AI-generated apps and is the single most common cause of full data leaks.
- Confirm password reset, email verification, and session/token expiry actually work as intended, not just that the UI shows a success message.
- Confirm rate limiting or basic abuse protection exists on login, signup, and password reset endpoints.
- Report each endpoint/table checked and its current access-control status (pass/fail/fixed).

---

## AGENT 3 — Payment & Money-Handling Auditor

**Goal:** Make sure money logic is correct, can't be tampered with, and the site never needlessly touches sensitive card data.

- Confirm the site **never** collects, stores, or transmits raw card numbers, CVVs, or full card data on its own servers. All card entry should happen inside a hosted/embedded element from a PCI-compliant processor (e.g. Stripe Elements/Checkout, Paystack, Flutterwave) so the card data goes straight to the processor, not through your backend. This keeps you in the lowest, simplest compliance category instead of carrying full PCI DSS scope yourself.
- Confirm the **price/amount is never trusted from the frontend.** Check every checkout flow: is the amount charged calculated and verified server-side from the actual product/course price in the database, or can a user tamper with a hidden field/request and pay less?
- Confirm payment confirmation is driven by a verified webhook/server-to-server callback from the payment processor — not just by the frontend saying "payment succeeded." A user should not be able to get access by faking a success redirect.
- Confirm webhook endpoints verify the signature from the payment provider, so attackers can't fake a "payment completed" event by hitting the webhook URL directly.
- Check for idempotency: if a webhook fires twice, or a user double-clicks "pay," does it charge twice or grant access twice?
- Confirm refund, failed-payment, and partial-payment states are all handled (not just the happy path) — what does the user see, what does the database record, can support manually adjust it?
- Confirm there's a clear, immutable transaction log/ledger (who paid what, when, for what) separate from "current access state" — so disputes can be investigated.
- Confirm currency handling is consistent (no float rounding errors on money — use integer minor units like cents, or a decimal type, never plain floats).
- Report findings per item above as pass/fail/fixed, and flag anything that needs a real merchant account or legal sign-off rather than code.

---

## AGENT 4 — Data Validation & Injection Auditor

**Goal:** Catch the classic OWASP-style issues AI code generators are statistically prone to reproducing.

- Check every form and API endpoint for server-side input validation (not just frontend form validation, which a user can bypass entirely).
- Search for any place user input is inserted directly into a database query (raw string concatenation) instead of parameterized queries/an ORM — this is a SQL injection risk.
- Check that any user-generated content displayed back to other users (comments, forum posts, profile bios, course reviews) is properly escaped/sanitized to prevent stored XSS.
- Check file upload features (profile photos, assignment submissions, certificates): is file type validated server-side, is file size capped, are uploaded files served in a way that can't execute as code?
- Confirm CORS settings aren't wide open (`*`) for any endpoint that handles authenticated requests or money.
- Report each pattern checked and result.

---

## AGENT 5 — Reliability & Data Integrity Auditor

**Goal:** Catch the "it works in the demo but breaks in real use" class of issues.

- Check for soft-deletes vs hard-deletes on important records (user accounts, enrollments, payment records) — accidental or malicious deletion shouldn't permanently destroy financial/academic records needed for disputes or compliance.
- Check error handling: do failures show raw error messages/stack traces to users (which can leak internal details), or a clean user-facing message while logging details internally?
- Check that long-running or critical actions (payment, enrollment, certificate issuance) have proper loading/pending states and don't silently fail.
- Confirm there are backups of the database, and that you know how to restore from one.
- Check for basic monitoring/alerting: would you actually find out if checkout started failing at 2am?
- Report status of each.

---

## AGENT 6 — Educational-Site-Specific & Compliance Auditor

**Goal:** Items specific to an education + payments site, beyond generic web security.

- **Privacy law fit:** If you have or expect users under 18, check what data you collect from them and whether you need parental consent flows (e.g. COPPA in the US, or local equivalents) — flag this as a decision for me, don't auto-decide.
- **General data protection:** Confirm there's a privacy policy and terms of service that actually match what the site does (data collected, payment processor used, refund policy), not generic boilerplate that contradicts the real flow.
- **Refund/cancellation policy:** Confirm the stated refund policy (e.g. "7-day money-back guarantee") is actually enforced in code, not just written on a page.
- **Course access logic:** Confirm paid content is genuinely gated server-side (not just hidden via frontend routing that a user could bypass by guessing a direct URL).
- **Certificates/credentials:** If the site issues certificates or grades, confirm these can't be forged or self-granted by manipulating client-side state.
- **Accessibility:** Quick check for basic accessibility (alt text on images, form labels, keyboard navigation, color contrast) — this matters extra for an education product and is often skipped by AI builders.
- Report each item.

---

## FINAL STEP — Ask the builder to produce a summary report

> Now consolidate all six agent reports into one document: a table with columns **Area | Issue Found | Severity | Status (Fixed / Needs My Decision / Not Applicable) | Notes**. Put anything involving money, access control, or exposed secrets at the top regardless of when it was found. Anything marked "Needs My Decision" should include exactly what decision you need from me and why you can't make it yourself.
