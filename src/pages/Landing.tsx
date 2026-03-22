import { useRef, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../lib/LanguageContext';
import OliLogo from '../components/OliLogo';

const CROPS = [
  'Ελιές','Λεμόνια','Πορτοκάλια','Μανταρίνια','Κλημέντινες',
  'Αμπέλι','Τομάτες','Ροδάκινα','Βερίκοκα','Κεράσια',
  'Σύκα','Ρόδια','Δαμάσκηνα','Πιπεριές','Μελιτζάνες',
  'Αγγούρια','Κολοκύθια','Πατάτες','Σιτάρι','Κριθάρι',
  'Αραβόσιτος','Ηλίανθος','Βαμβάκι','Φασόλια','Σκόρδο',
  'Κρεμμύδια','Μήλα','Αχλάδια','Φράουλες','Καρπούζι',
  'Πεπόνι','Καρύδια','Αμύγδαλα','Φιστίκια','Χαρούπια',
];

const STATS = (lang: string) => [
  { n: '20', unit: lang === 'el' ? 'δωρεάν' : 'free', label: lang === 'el' ? 'ερωτήσεις — χωρίς κάρτα' : 'questions — no credit card' },
  { n: '13', unit: lang === 'el' ? 'μέρες' : 'days', label: lang === 'el' ? 'μετά σε ρωτά αν πέτυχε' : 'later it asks if it worked' },
  { n: '∞', unit: lang === 'el' ? 'καλλιέργειες' : 'crops', label: lang === 'el' ? 'ελιές, αμπέλι κι άλλα' : 'olives, vines and more' },
];

const FEATURES = (lang: string) => [
  {
    n: '01',
    title: lang === 'el' ? 'Διάγνωση από φωτογραφία' : 'Photo diagnosis',
    body: lang === 'el'
      ? 'Τράβα φωτογραφία από το χωράφι. Ο Oli σου λέει τι έχει το φυτό, γιατί το έχει, και τι να κάνεις — σε δευτερόλεπτα.'
      : 'Take a photo from your field. Oli tells you what is wrong, why, and what to do — in seconds.',
  },
  {
    n: '02',
    title: lang === 'el' ? 'Βιολογικό & χημικό πλάνο' : 'Organic & chemical plan',
    body: lang === 'el'
      ? 'Για κάθε πρόβλημα παίρνεις δύο επιλογές: βιολογική και χημική. Με συγκεκριμένο προϊόν, ποσότητα και πότε να το εφαρμόσεις.'
      : 'Every diagnosis comes with two options: organic and chemical. Exact product, dose, and timing.',
  },
  {
    n: '03',
    title: lang === 'el' ? 'Μνήμη καλλιέργειας' : 'Field memory',
    body: lang === 'el'
      ? 'Ό,τι κάνεις στο χωράφι μένει καταγραμμένο. Ο Oli θυμάται και 13 μέρες μετά σε ρωτά αν το πρόβλημα πέρασε.'
      : 'Everything you do is recorded. Oli remembers and asks 13 days later if the problem is gone.',
  },
  {
    n: '04',
    title: lang === 'el' ? 'Εβδομαδιαίο πλάνο' : 'Weekly plan',
    body: lang === 'el'
      ? 'Κάθε Δευτέρα πρωί, ο Oli σου στέλνει τι να προσέξεις αυτή την εβδομάδα — ανάλογα με την εποχή και τη σοδειά σου.'
      : 'Every Monday morning, Oli sends you what to watch for this week — based on the season and your crops.',
  },
];

export default function Landing() {
  const { user, profile } = useAuth();
  const isLoggedIn = !!(user && profile);
  const { lang, setLang } = useLanguage();
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const total = 35; // CROPS.length
    const interval = setInterval(() => {
      setActiveIndex(i => (i + 1) % total);
    }, 1200);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="landing-root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bodoni+Moda:ital,opsz,wght@0,6..96,300;0,6..96,400;0,6..96,700;1,6..96,300;1,6..96,400&family=IBM+Plex+Sans:ital,wght@0,300;0,400;0,500;0,600;1,300&display=swap');

        .landing-root {
          min-height: 100dvh;
          background: #080C10;
          color: #E8EDF2;
          font-family: 'IBM Plex Sans', sans-serif;
          overflow-x: hidden;
          position: relative;
        }

        /* Background ambient glow */
        .landing-root::before {
          content: '';
          position: fixed;
          top: -20%;
          left: 50%;
          transform: translateX(-50%);
          width: 900px;
          height: 900px;
          background: radial-gradient(circle, rgba(46,160,67,0.08) 0%, rgba(45,106,79,0.04) 40%, transparent 70%);
          pointer-events: none;
          z-index: 0;
        }

        /* Grain overlay */
        .landing-root::after {
          content: '';
          position: fixed;
          inset: 0;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.035'/%3E%3C/svg%3E");
          pointer-events: none;
          z-index: 1;
        }

        .above-grain { position: relative; z-index: 2; }

        /* Typography */
        .font-display { font-family: 'Bodoni Moda', serif; }
        .font-mono { font-family: 'IBM Plex Sans', sans-serif; }

        /* Animations */
        @keyframes heroWord {
          from { opacity: 0; transform: translateY(20px); filter: blur(4px); }
          to   { opacity: 1; transform: translateY(0);    filter: blur(0); }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(32px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        @keyframes pulse-glow {
          0%, 100% { opacity: 0.6; }
          50%       { opacity: 1; }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(-1deg); }
          50%       { transform: translateY(-12px) rotate(1deg); }
        }
        @keyframes borderGlow {
          0%, 100% { border-color: rgba(46,160,67,0.15); }
          50%       { border-color: rgba(46,160,67,0.45); }
        }

        .hw1 { animation: heroWord 0.8s 0.1s both; }
        .hw2 { animation: heroWord 0.8s 0.25s both; }
        .hw3 { animation: heroWord 0.8s 0.4s both; }
        .hw4 { animation: heroWord 0.8s 0.55s both; }
        .hw5 { animation: heroWord 0.8s 0.7s both; }
        .fu1 { animation: fadeUp 0.9s 0.8s both; }
        .fu2 { animation: fadeUp 0.9s 1.0s both; }
        .fu3 { animation: fadeUp 0.9s 1.2s both; }


        .phone-float { animation: float 8s ease-in-out infinite; }

        .feature-card {
          border: 1px solid rgba(255,255,255,0.06);
          background: rgba(255,255,255,0.025);
          transition: border-color 0.4s, background 0.4s, transform 0.3s;
        }
        .feature-card:hover {
          border-color: rgba(46,160,67,0.3);
          background: rgba(46,160,67,0.04);
          transform: translateY(-4px);
        }

        .cta-glow {
          box-shadow: 0 0 60px rgba(46,160,67,0.25), 0 0 120px rgba(46,160,67,0.1);
        }
        .cta-glow:hover {
          box-shadow: 0 0 80px rgba(46,160,67,0.4), 0 0 160px rgba(46,160,67,0.15);
        }

        .line-accent {
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(46,160,67,0.4), transparent);
        }

        .stat-number {
          font-family: 'Bodoni Moda', serif;
          font-size: clamp(3rem, 8vw, 5rem);
          font-weight: 300;
          color: #2EA043;
          line-height: 1;
          letter-spacing: -0.02em;
        }

        /* Scrollbar */
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #080C10; }
        ::-webkit-scrollbar-thumb { background: rgba(46,160,67,0.3); border-radius: 2px; }
      `}</style>

      <div className="above-grain">

        {/* ── NAV ── */}
        <nav style={{borderBottom:'1px solid rgba(255,255,255,0.06)'}}
          className="flex items-center justify-between px-6 py-5 md:px-12 max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <OliLogo size={24} bg="#080C10" />
            <span className="font-mono text-sm tracking-widest text-white/60 uppercase">Oli</span>
          </div>
          <div className="flex items-center gap-4">
            {!isLoggedIn && (
              <Link to="/auth"
                className="hidden md:block font-mono text-xs tracking-wider text-white/40 hover:text-white/80 transition-colors uppercase">
                (lang === 'el' ? 'Σύνδεση' : 'Sign in')
              </Link>
            )}
            <Link to={isLoggedIn ? "/chat" : "/auth"}
              className="cta-glow font-mono text-xs tracking-widest uppercase rounded-full bg-[#2EA043] px-6 py-2.5 text-white transition-all hover:bg-[#35b84d]">
              {isLoggedIn ? 'Άνοιξε →' : (lang === 'el' ? 'Ξεκίνα δωρεάν' : 'Start free')}
            </Link>
            <button
              onClick={() => setLang(lang === 'el' ? 'en' : 'el')}
              className="font-mono text-xs tracking-wider text-white/30 hover:text-white/70 transition-colors uppercase border border-white/10 rounded-full px-3 py-1.5">
              {lang === 'el' ? 'EN' : 'ΕΛ'}
            </button>
          </div>
        </nav>

        {/* ── HERO ── */}
        <section className="max-w-7xl mx-auto px-6 md:px-12 pt-16 pb-8 md:pt-24">
          <div className="md:grid md:grid-cols-2 md:gap-20 md:items-start">

            {/* Left: text */}
            <div className="relative">
              {/* Label */}
              <div className="fu1 flex items-center gap-3 mb-8">
                <div className="h-px w-8" style={{background:'rgba(46,160,67,0.6)'}} />
                <span className="font-mono text-xs tracking-[0.2em] text-[#2EA043] uppercase">
                  {lang === 'el' ? 'AI Γεωπόνος · Μεσόγειος' : 'AI Agronomist · Mediterranean'}
                </span>
              </div>

              {/* Hero headline — editorial layout */}
              <h1 className="font-display mb-8" style={{fontSize:'clamp(3.2rem,7vw,5.5rem)', lineHeight:1.05, letterSpacing:'-0.02em'}}>
                <span className="hw1 block text-white/30" style={{fontSize:'0.45em', fontStyle:'italic', fontWeight:300, letterSpacing:'0.05em', marginBottom:'0.3em'}}>
                  {lang === 'el' ? 'Ο γεωπόνος σου' : 'Your agronomist'}
                </span>
                <span className="hw2 block text-white">{lang === 'el' ? 'είναι' : 'is always'}</span>
                <span className="hw3 block" style={{color:'#2EA043', fontStyle:'italic'}}>{lang === 'el' ? 'πάντα' : 'available'}</span>
                {lang === 'el' && <span className="hw4 block text-white">διαθέσιμος.</span>}
              </h1>

              <p className="fu1 text-base leading-relaxed mb-8 max-w-md"
                style={{color:'rgba(232,237,242,0.55)', fontFamily:'Plus Jakarta Sans, sans-serif', fontWeight:400}}>
                {lang === 'el'
                  ? 'Φωτογράφισε ή γράψε τι βλέπεις στο χωράφι. Σε δευτερόλεπτα ξέρεις τι έχει, γιατί και τι να κάνεις. Για ελιές, λεμόνια, αμπέλι — ό,τι και να φυτεύεις.'
                  : 'Photo or text — describe what you see in your field. In seconds you know what it is, why, and what to do. For olives, citrus, vines — whatever you grow.'}
              </p>

              <div className="fu2 flex flex-col sm:flex-row gap-4 mb-12">
                <Link to={isLoggedIn ? "/chat" : "/auth"}
                  className="cta-glow inline-flex items-center justify-center gap-3 rounded-full bg-[#2EA043] px-8 py-4 font-mono text-sm tracking-wider text-white uppercase transition-all hover:bg-[#35b84d]">
                  <span>{isLoggedIn ? 'Συνέχισε' : 'Ξεκίνα δωρεάν'}</span>
                  <span className="text-white/60">→</span>
                </Link>
                <div className="flex items-center gap-2">
                  <div className="flex -space-x-2">
                    {['Γ','Ν','Κ','Β','Μ'].map((l,i)=>(
                      <div key={i} style={{background:`hsl(${140+i*8},40%,${22+i*3}%)`, border:'2px solid #080C10'}}
                        className="flex h-8 w-8 items-center justify-center rounded-full font-mono text-[10px] text-white/80">
                        {l}
                      </div>
                    ))}
                  </div>
                  <span className="font-mono text-xs text-white/30">lang === 'el' ? '+112 αγρότες' : '+112 farmers'</span>
                </div>
              </div>

              {/* Stats row */}
              <div className="fu3 flex items-start gap-0 mt-2">
                {STATS(lang).map((s,i) => (
                  <div key={i} className="flex-1 pr-6" style={{borderRight: i < 2 ? '1px solid rgba(46,160,67,0.15)' : 'none', marginRight: i < 2 ? '24px' : '0'}}>
                    <div className="font-display text-4xl font-light text-[#2EA043]" style={{letterSpacing:'-0.03em', lineHeight:1}}>
                      {s.n}
                    </div>
                    <div className="font-mono text-xs text-[#2EA043]/70 mt-0.5 tracking-wider">{s.unit}</div>
                    <div className="font-mono text-[11px] text-white/25 mt-1.5 leading-snug">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: phone mockup */}
            <div className="mt-16 md:mt-0 flex justify-center md:justify-end md:pt-8">
              <div className="phone-float relative w-[260px] md:w-[300px]">

                {/* Outer glow ring */}
                <div className="absolute inset-[-20px] rounded-[60px] opacity-30"
                  style={{background:'radial-gradient(ellipse, rgba(46,160,67,0.3) 0%, transparent 70%)', animation:'pulse-glow 4s ease-in-out infinite'}} />

                {/* Phone body */}
                <div className="relative rounded-[40px] overflow-hidden shadow-2xl"
                  style={{background:'linear-gradient(145deg, #1a2030 0%, #0f1520 100%)', border:'1.5px solid rgba(255,255,255,0.08)', boxShadow:'0 40px 80px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05)'}}>

                  {/* Screen bezel */}
                  <div className="p-[3px] rounded-[40px]">
                    <div className="rounded-[38px] overflow-hidden bg-[#080C10]">

                      {/* Notch */}
                      <div className="flex justify-center pt-3 pb-1">
                        <div className="h-1.5 w-16 rounded-full bg-[#161C23]" />
                      </div>

                      {/* App header */}
                      <div className="flex items-center justify-between px-4 py-2 border-b border-white/5">
                        <div className="flex items-center gap-2">
                          <OliLogo size={14} bg="#080C10" />
                          <span className="font-mono text-[11px] text-[#2EA043]">Oli</span>
                        </div>
                        <span className="font-mono text-[10px] text-white/20">9:41</span>
                      </div>

                      {/* Chat messages */}
                      <div className="space-y-3 p-4 pb-2">

                        {/* User message */}
                        <div className="flex justify-end">
                          <div className="rounded-2xl rounded-br-sm bg-[#2EA043] px-3 py-2 max-w-[80%]">
                            <p className="font-mono text-[10px] text-white leading-relaxed">
                              Τα φύλλα της ελιάς έχουν καφέ κηλίδες 📸
                            </p>
                          </div>
                        </div>

                        {/* AI response */}
                        <div className="w-[92%]">
                          <div className="rounded-2xl rounded-bl-sm px-3 py-2.5"
                            style={{background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.07)'}}>
                            <p className="font-mono text-[10px] text-white/80 leading-relaxed">
                              Φαίνεται <span className="text-[#2EA043] font-medium">Κυκλοκόνιο</span> (μυκητιακή ασθένεια).
                              Συνηθίζει να εμφανίζεται μετά από βροχές.
                            </p>
                          </div>
                        </div>

                        {/* Treatment cards */}
                        <div className="grid grid-cols-2 gap-2 mt-1">
                          <div className="rounded-xl p-2.5"
                            style={{background:'rgba(46,160,67,0.08)', border:'1px solid rgba(46,160,67,0.2)'}}>
                            <p className="font-mono text-[9px] text-[#2EA043] mb-1.5 font-medium">🌿 Βιολογικό</p>
                            <p className="font-mono text-[9px] text-white/60 leading-snug">Βορδ. πολτός 1%</p>
                          </div>
                          <div className="rounded-xl p-2.5"
                            style={{background:'rgba(96,165,250,0.06)', border:'1px solid rgba(96,165,250,0.15)'}}>
                            <p className="font-mono text-[9px] text-blue-400 mb-1.5 font-medium">⚗️ Χημικό</p>
                            <p className="font-mono text-[9px] text-white/60 leading-snug">Χαλκούχο μυκ.</p>
                          </div>
                        </div>

                        {/* Action pills */}
                        <div className="flex gap-1.5 flex-wrap">
                          {['Καταχώρηση','Κοινοποίηση'].map(l=>(
                            <span key={l} className="font-mono text-[9px] text-white/40 rounded-full px-2 py-1"
                              style={{border:'1px solid rgba(255,255,255,0.08)'}}>
                              {l}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Input */}
                      <div className="px-4 pb-4 pt-2 border-t border-white/5">
                        <div className="flex items-center gap-2 rounded-full px-3 py-2"
                          style={{background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.07)'}}>
                          <span className="flex-1 font-mono text-[10px] text-white/20">{lang === 'el' ? 'Ρώτησε τον Oli...' : 'Ask Oli...'}</span>
                          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#2EA043]">
                            <svg width="8" height="8" viewBox="0 0 10 10" fill="none" stroke="white" strokeWidth="1.5">
                              <path d="M2 5h6M5 2l3 3-3 3"/>
                            </svg>
                          </div>
                        </div>
                      </div>

                    </div>
                  </div>
                </div>

                {/* Floating notification badge */}
                <div className="absolute -right-4 top-1/3 rounded-2xl px-3 py-2 shadow-xl"
                  style={{background:'linear-gradient(135deg,#1a2030,#161c23)', border:'1px solid rgba(46,160,67,0.3)', boxShadow:'0 8px 32px rgba(0,0,0,0.4)'}}>
                  <p className="font-mono text-[9px] text-[#2EA043]">Υπενθύμιση σε</p>
                  <p className="font-display text-xl font-light text-white" style={{letterSpacing:'-0.02em'}}>13<span className="font-mono text-[10px] ml-1 text-white/40">μέρες</span></p>
                </div>

              </div>
            </div>
          </div>
        </section>

        {/* ── TICKER ── */}
        <div className="py-5 overflow-hidden" style={{borderTop:'1px solid rgba(255,255,255,0.04)', borderBottom:'1px solid rgba(255,255,255,0.04)', background:'rgba(46,160,67,0.02)'}}>
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 px-6 max-w-5xl mx-auto">
            {CROPS.map((c, i) => (
              <span key={i}
                className="font-mono text-xs tracking-wider transition-all duration-500 whitespace-nowrap"
                style={{
                  color: activeIndex === i ? '#2EA043' : 'rgba(232,237,242,0.18)',
                  transform: activeIndex === i ? 'scale(1.12)' : 'scale(1)',
                  textShadow: activeIndex === i ? '0 0 16px rgba(46,160,67,0.6)' : 'none',
                }}>
                {c}
              </span>
            ))}
          </div>
        </div>

        <div className="line-accent my-0" />

        {/* ── FEATURES ── */}
        <section className="max-w-7xl mx-auto px-6 md:px-12 py-24">
          <div className="flex items-end justify-between mb-16">
            <div>
              <span className="font-mono text-xs tracking-[0.2em] text-[#2EA043] uppercase">{lang === 'el' ? 'Δυνατότητες' : 'Features'}</span>
              <h2 className="font-display mt-2"
                style={{fontSize:'clamp(2rem,4vw,3rem)', lineHeight:1.1, letterSpacing:'-0.02em', color:'white'}}>
                {lang === 'el' ? 'Ό,τι χρειάζεται' : 'Everything a'}<br/>
                <em style={{color:'rgba(232,237,242,0.4)', fontWeight:300}}>{lang === 'el' ? 'ένας σύγχρονος αγρότης' : 'a modern farmer'}</em>
              </h2>
            </div>
            <Link to={isLoggedIn ? "/chat" : "/auth"}
              className="hidden md:flex items-center gap-2 font-mono text-xs tracking-wider text-white/30 hover:text-[#2EA043] transition-colors uppercase">
              Δες πώς λειτουργεί <span>→</span>
            </Link>
          </div>

          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {FEATURES(lang).map((f,i)=>(
              <div key={i} className="feature-card rounded-2xl p-6">
                <div className="font-display mb-4" style={{fontSize:'3.5rem', lineHeight:1, color:'rgba(46,160,67,0.2)', fontWeight:300, letterSpacing:'-0.04em'}}>
                  {f.n}
                </div>
                <h3 className="font-mono text-sm font-medium text-white mb-3 tracking-tight">
                  {f.title}
                </h3>
                <p className="text-sm leading-relaxed" style={{color:'rgba(232,237,242,0.45)', fontFamily:'Plus Jakarta Sans, sans-serif', fontWeight:400}}>
                  {f.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        <div className="line-accent" />

        {/* ── HOW IT WORKS ── */}
        <section className="max-w-5xl mx-auto px-6 md:px-12 py-24">
          <div className="text-center mb-16">
            <span className="font-mono text-xs tracking-[0.2em] text-[#2EA043] uppercase">{lang === 'el' ? 'Διαδικασία' : 'How it works'}</span>
            <h2 className="font-display mt-2"
              style={{fontSize:'clamp(2rem,4vw,3rem)', lineHeight:1.1, letterSpacing:'-0.02em', color:'white'}}>
              {lang === 'el' ? 'Τρία βήματα' : 'Three steps'}
            </h2>
          </div>

          <div className="space-y-3">
            {[
              { n:'01', t:lang==='el'?'Φωτογράφισε ή περίγραψε':'Photo or describe', b:lang==='el'?'Στείλε φωτογραφία ή γράψε τι βλέπεις. Ο Oli καταλαβαίνει ελληνικά και αγγλικά.':'Send a photo or describe what you see. Oli understands Greek and English.' },
              { n:'02', t:lang==='el'?'Πάρε διάγνωση και πλάνο':'Get a diagnosis and plan', b:lang==='el'?'Μαθαίνεις τι έχει, πόσο σοβαρό είναι, και τι να κάνεις — βιολογικά ή χημικά.':'You learn what it is, how serious, and what to do — organic or chemical, with exact dose.' },
              { n:'03', t:lang==='el'?'Κατέγραψε. Παρακολούθησε.':'Record. Follow up.', b:lang==='el'?'Ό,τι κάνεις μένει στο ιστορικό. Ο Oli σε ρωτά 13 μέρες μετά αν πέτυχε.':'Everything is recorded. Oli asks 13 days later if it worked.' },
            ].map((s,i)=>(
              <div key={i} className="feature-card rounded-2xl p-6 md:flex md:items-start md:gap-8">
                <div className="font-display flex-shrink-0 mb-3 md:mb-0"
                  style={{fontSize:'4rem', lineHeight:1, color:'rgba(46,160,67,0.15)', fontWeight:300, letterSpacing:'-0.04em', minWidth:'80px'}}>
                  {s.n}
                </div>
                <div>
                  <h3 className="font-mono text-base text-white mb-2 tracking-tight">{s.t}</h3>
                  <p className="text-sm leading-relaxed" style={{color:'rgba(232,237,242,0.45)', fontFamily:'Plus Jakarta Sans, sans-serif'}}>
                    {s.b}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="line-accent" />

        {/* ── CTA ── */}
        <section className="max-w-3xl mx-auto px-6 md:px-12 py-28 text-center">
          <span className="font-mono text-xs tracking-[0.2em] text-[#2EA043] uppercase">{lang === 'el' ? 'Ξεκίνα σήμερα' : 'Start today'}</span>
          <h2 className="font-display mt-4 mb-4"
            style={{fontSize:'clamp(2.5rem,6vw,4.5rem)', lineHeight:1.05, letterSpacing:'-0.03em', color:'white'}}>
            {lang === 'el' ? 'Ο πρώτος' : 'The first'}<br/>
            <em style={{color:'#2EA043'}}>{lang === 'el' ? 'AI γεωπόνος' : 'AI agronomist'}</em><br/>
            <span style={{color:'rgba(232,237,242,0.35)', fontWeight:300}}>{lang === 'el' ? 'για τον Μεσογειακό αγρότη.' : 'for the Mediterranean farmer.'}</span>
          </h2>

          <p className="mb-10 text-base leading-relaxed" style={{color:'rgba(232,237,242,0.4)', fontFamily:'Plus Jakarta Sans, sans-serif'}}>
            {lang === 'el' ? 'Δωρεάν για τις πρώτες 20 ερωτήσεις.' : 'Free for the first 20 questions.'}<br/>
            {lang === 'el' ? 'Δεν χρειάζεσαι πιστωτική κάρτα.' : 'No credit card needed.'}
          </p>

          <Link to={isLoggedIn ? "/chat" : "/auth"}
            className="cta-glow inline-flex items-center gap-4 rounded-full bg-[#2EA043] px-10 py-5 font-mono text-sm tracking-widest text-white uppercase transition-all hover:bg-[#35b84d]">
            {isLoggedIn ? (lang === 'el' ? 'Συνέχισε στο Oli' : 'Continue to Oli') : (lang === 'el' ? 'Ξεκίνα δωρεάν — χωρίς κάρτα' : 'Start free — no card')}
            <span className="text-white/50">→</span>
          </Link>

          {!isLoggedIn && (
            <p className="mt-6 font-mono text-xs text-white/20">
              {lang === 'el' ? 'Έχεις ήδη λογαριασμό;' : 'Already have an account?'}{' '}
              <Link to="/auth" className="text-[#2EA043] hover:underline">{lang === 'el' ? 'Σύνδεση' : 'Sign in'}</Link>
            </p>
          )}
        </section>

        {/* ── FOOTER ── */}
        <footer style={{borderTop:'1px solid rgba(255,255,255,0.05)'}} className="px-6 py-8 md:px-12">
          <div className="max-w-7xl mx-auto flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <svg width="16" height="16" viewBox="0 0 32 32">
                <ellipse cx="16" cy="7"  rx="7" ry="10" fill="#2D6A4F"/>
                <ellipse cx="16" cy="25" rx="7" ry="10" fill="#2D6A4F"/>
                <ellipse cx="7"  cy="16" rx="10" ry="7" fill="#2EA043"/>
                <ellipse cx="25" cy="16" rx="10" ry="7" fill="#2EA043"/>
                <circle  cx="16" cy="16" r="5"  fill="#080C10"/>
              </svg>
              <span className="font-mono text-xs text-white/20">Oli © 2026</span>
            </div>
            <div className="flex gap-6 font-mono text-xs text-white/20">
              <Link to="/legal/privacy" className="hover:text-white/60 transition-colors">{lang === 'el' ? 'Απόρρητο' : 'Privacy'}</Link>
              <Link to="/legal/terms"   className="hover:text-white/60 transition-colors">{lang === 'el' ? 'Όροι' : 'Terms'}</Link>
            </div>
          </div>
        </footer>

      </div>
    </div>
  );
}
