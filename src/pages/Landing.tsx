import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Send } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../lib/LanguageContext';
import OliLogo from '../components/OliLogo';

const STATS = (lang: string) => [
  { n: '20', label: lang === 'el' ? 'Δωρεάν ερωτήσεις / μήνα' : 'Free questions / month' },
  { n: '13', label: lang === 'el' ? 'Ημέρες follow-up' : 'Day follow-up loop' },
  { n: '450+', label: lang === 'el' ? 'Αναγνωρίσιμες ασθένειες' : 'Identifiable diseases' },
];

const FEATURES = (lang: string) => [
  {
    icon: 'photo_camera',
    title: lang === 'el' ? 'Φωτογράφισε & πάρε διάγνωση' : 'Snap a photo, get a diagnosis',
    body: lang === 'el'
      ? 'Ο Oli σου λέει τι έχει, πόσο σοβαρό, και τι ακριβώς να κάνεις — σε δευτερόλεπτα.'
      : 'Oli tells you what it is, how serious, and exactly what to do — in seconds.',
  },
  {
    icon: 'science',
    title: lang === 'el' ? 'Βιολογικό & Χημικό πλάνο' : 'Organic & Chemical plan',
    body: lang === 'el'
      ? 'Κάθε διάγνωση με δύο επιλογές θεραπείας. Συγκεκριμένο προϊόν και δοσολογία.'
      : 'Every diagnosis with two treatment options. Exact product and dosage.',
  },
  {
    icon: 'assignment_turned_in',
    title: lang === 'el' ? 'Μνήμη & Follow-up' : 'Memory & Follow-up',
    body: lang === 'el'
      ? 'Θυμάται κάθε παρέμβαση. Σε ρωτά αν πέτυχε η θεραπεία.'
      : 'Remembers every treatment. Checks back if it worked.',
  },
];

export default function Landing() {
  const { user, profile } = useAuth();
  const isLoggedIn = !!(user && profile);
  const { lang, setLang } = useLanguage();
  const navigate = useNavigate();
  const [chatInput, setChatInput] = useState('');

  // SEO meta tags
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
      setMeta('name', 'description', 'Ο Oli είναι ο AI γεωπόνος σου. Διάγνωσε ασθένειες καλλιεργειών από φωτογραφία, πάρε συμβουλές θεραπείας και κατέγραψε παρεμβάσεις.');
      setMeta('property', 'og:title', 'Oli — AI Γεωπόνος για Αγρότες');
      setMeta('property', 'og:description', 'Διάγνωσε ασθένειες καλλιεργειών από φωτογραφία σε δευτερόλεπτα.');
      setMeta('property', 'og:locale', 'el_GR');
    } else {
      document.title = 'Oli — AI Agronomist | Crop Disease Diagnosis with AI';
      setMeta('name', 'description', 'Oli is your AI agronomist. Diagnose crop diseases from a photo, get treatment plans with exact dosages, and track interventions.');
      setMeta('property', 'og:title', 'Oli — AI Agronomist for Farmers');
      setMeta('property', 'og:description', 'Diagnose crop diseases from a photo in seconds. Organic & chemical treatments with exact dosages.');
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

    if (isLoggedIn) {
      navigate('/chat');
    } else {
      navigate(`/chat?q=${encodeURIComponent(text)}`);
    }
  };

  return (
    <div className="min-h-screen bg-[#faf9f4] text-[#1b1c19] overflow-x-hidden" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <link rel="preload" href="https://fonts.googleapis.com/css2?family=Noto+Serif:wght@400;600;700&family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap" as="style" onLoad={(e) => { (e.target as HTMLLinkElement).rel = 'stylesheet'; }} />
      <link rel="preload" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&text=photo_camera%2Bscience%2Bassignment_turned_in&display=swap" as="style" onLoad={(e) => { (e.target as HTMLLinkElement).rel = 'stylesheet'; }} />
      <noscript>
        <link href="https://fonts.googleapis.com/css2?family=Noto+Serif:wght@400;600;700&family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&text=photo_camera%2Bscience%2Bassignment_turned_in&display=swap" rel="stylesheet" />
      </noscript>

      {/* ── NAV ── */}
      <nav className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-xl" style={{ boxShadow: '0 8px 32px 0 rgba(27,28,25,0.04)' }}>
        <div className="flex justify-between items-center max-w-5xl mx-auto px-6 h-16">
          <div className="flex items-center gap-2.5">
            <OliLogo size={28} bg="#faf9f4" />
            <span className="text-xl font-bold tracking-tight" style={{ fontFamily: "'Noto Serif', serif", color: '#194121' }}>Oli</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setLang(lang === 'el' ? 'en' : 'el')}
              className="text-xs font-semibold text-[#606659] hover:text-[#194121] transition-colors px-3 py-1.5 rounded-full bg-[#e3e3de]/60">
              {lang === 'el' ? 'EN' : 'EL'}
            </button>
            <Link to={isLoggedIn ? "/chat" : "/auth"}
              className="text-white px-5 py-2 rounded-full font-semibold text-sm hover:opacity-90 transition-all"
              style={{ background: 'linear-gradient(135deg, #194121 0%, #305936 100%)' }}>
              {isLoggedIn ? (lang === 'el' ? 'Άνοιξε' : 'Open') : (lang === 'el' ? 'Σύνδεση' : 'Sign in')}
            </Link>
          </div>
        </div>
      </nav>

      {/* ── HERO + CHAT INPUT ── */}
      <section className="min-h-[85vh] flex flex-col items-center justify-center px-6 pt-24 pb-12">
        <div className="max-w-2xl w-full text-center">
          <div className="mb-6">
            <OliLogo size={56} bg="#faf9f4" />
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold leading-tight mb-4"
            style={{ fontFamily: "'Noto Serif', serif", color: '#194121' }}>
            {lang === 'el'
              ? 'Ο AI γεωπόνος σου.'
              : 'Your AI agronomist.'}
          </h1>

          <p className="text-base md:text-lg text-[#5a6053] mb-8 max-w-lg mx-auto leading-relaxed">
            {lang === 'el'
              ? 'Περίγραψε το πρόβλημα ή φωτογράφισε τη σοδειά σου. Μάθε τι έχει και τι να κάνεις — σε δευτερόλεπτα.'
              : 'Describe your crop problem or snap a photo. Get a diagnosis and treatment plan — in seconds.'}
          </p>

          {/* ── CHAT INPUT BAR ── */}
          <form onSubmit={handleChatSubmit} className="relative max-w-xl mx-auto mb-6">
            <input
              type="text"
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              aria-label={lang === 'el' ? 'Περίγραψε τι βλέπεις στο χωράφι' : 'Describe what you see in your field'}
              placeholder={lang === 'el' ? 'Περίγραψε τι βλέπεις στο χωράφι...' : 'Describe what you see in your field...'}
              className="w-full rounded-full px-6 py-4 pr-14 text-[15px] bg-white border border-[#e3e3de] focus:border-[#194121] focus:outline-none focus:ring-2 focus:ring-[#194121]/15 transition-all"
              style={{ boxShadow: '0 4px 20px rgba(25,65,33,0.08)' }}
            />
            <button
              type="submit"
              disabled={!chatInput.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full text-white transition-all disabled:opacity-30"
              style={{ background: 'linear-gradient(135deg, #194121 0%, #305936 100%)' }}
              aria-label={lang === 'el' ? 'Αποστολή' : 'Send'}
            >
              <Send className="h-4 w-4" />
            </button>
          </form>

          <p className="text-xs text-[#606659] mb-8">
            {lang === 'el'
              ? 'Χωρίς εγγραφή. Η πρώτη ερώτηση είναι δωρεάν.'
              : 'No sign-up required. Your first question is free.'}
          </p>

          {/* Social proof */}
          <div className="flex items-center justify-center gap-3">
            <div className="flex -space-x-2">
              {['Γ','Ν','Κ','Β','Μ'].map((l, i) => (
                <div key={i}
                  className="flex h-7 w-7 items-center justify-center rounded-full text-[9px] font-bold text-white"
                  style={{ background: `hsl(${140 + i * 12}, 35%, ${25 + i * 4}%)`, border: '2px solid #faf9f4' }}>
                  {l}
                </div>
              ))}
            </div>
            <span className="text-sm text-[#606659]">
              {lang === 'el' ? '+112 αγρότες ήδη χρησιμοποιούν τον Oli' : '+112 farmers already use Oli'}
            </span>
          </div>
        </div>
      </section>

      {/* ── FEATURES (compact) ── */}
      <section className="py-16 bg-[#f5f4ef]">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="sr-only">{lang === 'el' ? 'Χαρακτηριστικά' : 'Features'}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {FEATURES(lang).map((f, i) => (
              <div key={i} className="bg-white rounded-2xl p-6" style={{ boxShadow: '0 2px 12px rgba(27,28,25,0.04)' }}>
                <div className="w-10 h-10 bg-[#c0eec0]/30 rounded-xl flex items-center justify-center mb-4">
                  <span className="material-symbols-outlined text-[#194121]" style={{ fontSize: '22px' }}>{f.icon}</span>
                </div>
                <h3 className="font-bold text-[#1b1c19] mb-1.5" style={{ fontFamily: "'Noto Serif', serif" }}>{f.title}</h3>
                <p className="text-sm text-[#5a6053] leading-relaxed">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── STATS ── */}
      <section className="py-12 bg-[#faf9f4]">
        <div className="max-w-4xl mx-auto px-6">
          <div className="grid grid-cols-3 gap-4 text-center">
            {STATS(lang).map((s, i) => (
              <div key={i}>
                <div className="text-2xl md:text-4xl font-bold text-[#194121] mb-1" style={{ fontFamily: "'Noto Serif', serif" }}>
                  {s.n}
                </div>
                <p className="text-xs md:text-sm text-[#606659]">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="py-16 px-6 bg-[#f5f4ef]">
        <div className="max-w-3xl mx-auto rounded-[2rem] p-10 md:p-16 text-center text-white relative overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #194121 0%, #305936 100%)', boxShadow: '0 24px 64px rgba(25,65,33,0.3)' }}>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4" style={{ fontFamily: "'Noto Serif', serif" }}>
            {lang === 'el'
              ? 'Σταμάτα να μαντεύεις.'
              : 'Stop guessing.'}
          </h2>
          <p className="text-sm md:text-base opacity-90 mb-8 max-w-md mx-auto">
            {lang === 'el'
              ? 'Ρώτα τον Oli τώρα. Χωρίς εγγραφή, χωρίς πιστωτική κάρτα.'
              : 'Ask Oli now. No sign-up, no credit card.'}
          </p>
          <button
            onClick={() => {
              const hero = document.querySelector('input[type="text"]') as HTMLInputElement;
              hero?.focus();
              hero?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }}
            className="bg-white text-[#194121] px-8 py-3.5 rounded-full font-bold text-sm hover:bg-[#c0eec0] transition-all"
            style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}>
            {lang === 'el' ? 'Ρώτα τον Oli' : 'Ask Oli'}
          </button>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="bg-[#faf9f4] py-10">
        <div className="max-w-5xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <OliLogo size={18} bg="#faf9f4" />
            <span className="text-sm font-bold text-[#194121]" style={{ fontFamily: "'Noto Serif', serif" }}>Oli</span>
            <span className="text-xs text-[#606659]">
              &copy; 2026
            </span>
          </div>
          <div className="flex gap-4 text-xs text-[#606659]">
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
