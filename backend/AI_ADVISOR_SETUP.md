# Graduate Module — AI Advisor Setup

The Graduate Module AI Advisor (`/student/graduate/advisor`) talks to a real LLM
through the backend. All provider configuration lives in backend environment
variables; **no API key is ever sent to the browser**.

## Endpoint

```
POST /api/graduate/advisor/chat
Auth: Bearer <graduate student JWT>   (verifyStudent + graduate-only guard)
Rate limit: 30 requests / minute / student
```

### Request body

```json
{
  "message": "What government jobs can I apply for?",
  "history": [
    { "role": "user", "content": "Hi, which jobs can I apply for?" },
    { "role": "assistant", "content": "Which degree are you pursuing?" },
    { "role": "user", "content": "I am pursuing B.E. Computer Science Engineering." }
  ]
}
```

* `message` — required, 1–2000 characters.
* `history` — optional, validated to `user`/`assistant` roles only, each turn
  truncated, only the most recent 10 turns are forwarded. (`chatHistory` /
  `conversationHistory` are also accepted as aliases.)
* Any `profileContext`, `userId`, or other client-supplied profile data is
  **ignored** — the advisor always uses the authenticated student's own
  `GraduateProfile` from the database.

### Response body

```json
{ "success": true, "reply": "…", "source": "Groq (openai/gpt-oss-120b)", "intent": "GOVERNMENT_EXAM" }
```

Errors:

| Status | Meaning | Body |
|--------|---------|------|
| 400 | Empty / non-string / too-long message | `{ success:false, message }` |
| 401 | Missing or invalid token | `{ success:false, message }` |
| 429 | Rate limited | `{ success:false, rateLimited:true, message }` |
| 503 | **No AI provider configured** | `{ success:false, configured:false, retryable:false, message }` |
| 502 | Provider timeout / upstream error | `{ success:false, retryable:true, message }` |
| 500 | Unexpected server error | `{ success:false, message }` |

The frontend shows the server message and offers a **Retry** button for
retryable failures. A static/hardcoded answer is never returned in place of a
real model reply.

## Environment variables

The advisor reuses the project's existing provider resolution
(`backend/utils/aiQuestionGenerator.js`), so it works with whichever provider is
already configured. Set **one** provider key (first match wins):

```env
# Option A — OpenAI
OPENAI_API_KEY=
# Option B — Groq
GROQ_API_KEY=
# Option C — xAI Grok
GROK_API_KEY=
# Option D — Anthropic
ANTHROPIC_API_KEY=
# Option E — any OpenAI-compatible endpoint
AI_QUESTIONS_API_KEY=
AI_QUESTIONS_BASE_URL=

# Optional: model name for the advisor (falls back to AI_QUESTIONS_MODEL, then the provider default)
GRADUATE_ADVISOR_MODEL=

# Optional: request timeout (ms) and response cap
GRADUATE_ADVISOR_TIMEOUT_MS=30000
```

Do **not** commit real keys. `.env` is already git-ignored.

## Why the advisor used to be generic

The graduate `/advisor/chat` route was wired to the *college* study-tools
controller, which builds its context from `CollegeStudentProfile`
(`degreeProgramme`, `currentSemester`, `subjects`, …). Graduate accounts store
their data in `GraduateProfile`, so the college controller saw nothing and ran
on defaults ("College Degree", "Engineering & Technology", "Software Engineer").
It also read `chatHistory` while the graduate client sent `history`, so
conversation memory was dropped. The advisor is now served by a dedicated
controller (`backend/controllers/graduateAdvisorController.js`).

## Run

```bash
# backend
cd backend && npm install && npm run dev

# frontend
cd frontend && npm install && npm run dev

# focused AI Advisor tests (no DB / no network required)
cd backend && node tests/testGraduateAdvisor.js
```
