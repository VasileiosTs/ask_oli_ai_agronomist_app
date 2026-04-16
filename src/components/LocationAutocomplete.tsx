import { useState, useEffect, useRef } from 'react';

export interface LocationResult {
  name: string;
  admin1?: string;
  country: string;
  latitude: number;
  longitude: number;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  onSelect: (coords: { lat: number; lon: number; label: string } | null) => void;
  lang: string;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
  /** If true, shows the green/amber confirmation hint below the input. */
  showHint?: boolean;
  /** Coords set when user has picked a suggestion. null = free text only. */
  coords?: { lat: number; lon: number } | null;
}

/**
 * Shared location input backed by Open-Meteo geocoding.
 * Extracted from Onboarding so Fields + Clients reuse the same UX.
 */
export default function LocationAutocomplete({
  value,
  onChange,
  onSelect,
  lang,
  placeholder,
  autoFocus,
  className = '',
  showHint = true,
  coords = null,
}: Props) {
  const [suggestions, setSuggestions] = useState<LocationResult[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const query = value.trim();
    if (query.length < 2) { setSuggestions([]); return; }

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=6&language=${lang}&format=json`
        );
        const data = await res.json();
        setSuggestions(data.results ?? []);
        setOpen(true);
      } catch { /* offline → no suggestions */ }
    }, 300);

    return () => clearTimeout(timer);
  }, [value, lang]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const pick = (r: LocationResult) => {
    const label = r.admin1 ? `${r.name}, ${r.admin1}, ${r.country}` : `${r.name}, ${r.country}`;
    onChange(label);
    onSelect({ lat: r.latitude, lon: r.longitude, label });
    setSuggestions([]);
    setOpen(false);
  };

  const handleType = (val: string) => {
    onChange(val);
    // typing invalidates any previously locked coords
    onSelect(null);
  };

  return (
    <div className={className}>
      <div className="relative" ref={ref}>
        <input
          type="text"
          value={value}
          autoFocus={autoFocus}
          onChange={e => handleType(e.target.value)}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          placeholder={placeholder ?? (lang === 'el' ? 'π.χ. Καλαμάτα' : 'e.g. Kalamata')}
          autoComplete="off"
          className="w-full rounded-[22px] border border-border bg-surface px-4 py-3 text-foreground placeholder:text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        />
        {open && suggestions.length > 0 && (
          <ul className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-2xl border border-border bg-surface shadow-lg">
            {suggestions.map((s, i) => (
              <li key={i}>
                <button
                  type="button"
                  onMouseDown={e => { e.preventDefault(); pick(s); }}
                  className="w-full border-b border-border/40 px-4 py-3 text-left text-sm text-foreground transition-colors last:border-0 hover:bg-primary/10"
                >
                  <span className="font-medium">{s.name}</span>
                  {(s.admin1 || s.country) && (
                    <span className="ml-1 text-muted">
                      {s.admin1 ? `${s.admin1}, ` : ''}{s.country}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {showHint && (
        coords ? (
          <p className="mt-1 px-1 text-xs text-primary/70">
            {lang === 'el' ? '✓ Τοποθεσία επιβεβαιωμένη' : '✓ Location confirmed'}
          </p>
        ) : value.trim() ? (
          <p className="mt-1 px-1 text-xs text-amber-400/80">
            {lang === 'el' ? '↑ Επιλέξτε από τη λίστα για επιβεβαίωση' : '↑ Select from the list to confirm'}
          </p>
        ) : null
      )}
    </div>
  );
}
