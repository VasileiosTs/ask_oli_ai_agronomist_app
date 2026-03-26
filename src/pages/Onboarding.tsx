import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../lib/LanguageContext';
import { trackEvent, identifyUser, Events } from '../lib/analytics';

export default function Onboarding() {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [crops, setCrops] = useState<string[]>([]);
  const [customCrop, setCustomCrop] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user, refreshProfile } = useAuth();
  const { t, lang } = useLanguage();
  const navigate = useNavigate();

  const handleNext = () => {
    if (step === 1 && name.trim()) setStep(2);
    else if (step === 2 && location.trim()) setStep(3);
  };

  const toggleCrop = (c: string) => {
    setCrops(prev =>
      prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]
    );
  };

  const addCustomCrop = () => {
    const v = customCrop.trim();
    if (v && !crops.includes(v)) {
      setCrops(prev => [...prev, v]);
      setCustomCrop('');
    }
  };

  const allCrops = crops.join(', ');
  const canFinish = crops.length > 0 || customCrop.trim().length > 0;

  const handleComplete = async () => {
    if (!user) return;

    // include any typed but not-added custom crop
    const finalCrops = customCrop.trim()
      ? [...new Set([...crops, customCrop.trim()])]
      : crops;

    if (finalCrops.length === 0) return;

    setLoading(true);
    setError(null);

    let lat = null, lon = null;
    try {
      const res = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1&language=el&format=json`
      );
      const data = await res.json();
      if (data.results?.[0]) {
        lat = data.results[0].latitude;
        lon = data.results[0].longitude;
      }
    } catch { /* geocoding is optional */ }

    // Check for referral from shared diagnosis
    const referral = localStorage.getItem('oli_referral');

    const payload: Record<string, unknown> = {
      auth_id: user.id,
      name: name.trim(),
      location: location.trim(),
      location_lat: lat,
      location_lon: lon,
      primary_crop: finalCrops.join(', '),
      onboarding_complete: true,
    };
    if (referral) {
      payload.referred_by_share_id = referral;
      localStorage.removeItem('oli_referral');
    }

    const { error: upsertError } = await supabase
      .from('users')
      .upsert(payload, { onConflict: 'auth_id' });

    if (upsertError) {
      console.error('Onboarding upsert error:', upsertError);
      setError(`${t.savingError} (${upsertError.message})`);
      setLoading(false);
      return;
    }

    // Analytics: identify user and track signup
    identifyUser(user.id, { name: name.trim(), location: location.trim(), crops: finalCrops.join(', ') });
    trackEvent(Events.SIGNUP, { crops: finalCrops, location: location.trim() });
    if (referral) trackEvent(Events.SIGNUP_FROM_SHARE, { shareId: referral });

    // Send welcome email (fire-and-forget)
    supabase.functions.invoke('send-email', {
      body: { mode: 'welcome', email: user.email, name: name.trim(), lang },
    }).catch(() => {});

    // Refresh auth context so App.tsx routing sees the new profile
    await refreshProfile();
    setLoading(false);
    navigate('/chat', { replace: true });
  };

  return (
    <div className="flex min-h-[100dvh] flex-col bg-background p-4">
      <div className="mx-auto w-full max-w-[420px] flex-1 flex flex-col pt-8">

        {/* Progress bar */}
        <div className="mb-8 flex gap-2">
          {[1, 2, 3].map(i => (
            <div key={i}
              className={`h-1.5 flex-1 rounded-full transition-colors ${i <= step ? 'bg-primary' : 'bg-border'}`}
            />
          ))}
        </div>

        <div className="flex-1 animate-fade-in">

          {/* Step 1 — Name */}
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-foreground">{t.step1Q}</h2>
              <input
                type="text" value={name} autoFocus
                onChange={e => setName(e.target.value)}
                placeholder={t.step1P}
                onKeyDown={e => e.key === 'Enter' && name.trim() && handleNext()}
                className="w-full rounded-[22px] border border-border bg-surface px-4 py-3 text-foreground placeholder:text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          )}

          {/* Step 2 — Location */}
          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-foreground">{t.step2Q}</h2>
              <input
                type="text" value={location} autoFocus
                onChange={e => setLocation(e.target.value)}
                placeholder={t.step2P}
                onKeyDown={e => e.key === 'Enter' && location.trim() && handleNext()}
                className="w-full rounded-[22px] border border-border bg-surface px-4 py-3 text-foreground placeholder:text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          )}

          {/* Step 3 — Crops (multi-select) */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-2xl font-bold text-foreground">{t.step3Q}</h2>
                <p className="mt-1 text-sm text-muted">
                  {lang === 'el' ? 'Επέλεξε μία ή περισσότερες' : 'Select one or more'}
                </p>
              </div>

              {/* Preset chips */}
              <div className="flex flex-wrap gap-2">
                {t.crops.map(c => (
                  <button key={c} onClick={() => toggleCrop(c)}
                    className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                      crops.includes(c)
                        ? 'border-primary bg-primary text-white'
                        : 'border-border bg-surface text-muted hover:text-foreground'
                    }`}>
                    {crops.includes(c) ? `✓ ${c}` : c}
                  </button>
                ))}
              </div>

              {/* Custom crop input */}
              <div className="flex gap-2">
                <input
                  type="text" value={customCrop}
                  onChange={e => setCustomCrop(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addCustomCrop()}
                  placeholder={lang === 'el' ? 'Άλλη καλλιέργεια...' : 'Other crop...'}
                  className="flex-1 rounded-[22px] border border-border bg-surface px-4 py-2.5 text-sm text-foreground placeholder:text-muted focus:border-primary focus:outline-none"
                />
                {customCrop.trim() && (
                  <button onClick={addCustomCrop}
                    className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-white">
                    +
                  </button>
                )}
              </div>

              {/* Selected summary */}
              {crops.length > 0 && (
                <p className="text-sm text-primary font-medium">
                  {lang === 'el' ? 'Επιλεγμένες:' : 'Selected:'} {allCrops}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Bottom CTA */}
        <div className="mt-8 pb-safe space-y-3">
          {error && (
            <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </p>
          )}

          {step < 3 ? (
            <button onClick={handleNext}
              disabled={(step === 1 && !name.trim()) || (step === 2 && !location.trim())}
              className="w-full rounded-[22px] bg-primary px-4 py-3 font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50">
              {t.next}
            </button>
          ) : (
            <button onClick={handleComplete} disabled={!canFinish || loading}
              className="w-full rounded-[22px] bg-primary px-4 py-3 font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50">
              {loading ? t.saving : t.letsGo}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
