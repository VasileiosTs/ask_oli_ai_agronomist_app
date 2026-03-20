import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

const CROPS = ['Elies', 'Ampelonas', 'Tomata', 'Portokalia', 'Sitari', 'Allo'];

export default function Onboarding() {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [crop, setCrop] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { user } = useAuth();

  const handleNext = async () => {
    if (step === 1 && name.trim()) {
      setStep(2);
    } else if (step === 2 && location.trim()) {
      setStep(3);
    }
  };

  const handleComplete = async () => {
    if (!user || !crop.trim()) return;

    setLoading(true);
    setErrorMessage(null);
    let lat = null;
    let lon = null;

    try {
      const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1&language=el&format=json`);
      const data = await res.json();
      if (data.results && data.results.length > 0) {
        lat = data.results[0].latitude;
        lon = data.results[0].longitude;
      }
    } catch (e) {
      console.error('Geocoding failed', e);
    }

    const profilePayload = {
      auth_id: user.id,
      name,
      location,
      location_lat: lat,
      location_lon: lon,
      primary_crop: crop,
      onboarding_complete: true,
    };

    const { error: primaryError } = await supabase
      .from('users')
      .upsert(profilePayload, { onConflict: 'auth_id' });

    let error = primaryError;

    if (primaryError) {
      const { error: legacyError } = await supabase
        .from('users')
        .upsert({
          id: user.id,
          name,
          location,
          location_lat: lat,
          location_lon: lon,
          primary_crop: crop,
          onboarding_complete: true,
        }, { onConflict: 'id' });

      error = legacyError;
    }

    setLoading(false);

    if (!error) {
      // Force reload to update auth state with profile
      window.location.assign('/chat');
    } else {
      console.error('Error saving profile:', error);
      setErrorMessage('Den katafere na apothikeftei to profil sas. Dokimaste xana.');
    }
  };

  return (
    <div className="flex min-h-[100dvh] flex-col bg-background p-4">
      <div className="mx-auto w-full max-w-[420px] flex-1 flex flex-col pt-8">
        {/* Progress Bar */}
        <div className="mb-8 flex gap-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full ${
                i <= step ? 'bg-primary' : 'bg-border'
              }`}
            />
          ))}
        </div>

        <div className="flex-1 animate-fadeIn">
          {step === 1 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-foreground">Pws se lene;</h2>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="To onoma sas"
                className="w-full rounded-[22px] border border-border bg-surface px-4 py-3 text-foreground placeholder:text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleNext()}
              />
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-foreground">Poy vrisxesai;</h2>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Poli i perioxh"
                className="w-full rounded-[22px] border border-border bg-surface px-4 py-3 text-foreground placeholder:text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleNext()}
              />
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-foreground">Ti kalliergeis kyriws;</h2>
              <input
                type="text"
                value={crop}
                onChange={(e) => setCrop(e.target.value)}
                placeholder="Px. Elies, Tomates"
                className="mb-4 w-full rounded-[22px] border border-border bg-surface px-4 py-3 text-foreground placeholder:text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleComplete()}
              />
              <div className="flex flex-wrap gap-2">
                {CROPS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setCrop(c)}
                    className={`rounded-full border px-4 py-2 text-sm transition-colors ${
                      crop === c
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-surface text-muted hover:text-foreground'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="mt-8 pb-safe">
          {errorMessage && (
            <p className="mb-3 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {errorMessage}
            </p>
          )}
          {step < 3 ? (
            <button
              onClick={handleNext}
              disabled={
                (step === 1 && !name.trim()) ||
                (step === 2 && !location.trim())
              }
              className="w-full rounded-[22px] bg-primary px-4 py-3 font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              Epomeno
            </button>
          ) : (
            <button
              onClick={handleComplete}
              disabled={!crop.trim() || loading}
              className="w-full rounded-[22px] bg-primary px-4 py-3 font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {loading ? 'Apothikeusi...' : 'Xekiname'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
