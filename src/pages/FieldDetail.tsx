import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, MessageCircle, Sprout, Droplets, Sun,
  Calendar, AlertTriangle, CheckCircle, Clock, ChevronDown, ChevronUp,
  Pill, Pencil, Plus, X, Loader2, Trash2,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../lib/LanguageContext';
import { getGrowthStage, STAGE_LABELS, STAGE_COLORS } from '../lib/growthStages';
import WeatherWidget from '../components/WeatherWidget';
import ReportGenerator from '../components/ReportGenerator';
import clsx from 'clsx';

// ── Field health status (mirrors Fields.tsx logic) ──
function getFieldStatus(field: { last_intervention_at?: string | null }) {
  if (!field.last_intervention_at) return 'healthy' as const;
  const days = Math.floor((Date.now() - new Date(field.last_intervention_at).getTime()) / 86400000);
  return days <= 7 ? ('warning' as const) : ('healthy' as const);
}

const STATUS_CONFIG = {
  healthy:  { color: 'text-primary bg-primary/10 border-primary/20', icon: CheckCircle },
  warning:  { color: 'text-amber-400 bg-amber-500/10 border-amber-500/20', icon: Clock },
  critical: { color: 'text-red-400 bg-red-500/10 border-red-500/20', icon: AlertTriangle },
};

export default function FieldDetail() {
  const { fieldId } = useParams<{ fieldId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { appUserId } = useAuth();
  const { t, lang } = useLanguage();
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);

  // ── Fetch field ──
  const { data: field, isLoading: fieldLoading } = useQuery({
    queryKey: ['field-detail', fieldId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('field_context_view')
        .select('*')
        .eq('id', fieldId)
        .eq('user_id', appUserId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!fieldId && !!appUserId,
  });

  // ── Fetch timeline ──
  const { data: timeline = [], isLoading: timelineLoading } = useQuery({
    queryKey: ['field-timeline', fieldId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('field_activity_view')
        .select('*')
        .eq('field_id', fieldId)
        .eq('user_id', appUserId)
        .order('activity_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!fieldId && !!appUserId,
  });

  // ── Fetch pending follow-ups ──
  const { data: pendingFollowUps = [] } = useQuery({
    queryKey: ['field-followups', fieldId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('interventions')
        .select('id, crop_type, problem, diagnosis, vio_step, follow_up_at, product_applied, product')
        .eq('field_id', fieldId)
        .eq('user_id', appUserId)
        .is('outcome', null)
        .not('follow_up_at', 'is', null)
        .lt('vio_step', 3)
        .order('follow_up_at', { ascending: true })
        .limit(5);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!fieldId && !!appUserId,
  });

  // ── Fetch crops for growth stage + management ──
  const queryClient = useQueryClient();
  const { data: fieldCrops = [] } = useQuery({
    queryKey: ['field-crops', fieldId],
    queryFn: async () => {
      const { data } = await supabase
        .from('crops')
        .select('id, name, variety, planted_at, status, notes')
        .eq('field_id', fieldId)
        .order('created_at', { ascending: false });
      return (data ?? []) as Array<{ id: string; name: string; variety: string | null; planted_at: string | null; status: string | null; notes: string | null }>;
    },
    enabled: !!fieldId,
  });

  // ── CropManager state ──
  const [addCropOpen, setAddCropOpen] = useState(false);
  const [cropForm, setCropForm] = useState<{ name: string; variety: string; planted_at: string }>({ name: '', variety: '', planted_at: '' });
  const [savingCrop, setSavingCrop] = useState(false);
  const [removingCropId, setRemovingCropId] = useState<string | null>(null);

  const addCrop = async () => {
    if (!cropForm.name.trim() || !fieldId || !appUserId) return;
    setSavingCrop(true);
    try {
      const { error } = await supabase.from('crops').insert({
        user_id: appUserId,
        field_id: fieldId,
        name: cropForm.name.trim(),
        variety: cropForm.variety.trim() || null,
        planted_at: cropForm.planted_at || null,
      });
      if (!error) {
        setCropForm({ name: '', variety: '', planted_at: '' });
        setAddCropOpen(false);
        await queryClient.invalidateQueries({ queryKey: ['field-crops', fieldId] });
      }
    } finally {
      setSavingCrop(false);
    }
  };

  const removeCrop = async (cropId: string) => {
    setRemovingCropId(cropId);
    try {
      await supabase.from('crops').delete().eq('id', cropId);
      await queryClient.invalidateQueries({ queryKey: ['field-crops', fieldId] });
    } finally {
      setRemovingCropId(null);
    }
  };

  // ── Fetch user location for weather ──
  const { data: userLocation } = useQuery({
    queryKey: ['user-location', appUserId],
    queryFn: async () => {
      const { data } = await supabase
        .from('users')
        .select('location_lat, location_lon')
        .eq('id', appUserId)
        .single();
      return data;
    },
    enabled: !!appUserId,
    staleTime: 5 * 60 * 1000,
  });

  // ── Loading state ──
  if (fieldLoading) {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  // ── Not found ──
  if (!field) {
    return (
      <div className="flex h-[100dvh] flex-col items-center justify-center bg-background px-6 text-center">
        <Sprout className="h-10 w-10 text-muted/30 mb-3" />
        <p className="text-muted">{t.fieldDetailNotFound}</p>
        <button onClick={() => navigate('/fields')} className="mt-4 text-sm text-primary">
          ← {lang === 'el' ? 'Πίσω' : 'Back'}
        </button>
      </div>
    );
  }

  const fieldStatus = getFieldStatus(field);
  const statusCfg = STATUS_CONFIG[fieldStatus];
  const StatusIcon = statusCfg.icon;
  const statusLabel = fieldStatus === 'healthy' ? t.statusHealthy : fieldStatus === 'warning' ? t.statusWarning : t.statusCritical;

  const growthStage = getGrowthStage(field.crop_type, fieldCrops[0]?.planted_at);

  return (
    <div className="flex h-[100dvh] flex-col bg-background pt-safe">
      {/* ── Header ── */}
      <div className="flex items-center gap-3 border-b border-border/50 px-4 py-3">
        <button onClick={() => navigate('/fields')} className="rounded-full p-1.5 text-muted hover:text-foreground transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="truncate text-lg font-semibold text-foreground">{field.name}</h1>
          {field.crop_type && <p className="text-xs text-muted">{field.crop_type}</p>}
        </div>
        <button onClick={() => navigate('/fields', { state: { edit: fieldId } })}
          className="rounded-full p-2 text-muted hover:text-foreground transition-colors">
          <Pencil className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto pb-20">
        {/* ── Status Card ── */}
        <div className={clsx('mx-4 mt-4 rounded-2xl border p-4', statusCfg.color)}>
          <div className="flex items-center gap-3 mb-3">
            <StatusIcon className="h-6 w-6" />
            <span className="text-sm font-semibold">{statusLabel}</span>
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            {field.crop_type && (
              <div className="flex items-center gap-2">
                <Sprout className="h-3.5 w-3.5 opacity-60" />
                <span>{field.crop_type}</span>
              </div>
            )}
            {field.size_ha && (
              <div className="flex items-center gap-2">
                <Sun className="h-3.5 w-3.5 opacity-60" />
                <span>{field.size_ha} ha</span>
              </div>
            )}
            {field.irrigation_type && (
              <div className="flex items-center gap-2">
                <Droplets className="h-3.5 w-3.5 opacity-60" />
                <span>{t.fieldOptionLabels?.[field.irrigation_type] || field.irrigation_type}</span>
              </div>
            )}
            {field.soil_type && (
              <div className="flex items-center gap-2">
                <span className="text-sm opacity-60">🪨</span>
                <span>{t.fieldOptionLabels?.[field.soil_type] || field.soil_type}</span>
              </div>
            )}
          </div>
          {field.last_diagnosis && (
            <p className="mt-3 text-xs opacity-80">
              {t.fieldDetailLastIssue}: {field.last_diagnosis}
            </p>
          )}

          {/* ── Growth Stage ── */}
          {growthStage && (
            <div className="mt-3 pt-3 border-t border-inherit/20">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium">
                  {STAGE_LABELS[growthStage.stage][lang === 'el' ? 'el' : 'en']}
                </span>
                <span className="text-[11px] opacity-60">
                  {t.stageDay} {growthStage.totalDays}
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-black/20 overflow-hidden">
                <div
                  className={clsx('h-full rounded-full transition-all', STAGE_COLORS[growthStage.stage])}
                  style={{ width: `${growthStage.progress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* ── Weather (prefer field coords, fall back to user coords) ── */}
        <WeatherWidget
          lat={field.location_lat ?? userLocation?.location_lat ?? null}
          lon={field.location_lon ?? userLocation?.location_lon ?? null}
          lang={lang}
        />

        {/* ── Report + Share ── */}
        <ReportGenerator
          field={field}
          timeline={timeline}
          growthStage={growthStage ? STAGE_LABELS[growthStage.stage][lang === 'el' ? 'el' : 'en'] : null}
          lang={lang}
          autoGenerate={searchParams.get('report') === '1'}
        />

        {/* ── Quick Stats ── */}
        <div className="mx-4 mt-4 grid grid-cols-3 gap-2">
          {[
            { n: field.intervention_count ?? 0, label: t.fieldDetailTreatments, icon: Pill },
            { n: field.pending_follow_up_count ?? 0, label: t.fieldDetailPending, icon: Clock },
            { n: field.conversation_count ?? 0, label: t.fieldDetailChats, icon: MessageCircle },
          ].map(({ n, label, icon: I }) => (
            <div key={label} className="rounded-xl border border-border/50 bg-surface p-3 text-center">
              <I className="mx-auto h-4 w-4 text-muted mb-1" />
              <p className="text-lg font-bold text-foreground">{n}</p>
              <p className="text-[11px] text-muted">{label}</p>
            </div>
          ))}
        </div>

        {/* ── Pending Follow-ups ── */}
        {pendingFollowUps.length > 0 && (
          <div className="mx-4 mt-4">
            <h3 className="mb-2 text-sm font-semibold text-foreground">{t.fieldDetailPendingFollowups}</h3>
            <div className="space-y-2">
              {pendingFollowUps.map(fu => (
                <div key={fu.id} className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
                  <p className="text-sm font-medium text-foreground">
                    {fu.diagnosis || fu.problem || fu.crop_type}
                  </p>
                  <p className="text-xs text-muted mt-0.5">
                    {fu.product_applied || fu.product}
                    {fu.follow_up_at && (
                      <> · {t.fieldDetailDue}: {new Date(fu.follow_up_at).toLocaleDateString(lang === 'el' ? 'el-GR' : 'en-US')}</>
                    )}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Ask Oli Button ── */}
        <div className="mx-4 mt-4">
          <button
            onClick={() => navigate('/chat', { state: { fieldId } })}
            className="w-full flex items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/10 py-3 text-sm font-semibold text-primary transition-colors hover:bg-primary/20 active:scale-[0.98]"
          >
            <MessageCircle className="h-4 w-4" />
            {t.fieldDetailAskOli}
          </button>
        </div>

        {/* ── Crops (add / remove) ── */}
        <div className="mx-4 mt-6">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">
              {lang === 'el' ? 'Καλλιέργειες' : 'Crops'}
              <span className="ml-2 text-xs font-normal text-muted">({fieldCrops.length})</span>
            </h3>
            {!addCropOpen && (
              <button
                onClick={() => setAddCropOpen(true)}
                className="flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary/20"
              >
                <Plus className="h-3 w-3" />
                {lang === 'el' ? 'Νέα' : 'New'}
              </button>
            )}
          </div>

          {addCropOpen && (
            <div className="rounded-2xl border border-border/50 bg-surface p-3 mb-2 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-foreground">
                  {lang === 'el' ? 'Νέα καλλιέργεια' : 'New crop'}
                </p>
                <button onClick={() => setAddCropOpen(false)} className="text-muted hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <input
                type="text"
                placeholder={lang === 'el' ? 'Όνομα (π.χ. Ελιά)' : 'Name (e.g. Olive)'}
                value={cropForm.name}
                onChange={e => setCropForm(f => ({ ...f, name: e.target.value }))}
                className="w-full rounded-xl border border-border/50 bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-primary focus:outline-none"
              />
              <input
                type="text"
                placeholder={lang === 'el' ? 'Ποικιλία (προαιρ.)' : 'Variety (optional)'}
                value={cropForm.variety}
                onChange={e => setCropForm(f => ({ ...f, variety: e.target.value }))}
                className="w-full rounded-xl border border-border/50 bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-primary focus:outline-none"
              />
              <input
                type="date"
                placeholder={lang === 'el' ? 'Φύτευση' : 'Planted'}
                value={cropForm.planted_at}
                onChange={e => setCropForm(f => ({ ...f, planted_at: e.target.value }))}
                className="w-full rounded-xl border border-border/50 bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
              />
              <button
                onClick={addCrop}
                disabled={savingCrop || !cropForm.name.trim()}
                className="w-full rounded-xl bg-primary py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {savingCrop ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : (lang === 'el' ? 'Αποθήκευση' : 'Save')}
              </button>
            </div>
          )}

          {fieldCrops.length === 0 && !addCropOpen ? (
            <div className="rounded-xl border border-border/30 bg-surface p-4 text-center">
              <Sprout className="mx-auto h-6 w-6 text-muted/30 mb-1" />
              <p className="text-xs text-muted">
                {lang === 'el' ? 'Καμία καλλιέργεια ακόμα.' : 'No crops yet.'}
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {fieldCrops.map(c => (
                <div key={c.id} className="flex items-center gap-2 rounded-xl border border-border/30 bg-surface px-3 py-2">
                  <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <Sprout className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {c.name}{c.variety ? ` · ${c.variety}` : ''}
                    </p>
                    {c.planted_at && (
                      <p className="text-[11px] text-muted">
                        {lang === 'el' ? 'Φυτεύτηκε' : 'Planted'}: {new Date(c.planted_at).toLocaleDateString(lang === 'el' ? 'el-GR' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => removeCrop(c.id)}
                    disabled={removingCropId === c.id}
                    className="rounded-full p-1.5 text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                    title={lang === 'el' ? 'Διαγραφή' : 'Remove'}
                  >
                    {removingCropId === c.id
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <Trash2 className="h-3.5 w-3.5" />}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Timeline ── */}
        <div className="mx-4 mt-6 mb-4">
          <h3 className="mb-3 text-sm font-semibold text-foreground">{t.fieldDetailTimeline}</h3>

          {timelineLoading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="animate-pulse rounded-xl bg-surface p-4">
                  <div className="h-4 w-3/4 rounded bg-muted/20 mb-2" />
                  <div className="h-3 w-1/2 rounded bg-muted/10" />
                </div>
              ))}
            </div>
          ) : timeline.length === 0 ? (
            <div className="rounded-xl border border-border/30 bg-surface p-6 text-center">
              <Calendar className="mx-auto h-8 w-8 text-muted/30 mb-2" />
              <p className="text-sm text-muted">{t.fieldDetailNoActivity}</p>
            </div>
          ) : (
            <div className="relative space-y-0">
              {/* Timeline line */}
              <div className="absolute left-[11px] top-2 bottom-2 w-px bg-border/50" />

              {timeline.map((event) => {
                const isIntervention = event.activity_type === 'intervention';
                const expanded = expandedEvent === event.activity_id;
                return (
                  <button
                    key={event.activity_id}
                    onClick={() => setExpandedEvent(expanded ? null : event.activity_id)}
                    className="relative flex w-full gap-3 py-2.5 text-left"
                  >
                    {/* Timeline dot */}
                    <div className={clsx(
                      'relative z-10 mt-1 h-[22px] w-[22px] flex-shrink-0 rounded-full border-2 flex items-center justify-center',
                      isIntervention
                        ? (event.outcome
                            ? 'border-primary bg-primary/20'
                            : 'border-amber-400 bg-amber-400/20')
                        : 'border-border bg-surface'
                    )}>
                      {isIntervention
                        ? <Pill className="h-2.5 w-2.5" />
                        : <MessageCircle className="h-2.5 w-2.5 text-muted" />}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{event.title}</p>
                      <p className="text-[11px] text-muted mt-0.5">
                        {new Date(event.activity_at).toLocaleDateString(lang === 'el' ? 'el-GR' : 'en-US', {
                          day: 'numeric', month: 'short',
                        })}
                        {isIntervention && event.product_applied && ` · ${event.product_applied}`}
                      </p>

                      {/* Expanded detail */}
                      {expanded && isIntervention && (
                        <div className="mt-2 rounded-xl bg-surface border border-border/30 p-3 text-xs text-muted space-y-1">
                          {event.diagnosis && <p><span className="text-foreground font-medium">{t.problem}:</span> {event.diagnosis}</p>}
                          {event.product_applied && <p><span className="text-foreground font-medium">{t.productLabel}:</span> {event.product_applied}</p>}
                          {event.metadata?.dosage && <p><span className="text-foreground font-medium">{t.dosageLabel}:</span> {event.metadata.dosage as string}</p>}
                          {event.outcome && <p><span className="text-foreground font-medium">{t.outcomeLabel}:</span> {event.outcome}</p>}
                          {event.follow_up_at && !event.outcome && (
                            <p className="text-amber-400">
                              {t.followUpPending} · {new Date(event.follow_up_at).toLocaleDateString(lang === 'el' ? 'el-GR' : 'en-US')}
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    {isIntervention && (
                      expanded
                        ? <ChevronUp className="h-4 w-4 text-muted mt-1 flex-shrink-0" />
                        : <ChevronDown className="h-4 w-4 text-muted mt-1 flex-shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
