# Oli — MVP Build Todos

Strategic thesis: "We are the AI agronomist for Mediterranean smallholders — and every grower we help builds the dataset that makes every future grower's advice better. The consumer app is the acquisition engine. The data is the asset."

Status key: ✅ Done · 🔄 In progress · ⬜ Not started · 🚫 Blocked

---

## 🏗️ Foundation (Core Infrastructure)

| Status | Item | Priority | Notes |
|--------|------|----------|-------|
| ✅ | Supabase project + all 8 migrations applied | P0 | EU Frankfurt, GDPR |
| ✅ | Edge function `chat` deployed | P0 | Gemini 2.5 Flash |
| ✅ | Vercel deployment + SPA routing | P0 | codex-ask-oli-app.vercel.app |
| ✅ | Environment variables configured | P0 | Supabase + Gemini keys |
| ✅ | Auth: PKCE magic link working end-to-end | P0 | /auth/callback route |
| ✅ | Auth: shared React context (no more hook isolation bugs) | P0 | AuthProvider in main.tsx |
| ✅ | Onboarding flow: name → location → multi-crop | P0 | Saves profile, navigates to chat |
| ✅ | Onboarding: OAuth name pre-fill (skip step 1 for Google/Facebook users) | P0 | Reads user_metadata.full_name |
| ✅ | Onboarding: age range auto-advance (no extra "Next" tap needed) | P1 | 180ms delay then setStep(4) |
| ✅ | Onboarding: mobile keyboard no longer hides Next button | P1 | Scrollable content + sticky CTA |
| ✅ | RLS policies on all tables | P0 | Data isolation per user |
| ✅ | FORCE ROW LEVEL SECURITY on all sensitive tables | P0 | migration 20260407000001 — prevents owner bypass |
| ✅ | Custom domain | P1 | ask-oli.com — live |
| ⬜ | Storage bucket RLS policy verified | P1 | chat_uploads bucket access |
| ⬜ | Supabase backups enabled | P1 | Point-in-time recovery |
| ⬜ | Rate limiting on edge function beyond free tier | P2 | Already has 20/month soft limit |

---

## 💬 Chat — Core Experience

| Status | Item | Priority | Notes |
|--------|------|----------|-------|
| ✅ | SSE streaming from Gemini to browser | P0 | Token-by-token rendering |
| ✅ | Paragraph/newline preservation in stream | P0 | Fixed splitIntoChunks |
| ✅ | ReactMarkdown rendering (bold, lists, headers) | P0 | prose-invert Tailwind |
| ✅ | Photo upload + compression (max 1000px, JPEG 80%) | P0 | imageCache.ts |
| ✅ | IndexedDB photo cache | P0 | Instant re-display on revisit |
| ✅ | Historical image URL resolution from Storage | P0 | Signed URLs + cache fallback |
| ✅ | Organic vs chemical treatment cards | P0 | Side-by-side in AI bubble |
| ✅ | Star / Log Intervention / Share action pills | P0 | On diagnosis messages |
| ✅ | Abort controller — stream cancels on clearChat | P0 | No ghost messages |
| ✅ | Conversation title from first message | P0 | Edge function sets it |
| ✅ | Sidebar loading state when switching convos | P1 | Spinner during fetch |
| ✅ | Skip extractAndApply for short messages | P1 | Saves Gemini API calls |
| ✅ | Voice input language matches app language | P1 | SpeechRecognition — el-GR / en-US wired + tested |
| ⬜ | PDF analysis (upload + Gemini reads it) | P1 | Partially built, needs real test |
| ✅ | Conversation search | P2 | Client-side filter + highlight in ConversationSidebar |
| ✅ | Message pagination (load more) in sidebar | P2 | PAGE_SIZE pagination with "load more" button |
| ✅ | Proactive greeting on app open | P2 | dynamicGreeting from edge function greeting mode |
| ⬜ | Weekly plan as Monday chat message | P2 | Wave 2 feature |

---

## 🌿 Field Intelligence

| Status | Item | Priority | Notes |
|--------|------|----------|-------|
| ✅ | Fields table + RLS | P0 | Hidden from nav, data layer only |
| ✅ | Auto-detect crop/field from message (extractAndApply) | P0 | Gemini extraction mode |
| ✅ | Field disambiguation chips in chat | P0 | When 2+ fields match |
| ✅ | Field context injected into AI system prompt | P0 | assembleFieldContext() |
| ✅ | field_context_view in DB | P0 | Fields + last intervention + crop count |
| ⬜ | Auto-create field from first message crop mention | P1 | When no fields exist yet |
| ⬜ | Field name shown in conversation title | P2 | "Ελιές Βορείου 14 Mar" |
| ✅ | Seasonal context injection | P2 | Month + season + hemisphere injected into growerContext |

---

## 📊 VIO Data Flywheel (Verified Intervention Outcomes)

| Status | Item | Priority | Notes |
|--------|------|----------|-------|
| ✅ | Log Intervention modal (crop, problem, product, dose) | P0 | Pre-fills from diagnosis |
| ✅ | follow_up_at set to NOW+13d when intervention logged | P0 | DB column exists |
| ✅ | Outcome check on app open (VIO loop) | P0 | Queries overdue follow-ups |
| ✅ | Outcome chips in chat (Better / Same / Worse) | P0 | Updates interventions.outcome |
| ✅ | Crop status updated from outcome | P0 | healthy/warning/critical |
| ✅ | outcome migration (outcome, outcome_note, outcome_recorded_at) | P0 | Applied to DB |
| ✅ | outcome_note collection (text after chip tap) | P1 | Implemented in LogInterventionModal.tsx |
| ⬜ | Share diagnosis as public link (/d/:shareId) | P1 | Code exists, needs testing end-to-end |
| ✅ | OG image for shared diagnosis pages | P2 | og-image edge function generates SVG OG cards |
| ⬜ | Collective intelligence (show patterns to growers) | P3 | After 500+ VIOs |

---

## 👤 Auth & Profile

| Status | Item | Priority | Notes |
|--------|------|----------|-------|
| ✅ | Magic link auth (PKCE) | P0 | Working end-to-end |
| ✅ | Onboarding 3-step (name, location, multi-crop) | P0 | Saves to users table |
| ✅ | Profile page (edit name/location/crop) | P0 | Reads from auth context |
| ✅ | Logout | P0 | Clears session + navigates |
| ✅ | Delete account (GDPR — deletes storage files too) | P0 | Removes all data |
| ✅ | Export data as JSON | P1 | Downloads profile + messages + interventions |
| ✅ | Language toggle in Profile (Greek/English) | P1 | Persisted in localStorage |
| ✅ | Notification preferences (follow-up, weekly plan) | P1 | Toggles saved to DB |
| ✅ | Google OAuth | P1 | Live in production Auth.tsx |
| ⬜ | Facebook OAuth | P2 | Only in deprecated LoginModal.tsx — not wired in production Auth.tsx |
| ⬜ | Email change flow | P2 | Currently not possible after signup |
| ⬜ | Profile photo upload | P3 | Nice-to-have |

---

## 💰 Monetisation

| Status | Item | Priority | Notes |
|--------|------|----------|-------|
| ✅ | PaywallModal (UI only, no Stripe) | P0 | Shows at 20 msg/month |
| ✅ | PaywallModal: price corrected to €4.99/month (was €8.99) | P0 | Consistent with landing + i18n |
| ✅ | Free tier enforced (20 msg/month) in edge function | P0 | 429 response + reset logic |
| ✅ | Message count + progress bar in Profile | P0 | Visual usage indicator |
| ✅ | Stripe Checkout integration | P0 | Live — create-checkout function, pro/master × month/year |
| ✅ | Stripe webhook → update users.tier | P0 | Live — stripe-webhook function |
| ✅ | Stripe Customer Portal (manage/cancel sub) | P1 | Live — self-serve cancellation wired |
| ⬜ | Founding Grower offer (€50/year, limited) | P1 | Early revenue signal for investors |
| ✅ | Pro tier: unlimited messages enforced | P1 | Live — tier check in chat edge function |
| ⬜ | Payment failure handling (downgrade flow) | P2 | When Stripe payment fails |

---

## 🎨 Design & UX

| Status | Item | Priority | Notes |
|--------|------|----------|-------|
| ✅ | Dark theme only | P0 | CSS variables, no light mode |
| ✅ | Desktop: permanent sidebar + welcome screen | P0 | Like Claude.ai |
| ✅ | Mobile: full-screen chat + hamburger sidebar | P0 | No bottom nav |
| ✅ | Responsive max-width (max-w-2xl) on messages | P0 | Readable on wide screens |
| ✅ | Greek/English by IP geolocation | P0 | ipapi.co + localStorage |
| ✅ | Zero greeklish — all strings in proper script | P0 | i18n.ts |
| ✅ | i18n: messagesPerMonth key corrected (was messagesPerWeek) | P1 | Matches backend monthly enforcement |
| ✅ | SharedDiagnosis: chemical treatment regulatory disclaimer | P1 | ⚠ Ελέγξτε τοπικές άδειες |
| ✅ | Desktop: active field name shown in chat area header | P1 | Leaf icon + field name + crop type |
| ✅ | ErrorBoundary (no white screen on crash) | P0 | Shows refresh button |
| ✅ | Suggestion chips on empty chat state | P1 | 4 chips, localised |
| ✅ | Feature cards on desktop welcome screen | P1 | Photo/Memory/Logging |
| ✅ | Favicon (Oli leaf icon) | P1 | SVG leaf + all PNG sizes in public/ |
| ✅ | PWA manifest (add to home screen) | P2 | manifest.json with all icon sizes + standalone mode |
| ✅ | Loading skeleton for conversation list | P2 | animate-pulse skeleton in ConversationSidebar |
| ⬜ | Haptic feedback on mobile (iOS/Android) | P3 | On send, on diagnosis |

---

## 🔍 SEO & Discovery

| Status | Item | Priority | Notes |
|--------|------|----------|-------|
| ✅ | index.html: title, description, OG tags | P1 | Greek + English |
| ⬜ | Public landing page at / (static HTML, no React) | P0 | Before any acquisition push |
| ⬜ | Greek keyword research (olive disease, tomato pests etc.) | P1 | Informs landing page copy |
| ⬜ | Shared diagnosis pages: server-rendered HTML | P1 | /d/:shareId — best SEO asset |
| ⬜ | Schema.org structured data (MedicalCondition, HowTo) | P2 | AI search visibility |
| ⬜ | Sitemap.xml | P2 | When you have crawlable pages |
| ⬜ | Google Search Console setup | P2 | After landing page live |

---

## 🧪 Quality & Testing

| Status | Item | Priority | Notes |
|--------|------|----------|-------|
| ✅ | Production stress test (17 issues found + fixed) | P0 | March 2026 |
| ✅ | Edge function: validation + repair retry | P0 | Bad Gemini response → retry once |
| ✅ | Edge function: Gemini 5xx fallback to gemini-2.0-flash-lite | P1 | Automatic retry with stable model |
| ✅ | Edge function: skip Gemini extraction for single-field users | P1 | Saves API calls — no disambiguation needed |
| ✅ | Edge function: Greek injection patterns in sanitizeUserInput() | P0 | αγνόησε / είσαι τώρα / νέα οδηγία etc. |
| ✅ | Edge function: enforceConfidenceThreshold() post-Gemini safety layer | P0 | Clears diagnosis_data when confidence < 40 |
| ⬜ | Basic E2E test (auth → onboarding → chat → response) | P0 | Before sharing with users |
| ⬜ | Vitest unit tests for i18n, imageCache, fieldContext | P1 | Cheapest lake to boil |
| ⬜ | Edge function smoke test (Deno test) | P1 | Auth, rate limit, Gemini call |
| ✅ | Error monitoring (Sentry or similar) | P1 | @sentry/react integrated + VITE_SENTRY_DSN env var |
| ⬜ | Uptime monitoring (Better Uptime or UptimeRobot) | P1 | Alert if Vercel/Supabase down |
| ⬜ | Performance audit (Lighthouse) | P2 | LCP, CLS, FID scores |

---

## 📣 Growth & Acquisition

| Status | Item | Priority | Notes |
|--------|------|----------|-------|
| ⬜ | Invite 10 farmers personally (soft launch) | P0 | Real feedback before public |
| ⬜ | WhatsApp share of diagnosis (Greek farming groups) | P1 | Viral loop — one tap share |
| ⬜ | Cooperative partnership deck (B2B) | P1 | Target 3 cooperatives in Greece |
| ⬜ | Founding Grower email sequence | P1 | Onboard + educate early users |
| ⬜ | Social sharing card (auto-generated OG image) | P2 | Each diagnosis → shareable card |
| ⬜ | Agri-input retailer partnership (B2B embed) | P3 | Wave 3 revenue stream |

---

## 🗺️ Wave Milestones

### Wave 1 — MVP (current) — Target: April 2026
Core goal: 10 real farmers using the app weekly. One conversation saves them time or money.

- [x] Fix favicon — ✅ Oli leaf SVG in public/
- [x] Sentry error monitoring — ✅ @sentry/react integrated
- [x] Google OAuth working — ✅ live
- [x] Stripe checkout live — ✅ live (create-checkout, stripe-webhook, customer portal)
- [ ] Share diagnosis link — route + page done, needs E2E test with real data
- [ ] 10 personal invites sent — go do this

### Wave 2 — Monetisation — Target: June 2026
Core goal: First €500 MRR. First cooperative conversation.

- [x] Stripe fully integrated + webhooks — ✅ live
- [ ] Founding Grower offer (€50/year, 100 slots)
- [ ] Landing page live with Greek SEO content
- [ ] Weekly plan message (Monday morning)
- [ ] Proactive greeting (seasonal tip on app open)
- [x] Push notifications infrastructure — ✅ send-push edge function + usePushSubscription hook done; needs VAPID key in prod
- [ ] First cooperative pilot (embed widget)

### Wave 3 — Data Moat — Target: Q4 2026
Core goal: 500+ VIOs collected. Collective intelligence live.

- [ ] Collective intelligence ("Works for 43 growers like you")
- [ ] Admin VIO dashboard (efficacy by product/region/crop)
- [ ] Shared diagnosis pages server-rendered (SEO)
- [ ] PWA (offline message queue)
- [ ] B2B API / Agronomist Kit

---

## 🐛 Known Issues (open)

| Issue | Severity | Status |
|-------|----------|--------|
| Facebook OAuth not configured (no App review) | Medium | ⬜ Pending |
| ~~Conversation pagination missing~~ | Low | ✅ PAGE_SIZE pagination with load-more in sidebar |
| ~~outcome_note never written~~ | Low | ✅ Fixed — LogInterventionModal writes it |
| No test suite (no safety net for future changes) | Medium | ⬜ Wave 1 |
| ~~Favicon is default Vite icon~~ | Low | ✅ Fixed — Oli leaf SVG |
| ~~Stripe Checkout not integrated~~ | High | ✅ Fixed — Stripe live |
| ~~Admin dashboard UI not implemented~~ | Medium | ✅ AdminMetrics.tsx — KPIs, retention, VIO, revenue table |
| ~~Voice input not wired~~ | Low | ✅ SpeechRecognition API wired in Chat.tsx |

---

*Last updated: June 2026*
*Built with Claude (Sonnet 4.6) + Codex*
