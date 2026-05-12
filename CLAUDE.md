# Oli — AI Agronomist

## What this is
Oli is an AI agronomist app for small farmers worldwide. Users photograph or describe crop problems; Oli diagnoses diseases, recommends organic & chemical treatments with exact dosages, logs interventions, and follows up 3 days later to confirm application and outcome (the VIO loop). Goal: become the de-facto agri-intelligence layer for every small farm on earth, then sell anonymised crop-disease data and a fine-tuned model API to agrochemical companies (Yara, ADAMA, Syngenta, etc.).

**Primary market**: Greece-first (olives, vines, citrus, vegetables), then MENA + LatAm + SE Asia — all regions dominated by small farms underserved by traditional agronomists.

## Tech stack
| Layer | Tech |
|---|---|
| Frontend | React 19 + TypeScript + Vite 6, Tailwind CSS v4, React Router v6 |
| Backend | Supabase Edge Functions (Deno), PostgreSQL + RLS, pg_cron |
| AI | Google Gemini 2.5 Flash (primary), Gemini 1.5 Flash (5xx fallback) |
| Auth | Supabase Auth (email, Google OAuth, Facebook OAuth) |
| Payments | Stripe (free 20 msg/month, Pro = unlimited) |
| Email | Resend API (`send-email` Edge Function) |
| Push | Web Push / VAPID (`send-push` Edge Function + `public/sw.js`) |
| Monitoring | Sentry, PostHog, `operational_events` table |
| Deployment | Vercel (frontend), Supabase cloud (backend) |

## Critical architecture — read before editing

### VIO loop (Verify → Intervene → Outcome)
The core data flywheel: diagnosis → user logs intervention → 3 days later "did you apply?" → 3 days later "any improvement?" → outcome chip recorded. This is the product moat.

- `vio_step 1` = waiting for apply confirmation (3d after log)
- `vio_step 2` = waiting for outcome (3d after step 1)
- `vio_step 3` = loop closed (no more cron)
- `outcome` = 'better' | 'same' | 'worse' | 'not_applied' (+ `outcome_note` text)
- Cron: `send-push` at `:00`, `send-email` at `:30` every 6h
- **Critical**: crons must advance `vio_step` + reset `follow_up_at = NOW + 3 days` after notifying, or users get spammed every 6h

### Five-Pillar Diagnostic (chat AI)
Confidence is scored 0–100 across five pillars: THE_VICTIM (what crop), THE_SYMPTOMS (what's wrong), THE_TIMELINE (when), THE_ENVIRONMENT (weather/soil/location), THE_EVIDENCE (photo).

Confidence thresholds enforced in system prompt:
- `< 40` → hard block — do NOT name a disease, ask clarifying questions
- `40–65` → "possible/suspected", 2–3 candidates, safe actions only
- `65–85` → primary diagnosis + uncertainty language + one follow-up
- `> 85` → full diagnosis + complete treatment + prevention
- Quarantine diseases (HLB, Xylella, Fire Blight, Plum Pox) → require `> 85`

### Rate limiting
- Free tier: `FREE_MESSAGE_LIMIT = 20` messages/month (in `src/lib/constants.ts` AND `supabase/functions/chat/index.ts` — keep in sync)
- Warning banner at `PAYWALL_WARNING_MESSAGES_REMAINING = 3` remaining
- Atomic count via `increment_message_count` RPC (no race conditions)

### Edge function modes
- `chat` — main AI function; 2,000+ lines; handles extraction, memory, weather, field context, VIO follow-ups, paywall
- `send-push` — VIO push reminders + direct push. Silent VAPID ping (no body; payload encryption not implemented)
- `send-email` — VIO email reminders, weekly digest, onboarding drip, re-engagement (Resend API)
- `kpi-snapshot` — internal metrics
- `greeting` — personalised greeting on chat open
- `delete-account` — GDPR

### Dead code to ignore
`src/lib/fieldContext.ts` — `assembleFieldContext()` is never called from the frontend. All field context is built server-side in `supabase/functions/chat/lib/fieldContext.ts`. The frontend file is kept only because `fieldContext.test.ts` imports `formatFieldContextBlock()`.

### CORS pattern
All edge functions use `ALLOWED_ORIGIN` env var (not hardcoded arrays). Set this in Supabase secrets.

## gstack — proactive usage

**Always use gstack skills without being asked.** Don't wait for explicit `/skill` calls.

| When | Use |
|---|---|
| Completing a feature or bug fix | `/ship` — pre-flight checklist, commit, verify |
| After any significant change | `/qa` — verify UX, console errors, network |
| Reviewing a PR or diff | `/review` — code quality, security, coverage |
| Planning a new feature | `/autoplan` — break into tasks, identify risks |
| Investigating a bug | `/investigate` — root cause before touching code |
| Weekly or milestone check-in | `/retro` — what's working, what's not |
| After deploying | `/canary` — confirm deploy is healthy |
| Web research needed | `/browse` — use this, never `mcp__Claude_in_Chrome__*` |
| Working on YC application | `/yc-application-coach` — iterative YC section coaching |

When the user says "build X" or "fix Y": run `/autoplan` first if non-trivial, then implement, then `/qa`.

## Phase 2 roadmap (don't implement yet — understand the direction)
The current single-model Gemini setup is Phase 1. Phase 2 (post product-market fit):
- **Vision router**: TULIP or ViT fine-tuned on our own VIO outcome data for plant disease from photo
- **OCR layer**: Qwen-VL for reading product labels / spray schedules from photos
- **Reasoning**: Keep Gemini Flash for conversation; route image-only queries to fine-tuned model
- **API product**: Sell fine-tuned crop disease API to agrochemical companies
- **Data moat**: Every VIO outcome (applied treatment X → outcome Y on crop Z in climate C) trains the next model version

Phase 2 prep work that CAN be done now:
- Ensure all VIO outcomes are stored with full context (crop, location, climate, treatment, dosage)
- Add `confidence_score` column to `interventions` table so we can filter training data by quality
- Add `ai_model_version` column to `chat_messages` to track which model produced each diagnosis

## Known stable decisions
- **20/month free** (not per-week) — maximises trial period for seasonal farmers who plant once
- **Greek-first UX** — all copy bilingual el/en; Gemini responds in user's detected language
- **No Stripe yet** — implement when first user asks to pay
- **Accessibility** — need `<main>` landmark on all pages, fix contrast on `text-[#8a9280]` elements
- **Guest question preservation (UX9)** — typed question lost when guest logs in mid-session; not yet fixed

## Env vars needed in Supabase secrets
```
GEMINI_API_KEY
VAPID_PUBLIC_KEY
VAPID_PRIVATE_KEY
VAPID_SUBJECT=mailto:hello@ask-oli.com
RESEND_API_KEY
FROM_EMAIL=Oli <noreply@ask-oli.com>
APP_URL=https://ask-oli.com
ALLOWED_ORIGIN=https://ask-oli.com
SUPPORT_EMAIL=hello@ask-oli.com
SUPABASE_URL          (auto-set)
SUPABASE_SERVICE_ROLE_KEY  (auto-set)
SUPABASE_ANON_KEY     (auto-set)
```

## Running locally
```bash
npm install
npm run dev          # frontend on :5173
supabase start       # local Supabase
supabase functions serve --env-file .env.local  # edge functions
```
