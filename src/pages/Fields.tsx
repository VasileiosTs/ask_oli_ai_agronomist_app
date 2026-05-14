import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Sprout, Plus, X, ChevronRight, AlertTriangle, CheckCircle, Clock, FileDown, Users, ArrowLeft, MessageCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../lib/LanguageContext';
import { getTierLimits } from '../lib/constants';
import { isAdvisorTier } from '../../shared/subscription';
import { downloadFieldReport } from '../lib/generateReport';
import PaywallModal from '../components/PaywallModal';
import LocationAutocomplete from '../components/LocationAutocomplete';
import { formatArea, unitLabel, displayToHa, haToDisplay, type AreaUnit } from '../lib/areaUnits';
import clsx from 'clsx';

interface Field {
  id: string; name: string; crop_type: string | null; location: string | null;
  size_ha: number | null; soil_type: string | null; irrigation_type: string | null;
  growing_medium: string | null; is_active: boolean;
  location_lat: number | null; location_lon: number | null;
  last_diagnosis: string | null; last_intervention_at: string | null; crop_count: number;
}

interface FieldFormData {
  name: string; crop_type: string; location: string; size_ha: string;
  soil_type: string; irrigation_type: string; growing_medium: string;
  location_lat: number | null; location_lon: number | null;
}

const GROWING_MEDIUMS = ['soil', 'hydro', 'container', 'greenhouse'];
const SOIL_TYPES = ['argillous', 'sandy', 'loamy', 'silty', 'peaty', 'chalky'];
const IRRIGATION_TYPES = ['drip', 'sprinkler', 'furrow', 'flood', 'rain-fed'];

function getFieldStatus(field: Field): 'healthy' | 'warning' | 'critical' {
  if (!field.last_intervention_at) return 'healthy';
  const days = Math.floor((Date.now() - new Date(field.last_intervention_at).getTime()) / 86400000);
  if (days <= 7) return 'warning';
  return 'healthy';
}

export default function Fields() {
  const { appUserId, profile } = useAuth();
  const { t, lang } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const areaUnit: AreaUnit = (profile?.area_unit as AreaUnit | undefined) ?? (lang === 'el' ? 'stremma' : 'ha');
  const queryClient = useQueryClient();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);

  const advisor = isAdvisorTier(profile?.tier as string | undefined);
  const pageTitle = advisor
    ? (lang === 'el' ? 'Οι Παραγωγοί μου' : 'My Growers')
    : t.myFields;
  const [editingField, setEditingField] = useState<Field | null>(null);
  const [showPaywall, setShowPaywall] = useState(false);
  const [form, setForm] = useState<FieldFormData>({
    name: '', crop_type: '', location: '', size_ha: '',
    soil_type: '', irrigation_type: '', growing_medium: '',
    location_lat: null, location_lon: null,
  });

  const tier = (profile as { tier?: string })?.tier || 'free';
  const isFree = !profile?.tier || profile.tier === 'free';
  const limits = getTierLimits(tier);

  const STATUS_CONFIG = {
    critical: { color: 'text-red-400 bg-red-500/10 border-red-500/30', icon: <AlertTriangle className="h-3.5 w-3.5" />, label: t.statusCritical },
    warning:  { color: 'text-amber-400 bg-amber-500/10 border-amber-500/30', icon: <Clock className="h-3.5 w-3.5" />, label: t.statusWarning },
    healthy:  { color: 'text-primary bg-primary/10 border-primary/30', icon: <CheckCircle className="h-3.5 w-3.5" />, label: t.statusHealthy },
  };

  const { data: fields = [], isLoading } = useQuery({
    queryKey: ['fields', appUserId],
    queryFn: async () => {
      const { data, error } = await supabase.from('field_context_view').select('*').eq('user_id', appUserId!).eq('is_active', true);
      if (error) throw error;
      return (data ?? []) as Field[];
    },
    enabled: !!appUserId,
  });

  // Global pending VIO count across all fields
  const { data: pendingVioCount = 0 } = useQuery({
    queryKey: ['pending-vio-count', appUserId],
    queryFn: async () => {
      const { count } = await supabase
        .from('interventions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', appUserId!)
        .is('outcome', null)
        .lte('follow_up_at', new Date().toISOString())
        .lt('vio_step', 3);
      return count ?? 0;
    },
    enabled: !!appUserId,
  });

  // Handle edit navigation state from FieldDetail
  const editFromNav = (location.state as { edit?: string })?.edit;
  if (editFromNav && fields.length > 0 && !sheetOpen && !editingField) {
    const fieldToEdit = fields.find(f => f.id === editFromNav);
    if (fieldToEdit) {
      // Clear navigation state and open edit
      window.history.replaceState({}, '');
      setTimeout(() => openEdit(fieldToEdit), 0);
    }
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        user_id: appUserId!, name: form.name.trim(),
        crop_type: form.crop_type.trim() || null, location: form.location.trim() || null,
        location_lat: form.location_lat, location_lon: form.location_lon,
        size_ha: form.size_ha ? displayToHa(parseFloat(form.size_ha), areaUnit) : null,
        soil_type: form.soil_type || null, irrigation_type: form.irrigation_type || null,
        growing_medium: form.growing_medium || null, is_active: true, source: 'manual' as const,
      };
      if (editingField) {
        const { error } = await supabase.from('fields').update(payload).eq('id', editingField.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('fields').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['fields'] }); closeSheet(); },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('fields').update({ is_active: false }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['fields'] }),
  });

  const handleDownloadReport = async () => {
    if (!appUserId || reportLoading) return;
    let currentReportCount = 0;
    if (isFree) {
      const { data: userData } = await supabase.from('users').select('report_count_month').eq('id', appUserId).single();
      currentReportCount = userData?.report_count_month ?? 0;
      if (currentReportCount >= 1) { setShowPaywall(true); return; }
    }
    setReportLoading(true);
    try {
      await downloadFieldReport(appUserId, fields, (profile as any)?.name ?? '', lang);
      if (isFree) {
        await supabase.from('users').update({ report_count_month: currentReportCount + 1 }).eq('id', appUserId);
      }
    } finally {
      setReportLoading(false);
    }
  };

  const openAdd = () => {
    // Enforce field limit for free tier
    if (fields.length >= limits.fields) {
      setShowPaywall(true);
      return;
    }
    setEditingField(null);
    setForm({ name: '', crop_type: '', location: '', size_ha: '', soil_type: '', irrigation_type: '', growing_medium: '', location_lat: null, location_lon: null });
    setSheetOpen(true);
  };

  const openEdit = (field: Field) => {
    setEditingField(field);
    setForm({ name: field.name, crop_type: field.crop_type ?? '', location: field.location ?? '',
      size_ha: field.size_ha != null ? String(haToDisplay(field.size_ha, areaUnit)) : '', soil_type: field.soil_type ?? '',
      irrigation_type: field.irrigation_type ?? '', growing_medium: field.growing_medium ?? '',
      location_lat: field.location_lat ?? null, location_lon: field.location_lon ?? null });
    setSheetOpen(true);
  };

  const closeSheet = () => { setSheetOpen(false); setEditingField(null); };

  return (
    <main className="flex h-[calc(100dvh-104px)] md:h-[calc(100dvh-48px)] flex-col bg-background">
      <div className="border-b border-border/50 px-4 py-4">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(-1)} className="mr-1 rounded-full p-1.5 text-muted hover:bg-surface hover:text-foreground transition-colors" aria-label="Back">
            <ArrowLeft className="h-4 w-4" />
          </button>
          {advisor ? <Users className="h-5 w-5 text-primary" /> : <Sprout className="h-5 w-5 text-primary" />}
          <h1 className="text-lg font-semibold text-foreground">{pageTitle}</h1>
          {limits.fields !== Infinity && (
            <span className="text-xs text-muted" title={lang === 'el' ? `${fields.length} από ${limits.fields} αγροτεμάχια` : `${fields.length} of ${limits.fields} fields used`}>
              {fields.length}/{limits.fields} {lang === 'el' ? 'αγρ.' : 'fields'}
            </span>
          )}
          {fields.length > 0 && (
            <button
              onClick={handleDownloadReport}
              disabled={reportLoading}
              className="ml-auto flex items-center gap-1.5 rounded-lg border border-border/50 bg-surface px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:text-foreground disabled:opacity-50"
            >
              <FileDown className="h-3.5 w-3.5" />
              {reportLoading
                ? (lang === 'el' ? 'Φόρτωση...' : 'Loading...')
                : (lang === 'el' ? 'PDF' : 'PDF')}
            </button>
          )}
        </div>
        <p className="mt-0.5 text-xs text-muted">{t.fieldsSubtitle}</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {pendingVioCount > 0 && (
          <div className="mb-3 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-2.5 flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-400 flex-shrink-0" />
            <p className="text-xs text-amber-400">
              {lang === 'el'
                ? `${pendingVioCount} παρέμβαση${pendingVioCount > 1 ? 'εις' : ''} περιμένουν αποτέλεσμα`
                : `${pendingVioCount} intervention${pendingVioCount > 1 ? 's' : ''} awaiting outcome`}
            </p>
          </div>
        )}
        {isLoading ? (
          <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 animate-pulse rounded-2xl bg-surface" />)}</div>
        ) : fields.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
            <Sprout className="h-16 w-16 text-primary/20" />
            <div>
              <h3 className="font-semibold text-foreground">{t.noFieldsTitle}</h3>
              <p className="mt-1 text-sm text-muted">{t.noFieldsBody}</p>
            </div>
            <button onClick={openAdd} className="rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary/90">
              {t.addField}
            </button>
          </div>
        ) : (
          <div className="space-y-3 pb-24">
            {fields.map(field => {
              const status = getFieldStatus(field);
              const cfg = STATUS_CONFIG[status];
              return (
                <div key={field.id} className="rounded-2xl border border-border/50 bg-surface transition-colors hover:bg-surface/80">
                  <div className="flex items-center gap-2 p-4">
                    <button onClick={() => navigate(`/fields/${field.id}`)} className="flex-1 min-w-0 text-left active:scale-[0.99]">
                      <div className="flex items-center gap-2">
                        <h3 className="truncate font-semibold text-foreground">{field.name}</h3>
                        <span className={clsx('flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium', cfg.color)}>
                          {cfg.icon}{cfg.label}
                        </span>
                      </div>
                      {field.crop_type && <p className="mt-0.5 text-sm text-muted">{field.crop_type}</p>}
                      <div className="mt-2 flex flex-wrap gap-2">
                        {field.size_ha && <span className="rounded-full bg-background px-2 py-0.5 text-[11px] text-muted border border-border/50">{formatArea(field.size_ha, areaUnit, lang)}</span>}
                        {field.growing_medium && <span className="rounded-full bg-background px-2 py-0.5 text-[11px] text-muted border border-border/50">{t.fieldOptionLabels[field.growing_medium] || field.growing_medium}</span>}
                      </div>
                    </button>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => navigate('/chat', { state: { fieldId: field.id } })}
                        className="rounded-full border border-primary/30 bg-primary/10 p-2 text-primary transition-colors hover:bg-primary/20"
                        title={lang === 'el' ? 'Συνομιλία για αυτό το χωράφι' : 'Chat about this field'}
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => navigate(`/fields/${field.id}`)} className="p-2 text-muted">
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* FAB — Add field */}
      {fields.length > 0 && (
        <button onClick={openAdd} aria-label={t.addField} className="fixed bottom-[80px] md:bottom-6 right-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-lg transition-transform active:scale-95 hover:bg-primary/90">
          <Plus className="h-6 w-6" />
        </button>
      )}

      <PaywallModal isOpen={showPaywall} onClose={() => setShowPaywall(false)} />

      {/* Add/Edit sheet */}
      {sheetOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-t-[28px] bg-background p-6 pb-safe shadow-xl max-h-[90dvh] overflow-y-auto">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-foreground">{editingField ? t.editField : t.newField}</h2>
              <button onClick={closeSheet} className="rounded-full p-2 text-muted hover:bg-muted/10"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-4">
              {[
                { label: t.fieldName, key: 'name' as const },
                { label: t.fieldCrop, key: 'crop_type' as const },
              ].map(({ label, key }) => (
                <div key={key}>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">{label}</label>
                  <input type="text" value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    className="w-full rounded-xl border border-border/50 bg-surface px-4 py-2.5 text-[15px] text-foreground focus:border-primary focus:outline-none" />
                </div>
              ))}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">{t.fieldLocation}</label>
                <LocationAutocomplete
                  value={form.location}
                  lang={lang}
                  coords={form.location_lat && form.location_lon ? { lat: form.location_lat, lon: form.location_lon } : null}
                  onChange={val => setForm(f => ({ ...f, location: val }))}
                  onSelect={sel => setForm(f => ({
                    ...f,
                    location: sel?.label ?? f.location,
                    location_lat: sel?.lat ?? null,
                    location_lon: sel?.lon ?? null,
                  }))}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">
                  {t.fieldSize} ({unitLabel(areaUnit, lang)})
                </label>
                <input type="number" value={form.size_ha} onChange={e => setForm(f => ({ ...f, size_ha: e.target.value }))}
                  placeholder={areaUnit === 'stremma' ? 'π.χ. 50' : 'e.g. 5'}
                  className="w-full rounded-xl border border-border/50 bg-surface px-4 py-2.5 text-[15px] text-foreground focus:border-primary focus:outline-none" />
              </div>
              {[
                { label: t.fieldMedium, key: 'growing_medium' as const, opts: GROWING_MEDIUMS },
                { label: t.fieldSoil, key: 'soil_type' as const, opts: SOIL_TYPES },
                { label: t.fieldIrrigation, key: 'irrigation_type' as const, opts: IRRIGATION_TYPES },
              ].map(({ label, key, opts }) => (
                <div key={key}>
                  <label className="mb-2 block text-sm font-medium text-foreground">{label}</label>
                  <div className="flex flex-wrap gap-2">
                    {opts.map(o => (
                      <button key={o} onClick={() => setForm(f => ({ ...f, [key]: f[key] === o ? '' : o }))}
                        className={clsx('rounded-full border px-3 py-1.5 text-sm transition-colors',
                          form[key] === o ? 'border-primary bg-primary/10 text-primary' : 'border-border/50 bg-surface text-muted hover:text-foreground')}>
                        {t.fieldOptionLabels[o] || o}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <div className="flex gap-3 pt-2">
                {editingField && (
                  <button onClick={() => { deleteMutation.mutate(editingField.id); closeSheet(); }}
                    className="flex-1 rounded-xl border border-red-500/30 bg-red-500/10 py-3 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/20">
                    {t.fieldDelete}
                  </button>
                )}
                <button onClick={() => saveMutation.mutate()} disabled={!form.name.trim() || saveMutation.isPending}
                  className="flex-1 rounded-xl bg-primary py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50">
                  {saveMutation.isPending ? t.fieldSaving : t.fieldSave}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
