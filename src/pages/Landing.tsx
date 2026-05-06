import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Send, Clock, Leaf, Check, MessageCircle, Zap, RefreshCw, Camera, Mic, X, Globe, ClipboardCheck } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useLanguage } from '../lib/LanguageContext';
import OliLogo from '../components/OliLogo';
import { ALLOWED_IMAGE_TYPES, MAX_FILE_SIZE } from '../lib/constants';
import { LANG_OPTIONS } from '../lib/i18n';
import { LANDING_DICT } from '../lib/landing-dict';

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

const PHONE_DEMOS = (lang: string): PhoneDemo[] => {
  type D = { user1: string; disease1: string; fu1: string; org1: string; chem1: string; user2: string; ans2: string; user3: string; disease3: string; org3: string; fu3: string };
  const d: Record<string, D> = {
    el: { user1: 'Τα φύλλα της ντομάτας έχουν καστανούς κύκλους με κίτρινο περίγραμμα.', disease1: 'Εναλτερίωση Ντομάτας', fu1: 'Θα σε ρωτήσω για να δω πώς πάει η θεραπεία.', org1: 'Bordeaux mixture 200g/100L', chem1: 'Mancozeb 80% WP 250g/100L', user2: 'Πότε κλαδεύω αμπέλια για καλύτερη παραγωγή;', ans2: 'Κλάδεψε κατά τον χειμερινό ύπνο (Ιαν–Μαρ). Άφησε 2–3 μάτια ανά βλαστό. Αφαίρεσε πρώτα το νεκρό ξύλο.', user3: 'Λευκή σκόνη στα φύλλα του αμπελιού. Τι είναι;', disease3: 'Ωίδιο (Uncinula necator)', org3: 'Θείο WP 80%, 300g/100L', fu3: 'Θα σε ρωτήσω για να δω πώς πάει η θεραπεία.' },
    it: { user1: 'Le foglie del pomodoro hanno anelli marroni con bordo giallo.', disease1: 'Alternariosi del Pomodoro', fu1: 'Ti aggiornerò su come procede il trattamento.', org1: 'Poltiglia bordolese 200g/100L', chem1: 'Mancozeb 80% WP 250g/100L', user2: 'Quando potare la vite per una resa migliore?', ans2: 'Pota durante il riposo invernale (Gen–Mar). Mantieni 2–3 gemme per cane. Rimuovi prima il legno morto.', user3: 'Polvere bianca sulle foglie della vite. Cos\'è?', disease3: 'Oidio (Uncinula necator)', org3: 'Zolfo WP 80%, 300g/100L', fu3: 'Ti aggiornerò su come procede il trattamento.' },
    es: { user1: 'Las hojas del tomate tienen anillos marrones con borde amarillo.', disease1: 'Tizón Temprano (Alternaria)', fu1: 'Te preguntaré cómo va el tratamiento.', org1: 'Caldo bordelés 200g/100L', chem1: 'Mancozeb 80% WP 250g/100L', user2: '¿Cuándo podar la vid para mejor rendimiento?', ans2: 'Poda durante el reposo invernal (Ene–Mar). Mantén 2–3 yemas por sarmiento. Elimina la madera muerta primero.', user3: 'Polvo blanco en las hojas de vid. ¿Qué es?', disease3: 'Oídio (Uncinula necator)', org3: 'Azufre WP 80%, 300g/100L', fu3: 'Te preguntaré cómo va el tratamiento.' },
    fr: { user1: 'Les feuilles de tomate ont des anneaux bruns avec un bord jaune.', disease1: 'Alternariose de la Tomate', fu1: 'Je te demanderai comment avance le traitement.', org1: 'Bouillie bordelaise 200g/100L', chem1: 'Mancozèbe 80% WP 250g/100L', user2: 'Quand tailler la vigne pour un meilleur rendement?', ans2: 'Taille pendant la dormance (Jan–Mar). Garde 2–3 bourgeons par cane. Enlève le bois mort en premier.', user3: 'Poudre blanche sur les feuilles de vigne. C\'est quoi?', disease3: 'Oïdium (Uncinula necator)', org3: 'Soufre WP 80%, 300g/100L', fu3: 'Je te demanderai comment avance le traitement.' },
    ar: { user1: 'أوراق الطماطم بها حلقات بنية ببيضاء صفراء.', disease1: 'البثرة المبكرة (Alternaria)', fu1: 'سأسألك كيف يسير العلاج.', org1: 'خليط بوردو 200g/100L', chem1: 'مانكوزيب 80% WP 250g/100L', user2: 'متى أقلم الكروم للحصول على محصول أفضل؟', ans2: 'قلّم خلال فترة السكون (يناير–مارس). احتفظ بـ 2–3 براعم لكل عرجون. أزل الخشب الميت أولاً.', user3: 'مسحوق أبيض على أوراق الكروم. ما هذا؟', disease3: 'البياض الدقيقي (Uncinula necator)', org3: 'كبريت WP 80%، 300g/100L', fu3: 'سأسألك كيف يسير العلاج.' },
  };
  const t = d[lang] ?? d['en' as keyof typeof d] ?? { user1: 'My tomato leaves have brown rings with a yellow border.', disease1: 'Early Blight (Alternaria)', fu1: "I'll follow up to see how the treatment is going.", org1: 'Bordeaux mixture 200g/100L', chem1: 'Mancozeb 80% WP 250g/100L', user2: 'When should I prune grapevines for better yield?', ans2: 'Prune during dormancy (Jan–Mar). Keep 2–3 buds per cane. Remove dead wood first.', user3: 'White powder on my vine leaves. What is it?', disease3: 'Powdery Mildew', org3: 'Sulphur WP 80%, 300g/100L', fu3: "I'll follow up to see how the treatment is going." };
  return [
    { type: 'disease', user: t.user1, disease: t.disease1, confidence: 92, organic: t.org1, chemical: t.chem1, followup: t.fu1 },
    { type: 'advice',  user: t.user2, icon: '✂️', answer: t.ans2 },
    { type: 'disease', user: t.user3, disease: t.disease3, confidence: 88, organic: t.org3, chemical: 'Myclobutanil 12.5% EC, 40ml/100L', followup: t.fu3 },
  ];
};

// ── Static data ───────────────────────────────────────────────────────────────

const STATS = (lang: string) => {
  const labels: Record<string, [string, string, string, string]> = {
    el: ['Ασθένειες & παθογόνα', 'Είδη καλλιεργειών', 'Ελλείψεις θρεπτικών', 'Γλώσσες'],
    en: ['Diseases & pathogens', 'Crop types', 'Nutrient deficiencies', 'Languages'],
    it: ['Malattie e patogeni', 'Tipi di coltura', 'Carenze nutrizionali', 'Lingue'],
    es: ['Enfermedades y patógenos', 'Tipos de cultivo', 'Deficiencias nutricionales', 'Idiomas'],
    fr: ['Maladies et pathogènes', 'Types de culture', 'Carences nutritionnelles', 'Langues'],
    ar: ['الأمراض والمسببات', 'أنواع المحاصيل', 'نقص العناصر الغذائية', 'اللغات'],
  };
  const l = labels[lang] ?? labels['en'];
  return [
    { n: '450+', label: l[0] },
    { n: '80+',  label: l[1] },
    { n: '20+',  label: l[2] },
    { n: '6',    label: l[3] },
  ];
};

const HOW_IT_WORKS = (lang: string) => {
  type StepT = { t1: string; b1: string; t2: string; b2: string; t3: string; b3: string };
  const s: Record<string, StepT> = {
    el: { t1: 'Ρώτα ή φωτογράφισε', b1: 'Γράψε την ερώτησή σου ή ανέβασε φωτογραφία από το χωράφι. Δεν χρειάζεται να ξέρεις τη σωστή ορολογία.', t2: 'Πάρε απάντηση σε δευτερόλεπτα', b2: 'Διάγνωση, πλάνο θεραπείας, συμβουλές σποράς, υπολογισμός φύτευσης. Συγκεκριμένη απάντηση, όχι γενικές πληροφορίες.', t3: 'Ο Oli παρακολουθεί και μαθαίνει', b3: 'Θυμάται κάθε καλλιέργεια και παρέμβαση. Παρακολουθεί σαν αληθινός γεωπόνος αν η θεραπεία πέτυχε.' },
    en: { t1: 'Ask or snap a photo', b1: 'Type your question or upload a photo from your field. No need to know the right terminology.', t2: 'Get your answer in seconds', b2: 'Diagnosis, treatment plan, planting advice, spacing calculations. A specific answer, not generic information.', t3: 'Oli follows up and learns', b3: 'It remembers every crop and treatment. Follows up like a real agronomist to confirm the treatment worked.' },
    it: { t1: 'Chiedi o scatta una foto', b1: 'Scrivi la tua domanda o carica una foto dal campo. Non è necessario conoscere la terminologia tecnica.', t2: 'Ricevi la risposta in secondi', b2: 'Diagnosi, piano di trattamento, consigli di semina, calcolo delle spaziature. Una risposta specifica, non informazioni generiche.', t3: 'Oli monitora e impara', b3: 'Ricorda ogni coltura e intervento. Monitora i progressi come un vero agronomo per confermare che il trattamento ha funzionato.' },
    es: { t1: 'Pregunta o toma una foto', b1: 'Escribe tu pregunta o sube una foto de tu campo. No necesitas saber la terminología correcta.', t2: 'Obtén tu respuesta en segundos', b2: 'Diagnóstico, plan de tratamiento, consejos de siembra, cálculos de distancias. Una respuesta específica, no información genérica.', t3: 'Oli hace seguimiento y aprende', b3: 'Recuerda cada cultivo y tratamiento. Hace seguimiento como un agrónomo real para confirmar que el tratamiento funcionó.' },
    fr: { t1: 'Pose ta question ou prends une photo', b1: "Écris ta question ou charge une photo de ton champ. Pas besoin de connaître la terminologie exacte.", t2: 'Reçois ta réponse en secondes', b2: 'Diagnostic, plan de traitement, conseils de plantation, calculs de spacing. Une réponse précise, pas des informations génériques.', t3: 'Oli fait le suivi et apprend', b3: "Il se souvient de chaque culture et intervention. Fait le suivi comme un vrai agronome pour confirmer que le traitement a fonctionné." },
    ar: { t1: 'اسأل أو التقط صورة', b1: 'اكتب سؤالك أو ارفع صورة من حقلك. لا حاجة لمعرفة المصطلحات الصحيحة.', t2: 'احصل على إجابتك في ثوانٍ', b2: 'تشخيص، خطة علاج، نصائح الزراعة، حسابات التباعد. إجابة محددة، ليس معلومات عامة.', t3: 'أولي يتابع ويتعلم', b3: 'يتذكر كل محصول وتدخل. يتابع كمهندس زراعي حقيقي للتأكد من نجاح العلاج.' },
  };
  const t = s[lang] ?? s['en'];
  return [
    { step: '1', icon: MessageCircle, preview: 'ask' as const,     title: t.t1, body: t.b1 },
    { step: '2', icon: Zap,           preview: 'answer' as const,  title: t.t2, body: t.b2 },
    { step: '3', icon: RefreshCw,     preview: 'followup' as const, title: t.t3, body: t.b3 },
  ];
};

// ── Step preview micro-UIs ────────────────────────────────────────────────────

function StepPreviewAsk({ lang }: { lang: string }) {
  const lt = LANDING_DICT[lang as keyof typeof LANDING_DICT] ?? LANDING_DICT.en;
  return (
    <div className="mt-4 rounded-xl border border-[#e8e8e3] bg-white overflow-hidden"
      style={{ boxShadow: '0 2px 12px rgba(25,65,33,0.07)' }}>
      {/* Chat header */}
      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-[#f0efea] bg-[#fafaf8]">
        <div className="w-4 h-4 rounded-full bg-[#194121]/10 flex items-center justify-center">
          <span style={{ fontSize: '8px' }}>🌿</span>
        </div>
        <span className="text-[10px] font-semibold text-[#194121]">Oli</span>
        <span className="ml-auto flex items-center gap-0.5 text-[9px] text-emerald-600 font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
          Online
        </span>
      </div>
      <div className="p-3 space-y-2">
        {/* User message + photo thumbnail */}
        <div className="flex justify-end">
          <div className="flex items-end gap-1.5 max-w-[90%]">
            <div className="w-9 h-9 rounded-lg bg-[#e8f4ea] flex items-center justify-center flex-shrink-0 border border-[#d4e8d4] text-xl leading-none">
              🍅
            </div>
            <div className="rounded-xl rounded-tr-sm bg-[#194121] text-white text-[10px] px-3 py-2 leading-snug">
              {lt.heroPlaceholder}
            </div>
          </div>
        </div>
        {/* Input bar */}
        <div className="flex items-center gap-1.5 rounded-xl border border-[#deded8] bg-[#f5f4ef] px-2.5 py-2">
          <Camera className="h-3 w-3 text-[#606659] flex-shrink-0" />
          <span className="flex-1 text-[10px] text-[#9a9b93] truncate">
            {lt.heroPlaceholder}
          </span>
          <div className="h-5 w-5 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #194121 0%, #305936 100%)' }}>
            <Send className="h-2.5 w-2.5 text-white" />
          </div>
        </div>
      </div>
    </div>
  );
}

function StepPreviewAnswer({ lang }: { lang: string }) {
  const lt = LANDING_DICT[lang as keyof typeof LANDING_DICT] ?? LANDING_DICT.en;
  return (
    <div className="mt-4 rounded-xl border border-[#e8e8e3] bg-white p-3"
      style={{ boxShadow: '0 2px 12px rgba(25,65,33,0.07)' }}>
      {/* Oli avatar row */}
      <div className="flex items-center gap-1.5 mb-2.5">
        <div className="w-5 h-5 rounded-full bg-[#194121]/10 flex items-center justify-center flex-shrink-0">
          <span style={{ fontSize: '10px' }}>🌿</span>
        </div>
        <span className="text-[10px] font-semibold text-[#194121]">Oli</span>
      </div>
      {/* Diagnosis card */}
      <div className="rounded-lg border border-[#e8e8e3] bg-[#fafaf8] px-2.5 py-2 mb-1.5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-bold text-[#1b1c19]">
            {DEMO_DISEASE(lang).disease}
          </span>
          <span className="text-[9px] font-semibold bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded-full">92%</span>
        </div>
        <div className="grid grid-cols-2 gap-1">
          <div className="bg-emerald-50 rounded-md p-1.5">
            <p className="text-[8px] font-bold text-emerald-700 mb-0.5">{lt.organic}</p>
            <p className="text-[8px] text-[#3a4035] leading-tight">Bordeaux 200g/100L</p>
          </div>
          <div className="bg-blue-50 rounded-md p-1.5">
            <p className="text-[8px] font-bold text-blue-700 mb-0.5">{lt.chemical}</p>
            <p className="text-[8px] text-[#3a4035] leading-tight">Mancozeb 80% WP</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function StepPreviewFollowup({ lang }: { lang: string }) {
  // The actual VIO check-in that Oli sends 3 days after a logged treatment.
  // Shows the real outcome buttons, not a notification permission prompt.
  const CHECK_IN: Record<string, string> = {
    el: 'Πέρασαν 3 μέρες από τη θεραπεία για Εναλτερίωση Ντομάτας. Βελτιώθηκαν τα συμπτώματα;',
    en: "It's been 3 days since you treated for Early Blight. Are the symptoms improving?",
    it: 'Sono passati 3 giorni dal trattamento per Alternariosi. I sintomi migliorano?',
    es: 'Han pasado 3 días desde el tratamiento del Tizón Temprano. ¿Mejoran los síntomas?',
    fr: "Cela fait 3 jours depuis le traitement de l'Alternariose. Les symptômes s'améliorent ?",
    ar: 'مرّت 3 أيام منذ علاج البثرة المبكرة. هل تتحسن الأعراض؟',
  };
  const DIVIDER: Record<string, string> = {
    el: '3 μέρες αργότερα', en: '3 days later', it: '3 giorni dopo',
    es: '3 días después', fr: '3 jours plus tard', ar: '3 أيام لاحقاً',
  };
  const OUTCOMES: Record<string, [string, string, string]> = {
    el: ['✅ Βελτιώθηκε', '➡️ Δεν άλλαξε', '⚠️ Χειροτέρεψε'],
    en: ['✅ Improved',   '➡️ No change',  '⚠️ Got worse'],
    it: ['✅ Migliorato', '➡️ Invariato',  '⚠️ Peggiorato'],
    es: ['✅ Mejorado',   '➡️ Sin cambios','⚠️ Empeorado'],
    fr: ['✅ Amélioré',   '➡️ Inchangé',  '⚠️ Aggravé'],
    ar: ['✅ تحسّن',      '➡️ لا تغيير',  '⚠️ تفاقم'],
  };
  const msg = CHECK_IN[lang] ?? CHECK_IN.en;
  const divider = DIVIDER[lang] ?? DIVIDER.en;
  const [better, same, worse] = OUTCOMES[lang] ?? OUTCOMES.en;

  return (
    <div className="mt-4 rounded-xl border border-[#e8e8e3] bg-white p-3"
      style={{ boxShadow: '0 2px 12px rgba(25,65,33,0.07)' }}>
      {/* Time divider, makes it clear this happens 3 days later, not immediately */}
      <div className="flex items-center gap-2 mb-3">
        <div className="flex-1 h-px bg-[#e8e8e3]" />
        <span className="text-[9px] text-[#9a9b93] font-medium">{divider}</span>
        <div className="flex-1 h-px bg-[#e8e8e3]" />
      </div>
      {/* Oli's check-in message */}
      <div className="flex gap-2 items-start mb-3">
        <div className="w-5 h-5 rounded-full bg-[#194121]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
          <span style={{ fontSize: '10px' }}>🌿</span>
        </div>
        <div className="flex-1 text-[11px] text-[#1b1c19] leading-snug bg-[#f5f4ef] rounded-xl rounded-tl-sm px-3 py-2">
          {msg}
        </div>
      </div>
      {/* Real outcome buttons, matches the actual in-app VIO experience */}
      <div className="flex gap-1.5 justify-end flex-wrap">
        <button type="button" tabIndex={-1} aria-hidden="true"
          className="rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] px-2.5 py-1 font-medium pointer-events-none">
          {better}
        </button>
        <button type="button" tabIndex={-1} aria-hidden="true"
          className="rounded-full bg-[#f5f4ef] text-[#606659] border border-[#e8e8e3] text-[10px] px-2.5 py-1 font-medium pointer-events-none">
          {same}
        </button>
        <button type="button" tabIndex={-1} aria-hidden="true"
          className="rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[10px] px-2.5 py-1 font-medium pointer-events-none">
          {worse}
        </button>
      </div>
    </div>
  );
}

const FEATURES = (lang: string): { icon: LucideIcon; title: string; body: string; accent: boolean }[] => {
  type F = { t1: string; b1: string; t2: string; b2: string; t3: string; b3: string };
  const f: Record<string, F> = {
    el: { t1: 'Ρώτα οτιδήποτε για τις καλλιέργειές σου', b1: 'Ασθένειες, πότισμα, λίπανση, κλάδεμα, σπορά. Αν το ξέρει ένας έμπειρος γεωπόνος, το ξέρει και ο Oli. Δεν είναι απλώς εφαρμογή αναγνώρισης. Είναι ο σύμβουλός σου.', t2: 'Μιλά τη γλώσσα σου', b2: 'Ελληνικά, Αγγλικά, Ιταλικά, Ισπανικά, Γαλλικά, Αραβικά. Ιδανικός για αγρότες σε όλο τον κόσμο. Επιλέξτε γλώσσα από το προφίλ σας.', t3: 'Μαθαίνει τα χωράφια σου, παρακολουθεί', b3: 'Ο Oli θυμάται κάθε καλλιέργεια και παρέμβαση. Παρακολουθεί σαν αληθινός γεωπόνος αν η θεραπεία πέτυχε και προσαρμόζεται ανάλογα.' },
    en: { t1: 'Ask anything about your crops', b1: 'Diseases, irrigation, fertilisation, pruning, planting schedules. If an experienced agronomist knows it, Oli knows it. Not just an ID app. Your complete farming advisor.', t2: 'Works in your language', b2: 'Greek, English, Italian, Spanish, French, Arabic, 6 languages natively supported. Built for farmers worldwide. Set your preferred language from your profile.', t3: 'Learns your fields, follows up', b3: 'Oli builds a memory of your fields and crops over time. Follows up like a real agronomist to confirm the treatment worked, and adjusts if it did not.' },
    it: { t1: 'Chiedi qualsiasi cosa sulle tue colture', b1: 'Malattie, irrigazione, concimazione, potatura, calendario di semina. Se un agronomo esperto lo sa, lo sa anche Oli. Non è solo un\'app di identificazione. È il tuo consulente completo.', t2: 'Parla la tua lingua', b2: 'Greco, Inglese, Italiano, Spagnolo, Francese, Arabo, 6 lingue supportate nativamente. Costruito per agricoltori di tutto il mondo. Imposta la tua lingua preferita dal profilo.', t3: 'Impara i tuoi campi e monitora i progressi', b3: 'Oli costruisce una memoria dei tuoi campi e colture nel tempo. Monitora i progressi come un vero agronomo per confermare che il trattamento ha funzionato.' },
    es: { t1: 'Pregunta cualquier cosa sobre tus cultivos', b1: 'Enfermedades, riego, fertilización, poda, calendarios de siembra. Si un agrónomo experimentado lo sabe, Oli lo sabe. No es solo una app de identificación. Es tu asesor completo.', t2: 'Funciona en tu idioma', b2: 'Griego, Inglés, Italiano, Español, Francés, Árabe, 6 idiomas soportados nativamente. Diseñado para agricultores de todo el mundo. Configura tu idioma preferido desde tu perfil.', t3: 'Aprende tus campos y hace seguimiento', b3: 'Oli construye una memoria de tus campos y cultivos con el tiempo. Hace seguimiento como un agrónomo real para confirmar que el tratamiento funcionó.' },
    fr: { t1: 'Pose n\'importe quelle question sur tes cultures', b1: 'Maladies, irrigation, fertilisation, taille, calendriers de plantation. Si un agronome expérimenté le sait, Oli le sait. Pas seulement une app d\'identification. Ton conseiller agricole complet.', t2: 'Fonctionne dans ta langue', b2: 'Grec, Anglais, Italien, Espagnol, Français, Arabe, 6 langues supportées nativement. Conçu pour les agriculteurs du monde entier. Choisis ta langue préférée dans ton profil.', t3: 'Apprend tes champs et fait le suivi', b3: "Oli construit une mémoire de tes champs et cultures dans le temps. Fait le suivi comme un vrai agronome pour confirmer que le traitement a fonctionné." },
    ar: { t1: 'اسأل أي شيء عن محاصيلك', b1: 'الأمراض، الري، التسميد، التقليم، جداول الزراعة. إذا كان مهندس زراعي متمرس يعرفه، يعرفه أولي. ليس فقط تطبيق تعرف. مستشارك الزراعي الكامل.', t2: 'يعمل بلغتك', b2: 'اليونانية، الإنجليزية، الإيطالية، الإسبانية، الفرنسية، العربية, 6 لغات مدعومة بشكل أصلي. مصمم للمزارعين في جميع أنحاء العالم. اضبط لغتك المفضلة من ملفك الشخصي.', t3: 'يتعلم حقولك ويتابع', b3: 'يبني أولي ذاكرة لحقولك ومحاصيلك بمرور الوقت. يتابع كمهندس زراعي حقيقي للتأكد من نجاح العلاج.' },
  };
  const t = f[lang] ?? f['en'];
  return [
    { icon: Camera,        title: t.t1, body: t.b1, accent: true  },
    { icon: Globe,         title: t.t2, body: t.b2, accent: false },
    { icon: ClipboardCheck, title: t.t3, body: t.b3, accent: false },
  ];
};

// ── Role-based showcase ──────────────────────────────────────────────────────
const ROLES = (lang: string) => {
  type RoleT = { farmer: string; farmerHL: string; farmerQ: string; farmerA: string; farmerTag: string; agro: string; agroHL: string; agroQ: string; agroA: string; agroTag: string; assoc: string; assocHL: string; assocQ: string; assocA: string; assocTag: string; garden: string; gardenHL: string; gardenQ: string; gardenA: string; gardenTag: string; input: string; inputHL: string; inputQ: string; inputA: string; inputTag: string };
  const r: Record<string, RoleT> = {
    el: { farmer: 'Αγρότης', farmerHL: 'Απάντηση σε δευτερόλεπτα, στη γλώσσα σου', farmerQ: 'Λευκή σκόνη στα φύλλα του αμπελιού. Τι είναι και τι κάνω;', farmerA: 'Πρόκειται για Ωίδιο (Uncinula necator), μυκητολογική ασθένεια. Βεβαιότητα: 91%.\n🌿 Βιολογικό: Θείο WP 80%, 300g/100L, κάθε 7–10 μέρες\n⚗️ Χημικό: Myclobutanil 12.5% EC, 40ml/100L\nΘα σε ρωτήσω σε 3 μέρες αν βελτιώθηκε.', farmerTag: 'Διάγνωση + Θεραπεία', agro: 'Γεωπόνος', agroHL: 'Επιστημονικοί υπολογισμοί σε δευτερόλεπτα', agroQ: 'Υπολόγισέ μου ETc αμπελώνα Ιούλιο. ET₀ = 6.2mm/ημέρα, Kc = 0.85 (ανθοφορία)', agroA: 'ETc = ET₀ × Kc = 6.2 × 0.85 = 5.27 mm/ημέρα\nΣε ha: 5.27mm × 10 = 52.7 m³/ha/ημέρα\nΓια 5 στρέμματα (0.5 ha): 26.4 m³/ημέρα\nΓια εβδομάδα: 184.5 m³\nΜε σταγονικό (αποδοτ. 90%): 205 m³ πρόβλεψη.', agroTag: 'Υπολογισμός ETc', assoc: 'Αγροτικός Σύλλογος', assocHL: 'Ετήσιο αρχείο παρεμβάσεων και εργασιών', assocQ: 'Δώσε μου αρχείο με όλες τις εργασίες και παρεμβάσεις στα χωράφια μου το περασμένο χρόνο', assocA: '📋 Ετήσια Έκθεση Χωραφιών 2025\n\n🫒 Ελαιώνας Βοριά (8 στρ)\n• Μαρ: Κλάδεμα + Χαλκούχο (Περονόσπορος)\n• Ιούν: Λίπανση αζώτου 12kg/στρ\n• Σεπ: Ψεκασμός ολεοκτόνο (Δάκος)\n• Αποτέλεσμα: Βελτίωση ✅\n\n🍇 Αμπελώνας (5 στρ)\n• Φεβ: Κλάδεμα χειμερινό\n• Μαϊ: Θείο Ωίδιο 3× ψεκασμοί\n• Ιούλ: Άρδευση 850m³ σύνολο', assocTag: 'Ετήσια Αναφορά', garden: 'Κηπουρός / Οικιακός Κήπος', gardenHL: 'Ποια φυτά πάνε μαζί στον κήπο;', gardenQ: 'Ποια λαχανικά φυτεύω μαζί για καλύτερη ανάπτυξη στον κήπο μου;', gardenA: '✅ Καλοί συνδυασμοί:\n• Ντομάτα + Βασιλικός, απωθεί αφίδες, βελτιώνει γεύση\n• Καρότα + Κρεμμύδια, αμοιβαία προστασία\n• Κολοκυθάκι + Καλαμπόκι + Φασόλια\n\n❌ Αποφύγετε:\n• Ντομάτα + Μάραθο, ανταγωνισμός ριζών\n• Κρεμμύδια + Αρακάς, αναστέλλουν ανάπτυξη', gardenTag: 'Συνοδοί Καλλιέργειες', input: 'Εταιρεία Αγροεφοδίων', inputHL: 'Ποια προϊόντα συστήνει ο Oli για κάθε πρόβλημα;', inputQ: 'Ποια σκευάσματα για Περονόσπορο αμπελιού; Τι δόση και πότε;', inputA: 'Περονόσπορος (Plasmopara viticola), Προστατευτικά + Θεραπευτικά:\n\n⚗️ Χαλκούχα: Hydroxide χαλκού 77%, 250g/100L, πριν βροχή\n⚗️ Διασυστηματικά: Metalaxyl-M 4% + Mancozeb 64% WP, 250g/100L\n⚗️ Cymoxanil 45% WG, 30g/100L (θεραπευτικά έως 4ω μετά λοίμωξη)\n\n5–7 φύλλα έως κλείσιμο τσαμπιού', inputTag: 'Σκευάσματα & Δοσολογία' },
    en: { farmer: 'Farmer', farmerHL: 'Answers in seconds, in your language', farmerQ: 'White powder on my vine leaves. What is it and what should I do?', farmerA: 'This is Powdery Mildew (Oidium / Uncinula necator). Confidence: 91%.\n🌿 Organic: Sulphur WP 80%, 300g/100L every 7–10 days\n⚗️ Chemical: Myclobutanil 12.5% EC, 40ml/100L\nI\'ll follow up in 3 days to check progress.', farmerTag: 'Diagnosis + Treatment', agro: 'Agronomist', agroHL: 'Scientific calculations in seconds', agroQ: 'Calculate vineyard ETc for July. ET₀ = 6.2mm/day, Kc = 0.85 (flowering stage)', agroA: 'ETc = ET₀ × Kc = 6.2 × 0.85 = 5.27 mm/day\nPer ha: 5.27 × 10 = 52.7 m³/ha/day\nFor 1 ha: 52.7 m³/day, weekly: 368.9 m³\nWith drip (90% efficiency): schedule 410 m³/week.', agroTag: 'ETc Calculation', assoc: 'Farmers\' Association', assocHL: 'Annual intervention and field work report', assocQ: 'Give me a report of all field work and treatments done across my fields over the past year', assocA: '📋 Annual Field Report 2025\n\n🫒 North Olive Grove (0.8 ha)\n• Mar: Pruning + Copper spray (Downy Mildew)\n• Jun: Nitrogen top-dress 120kg/ha\n• Sep: Olicide spray (Olive fly)\n• Outcome: Improved ✅\n\n🍇 Vineyard (0.5 ha)\n• Feb: Winter pruning\n• May: Sulphur (Oidium) × 3 sprays\n• Jul: Irrigation 850m³ total', assocTag: 'Annual Report', garden: 'Garden Center / Home Garden', gardenHL: 'Which plants grow best together?', gardenQ: 'Which vegetables should I plant together for better growth in my garden?', gardenA: '✅ Good companion planting:\n• Tomato + Basil, repels aphids, improves flavour\n• Carrots + Onions, mutual insect deterrence\n• Courgette + Corn + Beans (Three Sisters)\n\n❌ Avoid together:\n• Tomato + Fennel, root competition\n• Onions + Peas, growth inhibition', gardenTag: 'Companion Planting', input: 'Agri-Input Company', inputHL: 'Which products does Oli recommend per problem?', inputQ: 'Which fungicides for Downy Mildew (Peronospora) on grapevines? Dose and timing?', inputA: 'Downy Mildew (Plasmopara viticola), Protectant + Curative:\n\n⚗️ Copper-based (preventive): Copper Hydroxide 77%, 250g/100L, apply before rain\n⚗️ Systemic: Metalaxyl-M 4% + Mancozeb 64% WP, 250g/100L\n⚗️ Cymoxanil 45% WG, 30g/100L (curative up to 4h post-infection)\n\nApply from 5-leaf stage through bunch closure', inputTag: 'Products & Dosage' },
    it: { farmer: 'Agricoltore', farmerHL: 'Risposta in secondi, nella tua lingua', farmerQ: 'Polvere bianca sulle foglie della vite. Cos\'è e cosa faccio?', farmerA: 'Questo è Oidio (Uncinula necator), malattia fungina. Affidabilità: 91%.\n🌿 Biologico: Zolfo WP 80%, 300g/100L ogni 7–10 giorni\n⚗️ Chimico: Miclobutanil 12.5% EC, 40ml/100L\nTi contatterò tra 3 giorni per verificare i progressi.', farmerTag: 'Diagnosi + Trattamento', agro: 'Agronomo', agroHL: 'Calcoli scientifici in secondi', agroQ: 'Calcola ETc vigneto luglio. ET₀ = 6.2mm/giorno, Kc = 0.85 (fioritura)', agroA: 'ETc = ET₀ × Kc = 6.2 × 0.85 = 5.27 mm/giorno\nPer ha: 5.27 × 10 = 52.7 m³/ha/giorno\nPer 1 ha: 52.7 m³/giorno, settimana: 368.9 m³\nCon goccia (90% efficienza): 410 m³/settimana.', agroTag: 'Calcolo ETc', assoc: 'Cooperativa Agricola', assocHL: 'Report annuale interventi e lavori', assocQ: 'Dammi un report di tutti i lavori e trattamenti fatti nei miei campi nell\'ultimo anno', assocA: '📋 Report Annuale Campi 2025\n\n🫒 Uliveto Nord (0.8 ha)\n• Mar: Potatura + rame (Peronospora)\n• Giu: Concimazione azoto 120kg/ha\n• Set: Insetticida (Mosca ulivo)\n• Esito: Migliorato ✅\n\n🍇 Vigneto (0.5 ha)\n• Feb: Potatura invernale\n• Mag: Zolfo (Oidio) × 3 trattamenti\n• Lug: Irrigazione 850m³ totale', assocTag: 'Report Annuale', garden: 'Giardinaggio / Orto Domestico', gardenHL: 'Quali piante crescono meglio insieme?', gardenQ: 'Quali ortaggi piantare insieme per una crescita migliore nel mio orto?', gardenA: '✅ Buone consociazioni:\n• Pomodoro + Basilico, allontana gli afidi\n• Carote + Cipolle, deterrente reciproco\n• Zucchina + Mais + Fagioli (Tre Sorelle)\n\n❌ Evitare insieme:\n• Pomodoro + Finocchio, competizione radici\n• Cipolle + Piselli, inibiscono la crescita', gardenTag: 'Consociazioni', input: 'Azienda Agri-Input', inputHL: 'Quali prodotti consiglia Oli per ogni problema?', inputQ: 'Quali fungicidi per la Peronospora della vite? Dose e tempi?', inputA: 'Peronospora (Plasmopara viticola), Preventivi + Curativi:\n\n⚗️ Rameici (preventivi): Idrossido di rame 77%, 250g/100L, prima della pioggia\n⚗️ Sistemici: Metalaxyl-M 4% + Mancozeb 64% WP, 250g/100L\n⚗️ Cymoxanil 45% WG, 30g/100L (curativo fino a 4h post-infezione)\n\nDa 5–7 foglie fino alla chiusura del grappolo', inputTag: 'Prodotti & Dosaggi' },
    es: { farmer: 'Agricultor', farmerHL: 'Respuestas en segundos, en tu idioma', farmerQ: 'Polvo blanco en las hojas de vid. ¿Qué es y qué hago?', farmerA: 'Esto es Oídio (Uncinula necator), enfermedad fúngica. Confianza: 91%.\n🌿 Ecológico: Azufre WP 80%, 300g/100L cada 7–10 días\n⚗️ Químico: Miclobutanil 12.5% EC, 40ml/100L\nTe preguntaré en 3 días para ver los avances.', farmerTag: 'Diagnóstico + Tratamiento', agro: 'Agrónomo', agroHL: 'Cálculos científicos en segundos', agroQ: 'Calcula ETc viñedo julio. ET₀ = 6.2mm/día, Kc = 0.85 (floración)', agroA: 'ETc = ET₀ × Kc = 6.2 × 0.85 = 5.27 mm/día\nPor ha: 5.27 × 10 = 52.7 m³/ha/día\nPara 1 ha: 52.7 m³/día, semanal: 368.9 m³\nCon goteo (90% eficiencia): 410 m³/semana.', agroTag: 'Cálculo ETc', assoc: 'Asociación de Agricultores', assocHL: 'Informe anual de intervenciones y trabajos', assocQ: 'Dame un informe de todos los trabajos y tratamientos realizados en mis campos el último año', assocA: '📋 Informe Anual de Campos 2025\n\n🫒 Olivar Norte (0.8 ha)\n• Mar: Poda + cobre (Mildiu)\n• Jun: Abonado nitrógeno 120kg/ha\n• Sep: Insecticida (Mosca del olivo)\n• Resultado: Mejorado ✅\n\n🍇 Viñedo (0.5 ha)\n• Feb: Poda invernal\n• May: Azufre (Oídio) × 3 tratamientos\n• Jul: Riego 850m³ total', assocTag: 'Informe Anual', garden: 'Jardinería / Huerto Doméstico', gardenHL: '¿Qué plantas crecen mejor juntas?', gardenQ: '¿Qué verduras plantar juntas para un mejor crecimiento en mi huerto?', gardenA: '✅ Buenas asociaciones:\n• Tomate + Albahaca, repele pulgones\n• Zanahorias + Cebollas, disuasión mutua\n• Calabacín + Maíz + Judías (Tres Hermanas)\n\n❌ Evitar juntos:\n• Tomate + Hinojo, competencia de raíces\n• Cebollas + Guisantes, inhiben el crecimiento', gardenTag: 'Plantas Compañeras', input: 'Empresa Agro-Insumos', inputHL: '¿Qué productos recomienda Oli para cada problema?', inputQ: '¿Qué fungicidas para el Mildiu en vid? ¿Dosis y momento?', inputA: 'Mildiu (Plasmopara viticola), Preventivos + Curativos:\n\n⚗️ Cúpricos (preventivos): Hidróxido de cobre 77%, 250g/100L, antes de lluvia\n⚗️ Sistémicos: Metalaxyl-M 4% + Mancozeb 64% WP, 250g/100L\n⚗️ Cymoxanil 45% WG, 30g/100L (curativo hasta 4h post-infección)\n\nDe 5–7 hojas hasta cierre del racimo', inputTag: 'Productos & Dosificación' },
    fr: { farmer: 'Agriculteur', farmerHL: 'Réponses en secondes, dans ta langue', farmerQ: 'Poudre blanche sur les feuilles de vigne. C\'est quoi et que faire?', farmerA: 'C\'est l\'Oïdium (Uncinula necator), maladie fongique. Confiance: 91%.\n🌿 Biologique: Soufre WP 80%, 300g/100L toutes les 7–10 jours\n⚗️ Chimique: Myclobutanil 12.5% EC, 40ml/100L\nJe te contacterai dans 3 jours pour voir les progrès.', farmerTag: 'Diagnostic + Traitement', agro: 'Agronome', agroHL: 'Calculs scientifiques en secondes', agroQ: 'Calcule l\'ETc vigneto juillet. ET₀ = 6.2mm/jour, Kc = 0.85 (floraison)', agroA: 'ETc = ET₀ × Kc = 6.2 × 0.85 = 5.27 mm/jour\nPar ha: 5.27 × 10 = 52.7 m³/ha/jour\nPour 1 ha: 52.7 m³/jour, hebdo: 368.9 m³\nAvec goutte (90% efficacité): 410 m³/semaine.', agroTag: 'Calcul ETc', assoc: 'Coopérative Agricole', assocHL: 'Rapport annuel interventions et travaux', assocQ: 'Donne-moi un rapport de tous les travaux et traitements effectués dans mes champs l\'année passée', assocA: '📋 Rapport Annuel Champs 2025\n\n🫒 Oliveraie Nord (0.8 ha)\n• Mar: Taille + cuivre (Mildiou)\n• Juin: Azote 120kg/ha\n• Sep: Insecticide (Mouche olive)\n• Résultat: Amélioré ✅\n\n🍇 Vignoble (0.5 ha)\n• Fév: Taille hivernale\n• Mai: Soufre (Oïdium) × 3 traitements\n• Juil: Irrigation 850m³ total', assocTag: 'Rapport Annuel', garden: 'Jardinage / Potager Maison', gardenHL: 'Quelles plantes poussent mieux ensemble?', gardenQ: 'Quels légumes planter ensemble pour une meilleure croissance dans mon potager?', gardenA: '✅ Bonnes associations:\n• Tomate + Basilic, repousse les pucerons\n• Carottes + Oignons, dissuasion mutuelle\n• Courgette + Maïs + Haricots (Trois Sœurs)\n\n❌ Éviter ensemble:\n• Tomate + Fenouil, compétition racines\n• Oignons + Pois, inhibent la croissance', gardenTag: 'Plantes Compagnes', input: 'Entreprise Agri-Input', inputHL: 'Quels produits Oli recommande pour chaque problème?', inputQ: 'Quels fongicides pour le Mildiou de la vigne? Dose et timing?', inputA: 'Mildiou (Plasmopara viticola), Préventifs + Curatifs:\n\n⚗️ Cuivrés (préventifs): Hydroxyde de cuivre 77%, 250g/100L, avant la pluie\n⚗️ Systémiques: Metalaxyl-M 4% + Mancozeb 64% WP, 250g/100L\n⚗️ Cymoxanil 45% WG, 30g/100L (curatif jusqu\'à 4h post-infection)\n\nDe 5–7 feuilles jusqu\'à fermeture de la grappe', inputTag: 'Produits & Dosages' },
    ar: { farmer: 'مزارع', farmerHL: 'إجابات في ثوانٍ، بلغتك', farmerQ: 'مسحوق أبيض على أوراق الكروم. ما هذا وماذا أفعل؟', farmerA: 'هذا هو البياض الدقيقي (Uncinula necator), مرض فطري. الدقة: 91%.\n🌿 عضوي: كبريت WP 80%، 300g/100L كل 7–10 أيام\n⚗️ كيميائي: ميكلوبوتانيل 12.5% EC، 40ml/100L\nسأتواصل معك بعد 3 أيام للتحقق من التقدم.', farmerTag: 'تشخيص + علاج', agro: 'مهندس زراعي', agroHL: 'حسابات علمية في ثوانٍ', agroQ: 'احسب ETc الكروم يوليو. ET₀ = 6.2mm/يوم، Kc = 0.85 (الإزهار)', agroA: 'ETc = ET₀ × Kc = 6.2 × 0.85 = 5.27 mm/يوم\nلكل هكتار: 5.27 × 10 = 52.7 m³/هكتار/يوم\nلـ 1 هكتار: 52.7 m³/يوم، أسبوعياً: 368.9 m³\nبالتنقيط (كفاءة 90%): 410 m³/أسبوع.', agroTag: 'حساب ETc', assoc: 'جمعية المزارعين', assocHL: 'تقرير سنوي للتدخلات والأعمال', assocQ: 'أعطني تقريراً بجميع الأعمال والعلاجات في حقولي خلال العام الماضي', assocA: '📋 التقرير السنوي للحقول 2025\n\n🫒 بستان الزيتون الشمالي (0.8 هكتار)\n• مارس: تقليم + نحاس (عفن الزغبي)\n• يونيو: تسميد نيتروجين 120kg/هكتار\n• سبتمبر: مبيد حشري (ذبابة الزيتون)\n• النتيجة: تحسن ✅\n\n🍇 كرم العنب (0.5 هكتار)\n• فبراير: تقليم شتوي\n• مايو: كبريت (البياض) × 3 رشات\n• يوليو: ري 850m³ إجمالي', assocTag: 'التقرير السنوي', garden: 'الحديقة المنزلية', gardenHL: 'أي نباتات تنمو أفضل معاً؟', gardenQ: 'أي خضروات أزرعها معاً لنمو أفضل في حديقتي؟', gardenA: '✅ تركيبات جيدة:\n• طماطم + ريحان, يطرد حشرات المن\n• جزر + بصل, حماية متبادلة\n• كوسا + ذرة + فاصوليا\n\n❌ تجنب معاً:\n• طماطم + شمر, تنافس الجذور\n• بصل + بازلاء, تثبط النمو', gardenTag: 'الزراعة المشتركة', input: 'شركة المستلزمات الزراعية', inputHL: 'أي منتجات يوصي بها أولي لكل مشكلة؟', inputQ: 'أي مبيدات فطرية لعفن الكروم الزغبي؟ الجرعة والتوقيت؟', inputA: 'عفن الكروم الزغبي (Plasmopara viticola), وقائي + علاجي:\n\n⚗️ نحاسي (وقائي): هيدروكسيد النحاس 77%، 250g/100L, قبل المطر\n⚗️ جهازي: Metalaxyl-M 4% + Mancozeb 64% WP، 250g/100L\n⚗️ Cymoxanil 45% WG، 30g/100L (علاجي حتى 4 ساعات بعد الإصابة)\n\nمن 5–7 أوراق حتى إغلاق العنقود', inputTag: 'المنتجات والجرعات' },
  };
  const t = r[lang] ?? r['en'];
  return [
    { id: 'farmer',      emoji: '🌾', label: t.farmer,  headline: t.farmerHL,  question: t.farmerQ,  answer: t.farmerA,  tag: t.farmerTag,  tagColor: 'text-amber-700 bg-amber-50 border-amber-200' },
    { id: 'agronomist',  emoji: '🔬', label: t.agro,    headline: t.agroHL,    question: t.agroQ,    answer: t.agroA,    tag: t.agroTag,    tagColor: 'text-blue-700 bg-blue-50 border-blue-200' },
    { id: 'association', emoji: '🤝', label: t.assoc,   headline: t.assocHL,   question: t.assocQ,   answer: t.assocA,   tag: t.assocTag,   tagColor: 'text-green-700 bg-green-50 border-green-200' },
    { id: 'garden',      emoji: '🌻', label: t.garden,  headline: t.gardenHL,  question: t.gardenQ,  answer: t.gardenA,  tag: t.gardenTag,  tagColor: 'text-purple-700 bg-purple-50 border-purple-200' },
    { id: 'input',       emoji: '🏭', label: t.input,   headline: t.inputHL,   question: t.inputQ,   answer: t.inputA,   tag: t.inputTag,   tagColor: 'text-slate-700 bg-slate-50 border-slate-200' },
  ];
};

type TestimonialItem = { quote: string; name: string; crop: string; initial: string };
const TESTIMONIALS = (lang: string) => {
  const map: Record<string, TestimonialItem[]> = {
    el: [
      { quote: 'Είχα στείλει φωτογραφία στον γεωπόνο μου και περίμενα 2 μέρες. Ο Oli μου έδωσε διάγνωση σε 10 δευτερόλεπτα. Ήταν ακριβώς σωστή.', name: 'Γιώργος', crop: 'Ελαιοκαλλιεργητής, Πελοπόννησος', initial: 'Γ' },
      { quote: 'Τέλος στο να μαντεύω ποιο φάρμακο να χρησιμοποιήσω. Μου δίνει ακριβώς τι να αγοράσω και σε ποια δόση.', name: 'Νίκος', crop: 'Λαχανοκαλλιεργητής, Κρήτη', initial: 'Ν' },
      { quote: 'Ρώτησα πότε να κλαδέψω τα εσπεριδοειδή μου φέτος. Σε δευτερόλεπτα είχα συγκεκριμένο εβδομαδιαίο πρόγραμμα. Ο γεωπόνος μου χρεώνει 80 ευρώ την επίσκεψη για αυτό.', name: 'Σταύρος', crop: 'Εσπεριδοειδή, Λακωνία', initial: 'Σ' },
      { quote: 'Πήγα στο αμπέλι το πρωί και είδα ύποπτα φύλλα. Έβγαλα φωτογραφία, την έστειλα στον Oli και πριν φύγω από το χωράφι είχα ήδη τη διάγνωση και τη θεραπεία.', name: 'Μαρία', crop: 'Αμπελοκαλλιεργήτρια, Νεμέα', initial: 'Μ' },
    ],
    en: [
      { quote: 'I sent a photo to my agronomist and waited 2 days. Oli gave me a diagnosis in 10 seconds. It was exactly right.', name: 'Giorgis', crop: 'Olive farmer, Peloponnese', initial: 'G' },
      { quote: 'No more guessing which product to use. It tells me exactly what to buy and at what dose.', name: 'Nikos', crop: 'Vegetable farmer, Crete', initial: 'N' },
      { quote: 'I asked when to prune my citrus trees. In seconds I had a specific week-by-week plan. My agronomist charges €80 a visit for exactly that.', name: 'Stavros', crop: 'Citrus farmer, Laconia', initial: 'S' },
      { quote: 'I spotted suspicious leaves during my morning walk through the vineyard. I took a photo, sent it to Oli, and had a full diagnosis and treatment plan before I even got back to my truck.', name: 'Maria', crop: 'Vineyard owner, Nemea', initial: 'M' },
    ],
    it: [
      { quote: 'Ho mandato una foto al mio agronomo e ho aspettato 2 giorni. Oli mi ha dato una diagnosi in 10 secondi. Era esattamente giusta.', name: 'Marco', crop: 'Olivicoltore, Puglia', initial: 'M' },
      { quote: 'Basta indovinare quale prodotto usare. Mi dice esattamente cosa comprare e a quale dose.', name: 'Lucia', crop: 'Viticoltrice, Sicilia', initial: 'L' },
      { quote: 'Ho chiesto quando potare i miei agrumi. In pochi secondi avevo un piano settimana per settimana. Il mio agronomo fa pagare €80 a visita per questo.', name: 'Antonio', crop: 'Agricoltore di agrumi, Calabria', initial: 'A' },
      { quote: 'Ho notato foglie sospette durante la mia mattinata nel vigneto. Ho scattato una foto, l\'ho inviata a Oli e avevo già diagnosi e piano di trattamento prima di tornare al furgone.', name: 'Sofia', crop: 'Viticoltrice, Toscana', initial: 'S' },
    ],
    es: [
      { quote: 'Envié una foto a mi agrónomo y esperé 2 días. Oli me dio un diagnóstico en 10 segundos. Era exactamente correcto.', name: 'Carlos', crop: 'Olivicultor, Andalucía', initial: 'C' },
      { quote: 'Se acabó adivinar qué producto usar. Me dice exactamente qué comprar y a qué dosis.', name: 'María', crop: 'Viticultora, La Rioja', initial: 'M' },
      { quote: 'Pregunté cuándo podar mis cítricos. En segundos tenía un plan semana a semana. Mi agrónomo cobra €80 por visita exactamente por eso.', name: 'José', crop: 'Agricultor de cítricos, Valencia', initial: 'J' },
      { quote: 'Vi hojas sospechosas en mi ronda matutina por el viñedo. Hice una foto, la mandé a Oli y ya tenía diagnóstico y plan de tratamiento antes de volver al coche.', name: 'Ana', crop: 'Viticultora, Castilla', initial: 'A' },
    ],
    fr: [
      { quote: "J'ai envoyé une photo à mon agronome et j'ai attendu 2 jours. Oli m'a donné un diagnostic en 10 secondes. C'était exactement juste.", name: 'Pierre', crop: 'Oléiculteur, Provence', initial: 'P' },
      { quote: 'Fini de deviner quel produit utiliser. Il me dit exactement quoi acheter et à quelle dose.', name: 'Claire', crop: 'Viticultrice, Bordeaux', initial: 'C' },
      { quote: "J'ai demandé quand tailler mes agrumes. En quelques secondes j'avais un plan semaine par semaine. Mon agronome facture €80 la visite pour ça.", name: 'Jean', crop: 'Agrumiculteur, Corse', initial: 'J' },
      { quote: "J'ai repéré des feuilles suspectes lors de ma tournée matinale dans le vignoble. J'ai pris une photo, l'ai envoyée à Oli et j'avais déjà un diagnostic et un plan de traitement avant de rentrer à la voiture.", name: 'Sophie', crop: 'Viticultrice, Languedoc', initial: 'S' },
    ],
    ar: [
      { quote: 'أرسلت صورة إلى زراعي وانتظرت يومين. أعطاني أولي تشخيصاً في 10 ثوانٍ. كان صحيحاً تماماً.', name: 'أحمد', crop: 'مزارع زيتون، المغرب', initial: 'أ' },
      { quote: 'لا مزيد من التخمين حول أي منتج أستخدم. يخبرني بالضبط ما يجب شراؤه وبأي جرعة.', name: 'فاطمة', crop: 'مزارعة كروم، تونس', initial: 'ف' },
      { quote: 'سألت متى أقلم أشجار الحمضيات. في ثوانٍ كان لدي خطة أسبوعية محددة. يتقاضى زراعي €80 للزيارة مقابل ذلك بالضبط.', name: 'محمد', crop: 'مزارع حمضيات، الجزائر', initial: 'م' },
      { quote: 'لاحظت أوراقاً مريبة خلال جولتي الصباحية في الكرم. التقطت صورة وأرسلتها لأولي، وقبل أن أعود للسيارة كان لديّ تشخيص كامل وخطة علاج.', name: 'ليلى', crop: 'مزارعة كروم، المغرب', initial: 'ل' },
    ],
  };
  return map[lang] ?? map.en;
};

// ── Demo data ─────────────────────────────────────────────────────────────────

const DEMO_DISEASE = (lang: string) => {
  const map: Record<string, { question: string; disease: string; confidence: number; organic: string; chemical: string; followup: string }> = {
    el: { question: 'Τα φύλλα της ντομάτας έχουν καστανούς κύκλους με κίτρινο περίγραμμα. Τι έχει;', disease: 'Εναλτερίωση Ντομάτας', confidence: 92, organic: 'Χαλκούχο μυκητοκτόνο (Bordeaux mixture), 200g/100L νερό. Εφαρμογή κάθε 7 μέρες.', chemical: 'Mancozeb 80% WP, 250g/100L νερό. Εφαρμογή κάθε 10 με 14 μέρες.', followup: 'Θα σε ρωτήσω για να δω πώς πάει η θεραπεία.' },
    en: { question: 'My tomato leaves have brown rings with a yellow border. What is wrong?', disease: 'Early Blight (Alternaria)', confidence: 92, organic: 'Copper-based fungicide (Bordeaux mixture), 200g/100L water. Apply every 7 days.', chemical: 'Mancozeb 80% WP, 250g/100L water. Apply every 10 to 14 days.', followup: "I'll follow up to see how the treatment is going." },
    it: { question: 'Le foglie del pomodoro hanno anelli marroni con bordo giallo. Cosa c\'è?', disease: 'Alternariosi del Pomodoro', confidence: 92, organic: 'Fungicida rameico (miscela bordolese), 200g/100L acqua. Applicare ogni 7 giorni.', chemical: 'Mancozeb 80% WP, 250g/100L acqua. Applicare ogni 10-14 giorni.', followup: 'Ti chiederò come procede il trattamento.' },
    es: { question: 'Las hojas de tomate tienen anillos marrones con borde amarillo. ¿Qué tiene?', disease: 'Tizón Temprano (Alternaria)', confidence: 92, organic: 'Fungicida cúprico (caldo bordelés), 200g/100L agua. Aplicar cada 7 días.', chemical: 'Mancozeb 80% WP, 250g/100L agua. Aplicar cada 10-14 días.', followup: 'Te haré seguimiento para ver cómo va el tratamiento.' },
    fr: { question: 'Les feuilles de tomate ont des anneaux bruns avec une bordure jaune. Qu\'est-ce que c\'est ?', disease: 'Alternariose de la Tomate', confidence: 92, organic: 'Fongicide cuivrique (bouillie bordelaise), 200g/100L eau. Appliquer toutes les 7 jours.', chemical: 'Mancozeb 80% WP, 250g/100L eau. Appliquer tous les 10 à 14 jours.', followup: 'Je ferai un suivi pour voir comment évolue le traitement.' },
    ar: { question: 'أوراق الطماطم بها حلقات بنية بحافة صفراء. ما المشكلة؟', disease: 'اللفحة المبكرة (ألترناريا)', confidence: 92, organic: 'مبيد فطري نحاسي (مرق بوردو)، 200 جرام/100 لتر ماء. تطبيق كل 7 أيام.', chemical: 'مانكوزب 80% WP، 250 جرام/100 لتر ماء. تطبيق كل 10-14 يوماً.', followup: 'سأتابع معك لأرى كيف يسير العلاج.' },
  };
  return map[lang] ?? map.en;
};

const DEMO_PLANNING = (lang: string, imperial: boolean) => {
  type PlanningData = { question: string; summary: string; summaryNote: string; rows: { label: string; value: string; note: string }[]; followup: string };
  const map: Record<string, PlanningData> = {
    el: {
      question: 'Έχω 10 στρέμματα αγρό. Πόσες λεμονιές να φυτέψω και με τι αποστάσεις;',
      summary: '400 λεμονιές', summaryNote: 'Συνιστώμενη φύτευση (5×5μ)',
      rows: [
        { label: 'Εντατική (4×5μ)',   value: '500 δέντρα', note: 'Μέγιστη παραγωγή, χρειάζεται μηχανική κλάδευση' },
        { label: 'Τυπική (5×5μ) ✓',  value: '400 δέντρα', note: 'Καλός αερισμός, εύκολη πρόσβαση μηχανημάτων' },
        { label: 'Παραδοσιακή (6×6μ)', value: '277 δέντρα', note: 'Μεγαλύτερα δέντρα, λιγότερα κόστος φυτοπροστασίας' },
      ],
      followup: 'Θέλεις να σου βοηθήσω με το πότισμα, τη λίπανση ή τη στήριξη για τα πρώτα χρόνια;',
    },
    en: {
      question: imperial ? 'I have a 2.5-acre field. How many lemon trees should I plant and what spacing do I need?' : 'I have a 1-hectare field. How many lemon trees should I plant and what spacing do I need?',
      summary: '400 lemon trees', summaryNote: 'Recommended planting (5m × 5m)',
      rows: [
        { label: 'Intensive (4m × 5m)',   value: '500 trees', note: 'Maximum yield, requires mechanical pruning' },
        { label: 'Standard (5m × 5m) ✓', value: '400 trees', note: 'Good airflow, easy machinery access' },
        { label: 'Traditional (6m × 6m)', value: '277 trees', note: 'Larger trees, lower crop protection costs' },
      ],
      followup: 'Want me to help you plan irrigation, fertilisation, or staking for the first few years?',
    },
    it: {
      question: 'Ho 1 ettaro di campo. Quanti limoni dovrei piantare e con quale spaziatura?',
      summary: '400 alberi di limone', summaryNote: 'Piantagione consigliata (5m × 5m)',
      rows: [
        { label: 'Intensiva (4m × 5m)',    value: '500 alberi', note: 'Resa massima, richiede potatura meccanica' },
        { label: 'Standard (5m × 5m) ✓',  value: '400 alberi', note: 'Buona aerazione, facile accesso ai macchinari' },
        { label: 'Tradizionale (6m × 6m)', value: '277 alberi', note: 'Alberi più grandi, minori costi di protezione' },
      ],
      followup: 'Vuoi che ti aiuti a pianificare irrigazione, fertilizzazione o tutoraggio per i primi anni?',
    },
    es: {
      question: 'Tengo 1 hectárea de campo. ¿Cuántos limoneros debo plantar y con qué espaciado?',
      summary: '400 limoneros', summaryNote: 'Plantación recomendada (5m × 5m)',
      rows: [
        { label: 'Intensivo (4m × 5m)',     value: '500 árboles', note: 'Rendimiento máximo, requiere poda mecánica' },
        { label: 'Estándar (5m × 5m) ✓',   value: '400 árboles', note: 'Buena ventilación, fácil acceso a maquinaria' },
        { label: 'Tradicional (6m × 6m)',   value: '277 árboles', note: 'Árboles más grandes, menores costes de protección' },
      ],
      followup: '¿Quieres que te ayude a planificar el riego, la fertilización o el tutoraje para los primeros años?',
    },
    fr: {
      question: "J'ai 1 hectare de champ. Combien de citronniers planter et avec quel espacement ?",
      summary: '400 citronniers', summaryNote: 'Plantation recommandée (5m × 5m)',
      rows: [
        { label: 'Intensive (4m × 5m)',      value: '500 arbres', note: 'Rendement maximum, nécessite une taille mécanique' },
        { label: 'Standard (5m × 5m) ✓',    value: '400 arbres', note: 'Bonne aération, accès facile aux machines' },
        { label: 'Traditionnelle (6m × 6m)', value: '277 arbres', note: 'Arbres plus grands, coûts de protection réduits' },
      ],
      followup: "Voulez-vous que je vous aide à planifier l'irrigation, la fertilisation ou le tuteurage pour les premières années ?",
    },
    ar: {
      question: 'لدي حقل بمساحة هكتار واحد. كم شجرة ليمون يجب أن أزرع وما المسافة المناسبة؟',
      summary: '400 شجرة ليمون', summaryNote: 'الزراعة الموصى بها (5م × 5م)',
      rows: [
        { label: 'مكثف (4م × 5م)',      value: '500 شجرة', note: 'أقصى إنتاج، يتطلب تقليماً آلياً' },
        { label: 'قياسي (5م × 5م) ✓',  value: '400 شجرة', note: 'تهوية جيدة، وصول سهل للمعدات' },
        { label: 'تقليدي (6م × 6م)',    value: '277 شجرة', note: 'أشجار أكبر، تكاليف حماية أقل' },
      ],
      followup: 'هل تريد مساعدة في تخطيط الري والتسميد أو الدعم للسنوات الأولى؟',
    },
  };
  return map[lang] ?? map.en;
};

// ── Example questions ─────────────────────────────────────────────────────────

const EXAMPLE_QUESTIONS = (lang: string, imperial: boolean) => {
  type EQSection = { category: string; questions: string[] };
  const map: Record<string, EQSection[]> = {
    el: [
      { category: '🔬 Διάγνωση ασθενειών', questions: ['Λευκή σκόνη στα φύλλα του αμπελιού, είναι Ωίδιο ή Περονόσπορος;', 'Μικρές τρύπες στον κορμό της μηλιάς μου. Τι έντομο είναι;', 'Κίτρινα φύλλα με μαύρα σπόρια στην κάτω επιφάνεια ελιάς'] },
      { category: '🧮 Επιστημονικοί υπολογισμοί', questions: ['Υπολόγισέ μου την εξατμισοδιαπνοή (ETc) στο αμπέλι μου για τον Ιούλιο με ET₀ = 6mm/ημέρα', 'Ποια φυτά πηγαίνουν μαζί για καλύτερο αποτέλεσμα στον λαχανόκηπό μου;', 'Φτιάξε μου αρχείο με όλες τις παρεμβάσεις και εργασίες του περασμένου χρόνου στα χωράφια μου'] },
      { category: '📐 Σχεδιασμός φύτευσης', questions: ['Πόσες λεμονιές χωράνε σε 5 στρέμματα με σωστές αποστάσεις;', 'Ποιες καλλιέργειες να φυτέψω μετά την ντομάτα για εναλλαγή;', 'Είναι αργά να φυτέψω καρπούζια τον Απρίλιο στην Πελοπόννησο;'] },
      { category: '💧 Άρδευση και θρέψη', questions: ['Πόσα m³ νερό χρειάζεται το σταγονικό πότισμα σε 3 στρέμματα ελιάς τον Αύγουστο;', 'Υπολόγισέ μου δόση αζώτου για ντομάτα στόχου παραγωγής 8 τόνων/στρέμμα', 'Είναι συμβατά χαλκούχο μυκητοκτόνο και λίπασμα φύλλου στο ίδιο ψεκαστικό;'] },
      { category: '🌱 Αναστήλωση και εδαφολογία', questions: ['Εγκαταλελειμμένος ελαιώνας 5 στρεμμάτων. Από πού αρχίζω;', 'Πώς βελτιώνω αργιλώδες έδαφος με κακή στράγγιση;', 'Τι εδαφολογική ανάλυση να κάνω πριν φυτέψω αμπέλι;'] },
    ],
    en: [
      { category: '🔬 Disease diagnosis', questions: ['White powder on vine leaves, is it Powdery Mildew (Oidium) or Downy Mildew (Peronospora)?', 'Small holes in my apple tree trunk. What insect is this?', 'Yellow olive leaves with black spots on the underside'] },
      { category: '🧮 Scientific calculations', questions: [imperial ? 'Calculate ETc for my vineyard in July with ET₀ = 0.24 in/day' : 'Calculate ETc water requirements for my vineyard in July with ET₀ = 6mm/day', 'Which plants grow best together for a productive kitchen garden?', 'Give me a full report of all treatments and field work done in the past year'] },
      { category: '📐 Planting planning', questions: [imperial ? 'How many lemon trees fit in a 3-acre field with proper spacing?' : 'How many lemon trees fit in a 1-hectare field with proper spacing?', 'Best crops to plant after tomatoes for rotation', 'Is April too late to plant watermelons in southern regions?'] },
      { category: '💧 Irrigation and nutrition', questions: [imperial ? 'How many gallons per day for drip irrigation on a 2-acre olive grove in August?' : 'How many m³ of water for drip irrigation on 3,000m² of olives in August?', imperial ? 'Calculate nitrogen dose for tomatoes targeting 14,000 lb/acre yield' : 'Calculate nitrogen dose for tomatoes targeting 8 tonnes/strema yield', 'Can I mix copper fungicide and foliar fertiliser in the same sprayer tank?'] },
      { category: '🌱 Rehabilitation and soil', questions: [imperial ? 'I have an abandoned 5-acre olive grove. Where do I start?' : 'I have an abandoned 2-hectare olive grove. Where do I start?', 'How do I improve clay soil with poor drainage?', 'What soil analysis should I run before planting a new vineyard?'] },
    ],
    it: [
      { category: '🔬 Diagnosi delle malattie', questions: ['Polvere bianca sulle foglie della vite, è Oidio o Peronospora?', 'Piccoli fori nel tronco del mio melo. Che insetto è?', 'Foglie di olivo gialle con macchie nere nella pagina inferiore'] },
      { category: '🧮 Calcoli scientifici', questions: ['Calcola l\'ETc per il mio vigneto a luglio con ET₀ = 6mm/giorno', 'Quali piante crescono meglio insieme in un orto?', 'Dammi un rapporto completo di tutti i trattamenti e lavori in campo dell\'anno scorso'] },
      { category: '📐 Pianificazione della coltura', questions: ['Quanti limoni entrano in 1 ettaro con la giusta spaziatura?', 'Migliori colture da piantare dopo i pomodori per la rotazione', 'È troppo tardi piantare angurie ad aprile nel sud Italia?'] },
      { category: '💧 Irrigazione e nutrizione', questions: ['Quanti m³ di acqua per l\'irrigazione a goccia su 3.000m² di olivi ad agosto?', 'Calcola la dose di azoto per pomodori con obiettivo 8 t/ha', 'Posso mescolare fungicida rameico e fertilizzante fogliare nello stesso serbatoio?'] },
      { category: '🌱 Recupero e pedologia', questions: ['Ho un oliveto abbandonato di 2 ettari. Da dove comincio?', 'Come migliorare un terreno argilloso con scarso drenaggio?', 'Quale analisi del suolo fare prima di impiantare un vigneto?'] },
    ],
    es: [
      { category: '🔬 Diagnóstico de enfermedades', questions: ['Polvo blanco en hojas de vid, ¿es Oidio o Mildiu?', 'Pequeños agujeros en el tronco de mi manzano. ¿Qué insecto es?', 'Hojas de olivo amarillas con manchas negras en el envés'] },
      { category: '🧮 Cálculos científicos', questions: ['Calcula la ETc para mi viñedo en julio con ET₀ = 6mm/día', '¿Qué plantas crecen mejor juntas en un huerto productivo?', 'Dame un informe completo de todos los tratamientos y trabajos del campo del año pasado'] },
      { category: '📐 Planificación de cultivos', questions: ['¿Cuántos limoneros caben en 1 hectárea con la distancia correcta?', 'Mejores cultivos para plantar después de los tomates en rotación', '¿Es tarde plantar sandías en abril en el sur?'] },
      { category: '💧 Riego y nutrición', questions: ['¿Cuántos m³ de agua para riego por goteo en 3.000m² de olivos en agosto?', 'Calcula la dosis de nitrógeno para tomates con objetivo 8 t/ha', '¿Puedo mezclar fungicida cúprico y fertilizante foliar en el mismo depósito?'] },
      { category: '🌱 Rehabilitación y edafología', questions: ['Tengo un olivar abandonado de 2 hectáreas. ¿Por dónde empiezo?', '¿Cómo mejorar un suelo arcilloso con mal drenaje?', '¿Qué análisis de suelo debo hacer antes de plantar un viñedo?'] },
    ],
    fr: [
      { category: '🔬 Diagnostic des maladies', questions: ['Poudre blanche sur les feuilles de vigne, est-ce l\'Oïdium ou le Mildiou ?', 'Petits trous dans le tronc de mon pommier. Quel insecte est-ce ?', 'Feuilles d\'olivier jaunes avec des taches noires sur la face inférieure'] },
      { category: '🧮 Calculs scientifiques', questions: ['Calculer l\'ETc pour mon vignoble en juillet avec ET₀ = 6mm/jour', 'Quelles plantes poussent le mieux ensemble dans un potager productif ?', 'Donne-moi un rapport complet de tous les traitements et travaux réalisés l\'an dernier'] },
      { category: '📐 Planification des cultures', questions: ['Combien de citronniers dans 1 hectare avec le bon espacement ?', 'Meilleures cultures à planter après les tomates en rotation', 'Est-il trop tard pour planter des pastèques en avril dans le Sud ?'] },
      { category: '💧 Irrigation et nutrition', questions: ['Combien de m³ d\'eau pour l\'irrigation goutte-à-goutte sur 3 000 m² d\'oliviers en août ?', 'Calculer la dose d\'azote pour des tomates avec objectif 8 t/ha', 'Puis-je mélanger fongicide cuivrique et engrais foliaire dans le même cuve ?'] },
      { category: '🌱 Réhabilitation et pédologie', questions: ["J'ai une oliveraie abandonnée de 2 hectares. Par où commencer ?", 'Comment améliorer un sol argileux avec un mauvais drainage ?', 'Quelle analyse de sol faire avant de planter un vignoble ?'] },
    ],
    ar: [
      { category: '🔬 تشخيص الأمراض', questions: ['مسحوق أبيض على أوراق الكرم, هل هو البياض الدقيقي أم العفن الزغبي؟', 'ثقوب صغيرة في جذع شجرة التفاح. ما هذه الحشرة؟', 'أوراق زيتون صفراء مع بقع سوداء في الوجه السفلي'] },
      { category: '🧮 الحسابات العلمية', questions: ['احسب ETc لكرمتي في يوليو مع ET₀ = 6mm/يوم', 'ما النباتات التي تنمو معاً بشكل أفضل في حديقة إنتاجية؟', 'أعطني تقريراً كاملاً عن جميع المعالجات والأعمال الميدانية للعام الماضي'] },
      { category: '📐 تخطيط الزراعة', questions: ['كم شجرة ليمون تناسب هكتاراً واحداً بالمسافة الصحيحة؟', 'أفضل المحاصيل لزراعتها بعد الطماطم في التناوب', 'هل أبريل متأخر لزراعة البطيخ في المناطق الجنوبية؟'] },
      { category: '💧 الري والتغذية', questions: ['كم متراً مكعباً من الماء للري بالتنقيط على 3000 م² من الزيتون في أغسطس؟', 'احسب جرعة النيتروجين للطماطم بهدف إنتاج 8 طن/هكتار', 'هل يمكنني خلط مبيد فطري نحاسي وسماد ورقي في نفس الخزان؟'] },
      { category: '🌱 إعادة التأهيل وعلم التربة', questions: ['لدي بستان زيتون مهجور بمساحة 2 هكتار. من أين أبدأ؟', 'كيف أحسن تربة طينية ذات صرف ضعيف؟', 'ما تحليل التربة الذي يجب إجراؤه قبل زراعة كرم؟'] },
    ],
  };
  return map[lang] ?? map.en;
};

// ── Rotating placeholders ─────────────────────────────────────────────────────

const ROTATING_QUESTIONS = (lang: string, imperial: boolean): string[] => {
  const map: Record<string, string[]> = {
    el: ['Υπολόγισέ μου την εξατμισοδιαπνοή (ETc) για το αμπέλι μου τον Ιούλιο', 'Λευκή σκόνη στα φύλλα, Ωίδιο ή Περονόσπορος;', 'Ποια φυτά πηγαίνουν μαζί στον λαχανόκηπό μου;', 'Φτιάξε μου αρχείο με τις εργασίες των χωραφιών μου πέρσι', 'Πόσα m³ νερό χρειάζεται η ελιά τον Αύγουστο;', 'Υπολόγισέ μου δόση αζώτου για ντομάτα 8 τόνων/στρέμμα'],
    en: [imperial ? 'How do I set up drip irrigation for strawberries?' : 'How do I set up drip irrigation for strawberries?', imperial ? 'I have 2.5 acres. How many lemon trees should I plant?' : 'I have 1 hectare. How many lemon trees should I plant?', 'What equipment do I need for an abandoned olive grove?', 'My tomato leaves have brown rings. What is wrong?', 'When and how should I prune grapevines for better yield?', 'What crops should I plant after tomatoes?'],
    it: ['Come configuro l\'irrigazione a goccia per le fragole?', 'Ho 1 ettaro. Quanti limoni dovrei piantare?', 'Di quale attrezzatura ho bisogno per un oliveto abbandonato?', 'Le foglie di pomodoro hanno anelli marroni. Cosa c\'è che non va?', 'Quando e come potare le viti per una resa migliore?', 'Quali colture piantare dopo i pomodori?'],
    es: ['¿Cómo configuro el riego por goteo para fresas?', 'Tengo 1 hectárea. ¿Cuántos limoneros debería plantar?', '¿Qué equipo necesito para un olivar abandonado?', 'Las hojas de tomate tienen anillos marrones. ¿Qué está mal?', '¿Cuándo y cómo podar las vides para mayor rendimiento?', '¿Qué cultivos plantar después de los tomates?'],
    fr: ["Comment configurer l'irrigation goutte-à-goutte pour les fraises ?", "J'ai 1 hectare. Combien de citronniers planter ?", "De quel équipement ai-je besoin pour une oliveraie abandonnée ?", "Les feuilles de tomate ont des anneaux bruns. Qu'est-ce qui ne va pas ?", 'Quand et comment tailler les vignes pour un meilleur rendement ?', 'Quelles cultures planter après les tomates ?'],
    ar: ['كيف أقوم بإعداد الري بالتنقيط للفراولة؟', 'لدي هكتار واحد. كم شجرة ليمون يجب أن أزرع؟', 'ما المعدات التي أحتاجها لبستان زيتون مهجور؟', 'أوراق الطماطم بها حلقات بنية. ما المشكلة؟', 'متى وكيف أقلم الكروم لإنتاج أفضل؟', 'ما المحاصيل التي أزرعها بعد الطماطم؟'],
  };
  return map[lang] ?? map.en;
};

// ── Phone Mockup (animated, cycles through 3 demo conversations) ─────────────

function PhoneMockup({ lang }: { lang: string }) {
  const lt = LANDING_DICT[lang as keyof typeof LANDING_DICT] ?? LANDING_DICT.en;
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
    // aria-hidden: this is a decorative animated mockup, not real UI content
    <div aria-hidden="true" className="relative mx-auto w-[220px] sm:w-[240px]">
      {/* Phone frame, box-shadow avoids filter repaint on animation */}
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
          {/* Messages, fades in/out on demo change */}
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
                        <p className="text-[8px] font-bold text-emerald-700 mb-1">{lt.organic}</p>
                        <p className="text-[8px] text-[#3a4035] leading-tight">{demo.organic}</p>
                      </div>
                      <div className="bg-white rounded-lg border border-[#e8e8e3] px-2 py-1.5">
                        <p className="text-[8px] font-bold text-blue-700 mb-1">{lt.chemical}</p>
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
                      <span className="text-[8px] text-[#606659]">{lt.agronomicData}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          {/* Demo indicators, use transform:scaleX for GPU-composited animation */}
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
            <span className="flex-1 text-[9px] text-[#3a4035]">{lt.askOli}</span>
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
  const lt = LANDING_DICT[lang as keyof typeof LANDING_DICT] ?? LANDING_DICT.en;
  const roles = useMemo(() => ROLES(lang), [lang]);
  const [activeId, setActiveId] = useState(roles[0].id);
  const active = roles.find(r => r.id === activeId) ?? roles[0];

  return (
    <div>
      {/* Role tabs */}
      <div className="flex flex-wrap justify-center gap-2 mb-8">
        {roles.map(r => (
          <button
            type="button"
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
            {lt.tryAs(active.label)}
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
  const lt = LANDING_DICT[lang as keyof typeof LANDING_DICT] ?? LANDING_DICT.en;
  const navigate = useNavigate();
  const [chatInput, setChatInput]         = useState('');
  const [demoTab, setDemoTab]             = useState<'disease' | 'planning'>('disease');
  const [suggestionIdx, setSuggestionIdx] = useState(0);
  const [suggestionVisible, setSuggestionVisible] = useState(true);
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'annual'>('annual');
  const imperial = useMemo(() => detectImperial(), []);

  // Fix mobile overscroll background, the app is dark-themed (#0D1117) but the
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
  const heroFormRef = useRef<HTMLFormElement>(null);

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
    rec.lang = lt.speechLang;
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
      alert(lt.invalidFile);
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
    document.title = lt.docTitle;
    setMeta('name', 'description', lt.metaDesc);
    setMeta('property', 'og:title', lt.ogTitle);
    setMeta('property', 'og:locale', lt.ogLocale);
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
          const q = text || lt.analyzePhoto;
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
            <OliLogo size={32} bg="#ffffff" />
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
              {isLoggedIn ? lt.openApp : lt.tryFree}
            </Link>
          </div>
        </div>
      </nav>

      {/* ── MAIN CONTENT ── */}
      <main>

      {/* ── HERO ── */}
      <section className="relative pt-20 pb-12 bg-[#faf9f4] overflow-hidden">
        {/* Faded leaf decorations */}
        <svg aria-hidden="true" className="pointer-events-none absolute -top-8 -right-12 w-[340px] opacity-[0.045] text-[#194121]" viewBox="0 0 200 200" fill="currentColor">
          <path d="M100 10 C60 10 10 50 10 100 C10 150 60 190 100 190 C140 190 190 150 190 100 C190 50 140 10 100 10 Z M100 30 C130 30 170 60 170 100 C170 140 130 170 100 170 L100 30 Z" />
        </svg>
        <svg aria-hidden="true" className="pointer-events-none absolute -bottom-16 -left-16 w-[420px] opacity-[0.04] text-[#194121] rotate-[35deg]" viewBox="0 0 200 200" fill="currentColor">
          <path d="M100 5 C55 5 5 50 5 100 C5 155 55 195 100 195 C145 195 195 155 195 100 C195 50 145 5 100 5 Z M100 25 C135 25 175 60 175 100 C175 140 135 175 100 175 L100 25 Z" />
        </svg>
        <svg aria-hidden="true" className="pointer-events-none absolute top-1/3 right-1/4 w-[180px] opacity-[0.03] text-[#194121] -rotate-[20deg]" viewBox="0 0 200 200" fill="currentColor">
          <ellipse cx="100" cy="100" rx="90" ry="50" />
          <line x1="100" y1="50" x2="100" y2="150" stroke="currentColor" strokeWidth="4" />
          <line x1="100" y1="80" x2="70" y2="100" stroke="currentColor" strokeWidth="2.5" />
          <line x1="100" y1="100" x2="130" y2="85" stroke="currentColor" strokeWidth="2.5" />
          <line x1="100" y1="115" x2="68" y2="130" stroke="currentColor" strokeWidth="2" />
        </svg>
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col lg:flex-row items-center gap-10 lg:gap-16">

            {/* Left: copy + input */}
            <div className="flex-1 text-center lg:text-left">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-[#194121]/10 px-3 py-1 text-xs font-semibold text-[#194121] mb-5">
                <span>🌿</span>
                {lt.heroBadge}
              </div>

              <h1
                className="text-4xl sm:text-5xl font-bold leading-[1.1] mb-5 tracking-tight"
                style={{ fontFamily: "'Noto Serif', serif", color: '#194121' }}>
                {lt.heroH1[0]}<br />{lt.heroH1[1]}
              </h1>

              <p className="text-base md:text-lg text-[#5a6053] mb-8 max-w-md mx-auto lg:mx-0 leading-relaxed">
                {lt.heroSubtitle}
              </p>

              {/* Chat input */}
              <form ref={heroFormRef} onSubmit={handleChatSubmit} className="max-w-xl mx-auto lg:mx-0 mb-3">
                {/* Photo preview */}
                {heroPhoto && (
                  <div className="flex items-center gap-2 mb-2 px-1">
                    <div className="relative inline-block">
                      <img src={heroPhoto.previewUrl} alt="attachment preview" className="h-14 w-14 rounded-xl object-cover border border-[#deded8]" />
                      <button
                        type="button"
                        onClick={removeHeroPhoto}
                        className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#194121] text-white shadow"
                        aria-label={lt.removePhoto}>
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                    <span className="text-xs text-[#606659]">{lt.photoAttached}</span>
                  </div>
                )}

                <div
                  className="flex items-start gap-1 rounded-2xl bg-white border border-[#deded8] focus-within:border-[#194121] focus-within:ring-2 focus-within:ring-[#194121]/15 transition-all px-3 py-2"
                  style={{ boxShadow: '0 4px 24px rgba(25,65,33,0.09)' }}>

                  {/* Photo button */}
                  <button
                    type="button"
                    onClick={() => heroFileInputRef.current?.click()}
                    aria-label={lt.uploadPhoto}
                    className="flex-shrink-0 self-start flex h-11 w-11 items-center justify-center rounded-xl text-[#606659] hover:text-[#194121] hover:bg-[#194121]/8 transition-colors">
                    <Camera className="h-5 w-5" />
                  </button>

                  {/* Voice button */}
                  {recognitionAvailable && (
                    <button
                      type="button"
                      onClick={toggleListening}
                      aria-label={isListening ? lt.stopRecording : lt.speak}
                      className={`flex-shrink-0 self-start flex h-11 w-11 items-center justify-center rounded-xl transition-colors ${isListening ? 'text-red-500 animate-pulse bg-red-500/10' : 'text-[#606659] hover:text-[#194121] hover:bg-[#194121]/8'}`}>
                      <Mic className="h-5 w-5" />
                    </button>
                  )}

                  {/* Text area */}
                  <textarea
                    rows={2}
                    value={isListening ? lt.listening : chatInput}
                    onChange={e => !isListening && setChatInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        if (chatInput.trim() || heroPhoto) heroFormRef.current?.requestSubmit();
                      }
                    }}
                    aria-label={lt.send}
                    placeholder={`${lt.heroPlaceholder}\n${lt.heroPlaceholderHint}`}
                    className="flex-1 min-w-0 bg-transparent text-[15px] text-[#1b1c19] placeholder:text-[#9a9b93] focus:outline-none focus-visible:ring-0 py-2.5 resize-none leading-snug"
                    readOnly={isListening}
                  />

                  {/* Send button */}
                  <button
                    type="submit"
                    disabled={!chatInput.trim() && !heroPhoto}
                    aria-label={lt.send}
                    className="flex-shrink-0 self-end flex h-11 w-11 items-center justify-center rounded-xl text-white transition-all disabled:opacity-30"
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
                  {lt.noSignup}
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
          <p className="mt-5 text-center text-xs text-[#9a9b93]">
            {lt.statsFree}
          </p>
        </div>
      </section>

      {/* ── DEMO WIDGET ── */}
      <section className="py-16 bg-[#faf9f4]">
        <div className="max-w-2xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-8">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#4a6b50] mb-2">
              {lt.demoLabel}
            </p>
            <p className="text-sm text-[#606659]">
              {lt.demoSubtitle}
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
                  {lt.tabDiagnosis}
                </button>
                <button
                  onClick={() => setDemoTab('planning')}
                  className={`text-xs font-semibold px-2.5 sm:px-3 py-2.5 min-h-[44px] rounded-full transition-all flex items-center ${demoTab === 'planning' ? 'bg-white text-[#194121] shadow-sm' : 'text-[#606659] hover:text-[#194121]'}`}>
                  {lt.tabPlanning}
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
                          <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">{demoDisease.confidence}% {lt.confidence}</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div className="bg-white rounded-xl border border-[#e8e8e3] px-4 py-3">
                          <p className="text-xs font-bold uppercase tracking-wider text-emerald-700 mb-1.5">{lt.organic}</p>
                          <p className="text-xs text-[#3a4035] leading-relaxed">{demoDisease.organic}</p>
                        </div>
                        <div className="bg-white rounded-xl border border-[#e8e8e3] px-4 py-3">
                          <p className="text-xs font-bold uppercase tracking-wider text-blue-700 mb-1.5">{lt.chemical}</p>
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
              {lt.howLabel}
            </p>
            <h2 className="text-2xl font-bold text-[#1b1c19]" style={{ fontFamily: "'Noto Serif', serif" }}>
              {lt.howTitle}
            </h2>
          </div>
          {/* Staggered alternating layout, avoids the symmetric 3-column grid */}
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
                      {/* Micro-preview card, shown on all screen sizes */}
                      {step.preview === 'ask' && <StepPreviewAsk lang={lang} />}
                      {step.preview === 'answer' && <StepPreviewAnswer lang={lang} />}
                      {step.preview === 'followup' && <StepPreviewFollowup lang={lang} />}
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
              {lt.rolesLabel}
            </p>
            <h2 className="text-2xl font-bold text-[#1b1c19] mb-1" style={{ fontFamily: "'Noto Serif', serif" }}>
              {lt.rolesTitle}
            </h2>
            <p className="text-sm text-[#606659]">
              {lt.rolesInstruction}
            </p>
          </div>
          <RoleShowcase lang={lang} onAsk={sendQuestion} />
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section className="py-16 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <h2 className="sr-only">{lt.featuresHeading}</h2>
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

      {/* ── TESTIMONIALS, dark section to break uniform rhythm ── */}
      <section className="py-16 bg-[#0f2418]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <p className="text-center text-xs font-semibold uppercase tracking-widest text-[#6dbf7e] mb-10">
            {lt.testimonialsLabel}
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
          <div className="text-center mb-8">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#4a6b50] mb-2">
              {lt.pricingLabel}
            </p>
            <h2 className="text-2xl font-bold text-[#1b1c19] mb-1" style={{ fontFamily: "'Noto Serif', serif" }}>
              {lt.pricingTitle}
            </h2>
            <p className="text-sm text-[#606659]">
              {lt.pricingSubtitle}
            </p>
          </div>

          {/* Billing toggle */}
          <div className="flex items-center justify-center mb-8">
            <div className="flex items-center gap-1 bg-[#f0f0eb] rounded-full p-1">
              <button
                onClick={() => setBillingPeriod('monthly')}
                className={[
                  'px-4 py-1.5 rounded-full text-sm font-medium transition-all',
                  billingPeriod === 'monthly'
                    ? 'bg-white text-[#1b1c19] shadow-sm'
                    : 'text-[#606659] hover:text-[#1b1c19]',
                ].join(' ')}
              >
                {lt.billingMonthly}
              </button>
              <button
                onClick={() => setBillingPeriod('annual')}
                className={[
                  'px-4 py-1.5 rounded-full text-sm font-medium transition-all',
                  billingPeriod === 'annual'
                    ? 'bg-white text-[#1b1c19] shadow-sm'
                    : 'text-[#606659] hover:text-[#1b1c19]',
                ].join(' ')}
              >
                {lt.billingAnnual}
                {billingPeriod !== 'annual' && (
                  <span className="ml-1.5 text-[10px] font-semibold text-[#4a6b50] bg-[#e0f0e0] px-1.5 py-0.5 rounded-full">-18%</span>
                )}
              </button>
            </div>
          </div>

          {/* Row 1: Starter + Grower (individual users) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-5">
            {/* Starter */}
            <div className="flex flex-col rounded-2xl border border-[#e8e8e3] bg-white p-6" style={{ boxShadow: '0 2px 12px rgba(27,28,25,0.04)' }}>
              <p className="text-xs font-bold uppercase tracking-wider text-[#606659] mb-1">{lt.freeName}</p>
              <div className="flex items-baseline gap-1 mb-1">
                <span className="text-3xl font-bold text-[#1b1c19]" style={{ fontFamily: "'Noto Serif', serif" }}>€0</span>
                <span className="text-sm text-[#606659]">{lt.perMonth}</span>
              </div>
              <p className="text-xs text-[#606659] mb-1">{lt.noCreditCard}</p>
              <p className="text-xs text-[#4a6b50] font-medium mb-5 italic">{lt.freeTagline}</p>
              <ul className="flex-1 space-y-2.5 mb-6">
                {lt.freeFeatures.map((item, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-[#3a4035]">
                    <Check className="w-4 h-4 text-[#194121] flex-shrink-0" />{item}
                  </li>
                ))}
              </ul>
              <Link to="/auth" className="block w-full text-center py-3 rounded-full text-sm font-semibold text-[#194121] border-2 border-[#194121] hover:bg-[#194121] hover:text-white transition-all">
                {lt.getStartedFree}
              </Link>
            </div>

            {/* Grower */}
            <div className="flex flex-col rounded-2xl p-6 relative overflow-hidden text-white"
              style={{ background: 'linear-gradient(135deg, #194121 0%, #2d5535 100%)', boxShadow: '0 8px 32px rgba(25,65,33,0.25)' }}>
              <p className="text-xs font-bold uppercase tracking-wider text-white/60 mb-1">Pro</p>
              {billingPeriod === 'monthly' ? (
                <>
                  <div className="flex items-baseline gap-1 mb-1">
                    <span className="text-3xl font-bold" style={{ fontFamily: "'Noto Serif', serif" }}>€4,99</span>
                    <span className="text-sm text-white/70">{lt.perMonth}</span>
                  </div>
                  <p className="text-xs text-white/50 mb-1">{lt.proYearlyNote}</p>
                </>
              ) : (
                <>
                  <div className="flex items-baseline gap-1 mb-1">
                    <span className="text-3xl font-bold" style={{ fontFamily: "'Noto Serif', serif" }}>€49</span>
                    <span className="text-sm text-white/70">{lt.perYear}</span>
                  </div>
                  <p className="text-xs text-white/50 mb-1">€4,08 {lt.perMonth}</p>
                </>
              )}
              <p className="text-xs text-white/70 font-medium mb-5 italic">{lt.proTagline}</p>
              <ul className="flex-1 space-y-2.5 mb-6">
                {lt.proFeatures.map((item, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-white/90">
                    <Check className="w-4 h-4 text-white/70 flex-shrink-0" />{item}
                  </li>
                ))}
              </ul>
              <Link to="/auth" className="block w-full text-center py-3 rounded-full text-sm font-semibold bg-white text-[#194121] hover:bg-[#c0eec0] transition-all">
                {lt.tryPro}
              </Link>
            </div>
          </div>

          {/* Row 2: Master + Enterprise */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* Master */}
            <div className="flex flex-col rounded-2xl border border-[#b8cfc0] bg-[#f4f8f4] p-6" style={{ boxShadow: '0 2px 12px rgba(27,28,25,0.04)' }}>
              <div className="flex items-start justify-between mb-1">
                <p className="text-xs font-bold uppercase tracking-wider text-[#4a6b50]">{lt.agronomistName}</p>
                <span className="text-[10px] font-semibold bg-[#194121] text-white px-2 py-0.5 rounded-full">
                  {lt.agronomistBadge}
                </span>
              </div>
              {billingPeriod === 'monthly' ? (
                <>
                  <div className="flex items-baseline gap-1 mb-1">
                    <span className="text-3xl font-bold text-[#1b1c19]" style={{ fontFamily: "'Noto Serif', serif" }}>€49</span>
                    <span className="text-sm text-[#606659]">{lt.perMonth}</span>
                  </div>
                  <p className="text-xs text-[#606659] mb-1">{lt.agronomistYearlyNote}</p>
                </>
              ) : (
                <>
                  <div className="flex items-baseline gap-1 mb-1">
                    <span className="text-3xl font-bold text-[#1b1c19]" style={{ fontFamily: "'Noto Serif', serif" }}>€490</span>
                    <span className="text-sm text-[#606659]">{lt.perYear}</span>
                  </div>
                  <p className="text-xs text-[#606659] mb-1">€40,83 {lt.perMonth}</p>
                </>
              )}
              <p className="text-xs text-[#4a6b50] font-medium mb-5 italic">
                {lt.agronomistTagline}
              </p>
              <ul className="flex-1 space-y-2.5 mb-6">
                {lt.agronomistFeatures.map((item, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-[#3a4035]">
                    <Check className="w-4 h-4 text-[#194121] flex-shrink-0" />{item}
                  </li>
                ))}
              </ul>
              <Link to="/auth" className="block w-full text-center py-3 rounded-full text-sm font-semibold text-[#194121] border-2 border-[#194121] hover:bg-[#194121] hover:text-white transition-all">
                {lt.startAgronomist}
              </Link>
            </div>

            {/* Enterprise */}
            <div className="rounded-2xl border-2 border-dashed border-[#c8d4ca] bg-white p-6 flex flex-col">
              <div className="flex items-start justify-between mb-1">
                <p className="text-xs font-bold uppercase tracking-wider text-[#606659]">Enterprise</p>
                <span className="text-[10px] font-semibold bg-slate-700 text-white px-2 py-0.5 rounded-full">
                  {lt.enterpriseBadge}
                </span>
              </div>
              <p className="text-2xl font-bold text-[#1b1c19] mb-1" style={{ fontFamily: "'Noto Serif', serif" }}>
                {lt.enterpriseContact}
              </p>
              <p className="text-xs text-[#606659] mb-5">
                {lt.enterpriseSubtitle}
              </p>
              <ul className="space-y-2.5 mb-6 flex-1">
                {lt.enterpriseFeatures.map((item, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-[#3a4035]">
                    <Check className="w-4 h-4 text-slate-500 flex-shrink-0" />{item}
                  </li>
                ))}
              </ul>
              <a
                href="mailto:hello@ask-oli.com?subject=Oli%20Enterprise%20pricing"
                className="block w-full text-center py-3 rounded-full text-sm font-semibold text-slate-700 border-2 border-slate-300 hover:border-slate-500 hover:bg-slate-50 transition-all">
                {lt.getInTouch}
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
            {lt.ctaHeadline}
          </h2>
          <p className="text-sm opacity-80 mb-8 max-w-sm mx-auto relative">
            {lt.ctaBody}
          </p>
          <Link
            to="/chat"
            className="inline-flex items-center gap-2 bg-white text-[#194121] font-semibold px-8 py-3.5 rounded-full text-sm hover:bg-[#c0eec0] transition-all relative"
            style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.15)' }}>
            {lt.ctaButton}
          </Link>
          <p className="text-xs text-white/40 mt-4 relative">
            {lt.ctaFine}
          </p>
        </div>
      </section>

      </main>

      {/* ── FOOTER ── */}
      <footer className="bg-white border-t border-[#e8e8e3] py-8">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <OliLogo size={20} bg="#ffffff" />
            <span className="text-sm font-bold text-[#194121]" style={{ fontFamily: "'Noto Serif', serif" }}>Oli</span>
            <span className="text-xs text-[#606659]">&copy; 2026</span>
          </div>
          <div className="flex gap-5 text-sm text-[#606659]">
            <Link to="/legal/privacy" className="hover:text-[#194121] transition-colors py-3 inline-flex items-center min-h-[44px]">
              {lt.privacy}
            </Link>
            <Link to="/legal/terms" className="hover:text-[#194121] transition-colors py-3 inline-flex items-center min-h-[44px]">
              {lt.terms}
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
