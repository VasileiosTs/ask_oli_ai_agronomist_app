# Oli — AI Agronomist for the World's Smallholder Farmers

> **"Every grower who uses Oli builds the dataset that makes every future grower's advice better."**

**App:** https://codex-ask-oli-app.vercel.app  
**Stage:** Pre-launch · Beachhead: Greece (all crops) · Vision: Global  
**Stack:** React + TypeScript · Supabase (Postgres + Edge Functions) · Google Gemini · Vercel

---

## The Problem

There are **500 million smallholder farmers** worldwide. They grow 70% of the world's food. They have no access to affordable agronomic expertise.

A certified agronomist costs €50–150/visit in Southern Europe. In sub-Saharan Africa, India, and Latin America there may be one agronomist per 1,000 farmers. A crop disease left undiagnosed for 48 hours can destroy an entire season's income.

Today's "solution": WhatsApp a photo to a friend. Wait two days for an agronomist visit. Google symptoms and guess. These are not solutions — they are a gap in the market worth billions of dollars.

Enterprise agtech (Trimble, John Deere Ops Center, Climate Corp) costs $10,000+/year and requires farm machinery integration. It is built for the 1% of large commercial farms. The other 500 million farmers are invisible to Silicon Valley.

**No one has built ChatGPT for farming. Until now.**

---

## What Oli Does

Oli is a **chat-first AI agronomist** — instant, expert-level crop guidance through a simple conversation, in the farmer's language, on any crop, on any device.

**Core loop:** Photo of a sick plant → diagnosis in 10 seconds → specific treatment protocol with exact dosages → follow-up in 7 days to record whether it worked.

### What a farmer can do today

| Task | How |
|------|-----|
| Diagnose crop disease from a photo | Attach photo, describe symptoms — Oli identifies the problem and cause |
| Get treatment plans | Organic and chemical options, exact product names, dosages, application method |
| Log what they applied | One-tap intervention logging after a diagnosis |
| Track field history | Fields, crops, seasons, past problems — remembered across every conversation |
| Get follow-up care | Oli checks back in 7 days: "How did the treatment work?" |
| Share a diagnosis | Public shareable link with OG card — for cooperatives, agronomists, forums |
| Talk in any language | Greek, English, Italian, Spanish, French, Arabic — auto-detected from device |
| Send voice or audio | Audio files processed as messages |
| Upload any file type | Photos, PDFs, audio — same interface, no separate app |

### What makes this different from every other agtech tool

**It remembers.** Every field, crop, past problem, and treatment outcome is stored and injected into every future conversation as context. The AI knows your farm.

**It follows up.** Oli records whether treatments worked. This is the data no one else has.

**It works on a €40 phone.** No app install, no subscription required to try. One free guest question, then sign up free.

---

## The Business Model

**Free:** 20 messages/month — enough for a farmer with one or two active problems.  
**Pro:** €4.99/month or €49/year — unlimited messages, priority AI model, full field history export.  
**Future — B2B API:** Sell agricultural AI inference to cooperatives, input distributors (ADAMA, Yara, Bayer), and agtech platforms. This is the high-margin, high-scale business.

Unit economics: Gemini API cost per conversation is ~€0.001–0.005. A Pro subscriber at €4.99/month covers 1,000–5,000 conversations. Gross margin at scale exceeds 85%.

---

## The Data Moat — VIO (Verified Intervention Outcomes)

This is the core thesis and the long-term defensibility.

Every time Oli recommends a treatment and a farmer follows up with the result (better / same / worse), we record a **Verified Intervention Outcome**: crop × disease × product × dosage × region × climate × outcome.

No one in agriculture has this data at scale. Extension services have fragments. Agrochemical companies pay millions for field trials to get approximations of this. We will have it across every crop, every country, indexed by GPS region and season — contributed for free by the farmers themselves.

**What VIO unlocks:**

- *"This product works for 87% of olive growers in Peloponnese with this disease"* — no one can say this today with real data
- Training a proprietary agricultural AI model that outperforms generic LLMs on crop problems
- Selling efficacy analytics back to input manufacturers (they spend €50M+ per year on field trials globally)
- Powering agronomist recommendations with outcome evidence instead of manufacturer marketing claims

The consumer app is the acquisition engine. The VIO data is the durable asset.

---

## Market Opportunity

| Segment | Size |
|---------|------|
| Global agricultural market | $5T/year |
| Crop protection (pesticides, fungicides, biocontrol) | $84B/year |
| Precision agriculture software | $12B → $25B by 2030 |
| Addressable: 500M smallholder farms worldwide | ~$50B/year in inputs + advisory spend |

**Beachhead:** Greece — 700,000 registered farm holdings, high smartphone penetration, 6 languages supported from day one. Greece is the test lab, not the destination.

**Expansion path:** Mediterranean (Italy, Spain, Morocco, Egypt) → India → sub-Saharan Africa → Latin America. All regions with high crop disease pressure, low agronomist density, and underserved smallholder farmers.

---

## Founder

**Vasileios Tsipas** — Solo founder, Xylokastro, Corinthia, Greece.

18+ years in agri-business, international BD, and supply chain. Not a tourist in this market — an agronomist who built software, not a software person who discovered farming.

- **Bravo Stimaga Grapes S.A.** (2021–present), BD & Operations Manager — €1.5M+ ARR through NL/BE distributor partnerships. 5 long-term multi-country contracts (UK, NL, Poland, Belgium, Germany, Sweden) at €250K–500K each. 35% YoY revenue growth. 45% harvesting efficiency improvement. Managed 80–110 person seasonal workforce. Digitalized all certifications (GlobalG.A.P., BRC, IFS, Sedex) to 100% compliance.
- **Freelance Agronomist Consultant** (2019+) — phytosanitary assessments, plant health diagnosis, growth cycle planning across Greek farms.
- **Founded an award-winning plant nursery** — pre-packaged trees with extended shelf life, exported to USA and China. EU entrepreneurship recognition, Brussels 2017.
- Clients have included Samsung, Deloitte, H&M, STIHL, OECD.
- Direct relationships with senior contacts at **ADAMA** (global crop protection, top 5 worldwide) and **Yara** (world's largest fertilizer company), Greek Ministry of Agriculture, University of Athens, EFG Bank, US Embassy Athens.
- Operated across **27 countries**. The global expansion plan is not theoretical — the relationships exist.

---

## Product Status

**Built and working (pre-launch):**

- ✅ Full chat experience — diagnosis, treatment plans, field memory, streaming
- ✅ Multi-language — Greek, English, Italian, Spanish, French, Arabic
- ✅ Photo + audio + PDF upload and AI analysis
- ✅ VIO follow-up loop — scheduled follow-up messages, outcome recording (better/same/worse)
- ✅ Field management — named fields, crop type, soil, historical context injected into every AI call
- ✅ Intervention logging with public shareable links + OG card generation
- ✅ Guest mode — 1 free question with no account required
- ✅ Auth — magic link + Google OAuth
- ✅ Freemium paywall — 20 messages/month free, Pro tier gated
- ✅ SSE streaming — AI tokens appear as they're generated, not after 10 seconds
- ✅ GDPR-compliant hosting (EU Frankfurt, no PII in analytics)
- ✅ Daily KPI snapshot pipeline (automated Supabase cron)
- ✅ Onboarding — name, location with geocoding, primary crop
- ✅ Push notification infrastructure (VAPID keys, service worker)
- ✅ Multi-grower accounts — agronomist can manage multiple farmer profiles
- ✅ AI image pre-extraction — separate focused Gemini call for photos before main diagnosis
- ✅ Automatic Gemini fallback — primary → gemini-2.0-flash-lite on quota or 5xx

**Not live yet:**
- 🔲 Stripe payment integration (paywall UI exists, checkout not wired)
- 🔲 Production domain
- 🔲 App Store / Play Store listing (PWA in the interim)
- 🔲 Public B2B API

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│  Browser / Mobile PWA (Vercel CDN, global edge)          │
│  React 18 + TypeScript + Vite + Tailwind CSS             │
│                                                          │
│  Chat.tsx → chatFunction.ts → SSE stream                 │
│                                                          │
│  Key client modules:                                     │
│  ├── fieldContext.ts      AI system prompt assembly      │
│  ├── extractAndApply.ts   silent field extraction        │
│  ├── imageCache.ts        IndexedDB + compression        │
│  └── i18n.ts              6-language typed string dict   │
└────────────────────┬─────────────────────────────────────┘
                     │ HTTPS / SSE
┌────────────────────▼─────────────────────────────────────┐
│  Supabase (EU Frankfurt — GDPR compliant)                │
│  ├── PostgreSQL   users, fields, conversations,          │
│  │                chat_messages, interventions, VIOs     │
│  ├── Auth         magic link, Google OAuth               │
│  ├── Storage      chat_uploads (photos, audio, PDFs)     │
│  ├── RLS          row-level security on all tables       │
│  └── Edge Functions (Deno runtime)                       │
│      ├── chat/index.ts   ← core AI function (~110KB)     │
│      │   auth → rate limit → Gemini → SSE → DB write     │
│      ├── og-image        OG card generation              │
│      ├── send-email      drip emails (Resend)            │
│      ├── send-push       web push notifications          │
│      ├── kpi-snapshot    daily analytics pipeline        │
│      └── api-v1          future public API surface       │
└────────────────────┬─────────────────────────────────────┘
                     │ HTTPS
┌────────────────────▼─────────────────────────────────────┐
│  Google Gemini                                           │
│  ├── gemini-2.5-flash (primary)                          │
│  │   — structured JSON output via responseSchema         │
│  │   — native multimodal photo analysis                  │
│  ├── gemini-2.0-flash (image pre-extraction)             │
│  └── gemini-2.0-flash-lite (automatic fallback)          │
└──────────────────────────────────────────────────────────┘
```

**Key security design:** The Gemini API key never touches the browser. All AI calls flow through the Supabase Edge Function, which reads the key from a server-side secret. The browser holds only the Supabase anon key, which is designed to be public.

---

## How the AI Function Works

`supabase/functions/chat/index.ts` is the product's core (~3,100 lines). Every message flows through it.

### Authenticated request pipeline

```
1.  JWT verification → Supabase user
2.  Monthly message count check vs FREE_LIMIT
3.  Attachment resolution: storage paths → signed URLs → base64 inline
4.  Field context assembly: field name, crop, soil, last problem, past interventions
5.  Image pre-extraction (if photo): dedicated Gemini call extracts structured
    observations (symptoms, affected area %, pest signs) before the main call
6.  Intent classification: diagnosis / advice / followup / general / unclear
7.  System prompt construction: language + field context + grower profile +
    conversation memory snapshot + VIO history
8.  Gemini call with JSON responseSchema — structured output enforced at API level
9.  Response validation: banned opener check, JSON repair on malformed output
10. SSE streaming: meta event → token chunks → done event
11. DB writes: save assistant message, update message count, schedule follow-up
    if a diagnosis with intervention was made (follow_up_at = now + 7 days)
12. Async post-save: field memory snapshot update, conversation title generation
```

### Guest pipeline

```
1. IP-based rate limit: 1 question/IP/24h (DB-backed, survives cold starts)
2. Message and attachment validation
3. Simplified Gemini call (no field context, no DB writes)
4. JSON response (no streaming for unauthenticated users)
```

---

## Database Schema (core tables)

```sql
users             — profile, tier, message_count_month, language, reset_date
fields            — name, crop_type, size_ha, soil_type, GPS location
conversations     — user + field link, title, last_message_at
chat_messages     — role, content, metadata (JSON: intent, diagnosis_data,
                    action_detected, crop_mentioned), starred, image_urls[]
interventions     — field, crop, diagnosis, product_applied, dosage,
                    organic_treatments[], chemical_treatments[], severity,
                    follow_up_at, outcome (better/same/worse),
                    share_id UUID (public share links)
growers           — multi-grower support (advisor manages multiple farmers)
guest_rate_limits — ip, request_count, window_start (DB-backed rate limiting)
```

Row-level security is enforced at the database level — not just in application code. A compromised JWT cannot read another user's data.

---

## Repository Structure

```
src/
├── pages/
│   ├── Chat.tsx               ⭐ core product — entire conversation experience
│   ├── Landing.tsx            public marketing page (Greek + English)
│   ├── Auth.tsx               magic link + Google OAuth
│   ├── Onboarding.tsx         3-step first-run (name, location, crop)
│   ├── Profile.tsx            settings, subscription, data export
│   ├── Fields.tsx             field management
│   └── SharedDiagnosis.tsx    public /d/:id share page
├── components/
│   ├── ConversationSidebar.tsx
│   ├── MessageBubble.tsx      renders treatment cards, outcome chips
│   ├── LogInterventionModal.tsx
│   ├── ShareModal.tsx         WhatsApp, Telegram, Facebook, X, email, copy
│   ├── PaywallModal.tsx
│   └── SignInModal.tsx
├── hooks/useAuth.tsx           session, profile, appUserId
└── lib/
    ├── chatFunction.ts         SSE streaming client
    ├── fieldContext.ts         system prompt assembly
    ├── extractAndApply.ts      silent field extraction from messages
    ├── imageCache.ts           IndexedDB + canvas compression
    └── i18n.ts                 typed 6-language string dictionary

supabase/functions/
├── chat/index.ts              ⭐ core AI function
├── og-image/index.ts
├── send-email/index.ts
├── send-push/index.ts
├── kpi-snapshot/index.ts
└── api-v1/index.ts
```

---

## Local Development

```bash
git clone https://github.com/VasileiosTs/codex_ask_oli_app.git
cd codex_ask_oli_app
npm install
cp .env.example .env.local   # fill in Supabase + Gemini credentials
npm run dev                  # http://localhost:5173
npx tsc --noEmit             # type check
npm test                     # unit tests
```

**Environment variables (frontend):**
```
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
VITE_SUPABASE_ANON_KEY        (legacy alias for the above)
VITE_SENTRY_DSN               (optional)
VITE_VAPID_PUBLIC_KEY         (optional, for push notifications)
```

**Supabase Edge Function secrets:**
```
GEMINI_API_KEY
SUPABASE_SERVICE_ROLE_KEY
RESEND_API_KEY
VAPID_PRIVATE_KEY
CRON_SECRET
```

---

## Deployment

**Frontend:** Vercel — auto-deploy on push to `main`.  
**Edge Functions:** GitHub Actions deploys on any change to `supabase/functions/**`.  
**Database:** Supabase managed Postgres, EU Frankfurt region.

---

## Why This Wins

**Founder-market fit.** 18 years agri-business, certified agronomist, direct relationships with ADAMA and Yara, operated across 27 countries. The founder is the product's first user.

**Timing.** Gemini 2.5's multimodal capability makes photo-based crop diagnosis reliable at scale. This wasn't possible 18 months ago.

**The flywheel.** Every VIO recorded makes the next recommendation more accurate. Every farmer who joins makes the dataset denser. Competitors cannot fast-follow — they need years of outcome data that only comes from real farmers using the product.

**Bottom-up distribution.** Farmers share diagnoses. Cooperatives forward treatment plans. Agronomists recommend the tool. WhatsApp and Telegram sharing is built into every diagnosis. The organic growth loop is in the product.

**No incumbent owns this space.** Enterprise agtech ignores smallholders. Consumer agtech is mostly photo-ID apps with no memory, no follow-up, no data loop. Oli is the first to close the full cycle: diagnosis → treatment → outcome → learning → better diagnosis.

---

## Contact

Vasileios Tsipas — founder@askoli.ai  
Location: Xylokastro, Corinthia, Greece
