import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const CROPS = [
  'Ελιές','Λεμόνια','Πορτοκάλια','Μανταρίνια','Αμπέλι','Τομάτες',
  'Ροδάκινα','Βερίκοκα','Κεράσια','Σύκα','Ρόδια','Αβοκάντο',
  'Πιπεριές','Μελιτζάνες','Αγγούρια','Κολοκύθια','Πατάτες',
  'Σιτάρι','Κριθάρι','Αραβόσιτος','Ηλίανθος','Βαμβάκι',
  'Αρακάς','Φασόλια','Σκόρδο','Κρεμμύδια','Μήλα','Αχλάδια',
  'Μανιτάρια','Σπανάκι','Μαρούλι','Φράουλες',
];

const STATS = [
  { n: '20', unit: 'δωρεάν', label: 'ερωτήσεις για νέους χρήστες' },
  { n: '13', unit: 'μέρες', label: 'follow-up μετά κάθε παρέμβαση' },
  { n: '2', unit: 'γλώσσες', label: 'Ελληνικά & Αγγλικά' },
];

const FEATURES = [
  {
    n: '01',
    title: 'Διάγνωση από φωτογραφία',
    body: 'Τράβα φωτογραφία από το χωράφι. Ο Oli αναγνωρίζει ασθένειες, ελλείψεις θρεπτικών και εχθρούς — σε δευτερόλεπτα, με ακριβείς συστάσεις.',
  },
  {
    n: '02',
    title: 'Βιολογικό & χημικό πλάνο',
    body: 'Κάθε διάγνωση συνοδεύεται από δύο πλάνα αντιμετώπισης — βιολογικό και χημικό — με ακριβή δοσολογία και μέθοδο εφαρμογής.',
  },
  {
    n: '03',
    title: 'Μνήμη καλλιέργειας',
    body: 'Κάθε παρέμβαση αποθηκεύεται. Ο Oli θυμάται το ιστορικό κάθε χωραφιού και σε ρωτά αν λειτούργησε — 13 μέρες μετά.',
  },
  {
    n: '04',
    title: 'Εβδομαδιαίο πλάνο',
    body: 'Κάθε Δευτέρα πρωί, ένα προσωποποιημένο αγρονομικό πλάνο — βασισμένο στην εποχή, την τοποθεσία και τις καλλιέργειές σου.',
  },
];

export default function Landing() {
  const { user, profile } = useAuth();
  const isLoggedIn = !!(user && profile);
  const tickerRef = useRef<HTMLDivElement>(null);

  return (
    <div className="landing-root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;0,700;1,300;1,400&family=Syne:wght@400;500;600;700&family=DM+Mono:wght@300;400&display=swap');

        .landing-root {
          min-height: 100dvh;
          background: #080C10;
          color: #E8EDF2;
          font-family: 'Syne', sans-serif;
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
        .font-display { font-family: 'Cormorant Garamond', serif; }
        .font-mono { font-family: 'DM Mono', monospace; }

        /* Animations */
        @keyframes heroWord {
          from { opacity: 0; transform: translateY(20px); filter: blur(4px); }
          to   { opacity: 1; transform: translateY(0);    filter: blur(0); }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(32px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes ticker {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
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

        .ticker-track { animation: ticker 40s linear infinite; display: flex; width: max-content; }
        .ticker-track:hover { animation-play-state: paused; }

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
          font-family: 'Cormorant Garamond', serif;
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
            <svg width="24" height="24" viewBox="0 0 32 32">
              <ellipse cx="16" cy="7"  rx="7" ry="10" fill="#2D6A4F"/>
              <ellipse cx="16" cy="25" rx="7" ry="10" fill="#2D6A4F"/>
              <ellipse cx="7"  cy="16" rx="10" ry="7" fill="#2EA043"/>
              <ellipse cx="25" cy="16" rx="10" ry="7" fill="#2EA043"/>
              <circle  cx="16" cy="16" r="5"  fill="#080C10"/>
            </svg>
            <span className="font-mono text-sm tracking-widest text-white/60 uppercase">Oli</span>
          </div>
          <div className="flex items-center gap-4">
            {!isLoggedIn && (
              <Link to="/auth"
                className="hidden md:block font-mono text-xs tracking-wider text-white/40 hover:text-white/80 transition-colors uppercase">
                Σύνδεση
              </Link>
            )}
            <Link to={isLoggedIn ? "/chat" : "/auth"}
              className="cta-glow font-mono text-xs tracking-widest uppercase rounded-full bg-[#2EA043] px-6 py-2.5 text-white transition-all hover:bg-[#35b84d]">
              {isLoggedIn ? 'Άνοιξε →' : 'Ξεκίνα δωρεάν'}
            </Link>
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
                  AI Γεωπόνος · Μεσόγειος
                </span>
              </div>

              {/* Hero headline — editorial layout */}
              <h1 className="font-display mb-8" style={{fontSize:'clamp(3.2rem,7vw,5.5rem)', lineHeight:1.05, letterSpacing:'-0.02em'}}>
                <span className="hw1 block text-white/30" style={{fontSize:'0.45em', fontStyle:'italic', fontWeight:300, letterSpacing:'0.05em', marginBottom:'0.3em'}}>
                  Ο γεωπόνος σου
                </span>
                <span className="hw2 block text-white">είναι</span>
                <span className="hw3 block" style={{color:'#2EA043', fontStyle:'italic'}}>πάντα</span>
                <span className="hw4 block text-white">διαθέσιμος.</span>
              </h1>

              <p className="fu1 text-base leading-relaxed mb-8 max-w-md"
                style={{color:'rgba(232,237,242,0.55)', fontFamily:'Syne, sans-serif', fontWeight:400}}>
                Φωτογράφισε το πρόβλημα. Πάρε διάγνωση σε δευτερόλεπτα.
                Βιολογικές και χημικές επιλογές, με ακριβή δοσολογία.
                Για ελαιώνες, εσπεριδοειδή, αμπέλια — ό,τι καλλιεργείς.
              </p>

              <div className="fu2 flex flex-col sm:flex-row gap-4 mb-12">
                <Link to={isLoggedIn ? "/chat" : "/auth"}
                  className="cta-glow inline-flex items-center justify-center gap-3 rounded-full bg-[#2EA043] px-8 py-4 font-mono text-sm tracking-wider text-white uppercase transition-all hover:bg-[#35b84d]">
                  <span>{isLoggedIn ? 'Συνέχισε' : 'Δημιούργησε λογαριασμό'}</span>
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
                  <span className="font-mono text-xs text-white/30">+112 αγρότες</span>
                </div>
              </div>

              {/* Stats row */}
              <div className="fu3 grid grid-cols-3 gap-4">
                {STATS.map((s,i) => (
                  <div key={i} className="border-l-2 border-[#2EA043]/30 pl-4">
                    <div className="font-display text-3xl font-light text-[#2EA043]" style={{letterSpacing:'-0.02em'}}>
                      {s.n}
                      <span className="font-mono text-xs ml-1 text-[#2EA043]/60">{s.unit}</span>
                    </div>
                    <div className="font-mono text-[10px] text-white/30 mt-1 leading-snug">{s.label}</div>
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
                          <svg width="14" height="14" viewBox="0 0 32 32">
                            <ellipse cx="16" cy="7"  rx="7" ry="10" fill="#2D6A4F"/>
                            <ellipse cx="16" cy="25" rx="7" ry="10" fill="#2D6A4F"/>
                            <ellipse cx="7"  cy="16" rx="10" ry="7" fill="#2EA043"/>
                            <ellipse cx="25" cy="16" rx="10" ry="7" fill="#2EA043"/>
                            <circle  cx="16" cy="16" r="5"  fill="#080C10"/>
                          </svg>
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
                              Διαγιγνώσκω <span className="text-[#2EA043] font-medium">Κυκλοκόνιο</span> — Cycloconium oleaginum.
                              Εμφανίζεται μετά από υγρασία.
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
                          <span className="flex-1 font-mono text-[10px] text-white/20">Ρώτησε τον Oli...</span>
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
                  <p className="font-mono text-[9px] text-[#2EA043]">Follow-up σε</p>
                  <p className="font-display text-xl font-light text-white" style={{letterSpacing:'-0.02em'}}>13<span className="font-mono text-[10px] ml-1 text-white/40">μέρες</span></p>
                </div>

              </div>
            </div>
          </div>
        </section>

        {/* ── TICKER ── */}
        <div className="py-4 overflow-hidden" style={{borderTop:'1px solid rgba(255,255,255,0.04)', borderBottom:'1px solid rgba(255,255,255,0.04)', background:'rgba(46,160,67,0.02)'}}>
          <div className="ticker-track">
            {[...CROPS,...CROPS,...CROPS,...CROPS].map((c,i)=>(
              <span key={i} className="font-mono text-xs tracking-wider mx-6 whitespace-nowrap"
                style={{color: i % 7 === 0 ? '#2EA043' : 'rgba(232,237,242,0.2)'}}>
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
              <span className="font-mono text-xs tracking-[0.2em] text-[#2EA043] uppercase">Δυνατότητες</span>
              <h2 className="font-display mt-2"
                style={{fontSize:'clamp(2rem,4vw,3rem)', lineHeight:1.1, letterSpacing:'-0.02em', color:'white'}}>
                Ό,τι χρειάζεται<br/>
                <em style={{color:'rgba(232,237,242,0.4)', fontWeight:300}}>ένας σύγχρονος αγρότης</em>
              </h2>
            </div>
            <Link to={isLoggedIn ? "/chat" : "/auth"}
              className="hidden md:flex items-center gap-2 font-mono text-xs tracking-wider text-white/30 hover:text-[#2EA043] transition-colors uppercase">
              Δες πώς λειτουργεί <span>→</span>
            </Link>
          </div>

          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f,i)=>(
              <div key={i} className="feature-card rounded-2xl p-6">
                <div className="font-display mb-4" style={{fontSize:'3.5rem', lineHeight:1, color:'rgba(46,160,67,0.2)', fontWeight:300, letterSpacing:'-0.04em'}}>
                  {f.n}
                </div>
                <h3 className="font-mono text-sm font-medium text-white mb-3 tracking-tight">
                  {f.title}
                </h3>
                <p className="text-sm leading-relaxed" style={{color:'rgba(232,237,242,0.45)', fontFamily:'Syne,sans-serif', fontWeight:400}}>
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
            <span className="font-mono text-xs tracking-[0.2em] text-[#2EA043] uppercase">Διαδικασία</span>
            <h2 className="font-display mt-2"
              style={{fontSize:'clamp(2rem,4vw,3rem)', lineHeight:1.1, letterSpacing:'-0.02em', color:'white'}}>
              Τρία βήματα
            </h2>
          </div>

          <div className="space-y-3">
            {[
              { n:'01', t:'Φωτογράφισε ή περίγραψε', b:'Στείλε φωτογραφία ή γράψε τι βλέπεις. Ο Oli καταλαβαίνει ελληνικά και αγγλικά — και ξέρει πότε να ζητήσει περισσότερες λεπτομέρειες.' },
              { n:'02', t:'Πάρε διάγνωση και πλάνο', b:'Αιτία, σοβαρότητα, βιολογική και χημική αντιμετώπιση — με ακριβή δοσολογία, μέθοδο εφαρμογής και χρονισμό.' },
              { n:'03', t:'Κατέγραψε. Παρακολούθησε.', b:'Κάθε παρέμβαση αποθηκεύεται αυτόματα. Ο Oli σε ρωτά 13 μέρες μετά αν λειτούργησε — και μαθαίνει από την απάντησή σου.' },
            ].map((s,i)=>(
              <div key={i} className="feature-card rounded-2xl p-6 md:flex md:items-start md:gap-8">
                <div className="font-display flex-shrink-0 mb-3 md:mb-0"
                  style={{fontSize:'4rem', lineHeight:1, color:'rgba(46,160,67,0.15)', fontWeight:300, letterSpacing:'-0.04em', minWidth:'80px'}}>
                  {s.n}
                </div>
                <div>
                  <h3 className="font-mono text-base text-white mb-2 tracking-tight">{s.t}</h3>
                  <p className="text-sm leading-relaxed" style={{color:'rgba(232,237,242,0.45)', fontFamily:'Syne,sans-serif'}}>
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
          <span className="font-mono text-xs tracking-[0.2em] text-[#2EA043] uppercase">Ξεκίνα σήμερα</span>
          <h2 className="font-display mt-4 mb-4"
            style={{fontSize:'clamp(2.5rem,6vw,4.5rem)', lineHeight:1.05, letterSpacing:'-0.03em', color:'white'}}>
            Ο πρώτος<br/>
            <em style={{color:'#2EA043'}}>AI γεωπόνος</em><br/>
            <span style={{color:'rgba(232,237,242,0.35)', fontWeight:300}}>για τον Μεσογειακό αγρότη.</span>
          </h2>

          <p className="mb-10 text-base leading-relaxed" style={{color:'rgba(232,237,242,0.4)', fontFamily:'Syne,sans-serif'}}>
            Δωρεάν για τις πρώτες 20 ερωτήσεις.<br/>
            Δεν χρειάζεσαι πιστωτική κάρτα.
          </p>

          <Link to={isLoggedIn ? "/chat" : "/auth"}
            className="cta-glow inline-flex items-center gap-4 rounded-full bg-[#2EA043] px-10 py-5 font-mono text-sm tracking-widest text-white uppercase transition-all hover:bg-[#35b84d]">
            {isLoggedIn ? 'Συνέχισε στο Oli' : 'Δημιούργησε δωρεάν λογαριασμό'}
            <span className="text-white/50">→</span>
          </Link>

          {!isLoggedIn && (
            <p className="mt-6 font-mono text-xs text-white/20">
              Έχεις ήδη λογαριασμό;{' '}
              <Link to="/auth" className="text-[#2EA043] hover:underline">Σύνδεση</Link>
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
              <Link to="/legal/privacy" className="hover:text-white/60 transition-colors">Απόρρητο</Link>
              <Link to="/legal/terms"   className="hover:text-white/60 transition-colors">Όροι</Link>
            </div>
          </div>
        </footer>

      </div>
    </div>
  );
}
