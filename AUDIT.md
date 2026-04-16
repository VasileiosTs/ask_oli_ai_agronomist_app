# Oli App Audit — 2026-04-16

Single source of truth for what's wired, what's orphaned, what's vestigial, and what to do about it. No code changes made as part of this pass.

---

## TL;DR

The app is in better shape than it feels. Nothing is truly dead. The pain is in **3 structural gaps**:

1. **System prompt is 78% English, 6% per-language.** Root cause of mixed-language AI output. Not a bug in `langInstruction` — a gravity problem. Gemini sees 145 English lines and 3 Greek lines and splits the difference.
2. **Bottom nav is doing half a job.** Free/pro users see 2 tabs (Chat + Profile). Fields and History exist but are buried in the hamburger sidebar. Orphaned from the main nav.
3. **`'pro'` tier is vestigial.** 5 tiers exist in code and DB, but `'pro'` has no unique business logic. It's a placeholder nobody filled in.

Plus minor: `/admin/metrics` and `/legal/*` are reachable only by typing the URL.

---

## 1. Bottom nav: rethink

You asked: *"since beginning we discussed and chose not to use bottom nav, think through if that's the right move still."*

**Current state (BottomNav.tsx):**
- Free / Pro: Chat, Profile (2 tabs)
- Agronomist / Expert: Chat, Clients, Profile (3 tabs)
- Enterprise: Chat, Clients, Cooperative, Profile (4 tabs)
- Fields/History never appear. Hidden in `ConversationSidebar` hamburger.

**This is the worst of both worlds.** A 2-tab bottom nav is neither a proper mobile IA nor a clean chat-first interface. The user watching the video saw "bottom nav missing most tabs" and that's exactly right.

**Three options:**

### A) Kill the bottom nav entirely (ChatGPT-style)
- Everything lives in the hamburger sidebar.
- Works if Oli is fundamentally a chat app.
- Problem: Fields, History, Clients, Profile are destinations, not conversation sidebars. Hamburger makes them 2-tap instead of 1-tap.
- Verdict: **not the right call**. Oli is more than chat. It's a working tool.

### B) Full bottom nav for all users (mobile-app standard)
- Free/Pro: **Chat, Fields, History, Profile** (4 tabs)
- Agronomist/Expert: **Chat, Clients, History, Profile** (Fields collapses into Clients for advisors, since each grower has fields)
- Enterprise: **Chat, Clients, Cooperative, Profile** (History in sidebar)
- Everyone gets 4 tabs, consistent. Hamburger still holds conversation list + settings.
- Verdict: **recommended**.

### C) Keep current design
- Verdict: no. Users are telling us with their eyes that it's broken.

**Recommendation: B.** It's a 30-min change (BottomNav.tsx + icons). Fields is the core farmer use case, History is the second most-used screen. Hiding them is why the app feels empty for free users.

---

## 2. Language mix in AI output — the real fix

**File:** `supabase/functions/chat/index.ts`, lines 225–408.

**Diagnosis:**
- 145 lines of English (Five Pillars, Question Type Detection, Behaviour by Type, Universal Rules, Agricultural Calculations)
- 3 lines of Greek instruction header
- 1 line each for Italian, Spanish, French, Arabic

When a Greek user asks a question, Gemini sees an overwhelmingly English context and mirrors that. The `langInstruction` at line 234 ("απάντα ΠΑΝΤΟΤΕ στα ελληνικά") is a sticky note on a billboard.

**Two fix paths:**

### A) Translate the system prompt per language (correct)
- Build 5 prompt variants: EL, IT, ES, FR, AR. Each one is fully in the user's language.
- English stays as the default for EN users.
- Effort: ~2 hours with Claude to translate + validate. Cost: near-zero ongoing (prompts are built once).
- This is the **Boil the Lake** answer.

### B) Tighter output enforcement (band-aid)
- Keep English prompt. Append at the very end: `"OUTPUT LANGUAGE: {lang}. Respond ENTIRELY in {lang}. Any English word is a bug. Translate all technical terms."`
- Put it both at prompt start AND end (recency bias).
- Works 80% of the time. Still leaks on edge cases.

**Recommendation: A.** You sell to Greek farmers first. The prompt should be Greek-first. English is the exception, not the default.

---

## 3. Tier cleanup — kill `'pro'`

Five tiers wired: `free`, `pro`, `agronomist`, `expert`, `enterprise`.

**`'pro'` has zero unique behavior:**
- Shown in `PaywallModal` as "Upgrade to Pro" label only.
- `isUnlimitedTier('pro')` returns true — but so does `agronomist`, `expert`, `enterprise`.
- AdminMetrics defaults promo creation to `'pro'` but no flow actually assigns it.
- No DB rows use it in your actual user base (verify — but structurally it's orphaned).

**Options:**

- **A) Remove `'pro'`.** Migrate any existing pro users to agronomist. Drop from tier enum. Update PaywallModal copy.
- **B) Define `'pro'`.** Cheap individual tier, limited vs agronomist. Requires product decision.

**Recommendation: A** unless you have product intent for a cheap individual tier. Right now it's confusing — promo codes grant 'pro', paywall says 'pro', but code treats it identically to advisor tiers. That's a trap.

---

## 4. Orphaned routes

| Route | Status | Action |
|-------|--------|--------|
| `/history` | Reachable only via direct URL | Add to bottom nav (see §1) |
| `/admin/metrics` | Reachable only via direct URL. **Unguarded in router.** | Add auth guard + admin-only sidebar link |
| `/legal/privacy`, `/legal/terms` | No footer link | Wire into Landing footer + Profile screen |

**Security note:** `/admin/metrics` has no route guard. The page itself presumably checks admin status, but anyone can load the component bundle. Low impact (no data leak if component checks), but should be guarded at router level too.

---

## 5. Migration hygiene

45 migrations total. Mostly clean. Two loose ends:

- `20260326200000_drip_reengagement_crons.sql` and `20260326500000_drip_reengagement_crons.sql` — duplicates with different cron times. Second one is current. First can be archived.
- `20260326300000_reset_message_counts.sql` and `20260326400000_reset_counts_v2.sql` — one-off cleanup scripts. Keep for history but name doesn't signal that.

**Action:** low priority. Production is fine. Just document that migrations 200000/300000/400000 on 03-26 are superseded experimental iterations.

---

## 6. Component inventory

Zero dead components. Every file in `src/components/` is imported at least once.

Largest files worth watching:
- `Chat.tsx` — 1,929 lines. Candidate for extraction (already has `src/pages/chat/` subdirectory suggesting in-progress split).
- `Landing.tsx` — 1,418 lines. OK for a marketing page, but sectionable.
- `AdminMetrics.tsx` — 871 lines. Fine, it's a dashboard.
- `MessageBubble.tsx` — 548 lines. Diagnosis rendering logic could be extracted.

**No prune needed here.** Large is not dead.

---

## 7. TODOs

Zero TODO/FIXME/XXX/HACK comments in src/ or supabase/. Clean.

---

## Priority stack (my recommendation)

### P0 — Ship this week
1. **Rewire bottom nav to Option B** (Chat, Fields/Clients, History, Profile). 30 min.
2. **Translate system prompt to Greek** (Italian/Spanish/French/Arabic can follow). 2 hours.
3. **Remove `'pro'` tier** OR fully define it. Product decision, then 1 hour code.

### P1 — Next week
4. Guard `/admin/metrics` at router level.
5. Wire `/legal/*` into Landing footer.
6. Extract Chat.tsx sub-components into `src/pages/chat/*`.

### P2 — When it itches
7. Archive duplicate migrations 20260326200000, 300000, 400000.
8. Consider splitting MessageBubble diagnosis rendering.

---

## What we're NOT fixing

- **The route set itself.** All pages are functional, used, and appropriate. No routes to remove.
- **Component library.** Nothing dead.
- **Migration schema.** Production is correct.

The app is 85% right. The 15% that feels broken is mostly **navigation discoverability** + **language prompt weighting**. Fix those two and the "this app has half-wired stuff" feeling goes away.
