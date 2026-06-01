# Dosage Gating: Why Oli gates explicit application rates behind a consent step

**Category**: Explanation (Diataxis)
**Audience**: Engineers, product reviewers, legal, partners
**Last updated**: 2026-06-01

---

## The short answer

Pesticide and agrochemical registration is national law. The same active ingredient — say, Myclobutanil 12.5% EC — may be registered at 40 ml/100L in Greece and at a different rate, or not at all, in another country. If Oli surfaced precise per-hectare rates without warning, and a farmer applied them in a jurisdiction where the product is unregistered, Oli would be giving advice that could lead to a regulatory violation, a crop failure from overdose, or harm to people downstream from the produce.

The gating is a **consent-before-disclosure** pattern, not a paywall and not a technical limitation.

---

## What the system actually does

### Step 1 — Diagnosis with reference dosage

When Oli diagnoses a disease and recommends a treatment, it always includes a reference dosage inline (e.g., "Sulphur WP 80%, 300 g/100L"). This is embedded in the treatment card by the extraction pipeline and is intentional: a farmer who cannot click a second button still gets actionable information.

The system prompt instruction is explicit:

> "Always include a specific dosage with every treatment recommendation. NEVER say 'apply as per label' or omit dosage."

### Step 2 — "Get application rates" button

A secondary `💊 Get application rates →` button appears beneath the treatment card. Pressing it triggers a follow-up AI call with the `ratePromptText` pre-filled ("What are the application rates for the recommended treatments").

### Step 3 — Disclaimer displayed first

Before the AI response is shown, the `dosageDisclaimer` string is rendered to the user. The English version:

> "Doses shown are reference rates. Exact amounts depend on the product you buy. Always read your product label before applying."

Other languages carry the same message, with some (Italian, Spanish, French) adding "consult a certified agronomist before applying."

### Step 4 — Full rates returned

Only after the disclaimer is visible does Oli return the detailed rates table with active ingredient concentrations, application windows, equipment-specific conversions, and PHI (pre-harvest interval) where known.

---

## Why two steps instead of one?

### Legal exposure varies by jurisdiction

Agrochemical registration is country-specific and crop-specific. A product legal in Greece on olives may be:
- Unregistered in Morocco on the same crop
- Registered at a different rate in Italy
- Not legal on that crop at all in Germany

Oli operates in 20 languages across markets with very different regulatory regimes. A blanket "here are the exact rates, apply now" response would not be appropriate for all users.

### The disclaimer creates an audit trail

When a user clicks "Get application rates" and sees the disclaimer, they have made an affirmative action and read the caveat. If a regulatory body or legal challenge ever asks whether Oli provided uncaveated pesticide rates, the answer is no: every rate disclosure is gated behind explicit user action and a visible disclaimer.

### It separates diagnosis from prescription

The two-step design reflects the product's intended role: Oli is a diagnostic and advisory tool, not a prescription pad. The AI gives you the _what_ and _why_ (diagnosis, treatment, active ingredient) immediately. The _exactly how much_ requires one extra tap, which signals to the user that rates are reference values to be confirmed against their specific product label.

---

## What the disclaimer does NOT do

- It does not prevent farmers from getting dosage information. The step is a tap, not a barrier.
- It does not create a free-vs-paid split. Both free and Pro users can access application rates.
- It does not replace reading the product label. The disclaimer says this explicitly.

---

## Design decision record

| Date | Decision | Reason |
|------|----------|--------|
| 2026-05-28 | Added `getApplicationRates` button + `dosageDisclaimer` across all languages | Liability exposure on off-label rates flagged during review of dosage cards feature |
| 2026-06-01 | `aiDisclaimer` string updated in all 20 languages to reference product registration and legal rates | Previous copy ("Oli can make mistakes") was too generic; new copy specifically calls out the regulatory dimension |

---

## Future: Jurisdiction-aware rates

As the data moat grows (VIO outcomes by crop + location + treatment + dosage), a Phase 2 feature could pull registration data per country per active ingredient and surface "registered in your location: yes/no" alongside the rate. Until that data is available, the disclaimer pattern is the appropriate risk management approach.

---

## Related files

| File | Relevance |
|------|-----------|
| `src/lib/i18n-dict.ts` | `getApplicationRates`, `dosageDisclaimer`, `ratePromptText` keys in all 20 languages |
| `supabase/functions/chat/index.ts` | `dosageInstruction` system prompt constant; extraction schema for `dosage` field |
| `src/components/MessageBubble.tsx` | Renders the treatment card and the "Get application rates" button |
| `CHANGELOG.md` | 0.9.0 entry for dosage cards + disclaimer |
