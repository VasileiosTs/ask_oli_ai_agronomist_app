import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Send, Clock, Leaf, Check, MessageCircle, Zap, RefreshCw } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../lib/LanguageContext';
import OliLogo from '../components/OliLogo';

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
  { n: '450+', label: lang === 'el' ? 'Αναγνωρίσιμες ασθένειες' : 'Identifiable diseases' },
  { n: '€0',   label: lang === 'el' ? 'Για να ξεκινήσεις, χωρίς κάρτα' : 'To start, no card needed' },
  { n: '24/7', label: lang === 'el' ? 'Γεωπόνος στην τσέπη σου' : 'Agronomist in your pocket' },
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

const FEATURES = (lang: string) => [
  {
    icon: 'photo_camera',
    title: lang === 'el' ? 'Ρώτα οτιδήποτε για τις καλλιέργειές σου' : 'Ask anything about your crops',
    body: lang === 'el'
      ? 'Ασθένειες, πότισμα, λίπανση, κλάδεμα, σπορά. Αν το ξέρει ένας έμπειρος γεωπόνος, το ξέρει και ο Oli. Δεν είναι απλώς εφαρμογή αναγνώρισης. Είναι ο σύμβουλός σου.'
      : 'Diseases, irrigation, fertilisation, pruning, planting schedules. If an experienced agronomist knows it, Oli knows it. Not just an ID app. Your complete farming advisor.',
    accent: true,
  },
  {
    icon: 'language',
    title: lang === 'el' ? 'Μιλά τη γλώσσα σου' : 'Works in your language',
    body: lang === 'el'
      ? 'Ελληνικά, Αγγλικά και περισσότερες γλώσσες σύντομα. Ιδανικός για αγρότες σε όλη την Ευρώπη και μεταναστευτικές κοινότητες. Επιλέξτε γλώσσα από το προφίλ σας.'
      : 'Greek, English and more languages coming. Built for farmers across Europe and immigrant farming communities. Set your preferred language from your profile.',
    accent: false,
  },
  {
    icon: 'assignment_turned_in',
    title: lang === 'el' ? 'Μαθαίνει τα χωράφια σου, παρακολουθεί' : 'Learns your fields, follows up',
    body: lang === 'el'
      ? 'Ο Oli θυμάται κάθε καλλιέργεια και παρέμβαση. Παρακολουθεί σαν αληθινός γεωπόνος αν η θεραπεία πέτυχε και προσαρμόζεται ανάλογα.'
      : 'Oli builds a memory of your fields and crops over time. Follows up like a real agronomist to confirm the treatment worked, and adjusts if it did not.',
    accent: false,
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
    category: lang === 'el' ? '🔬 Διάγνωση' : '🔬 Diagnosis',
    questions: lang === 'el'
      ? [
          'Λευκή σκόνη στα φύλλα του αμπελιού. Τι είναι;',
          'Μικρές τρύπες στον κορμό της μηλιάς μου',
          'Τα φύλλα της πιπεριάς μου τυλίγονται προς τα μέσα',
        ]
      : [
          'White powder on my vine leaves. Is it mildew?',
          'Small holes appearing in my apple tree trunk',
          'My pepper leaves are curling inward',
        ],
  },
  {
    category: lang === 'el' ? '📐 Σχεδιασμός φύτευσης' : '📐 Planting planning',
    questions: lang === 'el'
      ? [
          'Πόσες λεμονιές χωράνε σε 5 στρέμματα με σωστές αποστάσεις;',
          'Ποιες καλλιέργειες να φυτέψω μετά την ντομάτα;',
          'Είναι αργά να φυτέψω καρπούζια τον Απρίλιο;',
        ]
      : imperial
        ? [
            'How many lemon trees fit in a 3-acre field with proper spacing?',
            'Best crops to plant after tomatoes for rotation',
            'Is April too late to plant watermelons?',
          ]
        : [
            'How many lemon trees fit in a 1-hectare field with proper spacing?',
            'Best crops to plant after tomatoes for rotation',
            'Is April too late to plant watermelons?',
          ],
  },
  {
    category: lang === 'el' ? '💧 Άρδευση και εξοπλισμός' : '💧 Irrigation and equipment',
    questions: lang === 'el'
      ? [
          'Πώς στήνω σταγονικό πότισμα για φράουλες σε 2 στρέμματα;',
          'Πόσα λίτρα νερό χρειάζονται οι ελιές τον Αύγουστο;',
          'Τι εξοπλισμό χρειάζομαι για να αρχίσω από μηδέν;',
        ]
      : imperial
        ? [
            'How do I set up drip irrigation for strawberries on half an acre?',
            'How many gallons per day do olive trees need in August?',
            'What basic equipment do I need to start from scratch?',
          ]
        : [
            'How do I set up drip irrigation for strawberries on 2,000 sq m?',
            'How many litres per day do olive trees need in August?',
            'What basic equipment do I need to start from scratch?',
          ],
  },
  {
    category: lang === 'el' ? '🌱 Αναστήλωση χωραφιών' : '🌱 Field rehabilitation',
    questions: lang === 'el'
      ? [
          'Εγκαταλελειμμένος ελαιώνας 5 στρεμμάτων. Από πού αρχίζω;',
          'Τι εξοπλισμό και λιπάσματα χρειάζομαι για παλιό αμπελώνα;',
          'Πώς ετοιμάζω βραχώδες έδαφος για πρώτη φύτευση;',
        ]
      : imperial
        ? [
            'I have an abandoned 5-acre olive grove. Where do I start?',
            'What equipment and fertilisers do I need to rehabilitate a neglected vineyard?',
            'How do I prepare rocky terrain for first-time planting?',
          ]
        : [
            'I have an abandoned 2-hectare olive grove. Where do I start?',
            'What equipment and fertilisers do I need to rehabilitate a neglected vineyard?',
            'How do I prepare rocky terrain for first-time planting?',
          ],
  },
];

// ── Rotating placeholders ─────────────────────────────────────────────────────

const ROTATING_QUESTIONS = (lang: string, imperial: boolean): string[] =>
  lang === 'el'
    ? [
        'Πώς στήνω σταγονικό πότισμα για φράουλες;',
        'Έχω 10 στρέμματα. Πόσες λεμονιές να φυτέψω;',
        'Τι εξοπλισμό χρειάζομαι για εγκαταλελειμμένο ελαιώνα;',
        'Τα φύλλα της ντομάτας έχουν καστανούς κύκλους. Τι έχει;',
        'Πότε και πώς κλαδεύω αμπέλι για καλύτερη παραγωγή;',
        'Ποιες καλλιέργειες να φυτέψω μετά την ντομάτα;',
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
    <div aria-hidden="true" className="relative mx-auto w-[220px] sm:w-[240px]" style={{ filter: 'drop-shadow(0 32px 64px rgba(25,65,33,0.22))' }}>
      {/* Phone frame */}
      <div className="relative rounded-[36px] bg-[#111] p-[3px]" style={{ boxShadow: '0 0 0 1px rgba(255,255,255,0.08) inset' }}>
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
          {/* Demo indicators */}
          <div className="absolute bottom-[50px] left-0 right-0 flex justify-center gap-1.5 pointer-events-none">
            {demos.map((_, i) => (
              <div
                key={i}
                className="rounded-full transition-all duration-300"
                style={{
                  width: i === demoIdx ? '14px' : '4px',
                  height: '4px',
                  background: '#194121',
                  opacity: i === demoIdx ? 0.7 : 0.2,
                }}
              />
            ))}
          </div>
          {/* Input bar */}
          <div className="absolute bottom-3 left-3 right-3 flex items-center gap-1.5 bg-white rounded-full border border-[#deded8] px-3 py-2" style={{ boxShadow: '0 2px 8px rgba(25,65,33,0.08)' }}>
            <span className="flex-1 text-[9px] text-[#606659]">{lang === 'el' ? 'Ρώτα τον Oli...' : 'Ask Oli...'}</span>
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

// ── Component ─────────────────────────────────────────────────────────────────

export default function Landing() {
  const { user, profile } = useAuth();
  const isLoggedIn = !!(user && profile);
  const { lang, setLang } = useLanguage();
  const navigate = useNavigate();
  const [chatInput, setChatInput]         = useState('');
  const [demoTab, setDemoTab]             = useState<'disease' | 'planning'>('disease');
  const [suggestionIdx, setSuggestionIdx] = useState(0);
  const [suggestionVisible, setSuggestionVisible] = useState(true);
  const imperial = useMemo(() => detectImperial(), []);

  const rotatingQuestions = useMemo(() => ROTATING_QUESTIONS(lang, imperial), [lang, imperial]);
  const exampleQuestions  = useMemo(() => EXAMPLE_QUESTIONS(lang, imperial), [lang, imperial]);
  const demoDisease       = DEMO_DISEASE(lang);
  const demoPlanning      = DEMO_PLANNING(lang, imperial);

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
  }, [lang]);

  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = chatInput.trim();
    if (!text) return;
    navigate(isLoggedIn ? '/chat' : `/chat?q=${encodeURIComponent(text)}`);
  };

  const sendQuestion = (q: string) => {
    navigate(`/chat?q=${encodeURIComponent(q)}`);
  };

  return (
    <div className="min-h-screen bg-white text-[#1b1c19] overflow-x-hidden" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      {/* Load only the material symbols we actually use */}
      <link rel="preload" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&text=photo_camera%2Blanguage%2Bassignment_turned_in&display=swap" as="style" onLoad={(e) => { (e.target as HTMLLinkElement).rel = 'stylesheet'; }} />
      <noscript><link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&text=photo_camera%2Blanguage%2Bassignment_turned_in&display=swap" rel="stylesheet" /></noscript>

      {/* ── NAV ── */}
      <nav className="fixed top-0 w-full z-50 bg-white/90 backdrop-blur-xl border-b border-[#e8e8e3]">
        <div className="flex justify-between items-center max-w-5xl mx-auto px-4 sm:px-6 h-14">
          <div className="flex items-center gap-2">
            <OliLogo size={24} bg="#ffffff" />
            <span className="text-lg font-bold tracking-tight" style={{ fontFamily: "'Noto Serif', serif", color: '#194121' }}>Oli</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setLang(lang === 'el' ? 'en' : 'el')}
              className="text-xs font-semibold text-[#606659] hover:text-[#194121] transition-colors px-2.5 py-1.5 rounded-full bg-[#f0efea]">
              {lang === 'el' ? 'EN' : 'EL'}
            </button>
            <Link
              to={isLoggedIn ? '/chat' : '/auth'}
              className="text-white px-4 py-2 rounded-full font-semibold text-sm hover:opacity-90 transition-all"
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
              <form onSubmit={handleChatSubmit} className="relative max-w-xl mx-auto lg:mx-0 mb-3">
                <input
                  type="text"
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  aria-label={lang === 'el' ? 'Ρώτα τον Oli' : 'Ask Oli anything'}
                  placeholder={lang === 'el' ? 'Ρώτα τον Oli οτιδήποτε...' : 'Ask Oli anything about your crops...'}
                  className="w-full rounded-full px-5 py-3.5 pr-14 text-[15px] bg-white border border-[#deded8] focus:border-[#194121] focus:outline-none focus:ring-2 focus:ring-[#194121]/15 transition-all"
                  style={{ boxShadow: '0 4px 24px rgba(25,65,33,0.09)' }}
                />
                <button
                  type="submit"
                  disabled={!chatInput.trim()}
                  aria-label={lang === 'el' ? 'Αποστολή' : 'Send'}
                  className="absolute right-2 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full text-white transition-all disabled:opacity-30"
                  style={{ background: 'linear-gradient(135deg, #194121 0%, #305936 100%)' }}>
                  <Send className="h-4 w-4" />
                </button>
              </form>

              {/* Rotating suggestion chip */}
              <div className="flex flex-col items-center lg:items-start gap-2">
                <button
                  onClick={() => sendQuestion(rotatingQuestions[suggestionIdx])}
                  style={{ opacity: suggestionVisible ? 1 : 0, transition: 'opacity 0.35s ease' }}
                  className="inline-flex items-center gap-1.5 text-xs text-[#194121] bg-[#194121]/8 hover:bg-[#194121]/15 rounded-full px-3 py-1.5 transition-colors max-w-xs sm:max-w-sm text-left">
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

      {/* ── DEMO WIDGET ── */}
      <section className="py-16 bg-[#faf9f4]">
        <div className="max-w-2xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-8">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#194121]/70 mb-2">
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
                  className={`text-[11px] font-semibold px-2.5 sm:px-3 py-1 rounded-full transition-all ${demoTab === 'disease' ? 'bg-white text-[#194121] shadow-sm' : 'text-[#606659] hover:text-[#194121]'}`}>
                  {lang === 'el' ? '🔬 Διάγνωση' : '🔬 Diagnosis'}
                </button>
                <button
                  onClick={() => setDemoTab('planning')}
                  className={`text-[11px] font-semibold px-2.5 sm:px-3 py-1 rounded-full transition-all ${demoTab === 'planning' ? 'bg-white text-[#194121] shadow-sm' : 'text-[#606659] hover:text-[#194121]'}`}>
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
                          <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 mb-1.5">{lang === 'el' ? '🌿 Βιολογικό' : '🌿 Organic'}</p>
                          <p className="text-xs text-[#3a4035] leading-relaxed">{demoDisease.organic}</p>
                        </div>
                        <div className="bg-white rounded-xl border border-[#e8e8e3] px-4 py-3">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-blue-700 mb-1.5">{lang === 'el' ? '🧪 Χημικό' : '🧪 Chemical'}</p>
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
                            <p className="text-[10px] text-[#606659] leading-tight">{row.note}</p>
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

      {/* ── THINGS FARMERS ASK ── */}
      <section className="py-16 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#194121]/70 mb-2">
              {lang === 'el' ? 'Τι ρωτούν οι αγρότες' : 'Things farmers ask Oli'}
            </p>
            <h2 className="text-xl font-bold text-[#1b1c19] mb-1" style={{ fontFamily: "'Noto Serif', serif" }}>
              {lang === 'el' ? 'Αν το ξέρει ένας γεωπόνος, το ξέρει ο Oli' : 'If an agronomist knows it, so does Oli'}
            </h2>
            <p className="text-sm text-[#606659]">
              {lang === 'el' ? 'Κάνε κλικ σε οποιαδήποτε ερώτηση για να τη δοκιμάσεις' : 'Click any question to try it now'}
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {exampleQuestions.map((group, gi) => (
              <div key={gi}>
                <p className="text-xs font-bold text-[#606659] mb-3">{group.category}</p>
                <div className="flex flex-col gap-2">
                  {group.questions.map((q, qi) => (
                    <button
                      key={qi}
                      onClick={() => sendQuestion(q)}
                      className="text-left text-sm text-[#3a4035] bg-[#fafaf8] border border-[#e8e8e3] rounded-xl px-4 py-3 hover:border-[#194121]/40 hover:bg-[#f5f9f5] hover:text-[#194121] transition-all leading-snug active:scale-[0.98]">
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── STATS BAR ── */}
      <section className="py-8 bg-[#faf9f4] border-y border-[#f0efea]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-3 gap-4 text-center">
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

      {/* ── HOW IT WORKS ── */}
      <section className="py-16 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#194121]/70 mb-2">
              {lang === 'el' ? 'Πώς λειτουργεί' : 'How it works'}
            </p>
            <h2 className="text-2xl font-bold text-[#1b1c19]" style={{ fontFamily: "'Noto Serif', serif" }}>
              {lang === 'el' ? 'Τρία απλά βήματα' : 'Three simple steps'}
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8 relative">
            {/* Connector line — desktop only */}
            <div className="hidden sm:block absolute top-8 left-[calc(16.67%+16px)] right-[calc(16.67%+16px)] h-px bg-[#e8e8e3]" />
            {HOW_IT_WORKS(lang).map((step, i) => {
              const Icon = step.icon;
              return (
                <div key={i} className="flex flex-col items-center text-center relative">
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 relative z-10 bg-white border-2 border-[#e8e8e3]"
                    style={{ boxShadow: '0 4px 16px rgba(25,65,33,0.08)' }}>
                    <Icon className="w-6 h-6 text-[#194121]" />
                    <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-[#194121] text-white text-[10px] font-bold flex items-center justify-center">
                      {step.step}
                    </span>
                  </div>
                  <h3 className="font-bold text-[#1b1c19] mb-2 text-sm" style={{ fontFamily: "'Noto Serif', serif" }}>{step.title}</h3>
                  <p className="text-sm text-[#5a6053] leading-relaxed">{step.body}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section className="py-16 bg-[#faf9f4]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <p className="text-center text-xs font-semibold uppercase tracking-widest text-[#194121]/70 mb-10">
            {lang === 'el' ? 'Τι λένε οι αγρότες' : 'What farmers say'}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {TESTIMONIALS(lang).map((t, i) => (
              <div key={i} className="rounded-2xl border border-[#e8e8e3] p-6 bg-white">
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, j) => (
                    <svg key={j} className="w-4 h-4 text-amber-400 fill-current" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
                <p className="text-sm text-[#3a4035] leading-relaxed mb-5 italic">&ldquo;{t.quote}&rdquo;</p>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#194121]/10 flex items-center justify-center text-xs font-bold text-[#194121]">
                    {t.initial}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-[#1b1c19]">{t.name}</p>
                    <p className="text-[11px] text-[#606659]">{t.crop}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section className="py-16 bg-[#f5f4ef]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <h2 className="sr-only">{lang === 'el' ? 'Χαρακτηριστικά' : 'Features'}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {FEATURES(lang).map((f, i) => (
              <div
                key={i}
                className={`rounded-2xl p-6 ${f.accent ? 'bg-[#194121] text-white' : 'bg-white'}`}
                style={{ boxShadow: f.accent ? '0 8px 32px rgba(25,65,33,0.2)' : '0 2px 12px rgba(27,28,25,0.04)' }}>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${f.accent ? 'bg-white/15' : 'bg-[#c0eec0]/30'}`}>
                  <span className={`material-symbols-outlined ${f.accent ? 'text-white' : 'text-[#194121]'}`} style={{ fontSize: '22px' }}>{f.icon}</span>
                </div>
                <h3 className={`font-bold mb-1.5 ${f.accent ? 'text-white' : 'text-[#1b1c19]'}`} style={{ fontFamily: "'Noto Serif', serif" }}>{f.title}</h3>
                <p className={`text-sm leading-relaxed ${f.accent ? 'text-white/80' : 'text-[#5a6053]'}`}>{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section className="py-16 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#194121]/70 mb-2">
              {lang === 'el' ? 'Τιμολόγηση' : 'Pricing'}
            </p>
            <h2 className="text-2xl font-bold text-[#1b1c19]" style={{ fontFamily: "'Noto Serif', serif" }}>
              {lang === 'el' ? 'Ξεκίνα δωρεάν' : 'Start for free'}
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* Free tier */}
            <div className="rounded-2xl border border-[#e8e8e3] bg-white p-6" style={{ boxShadow: '0 2px 12px rgba(27,28,25,0.04)' }}>
              <div className="mb-5">
                <p className="text-xs font-bold uppercase tracking-wider text-[#606659] mb-1">{lang === 'el' ? 'Δωρεάν' : 'Free'}</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-[#1b1c19]" style={{ fontFamily: "'Noto Serif', serif" }}>€0</span>
                  <span className="text-sm text-[#606659]">{lang === 'el' ? '/ μήνα' : '/ month'}</span>
                </div>
                <p className="text-xs text-[#606659] mt-1">{lang === 'el' ? 'Χωρίς πιστωτική κάρτα' : 'No credit card required'}</p>
              </div>
              <ul className="space-y-2.5 mb-6">
                {(lang === 'el'
                  ? ['20 ερωτήσεις / μήνα', 'Διάγνωση ασθενειών', 'Βιολογικό και χημικό πλάνο', 'Ιστορικό συνομιλιών']
                  : ['20 questions / month', 'Crop disease diagnosis', 'Organic and chemical plans', 'Conversation history']
                ).map((item, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-[#3a4035]">
                    <Check className="w-4 h-4 text-[#194121] flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <Link
                to="/auth"
                className="block w-full text-center py-3 rounded-full text-sm font-semibold text-[#194121] border-2 border-[#194121] hover:bg-[#194121] hover:text-white transition-all">
                {lang === 'el' ? 'Ξεκίνα δωρεάν' : 'Get started free'}
              </Link>
            </div>

            {/* Pro tier */}
            <div className="rounded-2xl p-6 relative overflow-hidden text-white"
              style={{ background: 'linear-gradient(135deg, #194121 0%, #2d5535 100%)', boxShadow: '0 8px 32px rgba(25,65,33,0.25)' }}>
              <div className="absolute top-4 right-4 bg-white/20 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                {lang === 'el' ? 'Δημοφιλές' : 'Popular'}
              </div>
              <div className="mb-5">
                <p className="text-xs font-bold uppercase tracking-wider text-white/60 mb-1">Pro</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold" style={{ fontFamily: "'Noto Serif', serif" }}>€4.99</span>
                  <span className="text-sm text-white/70">{lang === 'el' ? '/ μήνα' : '/ month'}</span>
                </div>
                <p className="text-xs text-white/60 mt-1">{lang === 'el' ? 'ή €49 / χρόνο (εξοικονομείς 18%)' : 'or €49 / year (save 18%)'}</p>
              </div>
              <ul className="space-y-2.5 mb-6">
                {(lang === 'el'
                  ? ['Απεριόριστες ερωτήσεις', 'Μνήμη χωραφιών και καλλιεργειών', 'Follow-up σαν αληθινός γεωπόνος', 'Σχεδιασμός φύτευσης και υπολογισμοί', 'Πρώτη πρόσβαση σε νέες λειτουργίες']
                  : ['Unlimited questions', 'Field and crop memory', 'Follow-up like a real agronomist', 'Planting plans and calculations', 'Early access to new features']
                ).map((item, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-white/90">
                    <Check className="w-4 h-4 text-white flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <Link
                to="/auth"
                className="block w-full text-center py-3 rounded-full text-sm font-semibold bg-white text-[#194121] hover:bg-[#c0eec0] transition-all">
                {lang === 'el' ? 'Δοκίμασε Pro' : 'Try Pro'}
              </Link>
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
            <span>🌿</span>
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
          <div className="flex gap-5 text-xs text-[#606659]">
            <Link to="/legal/privacy" className="hover:text-[#194121] transition-colors">
              {lang === 'el' ? 'Απόρρητο' : 'Privacy'}
            </Link>
            <Link to="/legal/terms" className="hover:text-[#194121] transition-colors">
              {lang === 'el' ? 'Όροι' : 'Terms'}
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
