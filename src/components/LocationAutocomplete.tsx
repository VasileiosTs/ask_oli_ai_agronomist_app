import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';

export interface LocationResult {
  name: string;
  admin1?: string;
  country: string;
  latitude: number;
  longitude: number;
}

interface DropdownPos { top: number; left: number; width: number }

interface Props {
  value: string;
  onChange: (value: string) => void;
  onSelect: (coords: { lat: number; lon: number; label: string } | null) => void;
  lang: string;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
  /** Input style override — defaults to match standard form inputs */
  inputClassName?: string;
  /** If true, shows the green/amber confirmation hint below the input. */
  showHint?: boolean;
  /** Coords set when user has picked a suggestion. null = free text only. */
  coords?: { lat: number; lon: number } | null;
}

/**
 * Shared location input backed by Open-Meteo geocoding.
 * Dropdown rendered in a portal so it escapes overflow:hidden/auto containers.
 */
export default function LocationAutocomplete({
  value,
  onChange,
  onSelect,
  lang,
  placeholder,
  autoFocus,
  className = '',
  inputClassName,
  showHint = true,
  coords = null,
}: Props) {
  const [suggestions, setSuggestions] = useState<LocationResult[]>([]);
  const [open, setOpen] = useState(false);
  const [dropPos, setDropPos] = useState<DropdownPos | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const defaultInputClass =
    'w-full rounded-xl border border-border/50 bg-surface px-4 py-2.5 text-[15px] text-foreground placeholder:text-muted focus:border-primary focus:outline-none';

  // Recompute dropdown position whenever it opens
  const updatePos = useCallback(() => {
    if (!inputRef.current) return;
    const r = inputRef.current.getBoundingClientRect();
    setDropPos({ top: r.bottom + window.scrollY + 4, left: r.left + window.scrollX, width: r.width });
  }, []);

  useEffect(() => {
    const query = value.trim();
    if (query.length < 2) { setSuggestions([]); setOpen(false); return; }

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=6&language=${lang}&format=json`
        );
        const data = await res.json();
        const results: LocationResult[] = data.results ?? [];
        setSuggestions(results);
        if (results.length > 0) { updatePos(); setOpen(true); }
      } catch { /* offline → no suggestions */ }
    }, 300);

    return () => clearTimeout(timer);
  }, [value, lang, updatePos]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (inputRef.current && !inputRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Reposition on scroll/resize while open
  useEffect(() => {
    if (!open) return;
    const reposition = () => updatePos();
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => {
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    };
  }, [open, updatePos]);

  const pick = (r: LocationResult) => {
    const label = r.admin1 ? `${r.name}, ${r.admin1}, ${r.country}` : `${r.name}, ${r.country}`;
    onChange(label);
    onSelect({ lat: r.latitude, lon: r.longitude, label });
    setSuggestions([]);
    setOpen(false);
  };

  const handleType = (val: string) => {
    onChange(val);
    onSelect(null); // typing invalidates previously locked coords
  };

  const dropdown = open && suggestions.length > 0 && dropPos
    ? createPortal(
        <ul
          style={{ position: 'absolute', top: dropPos.top, left: dropPos.left, width: dropPos.width, zIndex: 9999 }}
          className="overflow-hidden rounded-2xl border border-border bg-surface shadow-lg"
        >
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
        </ul>,
        document.body
      )
    : null;

  return (
    <div className={className}>
      <input
        ref={inputRef}
        type="text"
        value={value}
        autoFocus={autoFocus}
        onChange={e => handleType(e.target.value)}
        onFocus={() => { if (suggestions.length > 0) { updatePos(); setOpen(true); } }}
        placeholder={placeholder ?? (lang === 'el' ? 'π.χ. Καλαμάτα' : 'e.g. Kalamata')}
        autoComplete="off"
        className={inputClassName ?? defaultInputClass}
      />
      {dropdown}
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
