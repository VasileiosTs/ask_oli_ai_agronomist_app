import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const FEATURES = [
  {
    icon: '📸',
    title: 'Φωτογράφισε, διάγνωσε',
    body: 'Τράβα φωτογραφία από το χωράφι σου. Ο Oli αναγνωρίζει ασθένειες, ελλείψεις θρεπτικών και εχθρούς σε δευτερόλεπτα.',
  },
  {
    icon: '🧠',
    title: 'Θυμάται το ιστορικό σου',
    body: 'Κάθε παρέμβαση καταγράφεται. Ο Oli ξέρει τι έχεις κάνει και σε ρωτά αν λειτούργησε — 13 μέρες μετά.',
  },
  {
    icon: '🌿',
    title: 'Βιολογικό ή χημικό',
    body: 'Λαμβάνεις και τις δύο επιλογές για κάθε πρόβλημα — με ακριβή δοσολογία και μέθοδο εφαρμογής.',
  },
  {
    icon: '📅',
    title: 'Εβδομαδιαίο πλάνο',
    body: 'Κάθε Δευτέρα πρωί, ένα προσωποποιημένο πλάνο για την εβδομάδα — με βάση την εποχή, την τοποθεσία σου και τις καλλιέργειές σου.',
  },
];

const CROPS = ['Ελιές', 'Εσπεριδοειδή', 'Αμπέλι', 'Τομάτες', 'Πατάτες', 'Ροδάκινα', 'Σύκα', 'Αχλάδια'];

export default function Landing() {
  const { user, profile } = useAuth();
  const isLoggedIn = !!(user && profile);

  return (
    <div className="min-h-[100dvh] bg-[#0D1117] text-white overflow-x-hidden">

      {/* Google Fonts */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;1,400&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet" />

      <style>{`
        .font-display { font-family: 'Playfair Display', serif; }
        .font-body { font-family: 'DM Sans', sans-serif; }
        .grain { background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E"); }
        @keyframes fadeUp { from { opacity:0; transform:translateY(24px); } to { opacity:1; transform:translateY(0); } }
        @keyframes floatSlow { 0%,100% { transform:translateY(0px); } 50% { transform:translateY(-10px); } }
        .anim-1 { animation: fadeUp 0.7s ease both; }
        .anim-2 { animation: fadeUp 0.7s 0.15s ease both; }
        .anim-3 { animation: fadeUp 0.7s 0.3s ease both; }
        .anim-4 { animation: fadeUp 0.7s 0.45s ease both; }
        .float { animation: floatSlow 6s ease-in-out infinite; }
        .glow { box-shadow: 0 0 80px rgba(46,160,67,0.15); }
      `}</style>

      {/* Nav */}
      <nav className="font-body flex items-center justify-between px-6 py-5 md:px-12 max-w-6xl mx-auto">
        <div className="flex items-center gap-2.5">
          <svg width="22" height="22" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <ellipse cx="16" cy="7" rx="7" ry="10" fill="#2D6A4F"/>
            <ellipse cx="16" cy="25" rx="7" ry="10" fill="#2D6A4F"/>
            <ellipse cx="7" cy="16" rx="10" ry="7" fill="#2EA043"/>
            <ellipse cx="25" cy="16" rx="10" ry="7" fill="#2EA043"/>
            <circle cx="16" cy="16" r="5" fill="#0D1117"/>
          </svg>
          <span className="font-display text-lg font-bold text-white tracking-tight">Oli</span>
        </div>
        <div className="flex items-center gap-3">
          {isLoggedIn ? (
            <Link to="/chat"
              className="font-body rounded-full bg-[#2EA043] px-5 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90">
              Άνοιξε το Oli →
            </Link>
          ) : (
            <>
              <Link to="/auth"
                className="font-body text-sm text-[#8B949E] transition-colors hover:text-white hidden md:block">
                Σύνδεση
              </Link>
              <Link to="/auth"
                className="font-body rounded-full bg-[#2EA043] px-5 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90">
                Ξεκίνα δωρεάν
              </Link>
            </>
          )}
        </div>
      </nav>

      {/* Hero */}
      <section className="grain relative px-6 pt-12 pb-20 md:px-12 md:pt-20 max-w-6xl mx-auto">
        <div className="md:grid md:grid-cols-2 md:gap-16 md:items-center">

          <div>
            <div className="anim-1 mb-5 inline-flex items-center gap-2 rounded-full border border-[#2EA043]/30 bg-[#2EA043]/8 px-4 py-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-[#2EA043]" />
              <span className="font-body text-xs font-medium text-[#2EA043]">AI Γεωπόνος για τον Μεσογειακό αγρότη</span>
            </div>

            <h1 className="anim-2 font-display text-[2.8rem] leading-[1.1] tracking-tight text-white md:text-[3.6rem]">
              Ο γεωπόνος<br />
              <em className="text-[#2EA043] not-italic">στην τσέπη σου</em>
            </h1>

            <p className="anim-3 font-body mt-5 text-[1.05rem] leading-relaxed text-[#8B949E] max-w-md">
              Φωτογράφισε το πρόβλημα. Πάρε διάγνωση σε δευτερόλεπτα.
              Οργανικές και χημικές επιλογές, με ακριβή δοσολογία.
              Για ελαιώνες, εσπεριδοειδή, αμπέλια — ό,τι καλλιεργείς.
            </p>

            <div className="anim-4 mt-8 flex flex-col gap-3 sm:flex-row">
              <Link to="/auth"
                className="font-body flex items-center justify-center gap-2 rounded-full bg-[#2EA043] px-7 py-3.5 text-base font-medium text-white transition-opacity hover:opacity-90 glow">
                Ξεκίνα δωρεάν
                <span className="text-white/70 text-sm">— 20 ερωτήσεις</span>
              </Link>
            </div>

            {/* Social proof */}
            <div className="anim-4 mt-8 flex items-center gap-3">
              <div className="flex -space-x-2">
                {['Γ','Κ','Ν','Μ'].map((l,i) => (
                  <div key={i} className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-[#0D1117] bg-[#2D6A4F] text-[11px] font-semibold text-white">
                    {l}
                  </div>
                ))}
              </div>
              <p className="font-body text-sm text-[#8B949E]">
                Ήδη βοηθάμε αγρότες σε Ελλάδα και Κύπρο
              </p>
            </div>
          </div>

          {/* Phone mockup */}
          <div className="float mt-16 md:mt-0 flex justify-center md:justify-end">
            <div className="relative w-[240px] md:w-[280px]">
              {/* Glow behind phone */}
              <div className="absolute inset-0 rounded-[40px] bg-[#2EA043]/10 blur-3xl scale-110" />
              {/* Phone frame */}
              <div className="relative rounded-[36px] border border-white/10 bg-[#161C23] p-3 shadow-2xl">
                <div className="rounded-[28px] bg-[#0D1117] overflow-hidden">
                  {/* Status bar */}
                  <div className="flex items-center justify-between px-5 pt-3 pb-1">
                    <span className="font-body text-[10px] text-[#8B949E]">9:41</span>
                    <div className="flex gap-1">
                      <div className="h-1.5 w-4 rounded-full bg-[#8B949E]/40" />
                      <div className="h-1.5 w-4 rounded-full bg-[#8B949E]/40" />
                    </div>
                  </div>
                  {/* Chat header */}
                  <div className="flex items-center gap-2 border-b border-white/5 px-4 py-2">
                    <svg width="14" height="14" viewBox="0 0 32 32">
                      <ellipse cx="16" cy="7" rx="7" ry="10" fill="#2D6A4F"/>
                      <ellipse cx="16" cy="25" rx="7" ry="10" fill="#2D6A4F"/>
                      <ellipse cx="7" cy="16" rx="10" ry="7" fill="#2EA043"/>
                      <ellipse cx="25" cy="16" rx="10" ry="7" fill="#2EA043"/>
                      <circle cx="16" cy="16" r="5" fill="#0D1117"/>
                    </svg>
                    <span className="font-body text-xs font-medium text-[#2EA043]">Oli</span>
                  </div>
                  {/* Mock messages */}
                  <div className="space-y-3 p-4">
                    <div className="ml-auto w-[80%] rounded-2xl rounded-br-sm bg-[#2EA043] px-3 py-2">
                      <p className="font-body text-[11px] leading-relaxed text-white">Τα φύλλα στις ελιές μου έχουν κίτρινες κηλίδες 📸</p>
                    </div>
                    <div className="w-[90%] rounded-2xl rounded-bl-sm border border-white/8 bg-[#161C23] px-3 py-2.5">
                      <p className="font-body text-[11px] leading-relaxed text-white/90">Φαίνεται σαν <strong className="text-[#2EA043]">Κυκλοκόνιο</strong> (Cycloconium oleaginum). Εμφανίζεται συνήθως μετά από βροχές.</p>
                    </div>
                    <div className="w-[90%] rounded-2xl rounded-bl-sm border border-[#2EA043]/20 bg-[#2EA043]/5 px-3 py-2.5">
                      <p className="font-body text-[10px] font-medium text-[#2EA043] mb-1">🌿 Βιολογική αντιμετώπιση</p>
                      <p className="font-body text-[11px] text-white/80">Βορδιγάλειος πολτός 1% — εφαρμογή μετά τη βροχή</p>
                    </div>
                  </div>
                  {/* Input bar */}
                  <div className="border-t border-white/5 px-4 pb-4 pt-2">
                    <div className="flex items-center gap-2 rounded-full border border-white/10 bg-[#161C23] px-3 py-2">
                      <span className="font-body flex-1 text-[11px] text-[#8B949E]/60">Ρώτησε τον Oli...</span>
                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#2EA043]/30">
                        <svg width="8" height="8" viewBox="0 0 10 10" fill="#2EA043">
                          <path d="M1 5h8M5 1l4 4-4 4"/>
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Crops ticker */}
      <div className="border-y border-white/5 bg-[#161C23]/50 py-3 overflow-hidden">
        <div className="flex gap-8 whitespace-nowrap font-body text-sm text-[#8B949E]" style={{animation:'none'}}>
          {[...CROPS,...CROPS].map((c,i) => (
            <span key={i} className="flex items-center gap-2">
              <span className="h-1 w-1 rounded-full bg-[#2EA043]/50" />
              {c}
            </span>
          ))}
        </div>
      </div>

      {/* Features */}
      <section className="px-6 py-20 md:px-12 max-w-6xl mx-auto">
        <div className="mb-12 text-center">
          <h2 className="font-display text-3xl text-white md:text-4xl">
            Τι κάνει ο <em className="text-[#2EA043] not-italic">Oli</em>
          </h2>
          <p className="font-body mt-3 text-[#8B949E]">Σχεδιασμένο για τον πραγματικό αγρότη — όχι για τον laptop</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f, i) => (
            <div key={i} className="rounded-2xl border border-white/8 bg-[#161C23] p-5 transition-colors hover:border-[#2EA043]/30">
              <div className="mb-3 text-2xl">{f.icon}</div>
              <h3 className="font-body mb-2 text-sm font-medium text-white">{f.title}</h3>
              <p className="font-body text-sm leading-relaxed text-[#8B949E]">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="px-6 py-16 md:px-12 max-w-4xl mx-auto">
        <h2 className="font-display mb-10 text-center text-3xl text-white">
          Τρία βήματα
        </h2>
        <div className="space-y-4">
          {[
            { n:'01', title:'Φωτογράφισε ή περίγραψε', body:'Στείλε φωτογραφία ή γράψε τι βλέπεις. Ο Oli καταλαβαίνει ελληνικά.' },
            { n:'02', title:'Πάρε άμεση διάγνωση', body:'Σε δευτερόλεπτα έχεις αιτία, σοβαρότητα, και πλάνο αντιμετώπισης.' },
            { n:'03', title:'Κατέγραψε και παρακολούθησε', body:'Η παρέμβαση αποθηκεύεται. 13 μέρες μετά σε ρωτά αν λειτούργησε.' },
          ].map((s,i) => (
            <div key={i} className="flex items-start gap-5 rounded-2xl border border-white/8 bg-[#161C23] p-5">
              <span className="font-display text-3xl font-bold text-[#2EA043]/30 leading-none flex-shrink-0">{s.n}</span>
              <div>
                <h3 className="font-body font-medium text-white mb-1">{s.title}</h3>
                <p className="font-body text-sm text-[#8B949E] leading-relaxed">{s.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-20 md:px-12 max-w-2xl mx-auto text-center">
        <div className="rounded-3xl border border-[#2EA043]/20 bg-[#2EA043]/5 p-10">
          <h2 className="font-display text-3xl text-white md:text-4xl mb-3">
            Ξεκίνα σήμερα
          </h2>
          <p className="font-body text-[#8B949E] mb-8 leading-relaxed">
            Δωρεάν για τις πρώτες 20 ερωτήσεις.<br />
            Δεν χρειάζεσαι πιστωτική κάρτα.
          </p>
          <Link to="/auth"
            className="font-body inline-flex items-center gap-2 rounded-full bg-[#2EA043] px-8 py-4 text-base font-medium text-white transition-opacity hover:opacity-90 glow">
            Δημιούργησε λογαριασμό
          </Link>
          <p className="font-body mt-6 text-xs text-[#8B949E]/60">
            Ήδη έχεις λογαριασμό;{' '}
            <Link to="/auth" className="text-[#2EA043] hover:underline">Σύνδεση</Link>
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 px-6 py-8 md:px-12">
        <div className="max-w-6xl mx-auto flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 32 32">
              <ellipse cx="16" cy="7" rx="7" ry="10" fill="#2D6A4F"/>
              <ellipse cx="16" cy="25" rx="7" ry="10" fill="#2D6A4F"/>
              <ellipse cx="7" cy="16" rx="10" ry="7" fill="#2EA043"/>
              <ellipse cx="25" cy="16" rx="10" ry="7" fill="#2EA043"/>
              <circle cx="16" cy="16" r="5" fill="#0D1117"/>
            </svg>
            <span className="font-body text-sm text-[#8B949E]">Oli © 2026 · AI Γεωπόνος</span>
          </div>
          <div className="flex gap-5 font-body text-sm text-[#8B949E]">
            <Link to="/legal/privacy" className="hover:text-white transition-colors">Απόρρητο</Link>
            <Link to="/legal/terms" className="hover:text-white transition-colors">Όροι</Link>
          </div>
        </div>
      </footer>

    </div>
  );
}
