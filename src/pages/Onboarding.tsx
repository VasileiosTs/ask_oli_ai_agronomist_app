import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../lib/LanguageContext';

export default function Onboarding() {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [crop, setCrop] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const { t } = useLanguage();

  const handleNext = () => {
    if (step === 1 && name.trim()) setStep(2);
    else if (step === 2 && location.trim()) setStep(3);
  };

  const handleComplete = async () => {
    if (!user || !crop.trim()) return;
    setLoading(true);
    setError(null);

    let lat = null, lon = null;
    try {
      const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1&language=el&format=json`);
      const data = await res.json();
      if (data.results?.[0]) { lat = data.results[0].latitude; lon = data.results[0].longitude; }
    } catch { /* geocoding optional */ }

    const { error: err } = await supabase.from('users').upsert({
      auth_id: user.id, name, location, location_lat: lat, location_lon: lon,
      primary_crop: crop, onboarding_complete: true,
    }, { onConflict: 'auth_id' });

    setLoading(false);
    if (!err) { window.location.assign('/chat'); }
    else { setError(t.savingError); }
  };

  const steps = [
    { q: t.step1Q, p: t.step1P, val: name, set: setName },
    { q: t.step2Q, p: t.step2P, val: location, set: setLocation },
    { q: t.step3Q, p: t.step3P, val: crop, set: setCrop },
  ];
  const cur = steps[step - 1];

  return (
    <div className="flex min-h-[100dvh] flex-col bg-background p-4">
      <div className="mx-auto w-full max-w-[420px] flex-1 flex flex-col pt-8">
        <div className="mb-8 flex gap-2">
          {[1, 2, 3].map(i => (
            <div key={i} className={`h-1.5 flex-1 rounded-full ${i <= step ? 'bg-primary' : 'bg-border'}`} />
          ))}
        </div>

        <div className="flex-1 animate-fade-in">
          <h2 className="mb-6 text-2xl font-bold text-foreground">{cur.q}</h2>
          <input
            type="text" value={cur.val}
            onChange={e => cur.set(e.target.value)}
            placeholder={cur.p}
            className="w-full rounded-[22px] border border-border bg-surface px-4 py-3 text-foreground placeholder:text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            autoFocus
            onKeyDown={e => e.key === 'Enter' && (step < 3 ? handleNext() : handleComplete())}
          />
          {step === 3 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {t.crops.map(c => (
                <button key={c} onClick={() => setCrop(c)}
                  className={`rounded-full border px-4 py-2 text-sm transition-colors ${crop === c ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-surface text-muted hover:text-foreground'}`}>
                  {c}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="mt-8 pb-safe">
          {error && <p className="mb-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</p>}
          {step < 3 ? (
            <button onClick={handleNext}
              disabled={(step === 1 && !name.trim()) || (step === 2 && !location.trim())}
              className="w-full rounded-[22px] bg-primary px-4 py-3 font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50">
              {t.next}
            </button>
          ) : (
            <button onClick={handleComplete} disabled={!crop.trim() || loading}
              className="w-full rounded-[22px] bg-primary px-4 py-3 font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50">
              {loading ? t.saving : t.letsGo}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
