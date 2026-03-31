import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Send, CheckCircle2, Clock, Leaf } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../lib/LanguageContext';
import OliLogo from '../components/OliLogo';

// ── Static data ───────────────────────────────────────────────────────────────

const STATS = (lang: string) => [
  { n: '450+', label: lang === 'el' ? 'Αναγνωρίσιμες ασθένειες' : 'Identifiable diseases' },
  { n: '~8s', label: lang === 'el' ? 'Μέσος χρόνος διάγνωσης' : 'Avg. diagnosis time' },
  { n: '100%', label: lang === 'el' ? 'Βιολογικό & χημικό πλάνο' : 'Organic & chemical plan' },
];

const FEATURES = (lang: string) => [
  {
    icon: 'photo_camera',
    title: lang === 'el' ? 'Φωτογράφισε & πάρε διάγνωση' : 'Snap a photo, get a diagnosis',
    body: lang === 'el'
      ? 'Ανέβασε φωτογραφία ή γράψε τι βλέπεις. Σε δευτερόλεπτα ξέρεις τι έχει η καλλιέργειά σου.'
      : 'Upload a photo or describe what you see. In seconds you know exactly what is wrong.',
    accent: true,
  },
  {
    icon: 'science',
    title: lang === 'el' ? 'Βιολογικό & Χημικό πλάνο' : 'Organic & Chemical plan',
    body: lang === 'el'
      ? 'Κάθε διάγνωση με δύο επιλογές θεραπείας. Συγκεκριμένο προϊόν και δοσολογία.'
      : 'Every diagnosis with two treatment options. Exact product and dosage.',
    accent: false,
  },
  {
    icon: 'assignment_turned_in',
    title: lang === 'el' ? 'Μνήμη & Follow-up' : 'Memory & Follow-up',
    body: lang === 'el'
      ? 'Θυμάται κάθε παρέμβαση. Σε ρωτά αν πέτυχε η θεραπεία μετά από 13 μέρες.'
      : 'Remembers every treatment. Checks back in 13 days to confirm it worked.',
    accent: false,
  },
];

const TESTIMONIALS = (lang: string) => [
  {
    quote: lang === 'el'
      ? 'Είχα στείλει φωτογραφία στον γεωπόνο μου και περίμενα 2 μέρες. Ο Oli μου έδωσε διάγνωση σε 10 δευτερόλεπτα — ήταν ακριβώς σωστή.'
      : 'I had sent a photo to my agronomist and waited 2 days. Oli gave me a diagnosis in 10 seconds — it was exactly right.',
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
];

// ── Chat demo data ─────────────────────────────────────────────────────────────

const DEMO = (lang: string) => ({
  question: lang === 'el'
    ? 'Τα φύλλα της ντομάτας έχουν καστανούς κύκλους με κίτρινο περίγραμμα. Τι έχει;'
    : 'My tomato leaves have brown rings with a yellow border. What is wrong?',
  disease: lang === 'el' ? 'Εναλτερίωση Ντομάτας' : 'Early Blight (Alternaria)',
  confidence: 92,
  organic: lang === 'el'
    ? 'Χαλκούχο μυκητοκτόνο (Bordeaux mixture) — 200g/100L νερό. Εφαρμογή κάθε 7 μέρες.'
    : 'Copper-based fungicide (Bordeaux mixture) — 200g/100L water. Apply every 7 days.',
  chemical: lang === 'el'
    ? 'Mancozeb 80% WP — 250g/100L νερό. Εφαρμογή κάθε 10–14 μέρες.'
    : 'Mancozeb 80% WP — 250g/100L water. Apply every 10–14 days.',
  followup: lang === 'el'
    ? 'Θα σε ρωτήσω σε 13 μέρες αν βελτιώθηκε η κατάσταση.'
    : "I'll check back in 13 days to see if the condition improved.",
});

// ── Component ─────────────────────────────────────────────────────────────────

export default function Landing() {
  const { user, profile } = useAuth();
  const isLoggedIn = !!(user && profile);
  const { lang, setLang } = useLanguage();
  const navigate = useNavigate();
  const [chatInput, setChatInput] = useState('');

  // SEO meta
  useEffect(() => {
    const setMeta = (attr: string, key: string, content: string) => {
      let el = document.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement;
      if (!el) { el = document.createElement('meta'); el.setAttribute(attr, key); document.head.appendChild(el); }
      el.setAttribute('content', content);
    };
    if (lang === 'el') {
      document.title = 'Oli — AI Γεωπόνος | Διάγνωση Καλλιεργειών';
      setMeta('name', 'description', 'Φωτογράφισε τη σοδειά σου. Ο Oli σου λέει τι έχει, πόσο σοβαρό και τι ακριβώς να κάνεις — σε δευτερόλεπτα.');
      setMeta('property', 'og:title', 'Oli — AI Γεωπόνος για Αγρότες');
      setMeta('property', 'og:locale', 'el_GR');
    } else {
      document.title = 'Oli — AI Agronomist | Crop Disease Diagnosis';
      setMeta('name', 'description', 'Snap a photo of your crop. Oli tells you what is wrong, how serious it is, and exactly what to do — in seconds.');
      setMeta('property', 'og:title', 'Oli — AI Agronomist for Farmers');
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

  const demo = DEMO(lang);

  return (
    <div className="min-h-screen bg-white text-[#1b1c19] overflow-x-hidden" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      {/* Material Symbols — icons only, self-hosted fonts via fontsource */}
      <link rel="preload" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&text=photo_camera%2Bscience%2Bassignment_turned_in&display=swap" as="style" onLoad={(e) => { (e.target as HTMLLinkElement).rel = 'stylesheet'; }} />
      <noscript><link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&text=photo_camera%2Bscience%2Bassignment_turned_in&display=swap" rel="stylesheet" /></noscript>

      {/* ── NAV ── */}
      <nav className="fixed top-0 w-full z-50 bg-white/90 backdrop-blur-xl border-b border-[#e8e8e3]">
        <div className="flex justify-between items-center max-w-5xl mx-auto px-6 h-14">
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

      {/* ── HERO ── */}
      <section className="flex flex-col items-center justify-center px-6 pt-28 pb-16 bg-[#faf9f4]">
        <div className="max-w-2xl w-full text-center">
          <h1
            className="text-4xl sm:text-5xl md:text-6xl font-bold leading-[1.1] mb-5 tracking-tight"
            style={{ fontFamily: "'Noto Serif', serif", color: '#194121' }}>
            {lang === 'el' ? (
              <>Φωτογράφισε.<br />Μάθε τι έχει.</>
            ) : (
              <>Take a photo.<br />Know exactly what&apos;s wrong.</>
            )}
          </h1>

          <p className="text-base md:text-lg text-[#5a6053] mb-8 max-w-md mx-auto leading-relaxed">
            {lang === 'el'
              ? 'Βιολογικό & χημικό πλάνο. Ακριβές προϊόν και δοσολογία. Follow-up σε 13 μέρες.'
              : 'Organic & chemical plan. Exact product and dosage. Follow-up in 13 days.'}
          </p>

          {/* Chat input */}
          <form onSubmit={handleChatSubmit} className="relative max-w-xl mx-auto mb-3">
            <input
              type="text"
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              aria-label={lang === 'el' ? 'Περίγραψε τι βλέπεις στο χωράφι' : 'Describe what you see in your field'}
              placeholder={lang === 'el' ? 'π.χ. Τα φύλλα της ελιάς κιτρινίζουν από τη βάση...' : 'e.g. My olive leaves are yellowing from the base...'}
              className="w-full rounded-full px-6 py-4 pr-14 text-[15px] bg-white border border-[#deded8] focus:border-[#194121] focus:outline-none focus:ring-2 focus:ring-[#194121]/15 transition-all"
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

          <p className="text-xs text-[#8a9280]">
            {lang === 'el' ? 'Χωρίς εγγραφή · Η πρώτη ερώτηση είναι δωρεάν' : 'No sign-up required · First question is free'}
          </p>
        </div>
      </section>

      {/* ── PRODUCT PROOF — chat demo ── */}
      <section className="py-16 bg-white">
        <div className="max-w-2xl mx-auto px-6">
          <p className="text-center text-xs font-semibold uppercase tracking-widest text-[#194121]/50 mb-8">
            {lang === 'el' ? 'Δες πώς λειτουργεί' : 'See how it works'}
          </p>

          <div className="rounded-2xl border border-[#e8e8e3] bg-[#faf9f4] overflow-hidden" style={{ boxShadow: '0 8px 40px rgba(25,65,33,0.07)' }}>
            {/* Chat header */}
            <div className="flex items-center gap-3 px-5 py-3.5 border-b border-[#e8e8e3] bg-white">
              <div className="flex items-center gap-2">
                <OliLogo size={20} bg="#ffffff" />
                <span className="text-sm font-semibold text-[#194121]" style={{ fontFamily: "'Noto Serif', serif" }}>Oli</span>
              </div>
              <span className="ml-auto flex items-center gap-1.5 text-[11px] text-emerald-600 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                {lang === 'el' ? 'Online' : 'Online'}
              </span>
            </div>

            <div className="p-5 space-y-4">
              {/* User message */}
              <div className="flex justify-end">
                <div className="max-w-[80%] bg-[#194121] text-white rounded-2xl rounded-tr-sm px-4 py-3 text-sm leading-relaxed">
                  {demo.question}
                </div>
              </div>

              {/* Oli response */}
              <div className="flex gap-3 items-start">
                <div className="flex-shrink-0 w-7 h-7 rounded-full bg-[#194121]/10 flex items-center justify-center">
                  <Leaf className="w-3.5 h-3.5 text-[#194121]" />
                </div>
                <div className="flex-1 space-y-3">
                  {/* Diagnosis header */}
                  <div className="bg-white rounded-xl rounded-tl-sm border border-[#e8e8e3] px-4 py-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-bold text-[#1b1c19]" style={{ fontFamily: "'Noto Serif', serif" }}>{demo.disease}</span>
                      <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">{demo.confidence}% {lang === 'el' ? 'βεβαιότητα' : 'confidence'}</span>
                    </div>
                  </div>

                  {/* Treatment options */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="bg-white rounded-xl border border-[#e8e8e3] px-4 py-3">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 mb-1.5">{lang === 'el' ? '🌿 Βιολογικό' : '🌿 Organic'}</p>
                      <p className="text-xs text-[#3a4035] leading-relaxed">{demo.organic}</p>
                    </div>
                    <div className="bg-white rounded-xl border border-[#e8e8e3] px-4 py-3">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-blue-700 mb-1.5">{lang === 'el' ? '🧪 Χημικό' : '🧪 Chemical'}</p>
                      <p className="text-xs text-[#3a4035] leading-relaxed">{demo.chemical}</p>
                    </div>
                  </div>

                  {/* Follow-up note */}
                  <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
                    <Clock className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-800">{demo.followup}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section className="py-16 bg-[#f5f4ef]">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="sr-only">{lang === 'el' ? 'Χαρακτηριστικά' : 'Features'}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
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

      {/* ── TESTIMONIALS ── */}
      <section className="py-16 bg-white">
        <div className="max-w-4xl mx-auto px-6">
          <p className="text-center text-xs font-semibold uppercase tracking-widest text-[#194121]/50 mb-10">
            {lang === 'el' ? 'Τι λένε οι αγρότες' : 'What farmers say'}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {TESTIMONIALS(lang).map((t, i) => (
              <div key={i} className="rounded-2xl border border-[#e8e8e3] p-6 bg-[#fafaf8]">
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, j) => (
                    <svg key={j} className="w-4 h-4 text-amber-400 fill-current" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                  ))}
                </div>
                <p className="text-sm text-[#3a4035] leading-relaxed mb-5 italic">&ldquo;{t.quote}&rdquo;</p>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#194121]/10 flex items-center justify-center text-xs font-bold text-[#194121]">
                    {t.initial}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-[#1b1c19]">{t.name}</p>
                    <p className="text-[11px] text-[#8a9280]">{t.crop}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── STATS ── */}
      <section className="py-12 bg-[#f5f4ef]">
        <div className="max-w-3xl mx-auto px-6">
          <div className="grid grid-cols-3 gap-4 text-center">
            {STATS(lang).map((s, i) => (
              <div key={i} className="flex flex-col items-center">
                <CheckCircle2 className="w-4 h-4 text-[#194121]/40 mb-2" />
                <div className="text-2xl md:text-3xl font-bold text-[#194121] mb-0.5" style={{ fontFamily: "'Noto Serif', serif" }}>
                  {s.n}
                </div>
                <p className="text-xs text-[#606659] leading-snug max-w-[100px]">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="py-16 px-6 bg-white">
        <div
          className="max-w-2xl mx-auto rounded-[2rem] p-10 md:p-14 text-center text-white relative overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #194121 0%, #2d5535 100%)', boxShadow: '0 24px 64px rgba(25,65,33,0.25)' }}>

          {/* Decorative circles */}
          <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full bg-white/5 pointer-events-none" />
          <div className="absolute -bottom-10 -left-10 w-40 h-40 rounded-full bg-white/5 pointer-events-none" />

          <h2 className="text-2xl sm:text-3xl font-bold mb-3 relative" style={{ fontFamily: "'Noto Serif', serif" }}>
            {lang === 'el' ? 'Σταμάτα να μαντεύεις.' : 'Stop guessing.'}
          </h2>
          <p className="text-sm opacity-80 mb-8 max-w-sm mx-auto relative">
            {lang === 'el'
              ? 'Ρώτα τον Oli τώρα. Χωρίς εγγραφή, χωρίς πιστωτική κάρτα.'
              : 'Ask Oli now. No sign-up, no credit card.'}
          </p>

          {/* Inline chat input — no scroll needed */}
          <form
            onSubmit={(e) => { e.preventDefault(); navigate(isLoggedIn ? '/chat' : '/chat?q='); }}
            className="relative max-w-md mx-auto"
          >
            <input
              type="text"
              placeholder={lang === 'el' ? 'Γράψε το πρόβλημά σου...' : 'Describe your problem...'}
              aria-label={lang === 'el' ? 'Γράψε το πρόβλημά σου' : 'Describe your problem'}
              className="w-full rounded-full px-6 py-3.5 pr-12 text-sm bg-white/15 backdrop-blur border border-white/25 text-white placeholder:text-white/50 focus:outline-none focus:border-white/60 transition-all"
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  const text = (e.target as HTMLInputElement).value.trim();
                  if (text) navigate(isLoggedIn ? '/chat' : `/chat?q=${encodeURIComponent(text)}`);
                  else navigate('/chat');
                }
              }}
            />
            <button
              type="submit"
              aria-label={lang === 'el' ? 'Αποστολή' : 'Send'}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-white flex items-center justify-center transition-all hover:bg-[#c0eec0]">
              <Send className="h-3.5 w-3.5 text-[#194121]" />
            </button>
          </form>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="bg-[#faf9f4] border-t border-[#e8e8e3] py-8">
        <div className="max-w-5xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <OliLogo size={16} bg="#faf9f4" />
            <span className="text-sm font-bold text-[#194121]" style={{ fontFamily: "'Noto Serif', serif" }}>Oli</span>
            <span className="text-xs text-[#8a9280]">&copy; 2026</span>
          </div>
          <div className="flex gap-5 text-xs text-[#8a9280]">
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
