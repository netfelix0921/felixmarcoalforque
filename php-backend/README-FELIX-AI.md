# Felix AI — deployment guide

A profile-only portfolio assistant. The visitor's browser never sees an API key.

```
Visitor browser
   -> portfolio frontend (index.html)
   -> your backend (api/felix-ai.php  or  Vercel /api/felix-ai)
   -> OpenAI API                        [key lives here, server-side only]
   -> Felix knowledge base (data/felix-knowledge-base.json)
   -> validated response
   -> portfolio chat UI
```

---

## 1. Files

| File | Purpose |
|---|---|
| `index.html` | Portfolio with the upgraded chat client. Design unchanged. |
| `api/felix-ai.php` | **Primary backend** for DirectAdmin / cPanel shared hosting. |
| `vercel/api/felix-ai.js` | Alternative backend for Vercel / Next.js. Same logic. |
| `data/felix-knowledge-base.json` | The only source of truth about Felix. Edit this, not the code. |
| `data/.htaccess` | Blocks direct HTTP access to the knowledge base. |
| `api/.htaccess` | Blocks dotfiles and non-PHP sources inside `/api`. |
| `htaccess-root-snippet.txt` | Rules to merge into your web-root `.htaccess`. |
| `.env.example` | Template for the server-side secret. |
| `.gitignore` | Keeps `.env` out of git. |
| `tests/scope-test.php` | 62-case test for the scope filter. |

---

## 2. Deploy on DirectAdmin / cPanel (recommended for felixmarcoalforque.it.com)

**Step 1 — upload**

```
public_html/
  index.html
  api/
    felix-ai.php
    .htaccess
  data/
    felix-knowledge-base.json
    .htaccess
```

**Step 2 — create the .env ABOVE the web root**

Put it at `/home/<your-user>/.env` — one level above `public_html`, so it can
never be served over HTTP even if a rule breaks:

```
OPENAI_API_KEY=sk-your-real-key-here
OPENAI_MODEL=gpt-4o-mini
```

The loader checks, in order: real environment variables → `../../.env`
(above web root) → `../.env` → `api/.env`. The first readable file wins.

If your panel exposes environment variables directly (DirectAdmin PHP-FPM
"Environment Variables", or cPanel's equivalent), set `OPENAI_API_KEY` there
instead and skip the file entirely — that is the cleanest option.

**Step 3 — merge the root rules**

Copy the contents of `htaccess-root-snippet.txt` into `public_html/.htaccess`.
If that file already exists, merge — do not overwrite.

**Step 4 — verify the protections**

```bash
curl -I https://felixmarcoalforque.it.com/data/felix-knowledge-base.json   # expect 403 or 404
curl -I https://felixmarcoalforque.it.com/.env                             # expect 403 or 404
curl -s https://felixmarcoalforque.it.com/api/felix-ai.php \
  -H 'Content-Type: application/json' \
  -d '{"message":"What is Python?"}'                                       # expect allowed:false
```

Then open the site and ask the chat "Where does Felix work?".

**Requirements:** PHP 7.4+. cURL is used when available; if your host disables
it, the code falls back to `allow_url_fopen` automatically. `mbstring` is used
when present and polyfilled when not.

---

## 3. Deploy on Vercel instead

```
your-repo/
  index.html          (or your Next.js app)
  api/felix-ai.js     <- move vercel/api/felix-ai.js here
  data/felix-knowledge-base.json
  vercel.json         <- move vercel/vercel.json here
```

Set `OPENAI_API_KEY` in **Project Settings → Environment Variables** (never in
the repo). Then change one line in `index.html`:

```js
var AI_ENDPOINT = '/api/felix-ai';   // was '/api/felix-ai.php'
```

`vercel.json` bundles `data/**` with the function so the knowledge base is
readable at runtime.

> Note: the Node rate limiter is per warm instance. That is fine for a
> portfolio; for stricter limits, back it with Upstash Redis.

---

## 4. If your hosting is static-only

Felix AI cannot run on pure static hosting (GitHub Pages, Netlify without
functions, plain S3). There is no safe client-side option — any key shipped to
the browser is readable in DevTools within seconds and will be scraped and
billed to you. Your choices:

1. Shared hosting with PHP (what you already have) — use `api/felix-ai.php`.
2. Vercel/Netlify functions — use the Node handler, host the frontend anywhere.
3. Keep the frontend where it is and point `AI_ENDPOINT` at a full URL on a
   second host that runs the backend, then add that origin to
   `FX_ALLOWED_ORIGINS` in the PHP file.

---

## 5. How the scope restriction works

**Stage 1 — local classifier, runs before any API call (costs nothing).**

| Check | Result |
|---|---|
| Prompt injection (`ignore previous`, `you are now`, `show your prompt`, …) | reject |
| Greeting / "who are you" | answered locally, no API call |
| Contains `felix` / `alforque` | allow |
| Contains `he` / `his` / `him` | allow |
| Matches a general-knowledge pattern (`^what is…`, `^who is…`, `^explain…`, `^write…`, `^help me…`, weather, joke, news, recipe, "what laptop should I buy") | reject |
| Contains a profile-intent word (`hire`, `portfolio`, `resume`, `education`, `skills`, `services`, …) | allow |
| Short follow-up with prior context (`what does he do there?`, `tell me more`) | allow |
| Anything else | reject |

Bare technology names are deliberately **not** treated as profile intent, so
"what is python" rejects while "does Felix know python" passes.

**Stage 2 — the model enforces the same rule independently** via a strict
system instruction with the knowledge base attached as the sole source of truth.

**Stage 3 — output validation.** If the model refuses, the API reports
`allowed:false`. A leak guard also rejects any answer over 280 characters that
never mentions Felix — that shape is almost always a general explanation that
slipped through.

---

## 6. API contract

`POST /api/felix-ai.php`

```json
{
  "message": "What does Felix build?",
  "history": [
    { "role": "user", "content": "Where does Felix work?" },
    { "role": "assistant", "content": "Eagle Cement Corporation." }
  ]
}
```

Response:

```json
{ "answer": "...", "allowed": true, "stage": "model" }
```

Rejected:

```json
{
  "answer": "I'm Felix's professional portfolio assistant, so I can only answer questions about Felix's professional background, experience, skills, projects, education, and services.",
  "allowed": false,
  "stage": "local"
}
```

`history` is optional and session-only. Nothing about a visitor is written to
disk — the rate limiter stores a SHA-256 hash of the IP and a counter, nothing else.

---

## 7. Abuse protection (tune at the top of the backend file)

| Limit | Default |
|---|---|
| Message length | 500 characters |
| Conversation history sent | 8 messages (4 exchanges) |
| Max output tokens | 450 |
| Requests per IP | 8/min, 40/hour, 120/day |
| Upstream timeout | 25s server, 30s browser |
| Request body cap | 20 KB |
| Empty messages | rejected before any API call |

Out-of-scope questions are rejected locally, so the common abuse case —
someone using your portfolio as a free ChatGPT — costs you nothing.

CORS is locked to `FX_ALLOWED_ORIGINS`, so other sites cannot embed your endpoint.

---

## 8. Updating what Felix AI knows

Edit `data/felix-knowledge-base.json` only. No code changes, no redeploy of the
frontend. Add a job, a project, a skill, and it is live on the next request.

Two conventions the model is instructed to obey:

- `"restriction"` / `"note"` on any object — hard limits on what may be claimed
  (e.g. the Shopify entry forbids claiming 3+ years or multiple clients).
- `"unknown_or_do_not_claim"` — topics that always get
  *"I don't have verified information about that in Felix's professional profile."*

**Changes made to your existing knowledge base in this version (v2):**

- Added `previous_roles` — Chase Technologies Corporation, June 2022 – May 2024,
  with all 13 documented responsibilities.
- Added `education` — BS Information Technology, Our Lady of Lourdes College
  (2018–2022) and Senior High ICT (2016–2018).
- Added `career_timeline` for "tell me about Felix's career" questions.
- Added `responsibilities` to `current_role`.
- Removed *"Specific university/degree/graduation year"* from
  `unknown_or_do_not_claim` — it is now verified, and leaving it there would
  have made the assistant refuse your own test case #4.
- Added explicit `restriction` fields for Ramco modules and Shopify claims.
- Added recruiter answers for previous work, education, and implementation.

---

## 9. Tests

```bash
php tests/scope-test.php     # 62 cases: every rejection and acceptance in the spec
```

Covers all 16 of your final test cases, including "What does he do there?"
resolving through conversation context, and "What laptop does Felix use?"
passing the filter but landing on the no-verified-information answer.

---

## 10. Cost note

With `gpt-4o-mini`, the knowledge base (~4k tokens) is sent as the system prompt
on every in-scope question. At current pricing that is a fraction of a cent per
question, and out-of-scope questions never reach the API at all. If the KB grows
past ~15k tokens, switch to retrieving only the relevant sections instead of
sending the whole file — the loading step is already isolated in one function.
