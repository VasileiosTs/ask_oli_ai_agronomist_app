import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, MessageSquare, ClipboardList, Leaf, Phone, MapPin, Sprout, Plus, Check, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../lib/LanguageContext';

interface Grower {
  id: string;
  name: string;
  phone: string | null;
  location: string | null;
  notes: string | null;
}

interface Diagnosis {
  id: string;
  problem: string | null;
  cause: string | null;
  severity: string | null;
  confidence_score: number | null;
  product_applied: string | null;
  created_at: string;
  fields: { name: string; crop_type: string | null } | null;
}

interface LinkedField {
  id: string; // field id
  name: string;
  crop_type: string | null;
  location: string | null;
  size_ha: number | null;
}

type Tab = 'diagnoses' | 'fields';

export default function ClientDetail() {
  const { growerId } = useParams<{ growerId: string }>();
  const { appUserId } = useAuth();
  const { lang } = useLanguage();
  const navigate = useNavigate();

  const [tab, setTab] = useState<Tab>('diagnoses');
  const [grower, setGrower] = useState<Grower | null>(null);
  const [diagnoses, setDiagnoses] = useState<Diagnosis[]>([]);
  const [linkedFields, setLinkedFields] = useState<LinkedField[]>([]);
  const [allFields, setAllFields] = useState<LinkedField[]>([]);
  const [loading, setLoading] = useState(true);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linking, setLinking] = useState(false);
  // Inline "create new field for this client" flow — required because previously
  // an agronomist could only LINK an existing field, never create a fresh one
  // directly under a client.
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newField, setNewField] = useState({ name: '', crop_type: '', location: '' });

  useEffect(() => {
    if (!growerId || !appUserId) return;
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [growerId, appUserId]);

  const reload = async () => {
    setLoading(true);
    const [growerRes, diagRes, linksRes, fieldsRes] = await Promise.all([
      supabase.from('growers').select('id, name, phone, location, notes').eq('id', growerId!).eq('advisor_id', appUserId!).maybeSingle(),
      supabase.from('interventions')
        .select('id, problem, cause, severity, confidence_score, product_applied, created_at, fields(name, crop_type)')
        .eq('grower_id', growerId!)
        .order('created_at', { ascending: false })
        .limit(50),
      supabase.from('grower_links')
        .select('field_id, fields(id, name, crop_type, location, size_ha)')
        .eq('grower_id', growerId!),
      supabase.from('fields')
        .select('id, name, crop_type, location, size_ha')
        .eq('user_id', appUserId!)
        .eq('is_active', true)
        .order('name'),
    ]);
    if (growerRes.data) setGrower(growerRes.data);
    if (diagRes.data) setDiagnoses(diagRes.data as unknown as Diagnosis[]);
    if (linksRes.data) {
      const fs = (linksRes.data as unknown as { fields: LinkedField }[])
        .map(r => r.fields).filter(Boolean);
      setLinkedFields(fs);
    }
    if (fieldsRes.data) setAllFields(fieldsRes.data as LinkedField[]);
    setLoading(false);
  };

  const toggleLink = async (fieldId: string, currentlyLinked: boolean) => {
    if (linking) return;
    setLinking(true);
    try {
      if (currentlyLinked) {
        await supabase.from('grower_links').delete()
          .eq('grower_id', growerId!).eq('field_id', fieldId);
      } else {
        await supabase.from('grower_links').insert({ grower_id: growerId!, field_id: fieldId });
      }
      await reload();
    } finally {
      setLinking(false);
    }
  };

  // Create a new field owned by the agronomist and immediately link it to this client.
  // Keeps the form minimal (name + crop + location). Advanced fields like soil type,
  // irrigation, and exact size are edited later via the field detail page.
  const createField = async () => {
    if (creating) return;
    const name = newField.name.trim();
    if (!name || !growerId || !appUserId) return;
    setCreating(true);
    try {
      // 1. Insert field owned by the agronomist
      const { data: created, error: fieldError } = await supabase
        .from('fields')
        .insert({
          user_id: appUserId,
          name,
          crop_type: newField.crop_type.trim() || null,
          location: newField.location.trim() || null,
          is_active: true,
          source: 'manual' as const,
        })
        .select('id')
        .single();
      if (fieldError || !created) throw fieldError ?? new Error('Field creation failed');
      // 2. Link field to this client
      const { error: linkError } = await supabase
        .from('grower_links')
        .insert({ grower_id: growerId, field_id: created.id });
      if (linkError) throw linkError;
      // 3. Reset form and reload
      setNewField({ name: '', crop_type: '', location: '' });
      setCreateOpen(false);
      await reload();
    } catch (err) {
      console.error('createField failed:', err);
    } finally {
      setCreating(false);
    }
  };

  const openChat = (fieldId?: string) => {
    const q = new URLSearchParams({ grower: growerId! });
    if (fieldId) q.set('field', fieldId);
    navigate(`/chat?${q.toString()}`);
  };

  const severityColor = (s: string | null) => {
    if (s === 'high') return 'text-red-400 bg-red-500/10 border-red-500/20';
    if (s === 'medium') return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
    return 'text-green-400 bg-green-500/10 border-green-500/20';
  };

  if (loading) {
    return <div className="flex h-full items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  if (!grower) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center">
        <p className="text-sm text-muted">{lang === 'el' ? 'Ο παραγωγός δεν βρέθηκε.' : 'Client not found.'}</p>
        <button onClick={() => navigate('/clients')} className="text-sm text-primary hover:underline">
          {lang === 'el' ? 'Πίσω στη λίστα' : 'Back to list'}
        </button>
      </div>
    );
  }

  const linkedIds = new Set(linkedFields.map(f => f.id));
  const unlinkedFields = allFields.filter(f => !linkedIds.has(f.id));

  return (
    <main className="flex h-full flex-col">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-border/50 bg-surface px-4 py-3">
        <div className="flex items-center gap-3 mb-3">
          <button onClick={() => navigate('/clients')} className="text-muted hover:text-foreground transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold text-foreground truncate">{grower.name}</h1>
            <div className="flex items-center gap-3 mt-0.5">
              {grower.location && (
                <span className="flex items-center gap-1 text-xs text-muted">
                  <MapPin className="h-3 w-3" />{grower.location}
                </span>
              )}
              {grower.phone && (
                <span className="flex items-center gap-1 text-xs text-muted">
                  <Phone className="h-3 w-3" />{grower.phone}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={() => openChat()}
            className="flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary/90 transition-colors"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            {lang === 'el' ? 'Συνομιλία' : 'Chat'}
          </button>
        </div>

        {grower.notes && (
          <p className="text-xs text-muted bg-surface rounded-xl px-3 py-2 border border-border/40 leading-relaxed">
            {grower.notes}
          </p>
        )}
      </div>

      {/* Tabs */}
      <div className="flex-shrink-0 flex border-b border-border/50 bg-background/60">
        <button
          onClick={() => setTab('diagnoses')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium transition-colors ${
            tab === 'diagnoses' ? 'text-primary border-b-2 border-primary' : 'text-muted hover:text-foreground'
          }`}
        >
          <ClipboardList className="h-4 w-4" />
          {lang === 'el' ? 'Διαγνώσεις' : 'Diagnoses'}
          <span className="text-xs opacity-70">({diagnoses.length})</span>
        </button>
        <button
          onClick={() => setTab('fields')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium transition-colors ${
            tab === 'fields' ? 'text-primary border-b-2 border-primary' : 'text-muted hover:text-foreground'
          }`}
        >
          <Sprout className="h-4 w-4" />
          {lang === 'el' ? 'Χωράφια' : 'Fields'}
          <span className="text-xs opacity-70">({linkedFields.length})</span>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {tab === 'diagnoses' ? (
          diagnoses.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center px-8 py-12">
              <ClipboardList className="h-10 w-10 text-muted/30" />
              <p className="text-sm text-muted whitespace-pre-line">
                {lang === 'el' ? 'Δεν υπάρχουν διαγνώσεις ακόμα.\nΞεκίνα συνομιλία με τον παραγωγό.' : 'No diagnoses yet.\nStart a chat with this client.'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              {diagnoses.map(d => (
                <div key={d.id} className="px-4 py-3.5">
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 mt-0.5">
                      <Leaf className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-foreground text-sm truncate">{d.problem ?? (lang === 'el' ? 'Άγνωστο' : 'Unknown')}</p>
                        {d.severity && (
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${severityColor(d.severity)}`}>
                            {lang === 'el'
                              ? { low: 'Χαμηλή', medium: 'Μέτρια', high: 'Υψηλή' }[d.severity] ?? d.severity
                              : d.severity}
                          </span>
                        )}
                      </div>
                      {d.cause && <p className="text-xs text-muted mt-0.5 truncate">{d.cause}</p>}
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {d.fields?.name && (
                          <span className="text-[11px] text-muted">{d.fields.name}{d.fields.crop_type ? ` · ${d.fields.crop_type}` : ''}</span>
                        )}
                        {d.product_applied && (
                          <span className="text-[11px] text-primary/80">{d.product_applied}</span>
                        )}
                      </div>
                    </div>
                    <span className="flex-shrink-0 text-[11px] text-muted">
                      {new Date(d.created_at).toLocaleDateString(lang === 'el' ? 'el-GR' : 'en-GB', { day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          // Fields tab
          <div className="p-4 space-y-3">
            {linkedFields.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 text-center py-10">
                <Sprout className="h-10 w-10 text-muted/30" />
                <p className="text-sm text-muted">
                  {lang === 'el' ? 'Δεν έχει συνδεθεί κανένα χωράφι ακόμα.' : 'No fields linked yet.'}
                </p>
              </div>
            ) : (
              linkedFields.map(f => (
                <div key={f.id} className="rounded-2xl border border-border/50 bg-surface p-4">
                  <div className="flex items-start justify-between gap-3">
                    <button
                      onClick={() => navigate(`/fields/${f.id}`)}
                      className="flex-1 text-left"
                    >
                      <h3 className="font-semibold text-foreground truncate">{f.name}</h3>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted">
                        {f.crop_type && <span>{f.crop_type}</span>}
                        {f.size_ha && <span>· {f.size_ha} ha</span>}
                        {f.location && <span>· {f.location}</span>}
                      </div>
                    </button>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openChat(f.id)}
                        className="rounded-full border border-primary/30 bg-primary/10 p-2 text-primary transition-colors hover:bg-primary/20"
                        title={lang === 'el' ? 'Συνομιλία για αυτό το χωράφι' : 'Chat about this field'}
                      >
                        <MessageSquare className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => toggleLink(f.id, true)}
                        disabled={linking}
                        className="rounded-full border border-red-500/30 bg-red-500/5 p-2 text-red-400 transition-colors hover:bg-red-500/20 disabled:opacity-50"
                        title={lang === 'el' ? 'Αφαίρεση σύνδεσης' : 'Unlink'}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}

            {/* Add field actions: create new OR link existing */}
            {!linkOpen && !createOpen && (
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  onClick={() => setCreateOpen(true)}
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-primary/30 bg-primary/10 py-3 text-sm font-semibold text-primary transition-colors hover:bg-primary/20"
                >
                  <Plus className="h-4 w-4" />
                  {lang === 'el' ? 'Νέο χωράφι' : 'New field'}
                </button>
                {unlinkedFields.length > 0 && (
                  <button
                    onClick={() => setLinkOpen(true)}
                    className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-dashed border-border/70 bg-surface/50 py-3 text-sm font-medium text-muted transition-colors hover:text-foreground"
                  >
                    <Plus className="h-4 w-4" />
                    {lang === 'el' ? 'Σύνδεση υπάρχοντος' : 'Link existing'}
                  </button>
                )}
              </div>
            )}

            {/* Inline create-new-field form */}
            {createOpen && (
              <div className="rounded-2xl border border-primary/30 bg-primary/5 p-3 space-y-2">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-semibold text-foreground">
                    {lang === 'el' ? 'Νέο χωράφι για ' + (grower?.name ?? '') : 'New field for ' + (grower?.name ?? '')}
                  </p>
                  <button
                    onClick={() => { setCreateOpen(false); setNewField({ name: '', crop_type: '', location: '' }); }}
                    className="text-muted hover:text-foreground"
                    disabled={creating}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <input
                  type="text"
                  value={newField.name}
                  onChange={(e) => setNewField(s => ({ ...s, name: e.target.value }))}
                  placeholder={lang === 'el' ? 'Όνομα χωραφιού (π.χ. Άνω Ελαιώνας)' : 'Field name (e.g. Upper Olive Grove)'}
                  className="w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                  disabled={creating}
                  autoFocus
                />
                <input
                  type="text"
                  value={newField.crop_type}
                  onChange={(e) => setNewField(s => ({ ...s, crop_type: e.target.value }))}
                  placeholder={lang === 'el' ? 'Καλλιέργεια (π.χ. Ελιές)' : 'Crop (e.g. Olives)'}
                  className="w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                  disabled={creating}
                />
                <input
                  type="text"
                  value={newField.location}
                  onChange={(e) => setNewField(s => ({ ...s, location: e.target.value }))}
                  placeholder={lang === 'el' ? 'Τοποθεσία (προαιρετικό)' : 'Location (optional)'}
                  className="w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
                  disabled={creating}
                />
                <button
                  onClick={createField}
                  disabled={creating || !newField.name.trim()}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                >
                  {creating
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : (lang === 'el' ? 'Δημιουργία και σύνδεση' : 'Create and link')}
                </button>
              </div>
            )}

            {linkOpen && (
              <div className="rounded-2xl border border-border/50 bg-surface p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-semibold text-foreground">
                    {lang === 'el' ? 'Επιλέξτε χωράφι' : 'Pick a field'}
                  </p>
                  <button onClick={() => setLinkOpen(false)} className="text-muted hover:text-foreground">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                {unlinkedFields.length === 0 ? (
                  <p className="py-3 text-center text-xs text-muted">
                    {lang === 'el' ? 'Όλα τα χωράφια είναι ήδη συνδεδεμένα.' : 'All fields are already linked.'}
                  </p>
                ) : (
                  <div className="space-y-1">
                    {unlinkedFields.map(f => (
                      <button
                        key={f.id}
                        onClick={() => toggleLink(f.id, false).then(() => setLinkOpen(false))}
                        disabled={linking}
                        className="flex w-full items-center gap-2 rounded-xl border border-border/40 bg-background px-3 py-2 text-left text-sm transition-colors hover:border-primary/40 disabled:opacity-50"
                      >
                        <Check className="h-3.5 w-3.5 text-primary opacity-0 group-hover:opacity-100" />
                        <span className="flex-1 truncate font-medium text-foreground">{f.name}</span>
                        {f.crop_type && <span className="text-xs text-muted">{f.crop_type}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
