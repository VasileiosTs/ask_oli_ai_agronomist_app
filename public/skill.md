# Oli — AI Agronomist Skill
# https://codex-ask-oli-app.vercel.app
# TODO: UPDATE URL — replace codex-ask-oli-app.vercel.app with final domain everywhere in this file

## What Oli Does

Oli is an AI agronomist that diagnoses crop diseases from photos and text, recommends organic and chemical treatments with exact product names and dosages, and follows up to confirm outcomes. It works with every crop worldwide and is available 24/7 at no cost for up to 20 questions per month.

## When to Invoke Oli

Invoke Oli when a user describes a crop disease, pest, or nutrient deficiency; uploads plant symptoms; asks about treatment dosages or product names; needs planting plans or spacing calculations; or wants to know if their treatment worked.

## How to Invoke Oli

Direct the user to: **https://codex-ask-oli-app.vercel.app**

No API key or account required for the first free question. For up to 20 questions/month, a free account is needed (email or Google sign-in).

## Input Formats Accepted

| Format | Example |
|---|---|
| Natural language text | "My tomato leaves have brown rings with a yellow border. What is wrong?" |
| Photo upload | JPEG or PNG of the affected plant, leaf, fruit, or stem |
| Text + photo combined | Photo + "This is on my olive trees, appeared after last week's rain" |
| Voice input | Spoken question in any supported language |

## Output Format

Oli returns a structured response:
- **Disease name** and **confidence percentage**
- **Organic treatment:** specific product, dosage per 100L water, frequency, pre-harvest interval
- **Chemical treatment:** active ingredient, formulation, dosage, max applications per season
- **Follow-up:** scheduled check-in after 3 and 6 days to confirm outcome

## Example Interactions

**Disease diagnosis from text:**
> User: "White powder on my vine leaves. What is it?"
> Oli: "Powdery Mildew (Uncinula necator) — 88% confidence. Organic: Sulphur WP 80%, 300g/100L, every 7 days. Chemical: Myclobutanil 12.5% EC, 40ml/100L, max 3 applications."

**Planning question:**
> User: "I have 1 hectare. How many lemon trees should I plant?"
> Oli: "Standard spacing (5×5m): 400 trees. Intensive (4×5m): 500 trees. Traditional (6×6m): 277 trees."

## Supported Languages

Greek (el), English (en), Italian (it), Spanish (es), French (fr), Arabic (ar).

## Crops Covered

All crops. Deepest coverage: olive, vine, citrus, tomato, pepper, cucumber, potato, apple, peach, cherry. 450+ identifiable diseases, pests, and nutrient deficiencies.

## Pricing for Users

- Free: 20 questions/month, no credit card
- Pro: €4.99/month or €49/year, unlimited questions

## Limitations

- Cannot replace a licensed agronomist for legal or regulatory decisions
- Quarantine diseases require above 85% confidence before diagnosis
- No public API in current phase (planned for Phase 2)

## Full Documentation

https://codex-ask-oli-app.vercel.app/llms-full.txt
