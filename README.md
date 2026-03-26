# Oli — AI Agronomist

Oli is a chat-first AI agronomist app for smallholder farmers and growers. Think ChatGPT but for farming — one conversation screen where a grower can diagnose crop disease, log interventions, get weekly advice, and build a memory of their fields over time.

**Live app:** https://codex-ask-oli-app.vercel.app  
**Stack:** React + TypeScript + Vite + Tailwind · Supabase (Postgres + Edge Functions + Storage) · Gemini AI  
**Deployed:** Vercel (frontend) + Supabase EU Frankfurt (backend, GDPR compliant)

---

## Table of Contents

1. [Product Vision](#1-product-vision)
2. [Architecture Overview](#2-architecture-overview)
3. [Repository Structure](#3-repository-structure)
4. [Frontend — Key Files Explained](#4-frontend--key-files-explained)
5. [Backend — Database Schema](#5-backend--database-schema)
6. [Backend — Edge Function](#6-backend--edge-function)
7. [AI Response Structure](#7-ai-response-structure)
8. [Auth Flow](#8-auth-flow)
9. [Internationalisation](#9-internationalisation)
10. [Local Development Setup](#10-local-development-setup)
11. [Environment Variables](#11-environment-variables)
12. [Deployment](#12-deployment)
13. [Feature Roadmap](#13-feature-roadmap)
14. [Key Design Decisions](#14-key-design-decisions)

---

## 1. Product Vision

**Core thesis:** Every grower who uses Oli builds the dataset that makes every future grower's advice better. The consumer app is the acquisition engine. The data is the asset.

**UX model:** Chat-only, like ChatGPT. No multi-tab navigation competing with chat. Everything — diagnosis, logging, field questions, weekly planning — flows through one conversation. On desktop, a permanent sidebar shows conversation history. On mobile, full-screen chat with a slide-over sidebar.

**Target user:** Mediterranean smallholder farmers (primary: Greece/Cyprus). Language auto-detected by IP — Greek for GR/CY, English otherwise. User can override in Profile.

**Free tier:** 20 messages/month. Pro: €4.99/month or €49/year.

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────┐
│  Browser / Mobile (Vercel)                  │
│  React + Vite + Tailwind                    │
│                                             │
│  Chat.tsx ──── chatFunction.ts              │
│       │              │                      │
│       │        SSE streaming                │
│       ▼              ▼                      │
│  Supabase JS   Edge Function (chat)         │
│  (auth, DB,    ── Gemini API                │
│   storage)     ── DB writes                 │
└─────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────┐
│  Supabase (EU Frankfurt)                    │
│  ├── PostgreSQL (all data)                  │
│  ├── Auth (magic link, OAuth)               │
│  ├── Storage (chat_uploads bucket)          │
│  └── Edge Functions (Deno runtime)          │
└─────────────────────────────────────────────┘
```

**Critical rule:** The Gemini API key never touches the browser. All AI calls go through the Supabase Edge Function (`supabase/functions/chat/index.ts`), which reads the key from a server-side secret. The frontend only holds `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, which are safe to expose.

---

## 3. Repository Structure

```
oli/
├── src/
│   ├── App.tsx                    # Routing, auth guards, QueryClientProvider, LanguageProvider
│   ├── main.tsx                   # React entry point
│   ├── index.css                  # Design tokens (CSS variables), Tailwind base, animations
│   │
│   ├── pages/
│   │   ├── Chat.tsx               # ⭐ Main screen — 1000+ lines, the entire app experience
│   │   ├── Auth.tsx               # Login: Google, Facebook, Magic Link
│   │   ├── Onboarding.tsx         # 3-step first-run: name, location (+ geocoding), crop
│   │   ├── Profile.tsx            # Settings, subscription, export, delete account
│   │   ├── Fields.tsx             # Field management (hidden from nav, data layer)
│   │   └── SharedDiagnosis.tsx    # Public /d/:shareId page — no auth required
│   │
│   ├── components/
│   │   ├── ConversationSidebar.tsx  # Desktop: permanent column. Mobile: slide-over
│   │   ├── LogInterventionModal.tsx # Bottom sheet to log a treatment after diagnosis
│   │   ├── PaywallModal.tsx         # Free tier limit — upgrade prompt
│   │   ├── SignInModal.tsx          # Guest user prompt to sign in
│   │   ├── AppLayout.tsx            # Outlet wrapper (no nav bar — chat is full screen)
│   │   ├── BottomNav.tsx            # Unused — kept for potential future use
│   │   └── LoadingSpinner.tsx       # Green spinner
│   │
│   ├── hooks/
│   │   └── useAuth.tsx            # Session, user, profile, appUserId, isGuest, logout
│   │
│   └── lib/
│       ├── supabase.ts            # Supabase client + getCurrentUserId helper
│       ├── chatFunction.ts        # SSE streaming client for the edge function
│       ├── fieldContext.ts        # Assembles field context string for AI system prompt
│       ├── extractAndApply.ts     # Silently extracts crop/field mentions from messages
│       ├── validateAi.ts          # Client-side validation types (no Gemini calls here)
│       ├── memoryContext.ts       # Builds the AI system prompt string
│       ├── imageCache.ts          # IndexedDB photo cache + image compression (max 1000px, JPEG 80%)
│       ├── i18n.ts                # All UI strings in Greek + English, IP-based auto-detection
│       └── LanguageContext.tsx    # React context for current language + t() accessor
│
├── supabase/
│   ├── functions/
│   │   └── chat/
│   │       └── index.ts          # ⭐ Edge function — auth, rate limiting, Gemini, SSE, DB writes
│   └── migrations/
│       ├── 20260320130100_core_schema.sql        # Users, fields, conversations, chat_messages, interventions
│       ├── 20260320130200_reviews_and_storage.sql # photo_reviews table
│       ├── 20260320130300_views_rpc_and_compat.sql # field_context_view, messages view, resolve_field()
│       ├── 20260320130400_multi_grower.sql        # growers + grower_links (advisor accounts)
│       ├── 20260320130500_shared_view_lockdown.sql
│       ├── 20260320130600_build_pack_alignment.sql # notification prefs, fields.source column
│       ├── 20260320130700_safe_shared_view_definer.sql # safe_shared_diagnoses view (public share)
│       └── 20260321000000_outcome_and_followup.sql # outcome recording columns + index
│
├── vercel.json                    # SPA rewrite rules (all routes → index.html)
├── vite.config.ts                 # Vite config (no GEMINI_API_KEY — server-side only)
└── tailwind.config.ts             # Extends Tailwind with Oli design tokens
```

---

## 4. Frontend — Key Files Explained

### `Chat.tsx` — The entire product

This is the most important file. Everything flows through here. Key sections:

**State:**
- `messages` — local array of chat messages (role, content, metadata, starred, attachments)
- `input` — current textarea value
- `attachments` — files pending send (File objects + preview URLs)
- `activeConversationId` — current conversation UUID
- `activeFieldId` — which field is selected for context injection
- `showSignIn / showPaywall` — modal visibility

**On mount:**
1. Loads user's fields from `field_context_view`
2. Checks for pending follow-ups (`follow_up_at <= now AND outcome IS NULL`) — if found, injects a follow-up message as the first chat message

**`handleSend()`:**
1. Check auth / guest / message limit
2. Compress images via `compressImage()` (max 1000×1000, JPEG 80%)
3. Upload to Supabase Storage → cache in IndexedDB
4. Save user message to `chat_messages` table
5. Run `extractAndApply()` — silently resolve/create field from message text
6. Call `streamChatCompletion()` → streams SSE tokens back
7. Update message count in local state

**Message rendering:**
- User bubbles: right-aligned green
- AI bubbles: left-aligned dark card
- After AI diagnosis: treatment cards (organic 🌿 / chemical ⚗️ side by side)
- After AI follow-up: outcome chips (Better / Same / Worse)
- Action pills: Star, Log Intervention, Share

**Dual textarea refs:**  
`textareaRef` → InputBar (mobile + desktop chat active)  
`desktopTextareaRef` → welcome screen centered input  
These must stay separate — attaching one ref to two elements breaks React's input routing.

### `chatFunction.ts` — SSE streaming client

Calls `supabase.functions.invoke('chat', { body: request })` and reads the response as a Server-Sent Events stream. Named events:
- `meta` — returns `conversationId`, `userMessageId` before streaming starts
- `token` — each chunk of AI text
- `done` — final payload with `assistantMessageId`, `messageCountMonth`, `metadata`
- `error` — streaming error

### `fieldContext.ts` — Context assembly

Queries `field_context_view` and returns a formatted string injected into the AI system prompt:
```
Field: North Grove | Crop: Olives | Size: 4.2ha | Soil: clay | Last issue: Cycloconium
```

### `extractAndApply.ts` — Silent field extraction

After every user message, calls the edge function with `mode: 'extract'`. Gemini returns `{ crop_type, field_mention, confidence }`. Based on confidence:
- `> 0.7` → auto-set `field_id` on the message
- `0.4–0.7` → show disambiguation chips
- No match + crop type → create new field silently

### `imageCache.ts` — Photo compression + IndexedDB

Two responsibilities:
1. `compressImage(file)` — canvas-based resize to max 1000×1000, JPEG 80%. Reduces a 4MB iPhone photo to ~200KB. Critical for farmers on slow rural 4G.
2. `cacheImage/getCachedImage` — stores compressed blobs in IndexedDB so photos reload instantly without network requests.

### `i18n.ts` — Internationalisation

All visible strings in Greek (`el`) and English (`en`). `detectLang()` calls `ipapi.co` to get the user's country — GR/CY → Greek, everything else → English. Result cached in `localStorage`. User can override in Profile.

---

## 5. Backend — Database Schema

### Core tables

**`users`** — extends Supabase auth  
`id, auth_id, name, location, location_lat, location_lon, primary_crop, language, tier (free/pro), message_count_month, message_reset_date, onboarding_complete, stripe_customer_id`

**`conversations`**  
`id, user_id, field_id, title`

**`chat_messages`** ← canonical table name (NOT `messages`)  
`id, conversation_id, user_id, field_id, role (user/assistant), content, metadata (JSONB), starred, image_urls[], embedding (vector 768)`

**`interventions`** — logged agronomic actions  
`id, user_id, field_id, crop_type, diagnosis, product_applied, dosage, application_method, organic_treatments[], chemical_treatments[], severity, share_id (UUID), is_shared, follow_up_at, followed_up_at, outcome (better/same/worse), outcome_recorded_at`

**`fields`**  
`id, user_id, name, crop_type, location, size_ha, soil_type, irrigation_type, growing_medium, is_active, source (manual/auto_detected)`

**`crops`**  
`id, user_id, field_id, name, variety, planted_at, status (healthy/warning/critical)`

**`photo_reviews`** — admin moderation queue  
`id, message_id, user_id, storage_path, ai_description, review_status`

### Views

**`field_context_view`** — joins fields with their latest intervention and crop count. Read by `fieldContext.ts`.

**`messages`** — view over `chat_messages` for backend compatibility.

**`safe_shared_diagnoses`** — read-only view for `/d/:shareId` public pages. Exposes only safe columns (no user_id, no personal data).

### Key RPC

**`resolve_field(p_user_id, p_mention)`** — fuzzy-matches field names using `pg_trgm`. Returns up to 3 candidates with confidence scores. Used by `extractAndApply.ts`.

### RLS

All tables use Row Level Security. Every policy checks `auth.uid()` against `users.auth_id`. `safe_shared_diagnoses` view is granted to `anon` role — the only public read in the system.

---

## 6. Backend — Edge Function

**Location:** `supabase/functions/chat/index.ts`  
**Runtime:** Deno  
**Deploy:** `supabase functions deploy chat`

### Request flow

```
Client → POST /functions/v1/chat
         Authorization: Bearer {session.access_token}
         Body: { messages[], fieldContext, hasActiveField, fieldId, conversationId,
                 userMessageId, attachmentPaths, mode? }
```

1. **Auth verification** — validates JWT, gets `auth.uid()`, looks up `users` row
2. **Monthly reset** — if `message_reset_date` is a previous month, resets `message_count_month = 0`
3. **Rate limit** — if `tier = 'free'` and `message_count_month >= 20` → 429
4. **Extract mode** — if `body.mode === 'extract'`, calls Gemini with extraction schema, returns field candidates (no DB writes, no token charge)
5. **Save user message** — upserts to `chat_messages` (update if `userMessageId` provided, else insert)
6. **Gemini call** — uses `systemInstruction` field (not injected as user message). Response schema enforces structured JSON output.
7. **Validation + repair** — if response fails validation, calls Gemini once more with error context
8. **SSE streaming** — splits response into word chunks, streams via named events
9. **Save assistant message** — inserts to `chat_messages` with `metadata` (diagnosis_data, intent, etc.)
10. **Increment counter** — updates `users.message_count_month` and `last_active_at`

### Gemini response schema

```typescript
{
  response_text: string           // shown to user
  intent: 'diagnosis' | 'advice' | 'followup' | 'general' | 'unclear'
  crop_mentioned: string | null
  field_scope: 'specific' | 'general'
  question_count: number          // Gemini self-reports — max 1 allowed
  has_banned_opener: boolean
  diagnosis_data: {
    problem: string | null
    cause: string | null
    severity: 'low' | 'medium' | 'high' | null
    product_applied: string | null
    product_category: string | null
    dosage: string | null
    application_method: string | null
    organic_treatments: string[] | null   // e.g. ["Neem oil", "Copper spray"]
    chemical_treatments: string[] | null  // e.g. ["Mancozeb 80WP", "Chlorpyrifos"]
  } | null
}
```

---

## 7. AI Response Structure

When Gemini returns `diagnosis_data`, the frontend:

1. **Renders treatment cards** inline in the chat bubble — green card for organic, blue for chemical
2. **Shows action pills** below the bubble: Star · Log Intervention · Share
3. **Log Intervention** pre-fills `LogInterventionModal` from `diagnosis_data` fields
4. **Share** creates a row in `interventions` with `is_shared=true`, generates `/d/{share_id}` URL
5. **Sets `follow_up_at`** to NOW + 13 days when intervention is logged

**VIO (Verified Intervention Outcome) loop:**  
On app open, `Chat.tsx` queries for interventions where `follow_up_at <= now AND outcome IS NULL`. If found, Oli sends a follow-up message with three outcome chips. Tapping one writes to `interventions.outcome` and updates `crops.status`.

---

## 8. Auth Flow

```
/auth → Google OAuth  → Supabase callback → useAuth detects profile → /chat
     → Facebook OAuth → (same)
     → Magic Link     → email → click link → Supabase callback → /chat
     → Guest mode     → localStorage 'oli_guest' = 'true' → /chat (no DB writes)
```

**`useAuth.tsx`** exports: `user` (Supabase auth user), `profile` (users table row), `appUserId` (internal UUID), `isGuest`, `logout`.

**Important:** Guest mode lets users explore the chat UI but hitting send shows `SignInModal`. No messages are saved. No API calls are made. This is intentional — it's a preview, not a demo mode.

**Supabase Auth settings required:**  
`Authentication → URL Configuration → Site URL` must be set to your deployment URL. Redirect URLs must include `https://yourdomain.com/**`.

---

## 9. Internationalisation

**File:** `src/lib/i18n.ts`  
**Context:** `src/lib/LanguageContext.tsx`

Every visible UI string is defined in both `el` (Greek) and `en` (English). No hardcoded strings anywhere in components — everything goes through `const { t } = useLanguage()`.

**Auto-detection flow:**
1. Check `localStorage['oli_lang']` — if set, use it
2. Call `ipapi.co/json/` — if `country_code` is GR or CY → Greek
3. Fallback: `navigator.language` startsWith 'el' → Greek
4. Default: English

User can switch language in Profile → Settings → Language toggle.

**Adding a new string:**
1. Add the key to the `T` interface in `i18n.ts`
2. Add values to both `el` and `en` objects
3. Use `t.yourKey` in the component

---

## 10. Local Development Setup

### Prerequisites
- Node.js 18+
- Supabase CLI (`brew install supabase/tap/supabase`)
- A Supabase project (EU Frankfurt recommended)

### Steps

```bash
# 1. Clone and install
git clone https://github.com/VasileiosTs/codex_ask_oli_app.git
cd codex_ask_oli_app
npm install

# 2. Set environment variables
cp .env.example .env.local
# Edit .env.local:
# VITE_SUPABASE_URL=https://xxxxx.supabase.co
# VITE_SUPABASE_ANON_KEY=eyJ...

# 3. Link to Supabase project
supabase login
supabase link

# 4. Run migrations
supabase db push

# 5. Set edge function secrets (NEVER put these in .env)
supabase secrets set GEMINI_API_KEY=AIza...
supabase secrets set SUPABASE_URL=https://xxxxx.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=eyJ...
supabase secrets set SUPABASE_ANON_KEY=eyJ...

# 6. Deploy edge function
supabase functions deploy chat

# 7. Run frontend
npm run dev
```

App runs at `http://localhost:3000`.

---

## 11. Environment Variables

### Frontend (Vercel / `.env.local`)

| Variable | Description | Safe to expose? |
|----------|-------------|-----------------|
| `VITE_SUPABASE_URL` | Supabase project URL | ✅ Yes |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key | ✅ Yes |

**Never add `VITE_GEMINI_API_KEY`** — the VITE_ prefix bundles it into browser JS. All Gemini calls go through the edge function.

### Edge Function (Supabase Secrets)

| Secret | Description |
|--------|-------------|
| `GEMINI_API_KEY` | Gemini API key — server-side only |
| `SUPABASE_URL` | Project URL (for admin DB writes) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (bypasses RLS for DB writes) |
| `SUPABASE_ANON_KEY` | For user JWT verification |

Set via: `supabase secrets set KEY=value` or Supabase Dashboard → Settings → Edge Functions.

---

## 12. Deployment

### Frontend — Vercel

1. Connect GitHub repo to Vercel
2. Framework: Vite (auto-detected)
3. Add environment variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
4. Deploy — `vercel.json` handles SPA routing (all routes → `index.html`)

### Backend — Supabase

1. Run migrations: `supabase db push` (or paste SQL files into Supabase SQL Editor in order)
2. Set secrets (see above)
3. Deploy edge function: `supabase functions deploy chat`
4. Set Auth redirect URLs in Supabase Dashboard → Authentication → URL Configuration

### Storage

Create a `chat_uploads` bucket in Supabase Storage → set to Private → add RLS policy:
```sql
-- Allow authenticated users to upload to their own folder
CREATE POLICY "user_uploads" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'chat_uploads' AND (storage.foldername(name))[1] = auth.uid()::text);
```

---

## 13. Feature Roadmap

### Wave 2 — Monetisation (next)
- [ ] Stripe integration (PaywallModal → real Stripe Checkout)
- [ ] Weekly plan delivery (Monday morning AI message, no new screen)
- [ ] Proactive greeting on app open (seasonal tip based on crop + location)
- [ ] Server-rendered OG tags for `/d/:shareId` share pages (social previews)
- [ ] Push notifications for follow-up reminders

### Wave 3 — Data Moat
- [ ] Collective intelligence: "Works for 43 growers like you" (after 1,000 VIOs)
- [ ] VIO analytics dashboard (admin: efficacy by product/crop/region)
- [ ] B2B embed widget ("Powered by Oli" for cooperative portals)
- [ ] PWA + offline message queue
- [ ] SEO landing page (Next.js, Greek + English)
- [ ] API / Agronomist Kit (wrap validator + field context as SDK)

---

## 14. Key Design Decisions

**Why chat-only?**  
Multi-tab apps with a Diagnose tab, a Week tab, and a Chat tab split attention and add cognitive load. Farmers don't think in tabs — they have a problem and want an answer. Every feature flows through conversation. The sidebar is history, not navigation.

**Why Supabase over Firebase?**  
EU Frankfurt hosting for GDPR compliance. Postgres with pgvector for future semantic search. RLS policies enforce data isolation at the database level — not just in application code.

**Why Gemini?**  
`responseSchema` (native JSON mode with schema enforcement) produces more reliable structured output than prompt-based JSON extraction. Gemini's multimodal capability handles plant photos natively.

**Why SSE streaming instead of waiting for full response?**  
Farming advice can be detailed — 200+ words for a treatment protocol. Waiting 8–10 seconds for a full response before showing anything destroys perceived performance. SSE shows tokens as they arrive.

**Why IndexedDB for photo cache?**  
localStorage is limited to ~5MB and is synchronous. A single compressed farming photo is ~200KB. IndexedDB handles arbitrary blob sizes asynchronously, survives page reloads, and doesn't block the main thread.

**`chat_messages` not `messages`**  
The canonical schema uses `messages`. The original codebase used `chat_messages`. A compatibility view (`messages`) was added so the edge function and any future tooling can use the canonical name, while the frontend continues using `chat_messages`. The trigger `sync_intervention_legacy_columns` keeps `product`↔`product_applied` and `diagnosis`↔`problem` in sync for backward compatibility.

**Dual textarea refs**  
`Chat.tsx` renders two `<textarea>` elements: one in the desktop welcome screen, one in the `InputBar` component. A React ref can only point to one DOM element. Using the same ref for both caused the focused textarea to lose its ref on every re-render, breaking input. They use separate refs: `textareaRef` (InputBar) and `desktopTextareaRef` (welcome screen).
