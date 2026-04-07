import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../lib/LanguageContext';
import { trackEvent, identifyUser, Events } from '../lib/analytics';

interface LocationResult {
  name: string;
  admin1?: string;
  country: string;
  latitude: number;
  longitude: number;
}

export default function Onboarding() {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');

  // Location state
  const [location, setLocation] = useState('');
  const [suggestions, setSuggestions] = useState<LocationResult[]>([]);
  const [locationCoords, setLocationCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const locationRef = useRef<HTMLDivElement>(null);

  // Age range state
  const [ageRange, setAgeRange] = useState('');

  // Crops state
  const [crops, setCrops] = useState<string[]>([]);
  const [customCrop, setCustomCrop] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user, refreshProfile } = useAuth();
  const { t, lang } = useLanguage();
  const navigate = useNavigate();

  const TOTAL_STEPS = 4;

  // ── Location autocomplete ──────────────────────────────────────────────────
  useEffect(() => {
    if (step !== 2) return;
    const query = location.trim();
    if (query.length < 2) { setSuggestions([]); return; }

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=6&language=${lang}&format=json`
        );
        const data = await res.json();
        setSuggestions(data.results ?? []);
        setSuggestionsOpen(true);
      } catch { /* network failure — just show no suggestions */ }
    }, 300);

    return () => clearTimeout(timer);
  }, [location, step, lang]);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (locationRef.current && !locationRef.current.contains(e.target as Node)) {
        setSuggestionsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selectLocation = (result: LocationResult) => {
    const label = result.admin1
      ? `${result.name}, ${result.admin1}, ${result.country}`
      : `${result.name}, ${result.country}`;
    setLocation(label);
    setLocationCoords({ lat: result.latitude, lon: result.longitude });
    setSuggestions([]);
    setSuggestionsOpen(false);
  };

  // When user edits location text after selecting, clear stored coords and any error
  const handleLocationChange = (val: string) => {
    setLocation(val);
    setLocationCoords(null);
    setLocationError(null);
  };

  // ── Navigation ─────────────────────────────────────────────────────────────
  const handleNext = () => {
    if (step === 1 && name.trim()) {
      setStep(2);
    } else if (step === 2) {
      if (!location.trim()) return;
      // Require the user to have selected from autocomplete (coords stored)
      if (!locationCoords) {
        setLocationError(
          lang === 'el'
            ? 'Παρακαλώ επιλέξτε τοποθεσία από τη λίστα για να αποθηκευτούν οι συντεταγμένες.'
            : 'Please select a location from the list so we can store your coordinates.',
        );
        return;
      }
      setLocationError(null);
      setStep(3);
    } else if (step === 3) {
      setStep(4);
    }
  };

  // ── Crops ──────────────────────────────────────────────────────────────────
  const toggleCrop = (c: string) => {
    setCrops(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);
  };

  const addCustomCrop = () => {
    const v = customCrop.trim();
    if (v && !crops.includes(v)) { setCrops(prev => [...prev, v]); setCustomCrop(''); }
  };

  const canFinish = crops.length > 0 || customCrop.trim().length > 0;

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleComplete = async () => {
    if (!user) return;

    const finalCrops = customCrop.trim()
      ? [...new Set([...crops, customCrop.trim()])]
      : crops;
    if (finalCrops.length === 0) return;

    setLoading(true);
    setError(null);

    // Use stored coords if available; otherwise geocode now as fallback
    let lat = locationCoords?.lat ?? null;
    let lon = locationCoords?.lon ?? null;

    if (!lat || !lon) {
      let geocodeTimeout: ReturnType<typeof setTimeout> | null = null;
      try {
        const controller = new AbortController();
        geocodeTimeout = setTimeout(() => controller.abort(), 3000);
        const res = await fetch(
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1&language=${lang}&format=json`,
          { signal: controller.signal }
        );
        const data = await res.json();
        if (data.results?.[0]) {
          lat = data.results[0].latitude;
          lon = data.results[0].longitude;
        }
      } catch { /* geocoding is optional */ }
      finally { if (geocodeTimeout) clearTimeout(geocodeTimeout); }
    }

    const referral = localStorage.getItem('oli_referral');

    const payload: Record<string, unknown> = {
      auth_id: user.id,
      name: name.trim(),
      location: location.trim(),
      location_lat: lat,
      location_lon: lon,
      primary_crop: finalCrops.join(', '),
      language: lang,
      onboarding_complete: true,
      notification_followup: true,
    };
    if (ageRange) payload.age_range = ageRange;
    if (referral) { payload.referred_by_share_id = referral; localStorage.removeItem('oli_referral'); }
    const signupRole = localStorage.getItem('oli_signup_role');
    if (signupRole === 'agronomist') { payload.role = 'agronomist'; localStorage.removeItem('oli_signup_role'); }

    try {
      const { error: upsertError } = await supabase
        .from('users')
        .upsert(payload, { onConflict: 'auth_id' })
        .select('id, onboarding_complete')
        .single();

      if (upsertError) {
        console.error('Onboarding upsert error:', upsertError);
        setError(`${t.savingError} (${upsertError.message})`);
        setLoading(false);
        return;
      }

      identifyUser(user.id, { name: name.trim(), location: location.trim(), crops: finalCrops.join(', '), age_range: ageRange });
      trackEvent(Events.SIGNUP, { crops: finalCrops, location: location.trim(), age_range: ageRange });
      if (referral) trackEvent(Events.SIGNUP_FROM_SHARE, { shareId: referral });

      supabase.functions.invoke('send-email', {
        body: { mode: 'welcome', email: user.email, name: name.trim(), lang },
      }).catch(() => {});

      const refreshedProfile = await refreshProfile({
        retries: 6,
        delayMs: 250,
        requireCompletedOnboarding: true,
      });

      if (!refreshedProfile?.onboarding_complete) {
        setError(
          lang === 'el'
            ? 'Το προφίλ αποθηκεύτηκε αλλά δεν συγχρονίστηκε σωστά. Δοκίμασε ξανά σε λίγα δευτερόλεπτα.'
            : 'Your profile was saved, but it did not sync yet. Please try again in a few seconds.',
        );
        setLoading(false);
        return;
      }

      navigate('/chat', { replace: true });
    } catch (err) {
      console.error('Onboarding failed:', err);
      setError(lang === 'el' ? 'Κάτι πήγε στραβά. Δοκίμασε ξανά.' : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[100dvh] flex-col bg-background p-4">
      <main className="mx-auto w-full max-w-[420px] flex-1 flex flex-col pt-8">

        {/* Progress bar */}
        <div className="mb-8 flex gap-2">
          {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map(i => (
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
                aria-label={t.step1Q}
                onKeyDown={e => e.key === 'Enter' && name.trim() && handleNext()}
                className="w-full rounded-[22px] border border-border bg-surface px-4 py-3 text-foreground placeholder:text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          )}

          {/* Step 2 — Location with autocomplete */}
          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-foreground">{t.step2Q}</h2>
              <div className="relative" ref={locationRef}>
                <input
                  type="text" value={location} autoFocus
                  onChange={e => handleLocationChange(e.target.value)}
                  onFocus={() => suggestions.length > 0 && setSuggestionsOpen(true)}
                  placeholder={t.step2P}
                  aria-label={t.step2Q}
                  autoComplete="off"
                  onKeyDown={e => e.key === 'Enter' && location.trim() && handleNext()}
                  className="w-full rounded-[22px] border border-border bg-surface px-4 py-3 text-foreground placeholder:text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
                {suggestionsOpen && suggestions.length > 0 && (
                  <ul className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-2xl border border-border bg-surface shadow-lg">
                    {suggestions.map((s, i) => {
                      const label = s.admin1
                        ? `${s.name}, ${s.admin1}, ${s.country}`
                        : `${s.name}, ${s.country}`;
                      return (
                        <li key={i}>
                          <button
                            type="button"
                            onMouseDown={e => { e.preventDefault(); selectLocation(s); }}
                            className="w-full px-4 py-3 text-left text-sm text-foreground hover:bg-primary/10 transition-colors border-b border-border/40 last:border-0"
                          >
                            <span className="font-medium">{s.name}</span>
                            {(s.admin1 || s.country) && (
                              <span className="text-muted ml-1">
                                {s.admin1 ? `${s.admin1}, ` : ''}{s.country}
                              </span>
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
              {locationCoords ? (
                <p className="text-xs text-primary/70 px-1">
                  {lang === 'el' ? '✓ Τοποθεσία επιβεβαιωμένη' : '✓ Location confirmed'}
                </p>
              ) : locationError ? (
                <p className="text-xs text-red-400 px-1">{locationError}</p>
              ) : location.trim() ? (
                <p className="text-xs text-amber-400/80 px-1">
                  {lang === 'el' ? '↑ Επιλέξτε από τη λίστα για επιβεβαίωση' : '↑ Select from the list to confirm'}
                </p>
              ) : null}
            </div>
          )}

          {/* Step 3 — Age range */}
          {step === 3 && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-foreground">{t.step4Q}</h2>
              <div className="space-y-2">
                {t.ageRanges.map(range => (
                  <button
                    key={range}
                    onClick={() => setAgeRange(range)}
                    className={`w-full rounded-[22px] border px-4 py-3 text-left text-sm font-medium transition-colors ${
                      ageRange === range
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-surface text-foreground hover:border-primary/50'
                    }`}
                  >
                    {ageRange === range && <span className="mr-2">✓</span>}{range}
                  </button>
                ))}
                <button
                  onClick={() => setAgeRange('')}
                  className={`w-full rounded-[22px] border px-4 py-3 text-left text-sm transition-colors ${
                    ageRange === ''
                      ? 'border-border/50 text-muted/60'
                      : 'border-border bg-surface text-muted hover:border-primary/50'
                  }`}
                >
                  {t.skipAge}
                </button>
              </div>
            </div>
          )}

          {/* Step 4 — Crops */}
          {step === 4 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-2xl font-bold text-foreground">{t.step3Q}</h2>
                <p className="mt-1 text-sm text-muted">
                  {lang === 'el' ? 'Επέλεξε μία ή περισσότερες' : 'Select one or more'}
                </p>
              </div>

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

              <div className="flex gap-2">
                <input
                  type="text" value={customCrop}
                  onChange={e => setCustomCrop(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addCustomCrop()}
                  placeholder={lang === 'el' ? 'Άλλη καλλιέργεια...' : 'Other crop...'}
                  aria-label={t.step3Q}
                  className="flex-1 rounded-[22px] border border-border bg-surface px-4 py-2.5 text-sm text-foreground placeholder:text-muted focus:border-primary focus:outline-none"
                />
                {customCrop.trim() && (
                  <button onClick={addCustomCrop}
                    className="rounded-full bg-primary px-4 py-2 text-sm font-medium text-white">
                    +
                  </button>
                )}
              </div>

              {crops.length > 0 && (
                <p className="text-sm text-primary font-medium">
                  {lang === 'el' ? 'Επιλεγμένες:' : 'Selected:'} {crops.join(', ')}
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

          {step < 4 ? (
            <button onClick={handleNext}
              disabled={
                (step === 1 && !name.trim()) ||
                (step === 2 && !location.trim())
                // step 3 (age) is always passable — skip is valid
              }
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
      </main>
    </div>
  );
}
