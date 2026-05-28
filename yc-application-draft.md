# YC Application Draft
# Company: Oli — AI Agronomist
# Last updated: 2026-05-12
# Status: Work in progress — review before submitting

---

## Company Description
*"Describe what your company does in 50 characters or less."*

AI agronomist for smallholder farmers

*(37 characters)*

---

## Product Description
*"Please describe your product and what it does or will do."*

Oli is a web app and PWA. A farmer describes a crop problem or uploads a photo. Oli identifies the disease, gives the cause, severity, and a treatment protocol — organic and chemical options with exact product names and dosages. It remembers every field, crop, and past problem. Seven days after a diagnosis, Oli follows up: "Did you apply? Is it improving?" The outcome is recorded. That loop — diagnosis → treatment → outcome — is the dataset no one else is building. Live at ask-oli.com. No app install required. Gemini 2.5's native multimodal capability makes photo-based crop diagnosis reliable at scale — this wasn't technically possible 18 months ago.

---

## Team
*"Who writes code, or does other technical work on your product?"*

Solo founder by choice — domain expertise and technical execution are both in one person, and the founder-market fit is specific enough that a generalist co-founder would add overhead, not leverage. Vasileios Tsipas is a licensed agronomist with 18 years in agribusiness. He ran a €1.5M/year agricultural export operation, founded PlantBox (exported packaged trees to 27 countries including USA and China, clients included Samsung, Deloitte, H&M, and OECD), and advised EU DG Agriculture on the EU-China Agricultural Trade Agreement of 2019. He managed phytosanitary assessments professionally for nine years — the same work Oli automates. Named Most Promising Young Agriculture Professional in the EU by the European Commission (2017–18) and winner of four startup innovation awards including the National Bank of Greece and the American-Hellenic Chamber of Commerce. He has direct senior relationships at ADAMA and Yara — every B2B conversation Oli needs to have is a warm call. He built Oli because the tool didn't exist and he needed it. He writes all the code.

---

## Location
*"Where do you live now, and where would the company be based after YC?"*

Greece. Xylokastro, Corinthia. After YC: open to relocating to the Bay Area permanently.

---

## Progress
*"How far along are you?"*

Live at ask-oli.com as of May 15, 2026. Every message runs through a multi-stage agent pipeline: image pre-extraction → intent classification → modular system prompt assembly → Gemini 2.5 structured JSON output → VIO follow-up scheduling. The result is reliable enough to give exact dosages, not just category-level advice. Also shipped: field memory, 6 languages, Stripe, push notifications, field reports, admin KPI dashboard. Solo founder, full-time, all code written by the founder. Core AI edge function: 3,100 lines, built solo. Multi-stage pipeline — image extraction agent, intent routing, structured JSON output enforced at API level, automated follow-up scheduling.

---

## Traction
*"Are people using your product? Do you have revenue?"*

Launching May 15th. No users before that date — a deliberate call. The chat pipeline had errors that would have damaged trust on first use, and in a farming community where everyone talks, one bad diagnosis spreads. The product is now stable and calibrated. On launch day, beta links go to the first cohort. 30-day goal: 100+ farmers, 10 agronomists, 2 cooperatives with 2,000+ members each, 2 crop protection company demos. The outreach is warm — direct relationships, long-term partners, and mutual introductions built across 18 years in Greek agribusiness. The ADAMA and Yara contacts are senior and direct.

---

## Idea Origin
*"Why did you pick this idea to work on? Do you have domain expertise? How do you know people need what you're making?"*

I grew up in a farming family in Xylokastro, Greece. My parents, grandparents, neighbors, and I all have fields. I've been the person people call for 18 years — because of my background in plant production and agribusiness, I'm the informal agronomist for everyone around me.

Three recent examples. A farmer I sold olive trees to three years ago called last week — leaves dropping from the tops of his plants, he didn't know why, I diagnosed it by phone description. My grandmother has a vegetable garden; she calls me to describe what she sees and asks why her plants are dying. Friends in Argos who grow oranges have a pest problem their professional agronomist hasn't been able to fix — they're losing produce. They called me because I sold them their trees.

I was already doing this manually, one call at a time. Oli is that, scaled — available at 2am, in 6 languages, to every farmer who can't afford a visit or can't get a useful answer. I didn't find this problem by researching markets. I've been living it my entire life.

---

## Competitors
*"Who are your competitors? What do you understand about your business that they don't?"*

Enterprise agtech (Trimble, Climate Corp, John Deere Ops Center) costs $10k+/year and requires farm machinery. It's built for large commercial farms — the 1%. Photo-ID apps (Plantix, PictureThis) identify diseases but give no treatment, remember nothing, and never follow up. General LLMs give category-level advice with no dosages and no memory. What none of them do: close the loop. No one records what treatment was applied and whether it worked. Oli does. That outcome data is the only thing that makes the next recommendation more accurate — and competitors can't fast-follow it.

---

## Monetization
*"How do or will you make money? How much could you make?"*

Free tier: 20 messages/month. Pro: €4.99/month. Agronomist tier: €49/month — agronomists manage client farmers, which makes them a distribution channel. Each agronomist who joins brings their network. Enterprise: cooperatives at custom pricing — not a revenue target initially, a go-to-market engine that onboards hundreds of farmers at once. Longer term: sell VIO outcome data and AI inference to input manufacturers. They spend €50M+/year on field trials. We'll have the real-world efficacy data they can't get elsewhere. 500M addressable farms globally. If 0.1% convert to Pro (€4.99/month), that's €3M MRR. If 1% — €30M MRR. The B2B API layer (efficacy data to input manufacturers) is the real prize: $50M+/year industry spend on field trials.

---

## Equity
*"Have you formed ANY legal entity yet? Have you taken any investment? Are you currently fundraising?"*

Oli operates under an existing sole proprietorship (personal VAT registration) used for plant production and wholesale. No separate legal entity for Oli has been formed yet — that will happen at fundraising. No external investment of any kind. Not currently fundraising — the plan is to demonstrate week-over-week growth from the May 15th launch, then raise.

---

## Curious
*"What convinced you to apply to Y Combinator? How did you hear about Y Combinator?"*

YC's stamp matters differently for Oli than for a typical software startup. We're selling to agricultural cooperatives, government extension services, and global input manufacturers — institutions that move slowly and vet vendors carefully. A YC company gets a different conversation than a solo founder from Greece. That changes our speed into US agribusiness partnerships and into government agricultural programs where Oli can reach thousands of farmers at once instead of one at a time. Beyond that: fundraising from a YC batch, with YC's network behind us, is the difference between raising enough to prove the model in Greece and raising enough to expand to Italy, Spain, Morocco, and India in the same window. We're not applying because everyone applies to YC. We're applying because the specific doors YC opens — US agribusiness, institutional buyers, global investors — are exactly the doors Oli needs in year one.

[ ADD: one sentence on how you first heard about YC ]

---

*Read this out loud — the whole thing. Any sentence you hesitate on, or couldn't elaborate on in a YC interview without notes, needs more work before you submit.*
