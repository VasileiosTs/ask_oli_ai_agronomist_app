import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Send, Clock, Leaf, Check, MessageCircle, Zap, RefreshCw, Camera, Mic, X, Globe, ClipboardCheck } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useLanguage } from '../lib/LanguageContext';
import OliLogo from '../components/OliLogo';
import { ALLOWED_IMAGE_TYPES, MAX_FILE_SIZE } from '../lib/constants';
import { LANG_OPTIONS } from '../lib/i18n';

// ── Unit detection ────────────────────────────────────────────────────────────
const detectImperial = (): boolean => {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return /^America\/(New_York|Chicago|Denver|Los_Angeles|Phoenix|Anchorage|Honolulu|Detroit|Boise|Juneau|Nome|Sitka|Metlakatla|Adak|Indiana|Kentucky|North_Dakota)/.test(tz);
  } catch { return false; }
};

// ── Phone demo data ───────────────────────────────────────────────────────────

type PhoneDemo =
  | { type: 'disease'; user: string; disease: string; confidence: number; organic: string; chemical: string; followup: string }
  | { type: 'advice';  user: string; answer: string; icon: string };

const PHONE_DEMOS = (lang: string): PhoneDemo[] => [
  {
    type: 'disease',
    user: lang === 'el'
      ? 'Τα φύλλα της ντομάτας έχουν καστανούς κύκλους με κίτρινο περίγραμμα.'
      : 'My tomato leaves have brown rings with a yellow border.',
    disease:    lang === 'el' ? 'Εναλτερίωση Ντομάτας' : 'Early Blight (Alternaria)',
    confidence: 92,
    organic:  'Bordeaux mixture 200g/100L',
    chemical: 'Mancozeb 80% WP 250g/100L',
    followup: lang === 'el' ? 'Θα σε ρωτήσω για να δω πώς πάει η θεραπεία.' : "I'll follow up to see how the treatment is going.",
  },
  {
    type: 'advice',
    user: lang === 'el'
      ? 'Πότε κλαδεύω αμπέλια για καλύτερη παραγωγή;'
      : 'When should I prune grapevines for better yield?',
    icon: '✂️',
    answer: lang === 'el'
      ? 'Κλάδεψε κατά τον χειμερινό ύπνο (Ιαν–Μαρ). Άφησε 2–3 μάτια ανά βλαστό. Αφαίρεσε πρώτα το νεκρό ξύλο.'
      : 'Prune during dormancy (Jan–Mar). Keep 2–3 buds per cane. Remove dead wood first.',
  },
  {
    type: 'disease',
    user: lang === 'el'
      ? 'Λευκή σκόνη στα φύλλα του αμπελιού. Τι είναι;'
      : 'White powder on my vine leaves. What is it?',
    disease:    lang === 'el' ? 'Ωίδιο (Uncinula necator)' : 'Powdery Mildew',
    confidence: 88,
    organic:  lang === 'el' ? 'Θείο WP 80%, 300g/100L' : 'Sulphur WP 80%, 300g/100L',
    chemical: 'Myclobutanil 12.5% EC, 40ml/100L',
    followup: lang === 'el' ? 'Θα σε ρωτήσω για να δω πώς πάει η θεραπεία.' : "I'll follow up to see how the treatment is going.",
  },
];

// ── Static data ───────────────────────────────────────────────────────────────

const STATS = (lang: string) => [
  { n: '450+', label: lang === 'el' ? 'Ασθένειες & παθογόνα' : 'Diseases & pathogens' },
  { n: '6',    label: lang === 'el' ? 'Γλώσσες' : 'Languages' },
  { n: '24/7', label: lang === 'el' ? 'Γεωπόνος στην τσέπη σου' : 'Agronomist in your pocket' },
  { n: '€0',   label: lang === 'el' ? 'Για να ξεκινήσεις' : 'To get started' },
];

const HOW_IT_WORKS = (lang: string) => [
  {
    step: '1',
    icon: MessageCircle,
    title: lang === 'el' ? 'Ρώτα ή φωτογράφισε' : 'Ask or snap a photo',
    body: lang === 'el'
      ? 'Γράψε την ερώτησή σου ή ανέβασε φωτογραφία από το χωράφι. Δεν χρειάζεται να ξέρεις τη σωστή ορολογία.'
      : 'Type your question or upload a photo from your field. No need to know the right terminology.',
  },
  {
    step: '2',
    icon: Zap,
    title: lang === 'el' ? 'Πάρε απάντηση σε δευτερόλεπτα' : 'Get your answer in seconds',
    body: lang === 'el'
      ? 'Διάγνωση, πλάνο θεραπείας, συμβουλές σποράς, υπολογισμός φύτευσης. Συγκεκριμένη απάντηση, όχι γενικές πληροφορίες.'
      : 'Diagnosis, treatment plan, planting advice, spacing calculations. A specific answer, not generic information.',
  },
  {
    step: '3',
    icon: RefreshCw,
    title: lang === 'el' ? 'Ο Oli παρακολουθεί και μαθαίνει' : 'Oli follows up and learns',
    body: lang === 'el'
      ? 'Θυμάται κάθε καλλιέργεια και παρέμβαση. Παρακολουθεί σαν αληθινός γεωπόνος αν η θεραπεία πέτυχε.'
      : 'It remembers every crop and treatment. Follows up like a real agronomist to confirm the treatment worked.',
  },
];

const FEATURES = (lang: string): { icon: LucideIcon; title: string; body: string; accent: boolean }[] => [
  {
    icon: Camera,
    title: lang === 'el' ? 'Ρώτα οτιδήποτε για τις καλλιέργειές σου' : 'Ask anything about your crops',
    body: lang === 'el'
      ? 'Ασθένειες, πότισμα, λίπανση, κλάδεμα, σπορά. Αν το ξέρει ένας έμπειρος γεωπόνος, το ξέρει και ο Oli. Δεν είναι απλώς εφαρμογή αναγνώρισης. Είναι ο σύμβουλός σου.'
      : 'Diseases, irrigation, fertilisation, pruning, planting schedules. If an experienced agronomist knows it, Oli knows it. Not just an ID app. Your complete farming advisor.',
    accent: true,
  },
  {
    icon: Globe,
    title: lang === 'el' ? 'Μιλά τη γλώσσα σου' : 'Works in your language',
    body: lang === 'el'
      ? 'Ελληνικά, Αγγλικά και περισσότερες γλώσσες σύντομα. Ιδανικός για αγρότες σε όλη την Ευρώπη και μεταναστευτικές κοινότητες. Επιλέξτε γλώσσα από το προφίλ σας.'
      : 'Greek, English and more languages coming. Built for farmers across Europe and immigrant farming communities. Set your preferred language from your profile.',
    accent: false,
  },
  {
    icon: ClipboardCheck,
    title: lang === 'el' ? 'Μαθαίνει τα χωράφια σου, παρακολουθεί' : 'Learns your fields, follows up',
    body: lang === 'el'
      ? 'Ο Oli θυμάται κάθε καλλιέργεια και παρέμβαση. Παρακολουθεί σαν αληθινός γεωπόνος αν η θεραπεία πέτυχε και προσαρμόζεται ανάλογα.'
      : 'Oli builds a memory of your fields and crops over time. Follows up like a real agronomist to confirm the treatment worked, and adjusts if it did not.',
    accent: false,
  },
];

// ── Role-based showcase ──────────────────────────────────────────────────────
const ROLES = (lang: string) => [
  {
    id: 'farmer',
    emoji: '🌾',
    label:    lang === 'el' ? 'Αγρότης' : 'Farmer',
    headline: lang === 'el' ? 'Απάντηση σε δευτερόλεπτα, στη γλώσσα σου' : 'Answers in seconds, in your language',
    question: lang === 'el'
      ? 'Λευκή σκόνη στα φύλλα του αμπελιού. Τι είναι και τι κάνω;'
      : 'White powder on my vine leaves. What is it and what should I do?',
    answer: lang === 'el'
      ? 'Πρόκειται για Ωίδιο (Uncinula necator) — μυκητολογική ασθένεια. Confidence: 91%.\n🌿 Οργανικό: Θείο WP 80%, 300g/100L, κάθε 7–10 μέρες\n⚗️ Χημικό: Myclobutanil 12.5% EC, 40ml/100L\nΘα σε ρωτήσω σε 3 μέρες αν βελτιώθηκε.'
      : 'This is Powdery Mildew (Oidium / Uncinula necator). Confidence: 91%.\n🌿 Organic: Sulphur WP 80%, 300g/100L every 7–10 days\n⚗️ Chemical: Myclobutanil 12.5% EC, 40ml/100L\nI\'ll follow up in 3 days to check progress.',
    tag: lang === 'el' ? 'Διάγνωση + Θεραπεία' : 'Diagnosis + Treatment',
    tagColor: 'text-amber-700 bg-amber-50 border-amber-200',
  },
  {
    id: 'agronomist',
    emoji: '🔬',
    label:    lang === 'el' ? 'Γεωπόνος' : 'Agronomist',
    headline: lang === 'el' ? 'Επιστημονικοί υπολογισμοί σε δευτερόλεπτα' : 'Scientific calculations in seconds',
    question: lang === 'el'
      ? 'Υπολόγισέ μου ETc αμπελώνα Ιούλιο. ET₀ = 6.2mm/ημέρα, Kc = 0.85 (ανθοφορία)'
      : 'Calculate vineyard ETc for July. ET₀ = 6.2mm/day, Kc = 0.85 (flowering stage)',
    answer: lang === 'el'
      ? 'ETc = ET₀ × Kc = 6.2 × 0.85 = 5.27 mm/ημέρα\nΣε ha: 5.27mm × 10 = 52.7 m³/ha/ημέρα\nΓια 5 στρέμματα (0.5 ha): 26.4 m³/ημέρα\nΓια εβδομάδα: 184.5 m³\nΜε σταγονικό (αποδοτ. 90%): 205 m³ πρόβλεψη.'
      : 'ETc = ET₀ × Kc = 6.2 × 0.85 = 5.27 mm/day\nPer ha: 5.27 × 10 = 52.7 m³/ha/day\nFor 1 ha: 52.7 m³/day, weekly: 368.9 m³\nWith drip (90% efficiency): schedule 410 m³/week.',
    tag: lang === 'el' ? 'Υπολογισμός ETc' : 'ETc Calculation',
    tagColor: 'text-blue-700 bg-blue-50 border-blue-200',
  },
  {
    id: 'association',
    emoji: '🤝',
    label:    lang === 'el' ? 'Αγροτικός Σύλλογος' : 'Farmers\' Association',
    headline: lang === 'el' ? 'Ετήσιο αρχείο παρεμβάσεων και εργασιών' : 'Annual intervention and field work report',
    question: lang === 'el'
      ? 'Δώσε μου αρχείο με όλες τις εργασίες και παρεμβάσεις στα χωράφια μου το περασμένο χρόνο'
      : 'Give me a report of all field work and treatments done across my fields over the past year',
    answer: lang === 'el'
      ? '📋 Ετήσια Έκθεση Χωραφιών 2025\n\n🫒 Ελαιώνας Βοριά (8 στρ)\n• Μαρ: Κλάδεμα + Χαλκούχο (Περονόσπορος)\n• Ιούν: Λίπανση αζώτου 12kg/στρ\n• Σεπ: Ψεκασμός ολεοκτόνο (Δάκος)\n• Αποτέλεσμα: Βελτίωση ✅\n\n🍇 Αμπελώνας (5 στρ)\n• Φεβ: Κλάδεμα χειμερινό\n• Μαϊ: Θείο Ωίδιο 3× ψεκασμοί\n• Ιούλ: Άρδευση 850m³ σύνολο'
      : '📋 Annual Field Report 2025\n\n🫒 North Olive Grove (0.8 ha)\n• Mar: Pruning + Copper spray (Downy Mildew)\n• Jun: Nitrogen top-dress 120kg/ha\n• Sep: Olicide spray (Olive fly)\n• Outcome: Improved ✅\n\n🍇 Vineyard (0.5 ha)\n• Feb: Winter pruning\n• May: Sulphur (Oidium) × 3 sprays\n• Jul: Irrigation 850m³ total',
    tag: lang === 'el' ? 'Ετήσια Αναφορά' : 'Annual Report',
    tagColor: 'text-green-700 bg-green-50 border-green-200',
  },
  {
    id: 'garden',
    emoji: '🌻',
    label:    lang === 'el' ? 'Κηπουρός / Οικιακός Κήπος' : 'Garden Center / Home Garden',
    headline: lang === 'el' ? 'Ποια φυτά πάνε μαζί στον κήπο;' : 'Which plants grow best together?',
    question: lang === 'el'
      ? 'Ποια λαχανικά φυτεύω μαζί για καλύτερη ανάπτυξη στον κήπο μου;'
      : 'Which vegetables should I plant together for better growth in my garden?',
    answer: lang === 'el'
      ? '✅ Καλές συνδυασμοί (συνοδοί καλλιέργειες):\n• Ντομάτα + Βασιλικός — απωθεί αφίδες, βελτιώνει γεύση\n• Καρότα + Κρεμμύδια — αμοιβαία προστασία από έντομα\n• Κολοκυθάκι + Καλαμπόκι + Φασόλια (Τρία Αδέρφια)\n\n❌ Αποφύγετε:\n• Ντομάτα + Μάραθο — ανταγωνισμός ριζών\n• Κρεμμύδια + Αρακάς — αναστέλλουν ανάπτυξη'
      : '✅ Good companion planting:\n• Tomato + Basil — repels aphids, improves flavour\n• Carrots + Onions — mutual insect deterrence\n• Courgette + Corn + Beans (Three Sisters)\n\n❌ Avoid together:\n• Tomato + Fennel — root competition\n• Onions + Peas — growth inhibition',
    tag: lang === 'el' ? 'Συνοδοί Καλλιέργειες' : 'Companion Planting',
    tagColor: 'text-purple-700 bg-purple-50 border-purple-200',
  },
  {
    id: 'input',
    emoji: '🏭',
    label:    lang === 'el' ? 'Εταιρεία Εισροών' : 'Input / Agri Company',
    headline: lang === 'el' ? 'Ποια προϊόντα συστήνει ο Oli για κάθε πρόβλημα;' : 'Which products does Oli recommend per problem?',
    question: lang === 'el'
      ? 'Ποια σκευάσματα για Περονόσπορο αμπελιού; Τι δόση και πότε;'
      : 'Which fungicides for Downy Mildew (Peronospora) on grapevines? Dose and timing?',
    answer: lang === 'el'
      ? 'Περονόσπορος (Plasmopara viticola) — Προστατευτικά + Θεραπευτικά:\n\n⚗️ Χαλκούχα (προληπτικά): Hydroxide χαλκού 77%, 250g/100L — εφαρμογή πριν βροχή\n⚗️ Διασυστηματικά: Metalaxyl-M 4% + Mancozeb 64% WP, 250g/100L\n⚗️ Cymoxanil 45% WG, 30g/100L (θεραπευτικά έως 4 ώρες μετά λοίμωξη)\n\nΧρόνος εφαρμογής: 5–7 φύλλα έως κλείσιμο τσαμπιού'
      : 'Downy Mildew (Plasmopara viticola) — Protectant + Curative:\n\n⚗️ Copper-based (preventive): Copper Hydroxide 77%, 250g/100L — apply before rain\n⚗️ Systemic: Metalaxyl-M 4% + Mancozeb 64% WP, 250g/100L\n⚗️ Cymoxanil 45% WG, 30g/100L (curative up to 4h post-infection)\n\nApply from 5-leaf stage through bunch closure',
    tag: lang === 'el' ? 'Σκευάσματα & Δοσολογία' : 'Products & Dosage',
    tagColor: 'text-slate-700 bg-slate-50 border-slate-200',
  },
];


const TESTIMONIALS = (lang: string) => [
  {
    quote: lang === 'el'
      ? 'Είχα στείλει φωτογραφία στον γεωπόνο μου και περίμενα 2 μέρες. Ο Oli μου έδωσε διάγνωση σε 10 δευτερόλεπτα. Ήταν ακριβώς σωστή.'
      : 'I sent a photo to my agronomist and waited 2 days. Oli gave me a diagnosis in 10 seconds. It was exactly right.',
    name: lang === 'el' ? 'Γιώργης Παπαδόπουλος' : 'Giorgis Papadopoulos',
    crop: lang === 'el' ? 'Ελαιοκαλλιεργητής, Πελοπόννησος' : 'Olive farmer, Peloponnese',
    initial: 'Γ',
  },
  {
    quote: lang === 'el'
      ? 'Τέλος στο να μαντεύω ποιο φάρμακο να χρησιμοποιήσω. Μου δίνει ακριβώς τι να αγοράσω και σε ποια δόση.'
      : 'No more guessing which product to use. It tells me exactly what to buy and at what dose.',
    name: lang === 'el' ? 'Νίκος Αθανασίου' : 'Nikos Athanassiou',
    crop: lang === 'el' ? 'Κτηματίας, Κρήτη' : 'Vineyard owner, Crete',
    initial: 'Ν',
  },
  {
    quote: lang === 'el'
      ? 'Ρώτησα πότε να κλαδέψω τα εσπεριδοειδή μου φέτος. Σε δευτερόλεπτα είχα συγκεκριμένο εβδομαδιαίο πρόγραμμα. Ο γεωπόνος μου χρεώνει 80 ευρώ την επίσκεψη για αυτό.'
      : 'I asked when to prune my citrus trees this year. In seconds I had a specific week-by-week plan. My agronomist charges €80 a visit for exactly that.',
    name: lang === 'el' ? 'Σταύρος Πετράκης' : 'Stavros Petrakis',
    crop: lang === 'el' ? 'Εσπεριδοειδή, Λακωνία' : 'Citrus farmer, Laconia',
    initial: 'Σ',
  },
  {
    quote: lang === 'el'
      ? '11 το βράδυ και βλέπω κάτι ανησυχητικό στα αμπέλια. Ρώτησα τον Oli και είχα σαφή απάντηση σε δευτερόλεπτα. Δοκίμασε να τηλεφωνήσεις τον γεωπόνο σου στις 11 το βράδυ.'
      : '11pm and something looked wrong on the vines. I asked Oli and had a clear answer in seconds. Try calling your agronomist at 11pm.',
    name: lang === 'el' ? 'Μαρία Ανδρέου' : 'Maria Andreou',
    crop: lang === 'el' ? 'Αμπελοκαλλιεργήτρια, Νεμέα' : 'Vineyard owner, Nemea',
    initial: 'Μ',
  },
];

// ── Demo data ─────────────────────────────────────────────────────────────────

const DEMO_DISEASE = (lang: string) => ({
  question: lang === 'el'
    ? 'Τα φύλλα της ντομάτας έχουν καστανούς κύκλους με κίτρινο περίγραμμα. Τι έχει;'
    : 'My tomato leaves have brown rings with a yellow border. What is wrong?',
  disease:    lang === 'el' ? 'Εναλτερίωση Ντομάτας' : 'Early Blight (Alternaria)',
  confidence: 92,
  organic:  lang === 'el'
    ? 'Χαλκούχο μυκητοκτόνο (Bordeaux mixture), 200g/100L νερό. Εφαρμογή κάθε 7 μέρες.'
    : 'Copper-based fungicide (Bordeaux mixture), 200g/100L water. Apply every 7 days.',
  chemical: lang === 'el'
    ? 'Mancozeb 80% WP, 250g/100L νερό. Εφαρμογή κάθε 10 με 14 μέρες.'
    : 'Mancozeb 80% WP, 250g/100L water. Apply every 10 to 14 days.',
  followup: lang === 'el'
    ? 'Θα σε ρωτήσω για να δω πώς πάει η θεραπεία.'
    : "I'll follow up to see how the treatment is going.",
});

const DEMO_PLANNING = (lang: string, imperial: boolean) => ({
  question: lang === 'el'
    ? 'Έχω 10 στρέμματα αγρό. Πόσες λεμονιές να φυτέψω και με τι αποστάσεις;'
    : imperial
      ? 'I have a 2.5-acre field. How many lemon trees should I plant and what spacing do I need?'
      : 'I have a 1-hectare field. How many lemon trees should I plant and what spacing do I need?',
  summary:     lang === 'el' ? '400 λεμονιές' : '400 lemon trees',
  summaryNote: lang === 'el' ? 'Συνιστώμενη φύτευση (5×5μ)' : 'Recommended planting (5m × 5m)',
  rows: lang === 'el'
    ? [
        { label: 'Εντατική (4×5μ)',      value: '500 δέντρα', note: 'Μέγιστη παραγωγή, χρειάζεται μηχανική κλάδευση' },
        { label: 'Τυπική (5×5μ) ✓',      value: '400 δέντρα', note: 'Καλός αερισμός, εύκολη πρόσβαση μηχανημάτων' },
        { label: 'Παραδοσιακή (6×6μ)',    value: '277 δέντρα', note: 'Μεγαλύτερα δέντρα, λιγότερα κόστος φυτοπροστασίας' },
      ]
    : [
        { label: 'Intensive (4m × 5m)',   value: '500 trees', note: 'Maximum yield, requires mechanical pruning' },
        { label: 'Standard (5m × 5m) ✓', value: '400 trees', note: 'Good airflow, easy machinery access' },
        { label: 'Traditional (6m × 6m)', value: '277 trees', note: 'Larger trees, lower crop protection costs' },
      ],
  followup: lang === 'el'
    ? 'Θέλεις να σου βοηθήσω με το πότισμα, τη λίπανση ή τη στήριξη για τα πρώτα χρόνια;'
    : 'Want me to help you plan irrigation, fertilisation, or staking for the first few years?',
});

// ── Example questions ─────────────────────────────────────────────────────────

const EXAMPLE_QUESTIONS = (lang: string, imperial: boolean) => [
  {
    category: lang === 'el' ? '🔬 Διάγνωση ασθενειών' : '🔬 Disease diagnosis',
    questions: lang === 'el'
      ? [
          'Λευκή σκόνη στα φύλλα του αμπελιού — είναι Ωίδιο ή Περονόσπορος;',
          'Μικρές τρύπες στον κορμό της μηλιάς μου. Τι έντομο είναι;',
          'Κίτρινα φύλλα με μαύρα σπόρια στην κάτω επιφάνεια ελιάς',
        ]
      : [
          'White powder on vine leaves — is it Powdery Mildew (Oidium) or Downy Mildew (Peronospora)?',
          'Small holes in my apple tree trunk. What insect is this?',
          'Yellow olive leaves with black spots on the underside',
        ],
  },
  {
    category: lang === 'el' ? '🧮 Επιστημονικοί υπολογισμοί' : '🧮 Scientific calculations',
    questions: lang === 'el'
      ? [
          'Υπολόγισέ μου την εξατμισοδιαπνοή (ETc) στο αμπέλι μου για τον Ιούλιο με ET₀ = 6mm/ημέρα',
          'Ποια φυτά πηγαίνουν μαζί για καλύτερο αποτέλεσμα στον λαχανόκηπό μου;',
          'Φτιάξε μου αρχείο με όλες τις παρεμβάσεις και εργασίες του περασμένου χρόνου στα χωράφια μου',
        ]
      : imperial
        ? [
            'Calculate ETc for my vineyard in July with ET₀ = 0.24 in/day — show me the formula',
            'Which plants grow best together for a productive kitchen garden?',
            'Give me a report of all treatments and work done in my fields over the past year',
          ]
        : [
            'Calculate ETc water requirements for my vineyard in July with ET₀ = 6mm/day',
            'Which plants grow best together for a productive kitchen garden?',
            'Give me a full report of all treatments and field work done in the past year',
          ],
  },
  {
    category: lang === 'el' ? '📐 Σχεδιασμός φύτευσης' : '📐 Planting planning',
    questions: lang === 'el'
      ? [
          'Πόσες λεμονιές χωράνε σε 5 στρέμματα με σωστές αποστάσεις;',
          'Ποιες καλλιέργειες να φυτέψω μετά την ντομάτα για εναλλαγή;',
          'Είναι αργά να φυτέψω καρπούζια τον Απρίλιο στην Πελοπόννησο;',
        ]
      : imperial
        ? [
            'How many lemon trees fit in a 3-acre field with proper spacing?',
            'Best crops to plant after tomatoes for rotation',
            'Is April too late to plant watermelons in southern regions?',
          ]
        : [
            'How many lemon trees fit in a 1-hectare field with proper spacing?',
            'Best crops to plant after tomatoes for rotation',
            'Is April too late to plant watermelons in southern regions?',
          ],
  },
  {
    category: lang === 'el' ? '💧 Άρδευση και θρέψη' : '💧 Irrigation and nutrition',
    questions: lang === 'el'
      ? [
          'Πόσα m³ νερό χρειάζεται το σταγονικό πότισμα σε 3 στρέμματα ελιάς τον Αύγουστο;',
          'Υπολόγισέ μου δόση αζώτου για ντομάτα στόχου παραγωγής 8 τόνων/στρέμμα',
          'Είναι συμβατά χαλκούχο μυκητοκτόνο και λίπασμα φύλλου στο ίδιο ψεκαστικό;',
        ]
      : imperial
        ? [
            'How many gallons per day for drip irrigation on a 2-acre olive grove in August?',
            'Calculate nitrogen dose for tomatoes targeting 14,000 lb/acre yield',
            'Can I mix copper fungicide and foliar fertiliser in the same sprayer tank?',
          ]
        : [
            'How many m³ of water for drip irrigation on 3,000m² of olives in August?',
            'Calculate nitrogen dose for tomatoes targeting 8 tonnes/strema yield',
            'Can I mix copper fungicide and foliar fertiliser in the same sprayer tank?',
          ],
  },
  {
    category: lang === 'el' ? '🌱 Αναστήλωση και εδαφολογία' : '🌱 Rehabilitation and soil',
    questions: lang === 'el'
      ? [
          'Εγκαταλελειμμένος ελαιώνας 5 στρεμμάτων. Από πού αρχίζω;',
          'Πώς βελτιώνω αργιλώδες έδαφος με κακή στράγγιση;',
          'Τι εδαφολογική ανάλυση να κάνω πριν φυτέψω αμπέλι;',
        ]
      : imperial
        ? [
            'I have an abandoned 5-acre olive grove. Where do I start?',
            'How do I improve clay soil with poor drainage?',
            'What soil analysis should I run before planting a new vineyard?',
          ]
        : [
            'I have an abandoned 2-hectare olive grove. Where do I start?',
            'How do I improve clay soil with poor drainage?',
            'What soil analysis should I run before planting a new vineyard?',
          ],
  },
];

// ── Rotating placeholders ─────────────────────────────────────────────────────

const ROTATING_QUESTIONS = (lang: string, imperial: boolean): string[] =>
  lang === 'el'
    ? [
        'Υπολόγισέ μου την εξατμισοδιαπνοή (ETc) για το αμπέλι μου τον Ιούλιο',
        'Λευκή σκόνη στα φύλλα — Ωίδιο ή Περονόσπορος;',
        'Ποια φυτά πηγαίνουν μαζί στον λαχανόκηπό μου;',
        'Φτιάξε μου αρχείο με τις εργασίες των χωραφιών μου πέρσι',
        'Πόσα m³ νερό χρειάζεται η ελιά τον Αύγουστο;',
        'Υπολόγισέ μου δόση αζώτου για ντομάτα 8 τόνων/στρέμμα',
      ]
    : imperial
      ? [
          'How do I set up drip irrigation for strawberries?',
          'I have 2.5 acres. How many lemon trees should I plant?',
          'What equipment do I need for an abandoned olive grove?',
          'My tomato leaves have brown rings. What is wrong?',
          'When and how should I prune grapevines for better yield?',
          'What crops should I plant after tomatoes?',
        ]
      : [
          'How do I set up drip irrigation for strawberries?',
          'I have 1 hectare. How many lemon trees should I plant?',
          'What equipment do I need for an abandoned olive grove?',
          'My tomato leaves have brown rings. What is wrong?',
          'When and how should I prune grapevines for better yield?',
          'What crops should I plant after tomatoes?',
        ];

// ── Phone Mockup (animated — cycles through 3 demo conversations) ─────────────

function PhoneMockup({ lang }: { lang: string }) {
  const demos = useMemo(() => PHONE_DEMOS(lang), [lang]);
  const [demoIdx, setDemoIdx] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setDemoIdx(i => (i + 1) % demos.length);
        setVisible(true);
      }, 400);
    }, 5000);
    return () => clearInterval(t);
  }, [demos.length]);

  const demo = demos[demoIdx];

  return (
    // aria-hidden: this is a decorative animated mockup — not real UI content
    <div aria-hidden="true" className="relative mx-auto w-[220px] sm:w-[240px]">
      {/* Phone frame — box-shadow avoids filter repaint on animation */}
      <div className="relative rounded-[36px] bg-[#111] p-[3px]" style={{ boxShadow: '0 0 0 1px rgba(255,255,255,0.08) inset, 0 32px 64px rgba(25,65,33,0.22)' }}>
        {/* Screen */}
        <div className="relative rounded-[34px] overflow-hidden bg-[#faf9f4]" style={{ height: '460px' }}>
          {/* Status bar */}
          <div className="flex items-center justify-between px-5 pt-3 pb-1 bg-white">
            <span className="text-[9px] font-semibold text-[#1b1c19]">9:41</span>
            <div className="w-16 h-4 bg-[#111] rounded-full" />
            <div className="flex gap-1 items-center">
              <div className="w-3 h-2 border border-[#1b1c19] rounded-[2px] relative">
                <div className="absolute right-[-3px] top-[3px] w-[2px] h-[6px] bg-[#1b1c19] rounded-r-sm" />
                <div className="absolute inset-[1px] right-[1px] bg-[#194121] rounded-[1px]" style={{ width: '60%' }} />
              </div>
            </div>
          </div>
          {/* Chat header */}
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[#e8e8e3] bg-white">
            <OliLogo size={18} bg="#ffffff" />
            <span className="text-xs font-bold text-[#194121]" style={{ fontFamily: "'Noto Serif', serif" }}>Oli</span>
            <span className="ml-auto flex items-center gap-1 text-[9px] text-emerald-600 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
              Online
            </span>
          </div>
          {/* Messages — fades in/out on demo change */}
          <div
            className="p-3 space-y-2.5 overflow-hidden"
            style={{ opacity: visible ? 1 : 0, transition: 'opacity 0.35s ease' }}
          >
            {/* User bubble */}
            <div className="flex justify-end">
              <div className="max-w-[80%] bg-[#194121] text-white rounded-xl rounded-tr-sm px-3 py-2 text-[10px] leading-relaxed">
                {demo.user}
              </div>
            </div>
            {/* Oli response */}
            <div className="flex gap-2 items-start">
              <div className="flex-shrink-0 w-5 h-5 rounded-full bg-[#194121]/10 flex items-center justify-center">
                <Leaf className="w-2.5 h-2.5 text-[#194121]" />
              </div>
              <div className="flex-1 space-y-1.5">
                {demo.type === 'disease' ? (
                  <>
                    <div className="bg-white rounded-xl rounded-tl-sm border border-[#e8e8e3] px-3 py-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-bold text-[#1b1c19]">{demo.disease}</span>
                        <span className="text-[9px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-full">{demo.confidence}%</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-1">
                      <div className="bg-white rounded-lg border border-[#e8e8e3] px-2 py-1.5">
                        <p className="text-[8px] font-bold text-emerald-700 mb-1">🌿 {lang === 'el' ? 'Βιολογικό' : 'Organic'}</p>
                        <p className="text-[8px] text-[#3a4035] leading-tight">{demo.organic}</p>
                      </div>
                      <div className="bg-white rounded-lg border border-[#e8e8e3] px-2 py-1.5">
                        <p className="text-[8px] font-bold text-blue-700 mb-1">🧪 {lang === 'el' ? 'Χημικό' : 'Chemical'}</p>
                        <p className="text-[8px] text-[#3a4035] leading-tight">{demo.chemical}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-1.5 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-2">
                      <Clock className="w-2.5 h-2.5 text-amber-600 flex-shrink-0 mt-0.5" />
                      <p className="text-[8px] text-amber-800 leading-tight">{demo.followup}</p>
                    </div>
                  </>
                ) : (
                  <div className="bg-white rounded-xl rounded-tl-sm border border-[#e8e8e3] px-3 py-3">
                    <p className="text-base mb-1.5 leading-none">{demo.icon}</p>
                    <p className="text-[10px] text-[#1b1c19] leading-relaxed">{demo.answer}</p>
                    <div className="flex items-center gap-1 mt-2">
                      <Check className="w-2.5 h-2.5 text-emerald-600" />
                      <span className="text-[8px] text-[#606659]">{lang === 'el' ? 'Βασισμένο σε αγρονομικά δεδομένα' : 'Based on agronomic data'}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          {/* Demo indicators — use transform:scaleX for GPU-composited animation */}
          <div className="absolute bottom-[50px] left-0 right-0 flex justify-center gap-1.5 pointer-events-none">
            {demos.map((_, i) => (
              <div
                key={i}
                style={{
                  width: '14px',
                  height: '4px',
                  borderRadius: '9999px',
                  background: '#194121',
                  opacity: i === demoIdx ? 0.7 : 0.2,
                  transform: i === demoIdx ? 'scaleX(1)' : 'scaleX(0.286)',
                  transformOrigin: 'left',
                  transition: 'transform 300ms ease, opacity 300ms ease',
                }}
              />
            ))}
          </div>
          {/* Input bar */}
          <div className="absolute bottom-3 left-3 right-3 flex items-center gap-1.5 bg-white rounded-full border border-[#deded8] px-3 py-2" style={{ boxShadow: '0 2px 8px rgba(25,65,33,0.08)' }}>
            <span className="flex-1 text-[9px] text-[#3a4035]">{lang === 'el' ? 'Ρώτα τον Oli...' : 'Ask Oli...'}</span>
            <div className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #194121 0%, #305936 100%)' }}>
              <Send className="w-2.5 h-2.5 text-white" />
            </div>
          </div>
        </div>
      </div>
      {/* Glow */}
      <div className="absolute -inset-4 -z-10 rounded-[50%] opacity-20 blur-3xl" style={{ background: 'radial-gradient(ellipse, #194121 0%, transparent 70%)' }} />
    </div>
  );
}

// ── Role Showcase component ───────────────────────────────────────────────────

function RoleShowcase({ lang, onAsk }: { lang: string; onAsk: (q: string) => void }) {
  const roles = useMemo(() => ROLES(lang), [lang]);
  const [activeId, setActiveId] = useState(roles[0].id);
  const active = roles.find(r => r.id === activeId) ?? roles[0];

  return (
    <div>
      {/* Role tabs */}
      <div className="flex flex-wrap justify-center gap-2 mb-8">
        {roles.map(r => (
          <button
            key={r.id}
            onClick={() => setActiveId(r.id)}
            className={[
              'flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition-all min-h-[44px]',
              activeId === r.id
                ? 'bg-[#194121] border-[#194121] text-white shadow-md'
                : 'bg-white border-[#e8e8e3] text-[#3a4035] hover:border-[#194121]/40 hover:text-[#194121]',
            ].join(' ')}
          >
            <span>{r.emoji}</span>
            {r.label}
          </button>
        ))}
      </div>

      {/* Active role card */}
      <div className="rounded-2xl border border-[#e8e8e3] bg-white overflow-hidden" style={{ boxShadow: '0 4px 24px rgba(25,65,33,0.08)' }}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#f0efea] bg-[#fafaf8]">
          <div className="flex items-center gap-2">
            <span className="text-xl">{active.emoji}</span>
            <span className="text-sm font-bold text-[#1b1c19]">{active.label}</span>
          </div>
          <span className={`text-xs font-semibold border rounded-full px-2.5 py-0.5 ${active.tagColor}`}>
            {active.tag}
          </span>
        </div>

        <div className="p-5 space-y-4">
          {/* Question bubble */}
          <div className="flex justify-end">
            <div className="max-w-[80%] rounded-xl rounded-tr-sm bg-[#194121] px-4 py-3 text-sm text-white leading-relaxed">
              {active.question}
            </div>
          </div>

          {/* Oli answer bubble */}
          <div className="flex gap-3 items-start">
            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-[#194121]/10 flex items-center justify-center">
              <span className="text-[#194121]" style={{ fontSize: '14px' }}>🌿</span>
            </div>
            <div className="flex-1 rounded-xl rounded-tl-sm border border-[#e8e8e3] bg-[#fafaf8] px-4 py-3">
              <p className="text-sm text-[#1b1c19] leading-relaxed whitespace-pre-line">{active.answer}</p>
            </div>
          </div>

          {/* CTA */}
          <button
            onClick={() => onAsk(active.question)}
            className="w-full text-center text-sm font-semibold text-[#194121] border-2 border-[#194121] rounded-full py-2.5 hover:bg-[#194121] hover:text-white transition-all"
          >
            {lang === 'el' ? `Δοκίμασε ως ${active.label} →` : `Try as ${active.label} →`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function Landing() {
  // App.tsx already redirects authenticated users to /chat before Landing renders,
  // so isLoggedIn is always false here. Avoids importing the 46kB supabase chunk.
  const isLoggedIn = false;
  const { lang, setLang } = useLanguage();
  const navigate = useNavigate();
  const [chatInput, setChatInput]         = useState('');
  const [demoTab, setDemoTab]             = useState<'disease' | 'planning'>('disease');
  const [suggestionIdx, setSuggestionIdx] = useState(0);
  const [suggestionVisible, setSuggestionVisible] = useState(true);
  const imperial = useMemo(() => detectImperial(), []);

  // Fix mobile overscroll background — the app is dark-themed (#0D1117) but the
  // landing page is light-themed. Without this, iOS overscroll shows the dark body.
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prevHtml = html.style.backgroundColor;
    const prevBody = body.style.backgroundColor;
    html.style.backgroundColor = '#faf9f4';
    body.style.backgroundColor = '#faf9f4';
    return () => {
      html.style.backgroundColor = prevHtml;
      body.style.backgroundColor = prevBody;
    };
  }, []);

  // Photo attachment for hero guest chat
  const [heroPhoto, setHeroPhoto] = useState<{ file: File; previewUrl: string } | null>(null);
  const heroFileInputRef = useRef<HTMLInputElement>(null);

  // Voice (speech-to-text) for hero guest chat
  const [isListening, setIsListening] = useState(false);
  const [recognitionAvailable, setRecognitionAvailable] = useState(false);
  const recognitionRef = useRef<any>(null);

  const rotatingQuestions = useMemo(() => ROTATING_QUESTIONS(lang, imperial), [lang, imperial]);
  const demoDisease       = DEMO_DISEASE(lang);
  const demoPlanning      = DEMO_PLANNING(lang, imperial);

  // Initialise speech recognition
  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = lang === 'el' ? 'el-GR' : 'en-US';
    rec.onresult = (e: any) => {
      const transcript = e.results[0]?.[0]?.transcript ?? '';
      if (transcript) setChatInput(prev => prev ? `${prev} ${transcript}` : transcript);
    };
    rec.onerror = () => setIsListening(false);
    rec.onend = () => setIsListening(false);
    recognitionRef.current = rec;
    setRecognitionAvailable(true);
  }, [lang]);

  const toggleListening = useCallback(() => {
    if (!recognitionRef.current) return;
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      recognitionRef.current.start();
      setIsListening(true);
    }
  }, [isListening]);

  // Handle photo selection for hero chat
  const handleHeroPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type) || file.size > MAX_FILE_SIZE) {
      alert(lang === 'el' ? 'Μη έγκυρο αρχείο (μέγιστο 10MB, JPEG/PNG/WEBP/HEIC)' : 'Invalid file (max 10MB, JPEG/PNG/WEBP/HEIC)');
      return;
    }
    const previewUrl = URL.createObjectURL(file);
    setHeroPhoto({ file, previewUrl });
    // Reset input so same file can be reselected
    e.target.value = '';
  };

  const removeHeroPhoto = () => {
    if (heroPhoto) URL.revokeObjectURL(heroPhoto.previewUrl);
    setHeroPhoto(null);
  };

  // Rotate suggestion every 3.5s
  useEffect(() => {
    const t = setInterval(() => {
      setSuggestionVisible(false);
      setTimeout(() => { setSuggestionIdx(i => (i + 1) % rotatingQuestions.length); setSuggestionVisible(true); }, 350);
    }, 3500);
    return () => clearInterval(t);
  }, [rotatingQuestions.length]);

  // SEO meta
  useEffect(() => {
    const setMeta = (attr: string, key: string, content: string) => {
      let el = document.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement;
      if (!el) { el = document.createElement('meta'); el.setAttribute(attr, key); document.head.appendChild(el); }
      el.setAttribute('content', content);
    };
    if (lang === 'el') {
      document.title = 'Oli — Ο AI Γεωπόνος σου | 24/7 Συμβουλές Καλλιεργειών';
      setMeta('name', 'description', 'Ο Oli είναι ο προσωπικός σου γεωπόνος. Διάγνωση ασθενειών, σχέδια θεραπείας, σχεδιασμός φύτευσης, άρδευση, αναστήλωση χωραφιών. Πάντα διαθέσιμος, πάντα μαθαίνει.');
      setMeta('property', 'og:title', 'Oli — Ο AI Γεωπόνος σου 24/7');
      setMeta('property', 'og:locale', 'el_GR');
    } else {
      document.title = 'Oli — Your AI Agronomist | Farming Advice 24/7';
      setMeta('name', 'description', 'Oli is your personal agronomist. Diagnose crop diseases, plan your fields, set up irrigation, rehabilitate old groves. Always available, always learning your crops.');
      setMeta('property', 'og:title', 'Oli — Your AI Agronomist, 24/7');
      setMeta('property', 'og:locale', 'en_US');
    }
    document.documentElement.lang = lang;
    setMeta('property', 'og:url', 'https://codex-ask-oli-app.vercel.app/');
    setMeta('property', 'og:type', 'website');
    // Language-specific OG image
    const ogImg = lang === 'el'
      ? 'https://codex-ask-oli-app.vercel.app/og-image-el.png'
      : 'https://codex-ask-oli-app.vercel.app/og-image.png';
    setMeta('property', 'og:image', ogImg);
    setMeta('name', 'twitter:image', ogImg);
  }, [lang]);

  // Build nav URL: if photo attached, we need to go to /chat directly (can't pass binary in URL)
  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = chatInput.trim();
    if (!text && !heroPhoto) return;

    // If photo is attached, encode it and navigate to chat with the text
    // The image will be stored in sessionStorage for Chat.tsx to pick up
    if (heroPhoto) {
      try {
        const reader = new FileReader();
        reader.onload = () => {
          const base64 = (reader.result as string).split(',')[1];
          sessionStorage.setItem('oli_hero_attachment', JSON.stringify({
            mimeType: heroPhoto.file.type,
            data: base64,
            previewUrl: heroPhoto.previewUrl,
          }));
          removeHeroPhoto();
          const q = text || (lang === 'el' ? 'Ανάλυσε αυτή τη φωτογραφία' : 'Analyze this photo');
          navigate(isLoggedIn ? `/chat?q=${encodeURIComponent(q)}` : `/chat?q=${encodeURIComponent(q)}`);
        };
        reader.readAsDataURL(heroPhoto.file);
      } catch {
        navigate(`/chat?q=${encodeURIComponent(text)}`);
      }
    } else {
      navigate(isLoggedIn ? '/chat' : `/chat?q=${encodeURIComponent(text)}`);
    }
  };

  const sendQuestion = (q: string) => {
    navigate(`/chat?q=${encodeURIComponent(q)}`);
  };

  return (
    <div className="min-h-screen bg-white text-[#1b1c19] overflow-x-hidden" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      {/* ── NAV ── */}
      <nav className="fixed top-0 w-full z-50 bg-white/90 backdrop-blur-xl border-b border-[#e8e8e3]">
        <div className="flex justify-between items-center max-w-5xl mx-auto px-4 sm:px-6 h-14">
          <div className="flex items-center gap-2">
            <OliLogo size={24} bg="#ffffff" />
            <span className="text-lg font-bold tracking-tight" style={{ fontFamily: "'Noto Serif', serif", color: '#194121' }}>Oli</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative group">
              <button className="text-xs font-semibold text-[#606659] hover:text-[#194121] transition-colors px-2.5 py-3 rounded-full bg-[#f0efea] flex items-center gap-1 min-h-[44px]">
                <span>{LANG_OPTIONS.find(o => o.code === lang)?.flag ?? '🌐'}</span>
                <span className="uppercase">{lang}</span>
              </button>
              <div className="absolute right-0 top-full mt-1 hidden group-hover:flex flex-col bg-white border border-[#e8e8e3] rounded-xl shadow-lg overflow-hidden z-50 min-w-[130px]">
                {LANG_OPTIONS.map(({ code, label, flag }) => (
                  <button
                    key={code}
                    onClick={() => setLang(code)}
                    className={`flex items-center gap-2 px-3 py-3 text-xs font-medium transition-colors ${lang === code ? 'bg-[#194121] text-white' : 'text-[#3a4035] hover:bg-[#f0efea]'}`}>
                    <span>{flag}</span>
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            </div>
            <Link
              to={isLoggedIn ? '/chat' : '/auth'}
              className="text-white px-5 py-2.5 rounded-full font-semibold text-sm hover:opacity-90 transition-all inline-flex items-center min-h-[44px]"
              style={{ background: 'linear-gradient(135deg, #194121 0%, #305936 100%)' }}>
              {isLoggedIn
                ? (lang === 'el' ? 'Άνοιξε' : 'Open app')
                : (lang === 'el' ? 'Δοκίμασε δωρεάν' : 'Try free')}
            </Link>
          </div>
        </div>
      </nav>

      {/* ── MAIN CONTENT ── */}
      <main>

      {/* ── HERO ── */}
      <section className="pt-20 pb-12 bg-[#faf9f4]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col lg:flex-row items-center gap-10 lg:gap-16">

            {/* Left: copy + input */}
            <div className="flex-1 text-center lg:text-left">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-[#194121]/10 px-3 py-1 text-xs font-semibold text-[#194121] mb-5">
                <span>🌿</span>
                {lang === 'el' ? 'Ο AI Γεωπόνος σου · 24/7' : 'Your AI Agronomist · 24/7'}
              </div>

              <h1
                className="text-4xl sm:text-5xl font-bold leading-[1.1] mb-5 tracking-tight"
                style={{ fontFamily: "'Noto Serif', serif", color: '#194121' }}>
                {lang === 'el' ? (
                  <>Ο γεωπόνος σου.<br />Πάντα μαζί σου.</>
                ) : (
                  <>Your personal agronomist.<br />With you 24/7.</>
                )}
              </h1>

              <p className="text-base md:text-lg text-[#5a6053] mb-8 max-w-md mx-auto lg:mx-0 leading-relaxed">
                {lang === 'el'
                  ? 'Διάγνωση ασθενειών, σχεδιασμός φύτευσης, άρδευση, αναστήλωση χωραφιών. Από σπορά μέχρι συγκομιδή, ο Oli μαθαίνει τις καλλιέργειές σου.'
                  : 'Diagnose diseases, plan your fields, set up irrigation, rehabilitate old groves. From planting to harvest, Oli learns your crops.'}
              </p>

              {/* Chat input */}
              <form onSubmit={handleChatSubmit} className="max-w-xl mx-auto lg:mx-0 mb-3">
                {/* Photo preview */}
                {heroPhoto && (
                  <div className="flex items-center gap-2 mb-2 px-1">
                    <div className="relative inline-block">
                      <img src={heroPhoto.previewUrl} alt="attachment preview" className="h-14 w-14 rounded-xl object-cover border border-[#deded8]" />
                      <button
                        type="button"
                        onClick={removeHeroPhoto}
                        className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#194121] text-white shadow"
                        aria-label={lang === 'el' ? 'Αφαίρεση φωτογραφίας' : 'Remove photo'}>
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                    <span className="text-xs text-[#606659]">{lang === 'el' ? 'Φωτογραφία επισυνάφθηκε' : 'Photo attached'}</span>
                  </div>
                )}

                <div
                  className="flex items-center gap-1 rounded-2xl bg-white border border-[#deded8] focus-within:border-[#194121] focus-within:ring-2 focus-within:ring-[#194121]/15 transition-all px-3 py-2"
                  style={{ boxShadow: '0 4px 24px rgba(25,65,33,0.09)' }}>

                  {/* Photo button */}
                  <button
                    type="button"
                    onClick={() => heroFileInputRef.current?.click()}
                    aria-label={lang === 'el' ? 'Ανέβασε φωτογραφία' : 'Upload photo'}
                    className="flex-shrink-0 flex h-11 w-11 items-center justify-center rounded-xl text-[#606659] hover:text-[#194121] hover:bg-[#194121]/8 transition-colors">
                    <Camera className="h-5 w-5" />
                  </button>

                  {/* Voice button */}
                  {recognitionAvailable && (
                    <button
                      type="button"
                      onClick={toggleListening}
                      aria-label={isListening ? (lang === 'el' ? 'Σταμάτα εγγραφή' : 'Stop recording') : (lang === 'el' ? 'Ομιλία' : 'Speak')}
                      className={`flex-shrink-0 flex h-11 w-11 items-center justify-center rounded-xl transition-colors ${isListening ? 'text-red-500 animate-pulse bg-red-500/10' : 'text-[#606659] hover:text-[#194121] hover:bg-[#194121]/8'}`}>
                      <Mic className="h-5 w-5" />
                    </button>
                  )}

                  {/* Text input */}
                  <input
                    type="text"
                    value={isListening ? (lang === 'el' ? 'Ακούω...' : 'Listening...') : chatInput}
                    onChange={e => !isListening && setChatInput(e.target.value)}
                    aria-label={lang === 'el' ? 'Ρώτα τον Oli' : 'Ask Oli anything'}
                    placeholder={lang === 'el' ? 'Ρώτα ή ανέβασε φωτογραφία...' : 'Ask or upload a photo...'}
                    className="flex-1 min-w-0 bg-transparent text-[15px] text-[#1b1c19] placeholder:text-[#9a9b93] focus:outline-none focus-visible:ring-0 py-1.5"
                    readOnly={isListening}
                  />

                  {/* Send button */}
                  <button
                    type="submit"
                    disabled={!chatInput.trim() && !heroPhoto}
                    aria-label={lang === 'el' ? 'Αποστολή' : 'Send'}
                    className="flex-shrink-0 flex h-11 w-11 items-center justify-center rounded-xl text-white transition-all disabled:opacity-30"
                    style={{ background: 'linear-gradient(135deg, #194121 0%, #305936 100%)' }}>
                    <Send className="h-4 w-4" />
                  </button>
                </div>

                {/* Hidden file input */}
                <input
                  ref={heroFileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                  capture="environment"
                  className="hidden"
                  onChange={handleHeroPhoto}
                />
              </form>

              {/* Rotating suggestion chip */}
              <div className="flex flex-col items-center lg:items-start gap-2">
                <button
                  onClick={() => sendQuestion(rotatingQuestions[suggestionIdx])}
                  style={{ opacity: suggestionVisible ? 1 : 0, transition: 'opacity 0.35s ease' }}
                  className="inline-flex items-center gap-1.5 text-xs text-[#194121] bg-[#194121]/8 hover:bg-[#194121]/15 rounded-full px-3 py-1.5 transition-colors max-w-xs sm:max-w-sm text-left"
                  aria-hidden={!suggestionVisible}>
                  <span className="flex-shrink-0 text-[#194121]/60">→</span>
                  <span className="truncate">{rotatingQuestions[suggestionIdx]}</span>
                </button>
                <p className="text-xs text-[#606659]">
                  {lang === 'el' ? 'Χωρίς εγγραφή · Η πρώτη ερώτηση είναι δωρεάν' : 'No sign-up required · First question is free'}
                </p>
              </div>
            </div>

            {/* Right: animated phone mockup */}
            <div className="flex-shrink-0 flex justify-center lg:justify-end">
              <PhoneMockup lang={lang} />
            </div>
          </div>
        </div>
      </section>

      {/* ── STATS BAR ── */}
      <section className="py-8 bg-white border-y border-[#f0efea]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            {STATS(lang).map((s, i) => (
              <div key={i} className="flex flex-col items-center">
                <div className="text-2xl sm:text-3xl font-bold text-[#194121] mb-0.5" style={{ fontFamily: "'Noto Serif', serif" }}>
                  {s.n}
                </div>
                <p className="text-xs text-[#606659] leading-snug max-w-[120px]">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── DEMO WIDGET ── */}
      <section className="py-16 bg-[#faf9f4]">
        <div className="max-w-2xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-8">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#4a6b50] mb-2">
              {lang === 'el' ? 'Ο Oli σε δράση' : 'Oli in action'}
            </p>
            <p className="text-sm text-[#606659]">
              {lang === 'el'
                ? 'Ασθένειες, κλάδεμα, λίπανση, σχεδιασμός φύτευσης και πολλά άλλα'
                : 'Diseases, pruning, irrigation, planting plans and much more'}
            </p>
          </div>

          <div className="rounded-2xl border border-[#e8e8e3] bg-white overflow-hidden" style={{ boxShadow: '0 8px 40px rgba(25,65,33,0.07)' }}>
            {/* Chat header with tabs */}
            <div className="flex items-center gap-3 px-4 sm:px-5 py-3.5 border-b border-[#e8e8e3] bg-white">
              <div className="flex items-center gap-2">
                <OliLogo size={20} bg="#ffffff" />
                <span className="text-sm font-semibold text-[#194121]" style={{ fontFamily: "'Noto Serif', serif" }}>Oli</span>
              </div>
              <div className="ml-auto flex items-center gap-1 bg-[#f0efea] rounded-full p-0.5">
                <button
                  onClick={() => setDemoTab('disease')}
                  className={`text-xs font-semibold px-2.5 sm:px-3 py-2.5 min-h-[44px] rounded-full transition-all flex items-center ${demoTab === 'disease' ? 'bg-white text-[#194121] shadow-sm' : 'text-[#606659] hover:text-[#194121]'}`}>
                  {lang === 'el' ? '🔬 Διάγνωση' : '🔬 Diagnosis'}
                </button>
                <button
                  onClick={() => setDemoTab('planning')}
                  className={`text-xs font-semibold px-2.5 sm:px-3 py-2.5 min-h-[44px] rounded-full transition-all flex items-center ${demoTab === 'planning' ? 'bg-white text-[#194121] shadow-sm' : 'text-[#606659] hover:text-[#194121]'}`}>
                  {lang === 'el' ? '📐 Σχεδιασμός' : '📐 Planning'}
                </button>
              </div>
            </div>

            <div className="p-4 sm:p-5 space-y-4 bg-[#faf9f4]">
              {demoTab === 'disease' ? (
                <>
                  <div className="flex justify-end">
                    <div className="max-w-[85%] bg-[#194121] text-white rounded-2xl rounded-tr-sm px-4 py-3 text-sm leading-relaxed">
                      {demoDisease.question}
                    </div>
                  </div>
                  <div className="flex gap-3 items-start">
                    <div className="flex-shrink-0 w-7 h-7 rounded-full bg-[#194121]/10 flex items-center justify-center">
                      <Leaf className="w-3.5 h-3.5 text-[#194121]" />
                    </div>
                    <div className="flex-1 space-y-3">
                      <div className="bg-white rounded-xl rounded-tl-sm border border-[#e8e8e3] px-4 py-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold text-[#1b1c19]" style={{ fontFamily: "'Noto Serif', serif" }}>{demoDisease.disease}</span>
                          <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">{demoDisease.confidence}% {lang === 'el' ? 'βεβαιότητα' : 'confidence'}</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div className="bg-white rounded-xl border border-[#e8e8e3] px-4 py-3">
                          <p className="text-xs font-bold uppercase tracking-wider text-emerald-700 mb-1.5">{lang === 'el' ? '🌿 Βιολογικό' : '🌿 Organic'}</p>
                          <p className="text-xs text-[#3a4035] leading-relaxed">{demoDisease.organic}</p>
                        </div>
                        <div className="bg-white rounded-xl border border-[#e8e8e3] px-4 py-3">
                          <p className="text-xs font-bold uppercase tracking-wider text-blue-700 mb-1.5">{lang === 'el' ? '🧪 Χημικό' : '🧪 Chemical'}</p>
                          <p className="text-xs text-[#3a4035] leading-relaxed">{demoDisease.chemical}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
                        <Clock className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-amber-800">{demoDisease.followup}</p>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex justify-end">
                    <div className="max-w-[85%] bg-[#194121] text-white rounded-2xl rounded-tr-sm px-4 py-3 text-sm leading-relaxed">
                      {demoPlanning.question}
                    </div>
                  </div>
                  <div className="flex gap-3 items-start">
                    <div className="flex-shrink-0 w-7 h-7 rounded-full bg-[#194121]/10 flex items-center justify-center">
                      <Leaf className="w-3.5 h-3.5 text-[#194121]" />
                    </div>
                    <div className="flex-1 space-y-3">
                      <div className="bg-white rounded-xl rounded-tl-sm border border-[#e8e8e3] px-4 py-3 flex items-center gap-4">
                        <div>
                          <div className="text-2xl font-bold text-[#194121]" style={{ fontFamily: "'Noto Serif', serif" }}>{demoPlanning.summary}</div>
                          <div className="text-xs text-[#606659]">{demoPlanning.summaryNote}</div>
                        </div>
                        <div className="ml-auto text-2xl">🌳</div>
                      </div>
                      <div className="space-y-2">
                        {demoPlanning.rows.map((row, i) => (
                          <div key={i} className={`bg-white rounded-xl border px-4 py-2.5 ${row.label.includes('✓') ? 'border-[#194121]/30' : 'border-[#e8e8e3]'}`}>
                            <div className="flex items-center justify-between mb-0.5">
                              <span className={`text-xs font-semibold ${row.label.includes('✓') ? 'text-[#194121]' : 'text-[#3a4035]'}`}>{row.label}</span>
                              <span className={`text-xs font-bold ${row.label.includes('✓') ? 'text-[#194121]' : 'text-[#606659]'}`}>{row.value}</span>
                            </div>
                            <p className="text-xs text-[#606659] leading-tight">{row.note}</p>
                          </div>
                        ))}
                      </div>
                      <div className="flex items-start gap-2 bg-[#f0fdf4] border border-emerald-100 rounded-xl px-4 py-3">
                        <span className="text-sm flex-shrink-0">💬</span>
                        <p className="text-xs text-emerald-800">{demoPlanning.followup}</p>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="py-16 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#4a6b50] mb-2">
              {lang === 'el' ? 'Πώς λειτουργεί' : 'How it works'}
            </p>
            <h2 className="text-2xl font-bold text-[#1b1c19]" style={{ fontFamily: "'Noto Serif', serif" }}>
              {lang === 'el' ? 'Τρία απλά βήματα' : 'Three simple steps'}
            </h2>
          </div>
          {/* Staggered alternating layout — avoids the symmetric 3-column grid */}
          <div className="flex flex-col gap-0">
            {HOW_IT_WORKS(lang).map((step, i) => {
              const Icon = step.icon;
              const isRight = i % 2 === 1; // steps 2 flips to right-icon
              return (
                <div key={i} className="relative">
                  {/* Vertical connector line between steps */}
                  {i < HOW_IT_WORKS(lang).length - 1 && (
                    <div className="absolute left-1/2 -translate-x-1/2 top-[72px] bottom-0 w-px bg-[#e8e8e3] pointer-events-none sm:hidden" />
                  )}
                  <div className={`flex items-start gap-6 sm:gap-10 py-8 ${isRight ? 'sm:flex-row-reverse' : 'sm:flex-row'} flex-row`}>
                    {/* Icon block */}
                    <div className="flex-shrink-0 flex flex-col items-center">
                      <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center bg-white border-2 border-[#e8e8e3] relative"
                        style={{ boxShadow: '0 4px 16px rgba(25,65,33,0.08)' }}>
                        <Icon className="w-6 h-6 text-[#194121]" />
                        <span aria-hidden="true" className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-[#194121] text-white text-[10px] font-bold flex items-center justify-center">
                          {step.step}
                        </span>
                      </div>
                      {/* Mobile vertical connector */}
                      {i < HOW_IT_WORKS(lang).length - 1 && (
                        <div className="sm:hidden w-px flex-1 min-h-[2rem] bg-[#e8e8e3] mt-3" />
                      )}
                    </div>
                    {/* Text block */}
                    <div className={`flex-1 pt-2 sm:pt-3 ${isRight ? 'sm:text-right' : ''}`}>
                      <h3 className="font-bold text-[#1b1c19] mb-2 text-[17px]" style={{ fontFamily: "'Noto Serif', serif" }}>{step.title}</h3>
                      <p className="text-sm text-[#5a6053] leading-relaxed">{step.body}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── ROLE SHOWCASE ── */}
      <section className="py-16 bg-[#faf9f4]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#4a6b50] mb-2">
              {lang === 'el' ? 'Για κάθε ρόλο στη γεωργία' : 'For every role in agriculture'}
            </p>
            <h2 className="text-2xl font-bold text-[#1b1c19] mb-1" style={{ fontFamily: "'Noto Serif', serif" }}>
              {lang === 'el' ? 'Ο Oli απαντάει διαφορετικά σε κάθε χρήστη' : 'Oli tailors every answer to who is asking'}
            </h2>
            <p className="text-sm text-[#606659]">
              {lang === 'el' ? 'Κάνε κλικ σε ρόλο για να δεις πραγματικές ερωτήσεις και απαντήσεις' : 'Select a role to see real questions and answers'}
            </p>
          </div>
          <RoleShowcase lang={lang} onAsk={sendQuestion} />
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section className="py-16 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <h2 className="sr-only">{lang === 'el' ? 'Χαρακτηριστικά' : 'Features'}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {FEATURES(lang).map((f, i) => (
              <div
                key={i}
                className={`rounded-2xl p-6 ${f.accent ? 'bg-[#194121] text-white' : 'bg-[#faf9f4]'}`}
                style={{ boxShadow: f.accent ? '0 8px 32px rgba(25,65,33,0.2)' : '0 2px 12px rgba(27,28,25,0.04)' }}>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${f.accent ? 'bg-white/15' : 'bg-[#c0eec0]/30'}`}>
                  <f.icon className={f.accent ? 'text-white' : 'text-[#194121]'} style={{ width: 22, height: 22 }} />
                </div>
                <h3 className={`font-bold mb-1.5 text-[17px] ${f.accent ? 'text-white' : 'text-[#1b1c19]'}`} style={{ fontFamily: "'Noto Serif', serif" }}>{f.title}</h3>
                <p className={`text-sm leading-relaxed ${f.accent ? 'text-white/80' : 'text-[#5a6053]'}`}>{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS — dark section to break uniform rhythm ── */}
      <section className="py-16 bg-[#0f2418]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <p className="text-center text-xs font-semibold uppercase tracking-widest text-[#6dbf7e] mb-10">
            {lang === 'el' ? 'Τι λένε οι αγρότες' : 'What farmers say'}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {TESTIMONIALS(lang).map((t, i) => (
              <div key={i} className="rounded-2xl border border-white/10 p-6 bg-white/5">
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, j) => (
                    <svg key={j} className="w-4 h-4 text-amber-400 fill-current" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
                <p className="text-sm text-white/80 leading-relaxed mb-5 italic">&ldquo;{t.quote}&rdquo;</p>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold text-white/70">
                    {t.initial}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-white/90">{t.name}</p>
                    <p className="text-xs text-white/50">{t.crop}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section className="py-16 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#4a6b50] mb-2">
              {lang === 'el' ? 'Τιμολόγηση' : 'Pricing'}
            </p>
            <h2 className="text-2xl font-bold text-[#1b1c19] mb-1" style={{ fontFamily: "'Noto Serif', serif" }}>
              {lang === 'el' ? 'Ξεκίνα δωρεάν' : 'Start for free'}
            </h2>
            <p className="text-sm text-[#606659]">
              {lang === 'el' ? 'Αναβάθμισε όταν χρειαστείς περισσότερα' : 'Upgrade when you need more'}
            </p>
          </div>

          {/* Row 1: Free + Pro (individual users) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-5">
            {/* Free */}
            <div className="rounded-2xl border border-[#e8e8e3] bg-white p-6" style={{ boxShadow: '0 2px 12px rgba(27,28,25,0.04)' }}>
              <p className="text-xs font-bold uppercase tracking-wider text-[#606659] mb-1">{lang === 'el' ? 'Δωρεάν' : 'Free'}</p>
              <div className="flex items-baseline gap-1 mb-1">
                <span className="text-3xl font-bold text-[#1b1c19]" style={{ fontFamily: "'Noto Serif', serif" }}>€0</span>
                <span className="text-sm text-[#606659]">{lang === 'el' ? '/ μήνα' : '/ month'}</span>
              </div>
              <p className="text-xs text-[#606659] mb-5">{lang === 'el' ? 'Χωρίς πιστωτική κάρτα' : 'No credit card required'}</p>
              <ul className="space-y-2.5 mb-6">
                {(lang === 'el'
                  ? ['20 ερωτήσεις / μήνα', 'Διάγνωση ασθενειών από φωτογραφία', 'Πλάνο θεραπείας με δόσεις', 'Ιστορικό συνομιλιών']
                  : ['20 questions / month', 'Crop disease diagnosis from photo', 'Treatment plan with dosages', 'Conversation history']
                ).map((item, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-[#3a4035]">
                    <Check className="w-4 h-4 text-[#194121] flex-shrink-0" />{item}
                  </li>
                ))}
              </ul>
              <Link to="/auth" className="block w-full text-center py-3 rounded-full text-sm font-semibold text-[#194121] border-2 border-[#194121] hover:bg-[#194121] hover:text-white transition-all">
                {lang === 'el' ? 'Ξεκίνα δωρεάν' : 'Get started free'}
              </Link>
            </div>

            {/* Pro */}
            <div className="rounded-2xl p-6 relative overflow-hidden text-white"
              style={{ background: 'linear-gradient(135deg, #194121 0%, #2d5535 100%)', boxShadow: '0 8px 32px rgba(25,65,33,0.25)' }}>
              <p className="text-xs font-bold uppercase tracking-wider text-white/60 mb-1">Pro</p>
              <div className="flex items-baseline gap-1 mb-1">
                <span className="text-3xl font-bold" style={{ fontFamily: "'Noto Serif', serif" }}>€4,99</span>
                <span className="text-sm text-white/70">{lang === 'el' ? '/ μήνα' : '/ month'}</span>
              </div>
              <p className="text-xs text-white/50 mb-5">{lang === 'el' ? 'ή €49 / χρόνο — εξοικονομείς 18%' : 'or €49 / year — save 18%'}</p>
              <ul className="space-y-2.5 mb-6">
                {(lang === 'el'
                  ? ['Απεριόριστες ερωτήσεις', 'Απεριόριστα χωράφια + μνήμη καλλιεργειών', 'Ο Oli κάνει follow-up στις θεραπείες', 'Υπολογισμοί άρδευσης και φύτευσης', 'Αρχείο παρεμβάσεων ανά χωράφι', 'Μηνιαίες αναφορές χωραφιών']
                  : ['Unlimited questions', 'Unlimited fields + crop memory', 'Oli follows up on every treatment', 'Irrigation & planting calculations', 'Field intervention log', 'Monthly field reports']
                ).map((item, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-white/90">
                    <Check className="w-4 h-4 text-white/70 flex-shrink-0" />{item}
                  </li>
                ))}
              </ul>
              <Link to="/auth" className="block w-full text-center py-3 rounded-full text-sm font-semibold bg-white text-[#194121] hover:bg-[#c0eec0] transition-all">
                {lang === 'el' ? 'Δοκίμασε Pro' : 'Try Pro'}
              </Link>
            </div>
          </div>

          {/* Row 2: Agronomist + Enterprise */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* Agronomist */}
            <div className="rounded-2xl border border-[#b8cfc0] bg-[#f4f8f4] p-6" style={{ boxShadow: '0 2px 12px rgba(27,28,25,0.04)' }}>
              <div className="flex items-start justify-between mb-1">
                <p className="text-xs font-bold uppercase tracking-wider text-[#4a6b50]">{lang === 'el' ? 'Γεωπόνος' : 'Agronomist'}</p>
                <span className="text-[10px] font-semibold bg-[#194121] text-white px-2 py-0.5 rounded-full">
                  {lang === 'el' ? 'Για επαγγελματίες' : 'For professionals'}
                </span>
              </div>
              <div className="flex items-baseline gap-1 mb-1">
                <span className="text-3xl font-bold text-[#1b1c19]" style={{ fontFamily: "'Noto Serif', serif" }}>€49</span>
                <span className="text-sm text-[#606659]">{lang === 'el' ? '/ μήνα' : '/ month'}</span>
              </div>
              <p className="text-xs text-[#606659] mb-1">{lang === 'el' ? 'ή €490 / χρόνο — εξοικονομείς 17%' : 'or €490 / year — save 17%'}</p>
              <p className="text-xs text-[#4a6b50] font-medium mb-5 italic">
                {lang === 'el' ? 'Λιγότερο από μία επίσκεψη γεωπόνου τον μήνα.' : 'Less than one agronomist visit per month.'}
              </p>
              <ul className="space-y-2.5 mb-6">
                {(lang === 'el'
                  ? ['Απεριόριστες ερωτήσεις', 'Απεριόριστα χωράφια & παραγωγοί', 'Πρόσβαση από κάθε συσκευή', 'Ιστορικό παρεμβάσεων ανά πελάτη', 'Επιστημονικοί υπολογισμοί (ETc, NPK)', 'Απεριόριστες επώνυμες PDF αναφορές']
                  : ['Unlimited questions', 'Unlimited fields & growers', 'Multi-device access', 'Intervention history per client', 'Scientific calculations (ETc, NPK)', 'Unlimited branded PDF reports']
                ).map((item, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-[#3a4035]">
                    <Check className="w-4 h-4 text-[#194121] flex-shrink-0" />{item}
                  </li>
                ))}
              </ul>
              <Link to="/auth" className="block w-full text-center py-3 rounded-full text-sm font-semibold text-[#194121] border-2 border-[#194121] hover:bg-[#194121] hover:text-white transition-all">
                {lang === 'el' ? 'Ξεκίνα Agronomist' : 'Start with Agronomist'}
              </Link>
            </div>

            {/* Enterprise */}
            <div className="rounded-2xl border-2 border-dashed border-[#c8d4ca] bg-white p-6 flex flex-col">
              <div className="flex items-start justify-between mb-1">
                <p className="text-xs font-bold uppercase tracking-wider text-[#606659]">Enterprise</p>
                <span className="text-[10px] font-semibold bg-slate-700 text-white px-2 py-0.5 rounded-full">
                  {lang === 'el' ? 'Προσαρμοσμένο' : 'Custom'}
                </span>
              </div>
              <p className="text-2xl font-bold text-[#1b1c19] mb-1" style={{ fontFamily: "'Noto Serif', serif" }}>
                {lang === 'el' ? 'Κατόπιν επικοινωνίας' : 'Contact us'}
              </p>
              <p className="text-xs text-[#606659] mb-5">
                {lang === 'el' ? 'Για συλλόγους, συνεταιρισμούς & εταιρείες αγροεφοδίων' : 'For cooperatives, associations & agri-input companies'}
              </p>
              <ul className="space-y-2.5 mb-6 flex-1">
                {(lang === 'el'
                  ? ['Απεριόριστα χωράφια & παραγωγοί', 'Απεριόριστες αναφορές & αναλύσεις', 'Πολλαπλοί χρήστες, multi-device', 'White-label ή co-branded αναφορές', 'Προτεραιότητα υποστήριξης', 'Προσαρμοσμένες ενσωματώσεις κατόπιν αιτήματος']
                  : ['Unlimited fields & growers', 'Unlimited reports & analytics', 'Multiple users, multi-device', 'White-label or co-branded reports', 'Priority support', 'Custom integrations on request']
                ).map((item, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-[#3a4035]">
                    <Check className="w-4 h-4 text-slate-500 flex-shrink-0" />{item}
                  </li>
                ))}
              </ul>
              <a
                href="mailto:hello@ask-oli.com?subject=Oli%20Enterprise%20pricing"
                className="block w-full text-center py-3 rounded-full text-sm font-semibold text-slate-700 border-2 border-slate-300 hover:border-slate-500 hover:bg-slate-50 transition-all">
                {lang === 'el' ? 'Επικοινωνήστε μαζί μας' : 'Get in touch'}
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="py-16 px-4 sm:px-6 bg-[#faf9f4]">
        <div
          className="max-w-2xl mx-auto rounded-[2rem] p-10 sm:p-16 text-center text-white relative overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #194121 0%, #2d5535 100%)', boxShadow: '0 24px 64px rgba(25,65,33,0.25)' }}>
          <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full bg-white/5 pointer-events-none" />
          <div className="absolute -bottom-10 -left-10 w-40 h-40 rounded-full bg-white/5 pointer-events-none" />
          <h2 className="text-2xl sm:text-3xl font-bold mb-3 relative" style={{ fontFamily: "'Noto Serif', serif" }}>
            {lang === 'el' ? 'Σταμάτα να μαντεύεις.' : 'Stop guessing.'}
          </h2>
          <p className="text-sm opacity-80 mb-8 max-w-sm mx-auto relative">
            {lang === 'el'
              ? 'Ο Oli είναι δωρεάν για να ξεκινήσεις. Χωρίς εγγραφή, χωρίς πιστωτική κάρτα.'
              : 'Oli is free to start. No sign-up required, no credit card.'}
          </p>
          <Link
            to="/chat"
            className="inline-flex items-center gap-2 bg-white text-[#194121] font-semibold px-8 py-3.5 rounded-full text-sm hover:bg-[#c0eec0] transition-all relative"
            style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.15)' }}>
            {lang === 'el' ? 'Δοκίμασε τον Oli τώρα' : 'Try Oli now'}
          </Link>
          <p className="text-xs text-white/40 mt-4 relative">
            {lang === 'el' ? 'Δωρεάν · Χωρίς πιστωτική κάρτα · Πάντα διαθέσιμος' : 'Free to start · No credit card · Available 24/7'}
          </p>
        </div>
      </section>

      </main>

      {/* ── FOOTER ── */}
      <footer className="bg-white border-t border-[#e8e8e3] py-8">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <OliLogo size={16} bg="#ffffff" />
            <span className="text-sm font-bold text-[#194121]" style={{ fontFamily: "'Noto Serif', serif" }}>Oli</span>
            <span className="text-xs text-[#606659]">&copy; 2026</span>
          </div>
          <div className="flex gap-5 text-sm text-[#606659]">
            <Link to="/legal/privacy" className="hover:text-[#194121] transition-colors py-3 inline-flex items-center min-h-[44px]">
              {lang === 'el' ? 'Απόρρητο' : 'Privacy'}
            </Link>
            <Link to="/legal/terms" className="hover:text-[#194121] transition-colors py-3 inline-flex items-center min-h-[44px]">
              {lang === 'el' ? 'Όροι' : 'Terms'}
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
