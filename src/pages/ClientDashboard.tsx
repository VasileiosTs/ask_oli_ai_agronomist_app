import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, ChevronRight, Plus, X, Loader2, Search, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../lib/LanguageContext';
import { isAdvisorTier } from '../../shared/subscription';
import LocationAutocomplete from '../components/LocationAutocomplete';

interface Grower {
  id: string;
  name: string;
  phone: string | null;
  location: string | null;
  notes: string | null;
  created_at: string;
  /** Computed client-side after join */
  diagnosis_count?: number;
  last_diagnosis_at?: string | null;
}

export default function ClientDashboard() {
  const { profile, appUserId } = useAuth();
  const { lang } = useLanguage();
  const navigate = useNavigate();

  const [growers, setGrowers] = useState<Grower[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState<{ name: string; phone: string; location: string; notes: string; location_lat: number | null; location_lon: number | null }>({ name: '', phone: '', location: '', notes: '', location_lat: null, location_lon: null });
  const [saving, setSaving] = useState(false);

  const tier = typeof profile?.tier === 'string' ? profile.tier : null;
  const hasAccess = isAdvisorTier(tier);

  useEffect(() => {
    if (!appUserId || !hasAccess) return;
    loadGrowers();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appUserId]);

  const loadGrowers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('growers')
        .select('id, name, phone, location, notes, created_at')
        .eq('advisor_id', appUserId!)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Enrich with diagnosis counts
      const enriched = await Promise.all((data ?? []).map(async (g) => {
        const { count } = await supabase
          .from('interventions')
          .select('id', { count: 'exact', head: true })
          .eq('grower_id', g.id);

        const { data: latest } = await supabase
          .from('interventions')
          .select('created_at')
          .eq('grower_id', g.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        return { ...g, diagnosis_count: count ?? 0, last_diagnosis_at: latest?.created_at ?? null };
      }));

      setGrowers(enriched);
    } finally {
      setLoading(false);
    }
  };

  const saveGrower = async () => {
    if (!form.name.trim() || !appUserId) return;
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('growers')
        .insert({
          advisor_id: appUserId,
          name: form.name.trim(),
          phone: form.phone.trim() || null,
          location: form.location.trim() || null,
          notes: form.notes.trim() || null,
        })
        .select('id, name, phone, location, notes, created_at')
        .single();

      if (error) throw error;
      setGrowers(prev => [{ ...data, diagnosis_count: 0, last_diagnosis_at: null }, ...prev]);
      setForm({ name: '', phone: '', location: '', notes: '', location_lat: null, location_lon: null });
      setAddOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const filtered = growers.filter(g =>
    g.name.toLowerCase().includes(search.toLowerCase()) ||
    (g.location ?? '').toLowerCase().includes(search.toLowerCase()),
  );

  if (!hasAccess) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
        <AlertCircle className="h-10 w-10 text-muted" />
        <p className="text-sm text-muted">
          {lang === 'el'
            ? 'Η Πολλαπλή Διαχείριση Παραγωγών απαιτεί σχέδιο Agronomist ή Enterprise.'
            : 'Multi-client management requires the Agronomist or Enterprise plan.'}
        </p>
        <button
          onClick={() => navigate('/profile')}
          className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-white hover:bg-primary/90"
        >
          {lang === 'el' ? 'Αναβάθμιση' : 'Upgrade'}
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-border/50 bg-surface px-4 py-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-semibold text-foreground">
              {lang === 'el' ? 'Παραγωγοί' : 'Clients'}
            </h1>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
              {growers.length}
            </span>
          </div>
          <button
            onClick={() => setAddOpen(true)}
            className="flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            {lang === 'el' ? 'Νέος' : 'New'}
          </button>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={lang === 'el' ? 'Αναζήτηση παραγωγού...' : 'Search clients...'}
            className="w-full rounded-xl border border-border/50 bg-background py-2 pl-9 pr-4 text-sm text-foreground placeholder:text-muted focus:border-primary focus:outline-none"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center px-8 py-12">
            <Users className="h-10 w-10 text-muted/30" />
            <p className="text-sm text-muted">
              {search
                ? (lang === 'el' ? 'Δεν βρέθηκαν παραγωγοί' : 'No clients found')
                : (lang === 'el' ? 'Δεν υπάρχουν παραγωγοί ακόμα.\nΠρόσθεσε τον πρώτο σου παραγωγό.' : 'No clients yet.\nAdd your first client to get started.')}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/40">
            {filtered.map(g => (
              <button
                key={g.id}
                onClick={() => navigate(`/clients/${g.id}`)}
                className="flex w-full items-center gap-4 px-4 py-3.5 text-left transition-colors hover:bg-surface/60 active:bg-surface"
              >
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <span className="text-base font-bold text-primary">{g.name.charAt(0).toUpperCase()}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground truncate">{g.name}</p>
                  <p className="text-xs text-muted mt-0.5 truncate">
                    {g.location ? `${g.location} · ` : ''}
                    {lang === 'el'
                      ? `${g.diagnosis_count} διαγνώσεις`
                      : `${g.diagnosis_count} diagnoses`}
                  </p>
                </div>
                {g.last_diagnosis_at && (
                  <span className="flex-shrink-0 text-[11px] text-muted">
                    {new Date(g.last_diagnosis_at).toLocaleDateString(lang === 'el' ? 'el-GR' : 'en-GB', { day: 'numeric', month: 'short' })}
                  </span>
                )}
                <ChevronRight className="h-4 w-4 flex-shrink-0 text-muted/50" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Add grower dialog */}
      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center px-4 pb-4 sm:pb-0">
          <div className="w-full max-w-sm rounded-2xl bg-background p-6 shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-foreground">
                {lang === 'el' ? 'Νέος Παραγωγός' : 'New Client'}
              </h3>
              <button onClick={() => setAddOpen(false)} className="rounded-full p-1.5 text-muted hover:bg-muted/10">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-3">
              {([
                { key: 'name', label: lang === 'el' ? 'Όνομα*' : 'Name*' },
                { key: 'phone', label: lang === 'el' ? 'Τηλέφωνο' : 'Phone' },
              ] as const).map(({ key, label }) => (
                <div key={key}>
                  <label className="mb-1 block text-xs font-medium text-muted">{label}</label>
                  <input
                    type="text"
                    value={form[key]}
                    onChange={e => setForm(prev => ({ ...prev, [key]: e.target.value }))}
                    className="w-full rounded-xl border border-border/50 bg-surface px-4 py-2.5 text-[15px] text-foreground focus:border-primary focus:outline-none"
                  />
                </div>
              ))}
              <div>
                <label className="mb-1 block text-xs font-medium text-muted">
                  {lang === 'el' ? 'Τοποθεσία' : 'Location'}
                </label>
                <LocationAutocomplete
                  value={form.location}
                  lang={lang}
                  coords={form.location_lat && form.location_lon ? { lat: form.location_lat, lon: form.location_lon } : null}
                  onChange={val => setForm(prev => ({ ...prev, location: val }))}
                  onSelect={sel => setForm(prev => ({
                    ...prev,
                    location: sel?.label ?? prev.location,
                    location_lat: sel?.lat ?? null,
                    location_lon: sel?.lon ?? null,
                  }))}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted">
                  {lang === 'el' ? 'Σημειώσεις' : 'Notes'}
                </label>
                <input
                  type="text"
                  value={form.notes}
                  onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
                  className="w-full rounded-xl border border-border/50 bg-surface px-4 py-2.5 text-[15px] text-foreground focus:border-primary focus:outline-none"
                />
              </div>
            </div>
            <div className="mt-5 flex gap-3">
              <button onClick={() => setAddOpen(false)}
                className="flex-1 rounded-xl border border-border bg-surface py-2.5 text-sm text-foreground">
                {lang === 'el' ? 'Ακύρωση' : 'Cancel'}
              </button>
              <button onClick={saveGrower} disabled={saving || !form.name.trim()}
                className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-semibold text-white disabled:opacity-50">
                {saving ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : lang === 'el' ? 'Αποθήκευση' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
