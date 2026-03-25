import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../lib/LanguageContext';
import OliLogo from '../components/OliLogo';

const STATS = (lang: string) => [
  { n: '20', label: lang === 'el' ? 'Δωρεάν ερωτήσεις / μήνα' : 'Free questions / month' },
  { n: '13', label: lang === 'el' ? 'Ημέρες follow-up' : 'Day follow-up loop' },
  { n: '450+', label: lang === 'el' ? 'Αναγνωρίσιμες ασθένειες' : 'Identifiable diseases' },
];

const PROBLEMS = (lang: string) => [
  {
    icon: 'eco',
    title: lang === 'el' ? 'Κιτρίνισμα Φύλλων' : 'Leaf Yellowing',
    body: lang === 'el'
      ? 'Αναγνώρισε αν είναι έλλειψη αζώτου, μυκητολογικό πρόβλημα ή ριζόσηψη — σε κάθε καλλιέργεια.'
      : 'Instantly distinguish between nitrogen deficiency, fungal disease, or root rot — in any crop.',
  },
  {
    icon: 'coronavirus',
    title: lang === 'el' ? 'Μυκητολογικές Κηλίδες' : 'Fungal Spots',
    body: lang === 'el'
      ? 'Σταμάτησε τους παθογόνους μύκητες πριν εξαπλωθούν σε ολόκληρο το χωράφι.'
      : 'Stop pathogens before they colonize the entire field with targeted treatment plans.',
  },
  {
    icon: 'bug_report',
    title: lang === 'el' ? 'Παράσιτα & Έντομα' : 'Pests & Insects',
    body: lang === 'el'
      ? 'Δάκος, αφίδες, τούτα, αλευρώδης — αναγνώριση και σχέδιο αντιμετώπισης σε δευτερόλεπτα.'
      : 'Olive fly, aphids, tuta absoluta, whitefly — identification and treatment plan in seconds.',
  },
  {
    icon: 'water_drop',
    title: lang === 'el' ? 'Υδατικό Στρες' : 'Water Stress',
    body: lang === 'el'
      ? 'Εντόπισε προβλήματα άρδευσης πριν γίνουν ορατά με γυμνό μάτι.'
      : 'Identify irrigation issues days before physical wilting becomes visible.',
  },
];

const FEATURES = (lang: string) => [
  {
    title: lang === 'el' ? 'Διάγνωση με φωτογραφία' : 'Photo diagnosis',
    body: lang === 'el'
      ? 'Τράβα φωτογραφία. Ο Oli σου λέει τι έχει, γιατί, και τι να κάνεις — σε δευτερόλεπτα.'
      : 'Snap a photo. Oli tells you what is wrong, why, and what to do — in seconds.',
  },
  {
    title: lang === 'el' ? 'Βιολογικό & Χημικό πλάνο' : 'Organic & Chemical plan',
    body: lang === 'el'
      ? 'Κάθε διάγνωση με δύο επιλογές: βιολογική και χημική. Συγκεκριμένο προϊόν και δοσολογία.'
      : 'Every diagnosis with two options: organic and chemical. Exact product and dosage.',
  },
  {
    title: lang === 'el' ? 'Μνήμη & Follow-up' : 'Memory & Follow-up',
    body: lang === 'el'
      ? 'Καταγράφει κάθε παρέμβαση. Σε 13 μέρες σε ρωτά αν πέτυχε η θεραπεία.'
      : 'Logs every intervention. After 13 days, asks if the treatment worked.',
  },
  {
    title: lang === 'el' ? 'Φωνητική εισαγωγή' : 'Voice input',
    body: lang === 'el'
      ? 'Μίλα στον Oli στα Ελληνικά ή Αγγλικά. Ιδανικό όταν έχεις βρώμικα χέρια στο χωράφι.'
      : 'Talk to Oli in Greek or English. Perfect when your hands are dirty in the field.',
  },
];

export default function Landing() {
  const { user, profile } = useAuth();
  const isLoggedIn = !!(user && profile);
  const { lang, setLang } = useLanguage();

  // Dynamic SEO meta tags based on language
  useEffect(() => {
    const setMeta = (attr: string, key: string, content: string) => {
      let el = document.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement;
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attr, key);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    };

    if (lang === 'el') {
      document.title = 'Oli — AI Γεωπόνος | Διάγνωση Καλλιεργειών με Τεχνητή Νοημοσύνη';
      setMeta('name', 'description', 'Ο Oli είναι ο AI γεωπόνος σου. Διάγνωσε ασθένειες καλλιεργειών από φωτογραφία, πάρε συμβουλές θεραπείας (βιολογική & χημική) και κατέγραψε παρεμβάσεις. Για κάθε καλλιέργεια — ελιές, αμπέλι, κηπευτικά, δενδρώδεις.');
      setMeta('property', 'og:title', 'Oli — AI Γεωπόνος για Έλληνες Αγρότες');
      setMeta('property', 'og:description', 'Διάγνωσε ασθένειες καλλιεργειών από φωτογραφία σε δευτερόλεπτα. Για κάθε καλλιέργεια. Βιολογικές & χημικές θεραπείες με ακριβή δοσολογία.');
      setMeta('property', 'og:locale', 'el_GR');
    } else {
      document.title = 'Oli — AI Agronomist | Crop Disease Diagnosis for Greek Farmers';
      setMeta('name', 'description', 'Oli is your AI agronomist. Diagnose crop diseases from a photo, get organic & chemical treatment plans with exact dosages, and track interventions. Works with every crop — olives, vines, vegetables, fruit trees.');
      setMeta('property', 'og:title', 'Oli — AI Agronomist for Greek Farmers');
      setMeta('property', 'og:description', 'Diagnose crop diseases from a photo in seconds. Works with every crop. Organic & chemical treatments with exact dosages. 20 free questions/month.');
      setMeta('property', 'og:locale', 'en_US');
    }

    document.documentElement.lang = lang;
    setMeta('property', 'og:url', 'https://askoli.gr/');
    setMeta('property', 'og:type', 'website');
  }, [lang]);

  return (
    <div className="min-h-screen bg-[#faf9f4] text-[#1b1c19] overflow-x-hidden" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Noto+Serif:wght@400;600;700&family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />

      {/* ── NAV ── */}
      <nav className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-xl" style={{ boxShadow: '0 8px 32px 0 rgba(27,28,25,0.04)' }}>
        <div className="flex justify-between items-center max-w-7xl mx-auto px-6 md:px-8 h-16 md:h-20">
          <div className="flex items-center gap-2.5">
            <OliLogo size={28} bg="#faf9f4" />
            <span className="text-xl font-bold tracking-tight" style={{ fontFamily: "'Noto Serif', serif", color: '#194121' }}>Oli</span>
          </div>
          <div className="flex items-center gap-3 md:gap-4">
            {!isLoggedIn && (
              <Link to="/auth"
                className="hidden md:block text-sm font-semibold text-[#606659] hover:text-[#194121] transition-colors"
                style={{ fontFamily: "'Noto Serif', serif" }}>
                {lang === 'el' ? 'Σύνδεση' : 'Sign in'}
              </Link>
            )}
            <button
              onClick={() => setLang(lang === 'el' ? 'en' : 'el')}
              className="text-xs font-semibold text-[#606659] hover:text-[#194121] transition-colors px-3 py-1.5 rounded-full bg-[#e3e3de]/60">
              {lang === 'el' ? 'EN' : 'ΕΛ'}
            </button>
            <Link to={isLoggedIn ? "/chat" : "/auth"}
              className="text-white px-5 md:px-6 py-2.5 rounded-full font-semibold text-sm hover:opacity-90 transition-all"
              style={{ background: 'linear-gradient(135deg, #194121 0%, #305936 100%)', boxShadow: '0 4px 20px rgba(25,65,33,0.2)' }}>
              {isLoggedIn ? (lang === 'el' ? 'Άνοιξε →' : 'Open →') : (lang === 'el' ? 'Ξεκίνα δωρεάν' : 'Start free')}
            </Link>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="relative min-h-[90vh] flex items-center overflow-hidden bg-[#faf9f4] pt-20">
        <div className="max-w-7xl mx-auto px-6 md:px-8 w-full grid md:grid-cols-2 gap-8 md:gap-12 items-center py-12 md:py-20">
          <div className="z-10">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-px w-8 bg-[#194121]/40" />
              <span className="text-xs font-bold tracking-[0.15em] text-[#194121] uppercase">
                {lang === 'el' ? 'AI Γεωπόνος · Μεσόγειος' : 'AI Agronomist · Mediterranean'}
              </span>
            </div>

            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold leading-[1.08] mb-6"
              style={{ fontFamily: "'Noto Serif', serif", color: '#194121' }}>
              {lang === 'el'
                ? <>Εντόπισε προβλήματα νωρίς. Πάρε σωστές αποφάσεις.</>
                : <>Detect crop problems early. Make better decisions fast.</>}
            </h1>

            <p className="text-base md:text-lg text-[#5a6053] mb-8 max-w-lg leading-relaxed">
              {lang === 'el'
                ? 'Φωτογράφισε ή περίγραψε τι βλέπεις στο χωράφι. Σε δευτερόλεπτα μαθαίνεις τι έχει, γιατί, και τι ακριβώς να κάνεις. Ό,τι κι αν καλλιεργείς.'
                : 'AI-powered crop analysis for Greek farmers — identify diseases, spot deficiencies, and get clear treatment recommendations in seconds. Works with every crop you grow.'}
            </p>

            <div className="flex flex-col sm:flex-row gap-3 mb-10">
              <Link to={isLoggedIn ? "/chat" : "/auth"}
                className="text-white px-8 py-4 rounded-full font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-all text-sm md:text-base"
                style={{ background: 'linear-gradient(135deg, #194121 0%, #305936 100%)', boxShadow: '0 8px 32px rgba(25,65,33,0.3)' }}>
                <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1", fontSize: '20px' }}>photo_camera</span>
                {isLoggedIn
                  ? (lang === 'el' ? 'Συνέχισε στο Oli' : 'Continue to Oli')
                  : (lang === 'el' ? 'Σκανάρισε τη σοδειά σου' : 'Scan your crop')}
              </Link>
              <Link to={isLoggedIn ? "/chat" : "/auth"}
                className="bg-[#e3e3de] text-[#1b1c19] px-8 py-4 rounded-full font-bold hover:bg-[#dbdad5] transition-all text-sm md:text-base text-center">
                {lang === 'el' ? 'Δοκίμασε δωρεάν' : 'Try it free'}
              </Link>
            </div>

            {/* Social proof */}
            <div className="flex items-center gap-3">
              <div className="flex -space-x-2">
                {['Γ','Ν','Κ','Β','Μ'].map((l, i) => (
                  <div key={i}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-[10px] font-bold text-white"
                    style={{ background: `hsl(${140 + i * 12}, 35%, ${25 + i * 4}%)`, border: '2px solid #faf9f4' }}>
                    {l}
                  </div>
                ))}
              </div>
              <span className="text-sm text-[#606659]">{lang === 'el' ? '+112 αγρότες ήδη χρησιμοποιούν τον Oli' : '+112 farmers already use Oli'}</span>
            </div>
          </div>

          {/* Hero image / phone mockup */}
          <div className="relative">
            <div className="aspect-[4/5] rounded-[2rem] overflow-hidden relative" style={{ boxShadow: '0 40px 80px rgba(25,65,33,0.15)' }}>
              <img
                alt={lang === 'el' ? 'Αγρότης χρησιμοποιεί τον Oli στο χωράφι' : 'Farmer using Oli in the field'}
                className="w-full h-full object-cover"
                src="https://images.unsplash.com/photo-1625246333195-78d9c38ad449?w=800&q=80"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#194121]/50 to-transparent pointer-events-none" />

              {/* Floating diagnosis card */}
              <div className="absolute bottom-6 left-6 right-6 bg-white/92 backdrop-blur-md p-5 rounded-2xl" style={{ outline: '1px solid rgba(194, 201, 187, 0.15)' }}>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-[#c0eec0] flex items-center justify-center">
                    <span className="material-symbols-outlined text-[#194121]" style={{ fontSize: '20px' }}>psychology</span>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-[#194121] tracking-widest uppercase">{lang === 'el' ? 'Διάγνωση' : 'Diagnosis detected'}</p>
                    <p className="font-semibold text-[#1b1c19] text-sm" style={{ fontFamily: "'Noto Serif', serif" }}>
                      {lang === 'el' ? 'Κυκλοκόνιο Ελιάς' : 'Olive Leaf Spot (Cycloconium)'}
                    </p>
                  </div>
                </div>
                <div className="h-1.5 w-full bg-[#e3e3de] rounded-full overflow-hidden">
                  <div className="h-full bg-[#194121] rounded-full" style={{ width: '92%' }} />
                </div>
                <p className="text-xs text-[#5a6053] mt-2">92% {lang === 'el' ? 'βεβαιότητα · Συνιστάται θεραπεία' : 'confidence · Treatment recommended'}</p>
              </div>
            </div>
            <div className="absolute -top-12 -right-12 w-64 h-64 bg-[#d9e9ba]/30 rounded-full blur-3xl -z-10" />
          </div>
        </div>
      </section>

      {/* ── URGENCY HOOK ── */}
      <section className="bg-[#f5f4ef] py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-6 md:px-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 md:mb-16 gap-6">
            <div className="max-w-2xl">
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-[#194121] mb-4"
                style={{ fontFamily: "'Noto Serif', serif" }}>
                {lang === 'el' ? 'Κάθε μέρα που περιμένεις, χάνεις σοδειά.' : 'Every day you wait costs yield.'}
              </h2>
              <p className="text-base md:text-lg text-[#5a6053]">
                {lang === 'el'
                  ? 'Η καθυστερημένη ανίχνευση μετατρέπει μικρά προβλήματα σε καταστροφή ολόκληρου του χωραφιού.'
                  : 'Late detection turns small patches into field-wide failures. Don\'t leave your harvest to chance.'}
              </p>
            </div>
            <div className="text-[#ba1a1a] font-bold flex items-center gap-2 bg-[#ffdad6]/30 px-4 py-2 rounded-full text-sm shrink-0">
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>warning</span>
              {lang === 'el' ? 'Κρίσιμο παράθυρο απόφασης' : 'Critical decision window'}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            {PROBLEMS(lang).map((p, i) => (
              <div key={i}
                className="bg-white p-6 md:p-8 rounded-3xl hover:-translate-y-1 transition-all duration-300"
                style={{ outline: '1px solid rgba(194, 201, 187, 0.15)', boxShadow: '0 2px 12px rgba(27,28,25,0.04)' }}>
                <div className="w-12 h-12 bg-[#f5f4ef] rounded-2xl flex items-center justify-center mb-5">
                  <span className="material-symbols-outlined text-[#194121]" style={{ fontSize: '24px' }}>{p.icon}</span>
                </div>
                <h3 className="font-bold text-lg text-[#1b1c19] mb-2" style={{ fontFamily: "'Noto Serif', serif" }}>{p.title}</h3>
                <p className="text-sm text-[#5a6053] leading-relaxed">{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── BENTO FEATURES ── */}
      <section className="py-20 md:py-32">
        <div className="max-w-7xl mx-auto px-6 md:px-8">
          <div className="text-center mb-12 md:mb-20">
            <span className="text-xs font-bold tracking-[0.2em] text-[#194121] uppercase mb-4 block">
              {lang === 'el' ? 'Δυνατότητες' : 'The intelligence edge'}
            </span>
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-[#194121] max-w-4xl mx-auto leading-tight"
              style={{ fontFamily: "'Noto Serif', serif" }}>
              {lang === 'el'
                ? 'Ξέρε ακριβώς τι συμβαίνει στη σοδειά σου — αμέσως.'
                : 'Know exactly what\'s happening in your crops — instantly.'}
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-6">
            {/* Primary feature — large card */}
            <div className="md:col-span-8 md:row-span-2 bg-[#f5f4ef] rounded-[2rem] overflow-hidden relative group min-h-[320px] md:min-h-[560px]">
              <img
                alt={lang === 'el' ? 'Σκανάρισμα φυτού' : 'Scanning plant'}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 absolute inset-0"
                src="https://images.unsplash.com/photo-1574943320219-553eb213f72d?w=1200&q=80"
              />
              <div className="absolute inset-0 p-8 md:p-12 flex flex-col justify-end bg-gradient-to-t from-black/60 via-black/20 to-transparent">
                <h3 className="text-2xl md:text-3xl font-bold text-white mb-3" style={{ fontFamily: "'Noto Serif', serif" }}>
                  {lang === 'el' ? 'Σκανάρισε & εντόπισε ασθένειες' : 'Scan plants & detect diseases'}
                </h3>
                <p className="text-white/80 max-w-md text-sm md:text-base">
                  {lang === 'el'
                    ? 'Η AI του Oli αναγνωρίζει εκατοντάδες ασθένειες σε κάθε καλλιέργεια — ελιές, αμπέλια, κηπευτικά, δενδρώδεις, αρωματικά φυτά.'
                    : 'Oli\'s AI identifies hundreds of diseases across every crop — olives, vines, vegetables, fruit trees, herbs, and more.'}
                </p>
              </div>
            </div>

            {/* Secondary feature */}
            <div className="md:col-span-4 rounded-[2rem] p-6 md:p-8 flex flex-col justify-between min-h-[180px] md:min-h-0"
              style={{ background: 'linear-gradient(135deg, #485532, #313e1d)', color: '#d9e9ba' }}>
              <span className="material-symbols-outlined text-3xl md:text-4xl">science</span>
              <div>
                <h3 className="text-lg md:text-xl font-bold mb-2">
                  {lang === 'el' ? 'Εντοπισμός ελλείψεων' : 'Nutrient deficiency detection'}
                </h3>
                <p className="text-sm opacity-80">
                  {lang === 'el'
                    ? 'Ανάλυση φύλλων για εντοπισμό ελλείψεων αζώτου, φωσφόρου και καλίου.'
                    : 'Leaf analysis maps color shifts to specific NPK imbalances.'}
                </p>
              </div>
            </div>

            {/* Small feature */}
            <div className="md:col-span-4 bg-[#e3e3de] rounded-[2rem] p-6 md:p-8 flex flex-col justify-between min-h-[180px] md:min-h-0">
              <span className="material-symbols-outlined text-3xl md:text-4xl text-[#194121]">bug_report</span>
              <div>
                <h3 className="text-lg md:text-xl font-bold text-[#194121] mb-2">
                  {lang === 'el' ? 'Εντοπισμός παρασίτων' : 'Spot pests early'}
                </h3>
                <p className="text-sm text-[#5a6053]">
                  {lang === 'el'
                    ? 'Πρώιμη ανίχνευση δάκου, αφίδων, τούτα, αλευρώδη πριν τη μαζική προσβολή.'
                    : 'Early detection of olive fly, aphids, tuta absoluta, and whitefly before colony establishment.'}
                </p>
              </div>
            </div>

            {/* Bottom features */}
            <div className="md:col-span-6 rounded-[2rem] p-8 md:p-10 flex items-center gap-6 overflow-hidden relative min-h-[140px]"
              style={{ background: '#305936', color: '#c0eec0' }}>
              <div className="flex-1 relative z-10">
                <h3 className="text-xl md:text-2xl font-bold mb-2">{lang === 'el' ? 'Βιολογική θεραπεία' : 'Organic treatments'}</h3>
                <p className="text-sm opacity-80">
                  {lang === 'el'
                    ? 'Πάντα δύο επιλογές: βιολογική και χημική, με ακριβή δοσολογία.'
                    : 'Always two options: organic and chemical, with exact dosage and timing.'}
                </p>
              </div>
              <span className="material-symbols-outlined text-4xl md:text-5xl relative z-10">eco</span>
            </div>

            <div className="md:col-span-6 bg-[#dfe5d4] rounded-[2rem] p-8 md:p-10 flex items-center gap-6 overflow-hidden relative min-h-[140px]">
              <div className="flex-1 text-[#42493e]">
                <h3 className="text-xl md:text-2xl font-bold mb-2">{lang === 'el' ? 'Καταχώρηση & Follow-up' : 'Log & Follow-up'}</h3>
                <p className="text-sm opacity-80">
                  {lang === 'el'
                    ? 'Καταγράφει κάθε παρέμβαση. 13 μέρες μετά σε ρωτά αν πέτυχε.'
                    : 'Logs every intervention. 13 days later, checks if the treatment worked.'}
                </p>
              </div>
              <span className="material-symbols-outlined text-4xl md:text-5xl text-[#42493e]">assignment_turned_in</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── CHAT DEMO ── */}
      <section className="py-20 md:py-32 overflow-hidden bg-white">
        <div className="max-w-7xl mx-auto px-6 md:px-8">
          <div className="grid md:grid-cols-2 gap-12 md:gap-20 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-[#194121] mb-6"
                style={{ fontFamily: "'Noto Serif', serif" }}>
                {lang === 'el' ? 'Ο γεωπόνος σου, on demand.' : 'Your expert, on demand.'}
              </h2>
              <p className="text-base md:text-lg text-[#5a6053] mb-10">
                {lang === 'el'
                  ? 'Λύσε κρίσιμα προβλήματα χωραφιού με φυσική συζήτηση. Χωρίς αναμονή για γεωπόνο.'
                  : 'Solve critical field issues with natural conversation. No more waiting for consultants.'}
              </p>
              <div className="space-y-3">
                {(lang === 'el'
                  ? ['Τα φύλλα κιτρινίζουν', 'Ασθένεια εξαπλώνεται', 'Πότε να ψεκάσω;', 'Τι να κάνω αυτή την εβδομάδα;', 'Ανέβασε φωτογραφία']
                  : ['My leaves are turning yellow', 'Disease spreading fast', 'When should I spray?', 'What to do this week?', 'Upload a photo']
                ).map((q, i) => (
                  <Link key={i} to={isLoggedIn ? "/chat" : "/auth"}
                    className="flex items-center gap-3 group cursor-pointer p-3 md:p-4 rounded-2xl hover:bg-[#f5f4ef] transition-all">
                    <div className="w-9 h-9 rounded-full bg-[#dfe5d4] flex items-center justify-center text-[#42493e] group-hover:bg-[#194121] group-hover:text-white transition-colors shrink-0">
                      <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>chat_bubble</span>
                    </div>
                    <p className="text-base font-medium text-[#1b1c19] group-hover:text-[#194121] transition-colors">{q}</p>
                  </Link>
                ))}
              </div>
            </div>

            {/* Chat simulation */}
            <div className="relative">
              <div className="space-y-4 max-w-lg ml-auto">
                <div className="bg-[#efeee9] p-4 rounded-2xl rounded-tr-none text-[#1b1c19] ml-12" style={{ boxShadow: '0 2px 8px rgba(27,28,25,0.06)' }}>
                  <p className="text-sm">
                    {lang === 'el' ? 'Τα φύλλα της ελιάς έχουν σκούρες κηλίδες. Τι μπορεί να είναι;' : 'My olive tree leaves have dark spots. What could it be?'}
                  </p>
                </div>
                <div className="p-5 md:p-6 rounded-2xl rounded-tl-none mr-12 relative text-white"
                  style={{ background: 'linear-gradient(135deg, #194121 0%, #305936 100%)', boxShadow: '0 8px 32px rgba(25,65,33,0.25)' }}>
                  <p className="font-bold text-[10px] uppercase tracking-widest opacity-70 mb-2">{lang === 'el' ? 'Ανάλυση Oli' : 'Oli analysis'}</p>
                  <p className="mb-4 text-sm md:text-base leading-relaxed">
                    {lang === 'el'
                      ? <>Αυτό μοιάζει με <strong>Κυκλοκόνιο</strong> (Cycloconium oleaginum). Βλέπω σκούρες, κυκλικές κηλίδες στην πάνω επιφάνεια του φύλλου — χαρακτηριστικό σύμπτωμα.</>
                      : <>That looks like <strong>Olive Leaf Spot</strong> (Cycloconium oleaginum). I see dark, circular spots on the upper leaf surface — a characteristic symptom.</>}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-white/10 p-3 rounded-xl text-sm backdrop-blur-sm">
                      <p className="font-bold text-[10px] uppercase tracking-wider mb-1 text-[#c0eec0]">{lang === 'el' ? 'Βιολογικό' : 'Organic'}</p>
                      <p className="text-xs opacity-90">{lang === 'el' ? 'Βορδιγάλειος πολτός 1%' : 'Bordeaux mixture 1%'}</p>
                    </div>
                    <div className="bg-white/10 p-3 rounded-xl text-sm backdrop-blur-sm">
                      <p className="font-bold text-[10px] uppercase tracking-wider mb-1 text-[#a4d2a6]">{lang === 'el' ? 'Χημικό' : 'Chemical'}</p>
                      <p className="text-xs opacity-90">{lang === 'el' ? 'Χαλκούχο σκεύασμα' : 'Copper-based fungicide'}</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="absolute -z-10 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[140%] h-[140%] bg-[#f5f4ef] rounded-full blur-3xl opacity-50" />
            </div>
          </div>
        </div>
      </section>

      {/* ── STATS ── */}
      <section className="bg-[#f5f4ef] py-16 md:py-20">
        <div className="max-w-5xl mx-auto px-6 md:px-8">
          <div className="grid grid-cols-3 gap-4 md:gap-8 text-center">
            {STATS(lang).map((s, i) => (
              <div key={i}>
                <div className="text-3xl md:text-5xl font-bold text-[#194121] mb-1" style={{ fontFamily: "'Noto Serif', serif", letterSpacing: '-0.03em' }}>
                  {s.n}
                </div>
                <p className="text-xs md:text-sm text-[#606659]">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="py-20 md:py-32 bg-white">
        <div className="max-w-5xl mx-auto px-6 md:px-8">
          <div className="text-center mb-12 md:mb-16">
            <span className="text-xs font-bold tracking-[0.2em] text-[#194121] uppercase mb-4 block">
              {lang === 'el' ? 'Πώς λειτουργεί' : 'How it works'}
            </span>
            <h2 className="text-3xl md:text-4xl font-bold text-[#194121]" style={{ fontFamily: "'Noto Serif', serif" }}>
              {lang === 'el' ? 'Τρία απλά βήματα' : 'Three simple steps'}
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6 md:gap-8">
            {[
              {
                n: '01', icon: 'photo_camera',
                t: lang === 'el' ? 'Φωτογράφισε' : 'Snap a photo',
                b: lang === 'el' ? 'Τράβα φωτογραφία ή περίγραψε τι βλέπεις στο χωράφι.' : 'Take a photo or describe what you see in your field.',
              },
              {
                n: '02', icon: 'psychology',
                t: lang === 'el' ? 'Πάρε διάγνωση' : 'Get diagnosis',
                b: lang === 'el' ? 'Ο Oli σου λέει τι είναι, πόσο σοβαρό, και τι να κάνεις.' : 'Oli tells you what it is, how serious, and what to do.',
              },
              {
                n: '03', icon: 'assignment_turned_in',
                t: lang === 'el' ? 'Κατέγραψε & Follow-up' : 'Log & Follow-up',
                b: lang === 'el' ? 'Αποθηκεύεται αυτόματα. 13 μέρες μετά σε ρωτά αν πέτυχε.' : 'Saved automatically. 13 days later, asks if the treatment worked.',
              },
            ].map((s, i) => (
              <div key={i} className="bg-[#faf9f4] rounded-3xl p-6 md:p-8 text-center" style={{ outline: '1px solid rgba(194, 201, 187, 0.15)' }}>
                <div className="w-14 h-14 bg-[#c0eec0]/30 rounded-2xl flex items-center justify-center mx-auto mb-5">
                  <span className="material-symbols-outlined text-[#194121]" style={{ fontSize: '28px' }}>{s.icon}</span>
                </div>
                <div className="text-4xl font-light text-[#194121]/15 mb-3" style={{ fontFamily: "'Noto Serif', serif" }}>{s.n}</div>
                <h3 className="font-bold text-lg text-[#1b1c19] mb-2">{s.t}</h3>
                <p className="text-sm text-[#5a6053] leading-relaxed">{s.b}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="py-16 md:py-24 px-6 md:px-8 bg-[#faf9f4]">
        <div className="max-w-5xl mx-auto rounded-[2rem] md:rounded-[3rem] p-8 sm:p-12 md:p-24 text-center text-white relative overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #194121 0%, #305936 100%)', boxShadow: '0 24px 64px rgba(25,65,33,0.3)' }}>
          <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '40px 40px' }} />

          <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-6 md:mb-8 relative z-10" style={{ fontFamily: "'Noto Serif', serif" }}>
            {lang === 'el'
              ? <>Σταμάτα να μαντεύεις.<br/>Προστάτεψε τη σοδειά σου.</>
              : <>Stop guessing.<br/>Start protecting your yield.</>}
          </h2>
          <p className="text-base md:text-xl opacity-90 mb-8 md:mb-12 max-w-2xl mx-auto relative z-10">
            {lang === 'el'
              ? 'Δωρεάν 20 ερωτήσεις τον μήνα. Χωρίς πιστωτική κάρτα.'
              : '20 free questions per month. No credit card required.'}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 md:gap-6 justify-center relative z-10">
            <Link to={isLoggedIn ? "/chat" : "/auth"}
              className="bg-white text-[#194121] px-8 md:px-10 py-4 md:py-5 rounded-full font-extrabold text-base md:text-xl hover:bg-[#c0eec0] hover:scale-105 transition-all"
              style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
              {isLoggedIn
                ? (lang === 'el' ? 'Άνοιξε τον Oli' : 'Open Oli')
                : (lang === 'el' ? 'Ξεκίνα δωρεάν τώρα' : 'Start free now')}
            </Link>
          </div>
          {!isLoggedIn && (
            <p className="mt-6 md:mt-8 text-sm opacity-60 relative z-10">
              {lang === 'el' ? 'Έχεις ήδη λογαριασμό;' : 'Already have an account?'}{' '}
              <Link to="/auth" className="underline hover:opacity-100">{lang === 'el' ? 'Σύνδεση' : 'Sign in'}</Link>
            </p>
          )}
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="bg-[#f5f4ef] w-full py-12 md:py-20">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 max-w-7xl mx-auto px-6 md:px-8">
          <div className="space-y-4">
            <div className="flex items-center gap-2.5">
              <OliLogo size={22} bg="#f5f4ef" />
              <span className="text-xl font-bold text-[#194121]" style={{ fontFamily: "'Noto Serif', serif" }}>Oli</span>
            </div>
            <p className="text-[#606659] max-w-xs text-sm leading-relaxed">
              {lang === 'el'
                ? 'AI γεωπόνος για τον Έλληνα αγρότη. Διάγνωση κάθε καλλιέργειας, θεραπεία, παρακολούθηση — στο κινητό σου.'
                : 'AI agronomist for Greek farmers. Diagnosis for every crop, treatment, follow-up — on your phone.'}
            </p>
            <p className="text-[#606659] text-xs opacity-60">
              © 2026 Oli. {lang === 'el' ? 'Με ασφάλεια δεδομένων.' : 'Data encrypted & secure.'}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-8">
            <div className="space-y-3">
              <p className="font-bold text-[#194121] text-sm uppercase tracking-wider">{lang === 'el' ? 'Πλατφόρμα' : 'Platform'}</p>
              <ul className="space-y-2">
                <li><Link to="/legal/privacy" className="text-[#606659] hover:text-[#194121] transition-all text-sm">{lang === 'el' ? 'Απόρρητο' : 'Privacy'}</Link></li>
                <li><Link to="/legal/terms" className="text-[#606659] hover:text-[#194121] transition-all text-sm">{lang === 'el' ? 'Όροι Χρήσης' : 'Terms of Service'}</Link></li>
              </ul>
            </div>
            <div className="space-y-3">
              <p className="font-bold text-[#194121] text-sm uppercase tracking-wider">{lang === 'el' ? 'Επικοινωνία' : 'Contact'}</p>
              <ul className="space-y-2">
                <li><a href="mailto:hello@askoli.ai" className="text-[#606659] hover:text-[#194121] transition-all text-sm">hello@askoli.ai</a></li>
              </ul>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
