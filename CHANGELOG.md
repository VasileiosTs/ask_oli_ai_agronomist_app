# Changelog

All notable user-facing changes to Ask Oli. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [Unreleased]

---

## [0.9.0] — 2026-06-01

### Added
- **Weekly engagement cron**: users who have open VIO outcomes receive a personalised re-engagement email + push at most once per week; deep-link `?prompt=` takes them straight to the question (80-email/run cap, redundant Monday crons removed)
- **Dosage in intervention cards**: prescribed doses now appear inline on the logged-intervention history card; explicit-dosage requests guarded by a consent disclaimer before revealing off-label rates
- **5th hero stat** and product follow-up copy on the landing page
- **Urdu (ur)** added as the 20th supported language
- **13 new languages** added: Turkish, Romanian, Bulgarian, Albanian, Portuguese, German, Hindi, Swahili, Bengali, Indonesian, Amharic, Vietnamese, Hausa (tr/ro/bg/sq/pt/de/hi/sw/bn/id/am/vi/ha)
- **Hero input placeholder rotation**: example questions cycle through crop scenarios inside the hero input to reduce blank-page friction
- **Testimonials 3-up on desktop**: 2x3 grid layout on md+ screens, names bottom-aligned for clean columns
- **"Your AI Agronomist" category lockup** in the navigation bar
- **Trial badge as CTA**: the "Free trial" badge on the landing page now links directly to auth/chat
- **Grant-tier admin panel**: new tab in the admin dashboard for manually upgrading any user, with a full audit log in `manual_grants`
- **Benefit-first relaunch positioning**: hero headline, meta tags, and OG social cards updated to lead with the farmer outcome ("Know what's wrong. Know exactly what to do.")
- **Broadened positioning to all growers**: landing copy shifted from "farmers" to include agronomists, cooperatives, home gardeners, and agri-input companies; all 18+ languages updated
- **Planning context check (TYPE C)**: chat function validates that planning questions have sufficient field context before answering (soil, crop, location)
- **Field-scoped VIO creation**: VIO outcome loops are only created when the chat is tied to a specific field, preventing orphaned follow-up records
- **Read isolation for general chat**: general-chat threads cannot access field-level data from unrelated field chats
- **Weekly engagement function** (`send-weekly-engagement`) with `CRON_SECRET` authentication via `x-cron-secret` header

### Changed
- **VIO timing overhaul**: step 1 cadence 3 days, step 2 cadence 7 days, expiry notifications added, email cadence refined; constants centralised in `src/lib/constants.ts` and `supabase/functions/chat/index.ts` (kept in sync)
- **Liability disclaimer upgraded** across all 20 languages: "Oli is AI and can make mistakes. Always verify important agricultural advice." replaced with "Oli recommendations are for guidance only. Always verify product registration and legal rates before applying."
- **Landing persona hierarchy**: farmer card is now the always-visible hero; agronomist/cooperative/garden/agri-input roles collapse into a secondary toggle — primary audience signal is now unambiguous
- **Pricing toggle touch targets**: billing period buttons enlarged to minimum 44px height (WCAG 2.5.5)
- **Auth inputs WCAG focus rings**: removed JavaScript inline-style focus handlers; replaced with pure CSS `focus-visible` ring (WCAG SC 2.4.7)
- **Stripe webhook unknown-price warning**: `customer.subscription.updated` now logs a `[webhook] Unknown price ID` warning when a subscription carries a price ID not in the tier map
- **Domain confirmed live**: `ask-oli.com` custom domain active on Vercel

### Fixed
- Billing CTA copy and plan export modal
- Gemini model repair after version drift
- CSP inline-script hashes corrected; dead `unsafe-hashes` directive removed; build-time hash generator added to prevent future drift
- Chat attachments now fully cleared on send (prevented files carrying over into the next message)
- Language picker: click-only on landing page; dropdown retained in profile
- Translation bugs across Greek, Bengali, am/ha/sw/bn landing copy
- Permanent 301 redirect for Google Search Console ownership verification
- Missing `getApplicationRates` / `dosageDisclaimer` / `ratePromptText` keys for tr/ro/bg/sq/pt/de
- Engagement cron authentication: `x-cron-secret` header, anon JWT for gateway, hardcoded function URL in migration
- Improved intent classification logic in the chat function

### Internal
- `grant-tier` Edge Function with admin-only server-side auth; `manual_grants` audit table migration
- `ALLOWED_ORIGIN` CORS pattern: all Edge Functions read from env var (set `ALLOWED_ORIGIN=https://ask-oli.com` in Supabase secrets)
- Phase 2 data moat columns: `confidence_score INTEGER` on `interventions`, `ai_model_version TEXT` on `chat_messages` (migration `20260406000002_phase2_prep.sql`)
- Build-time CSP hash generator (`scripts/gen-csp-hashes.ts`)
- Testimonials padded to 6 per language for clean 2x3 desktop rows (it/es/fr/ar)
- Facebook OAuth removed from production auth flow; `LoginModal.tsx` marked deprecated

---

## [0.8.0] — 2026-04-30

Initial production launch on ask-oli.com.

- Supabase Auth (email + Google OAuth)
- Gemini 2.5 Flash primary AI, gemini-2.0-flash-lite fallback
- Free tier: 20 messages/month; Pro tier: unlimited
- Stripe checkout, webhook, and customer portal (monthly + annual billing)
- VIO loop: diagnosis, intervention log, 3-day apply check, 7-day outcome
- Six launch languages: Greek, English, Italian, Spanish, French, Arabic
- Push notifications (VAPID) + email reminders (Resend)
- Field management with GPS location
- Weekly digest email
- Admin metrics dashboard

---

[Unreleased]: https://github.com/VasileiosTs/ask_oli_ai_agronomist_app/compare/HEAD...HEAD
[0.9.0]: https://github.com/VasileiosTs/ask_oli_ai_agronomist_app/compare/v0.8.0...v0.9.0
[0.8.0]: https://github.com/VasileiosTs/ask_oli_ai_agronomist_app/releases/tag/v0.8.0
