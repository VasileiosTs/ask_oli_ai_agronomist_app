import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Sprout, Plus, X, ChevronRight, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import clsx from 'clsx';

interface Field {
  id: string;
  name: string;
  crop_type: string | null;
  location: string | null;
  size_ha: number | null;
  soil_type: string | null;
  irrigation_type: string | null;
  growing_medium: string | null;
  is_active: boolean;
  last_diagnosis: string | null;
  last_intervention_at: string | null;
  crop_count: number;
}

interface FieldFormData {
  name: string;
  crop_type: string;
  location: string;
  size_ha: string;
  soil_type: string;
  irrigation_type: string;
  growing_medium: string;
}

const GROWING_MEDIUMS = ['soil', 'hydro', 'container', 'greenhouse'];
const SOIL_TYPES = ['argillous', 'sandy', 'loamy', 'silty', 'peaty', 'chalky'];
const IRRIGATION_TYPES = ['drip', 'sprinkler', 'furrow', 'flood', 'rain-fed'];

const STATUS_CONFIG: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  critical: {
    color: 'text-red-400 bg-red-500/10 border-red-500/30',
    icon: <AlertTriangle className="h-3.5 w-3.5" />,
    label: 'Kritiko',
  },
  warning: {
    color: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
    icon: <Clock className="h-3.5 w-3.5" />,
    label: 'Prosochi',
  },
  healthy: {
    color: 'text-primary bg-primary/10 border-primary/30',
    icon: <CheckCircle className="h-3.5 w-3.5" />,
    label: 'Ygiino',
  },
};

function getFieldStatus(field: Field): 'healthy' | 'warning' | 'critical' {
  if (!field.last_intervention_at) return 'healthy';
  const daysSince = Math.floor(
    (Date.now() - new Date(field.last_intervention_at).getTime()) / 86400000
  );
  if (daysSince <= 7) return 'warning';
  return 'healthy';
}

export default function Fields() {
  const { appUserId, isGuest } = useAuth();
  const queryClient = useQueryClient();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingField, setEditingField] = useState<Field | null>(null);
  const [form, setForm] = useState<FieldFormData>({
    name: '', crop_type: '', location: '', size_ha: '',
    soil_type: '', irrigation_type: '', growing_medium: '',
  });

  const { data: fields = [], isLoading } = useQuery({
    queryKey: ['fields', appUserId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('field_context_view')
        .select('*')
        .eq('user_id', appUserId!);
      if (error) throw error;
      return (data ?? []) as Field[];
    },
    enabled: !!appUserId && !isGuest,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        user_id: appUserId!,
        name: form.name.trim(),
        crop_type: form.crop_type.trim() || null,
        location: form.location.trim() || null,
        size_ha: form.size_ha ? parseFloat(form.size_ha) : null,
        soil_type: form.soil_type || null,
        irrigation_type: form.irrigation_type || null,
        growing_medium: form.growing_medium || null,
        is_active: true,
      };
      if (editingField) {
        const { error } = await supabase.from('fields').update(payload).eq('id', editingField.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('fields').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fields'] });
      closeSheet();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('fields').update({ is_active: false }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['fields'] }),
  });

  const openAdd = () => {
    setEditingField(null);
    setForm({ name: '', crop_type: '', location: '', size_ha: '', soil_type: '', irrigation_type: '', growing_medium: '' });
    setSheetOpen(true);
  };

  const openEdit = (field: Field) => {
    setEditingField(field);
    setForm({
      name: field.name,
      crop_type: field.crop_type ?? '',
      location: field.location ?? '',
      size_ha: field.size_ha?.toString() ?? '',
      soil_type: field.soil_type ?? '',
      irrigation_type: field.irrigation_type ?? '',
      growing_medium: field.growing_medium ?? '',
    });
    setSheetOpen(true);
  };

  const closeSheet = () => {
    setSheetOpen(false);
    setEditingField(null);
  };

  if (isGuest) {
    return (
      <div className="flex h-[calc(100dvh-48px)] flex-col items-center justify-center gap-4 px-6 text-center">
        <Sprout className="h-12 w-12 text-primary/40" />
        <h2 className="text-lg font-semibold text-foreground">Dimiourgia Logariamoy</h2>
        <p className="text-sm text-muted">Syndesu gia na diaxeiristeis ta xwrafia sou kai na exeis prostateymeni mnimi.</p>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100dvh-48px)] flex-col bg-background">
      {/* Header */}
      <div className="border-b border-border/50 px-4 py-4">
        <div className="flex items-center gap-2">
          <Sprout className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-semibold text-foreground">Ta Xwrafia mou</h1>
        </div>
        <p className="mt-0.5 text-xs text-muted">Diacherisi kalliergion kai agrwn</p>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-20 animate-pulse rounded-2xl bg-surface" />
            ))}
          </div>
        ) : fields.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
            <Sprout className="h-16 w-16 text-primary/20" />
            <div>
              <h3 className="font-semibold text-foreground">Kamia kalliergeia akoma</h3>
              <p className="mt-1 text-sm text-muted">Prosthese tin prwti soy kalliergeia</p>
            </div>
            <button
              onClick={openAdd}
              className="rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary/90"
            >
              Prosthiki
            </button>
          </div>
        ) : (
          <div className="space-y-3 pb-24">
            {fields.map(field => {
              const status = getFieldStatus(field);
              const statusCfg = STATUS_CONFIG[status];
              return (
                <div
                  key={field.id}
                  className="rounded-2xl border border-border/50 bg-surface p-4 transition-colors active:scale-[0.99]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="truncate font-semibold text-foreground">{field.name}</h3>
                        <span className={clsx('flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium', statusCfg.color)}>
                          {statusCfg.icon}
                          {statusCfg.label}
                        </span>
                      </div>
                      {field.crop_type && (
                        <p className="mt-0.5 text-sm text-muted">{field.crop_type}</p>
                      )}
                      <div className="mt-2 flex flex-wrap gap-2">
                        {field.size_ha && (
                          <span className="rounded-full bg-background px-2 py-0.5 text-[11px] text-muted border border-border/50">
                            {field.size_ha} ha
                          </span>
                        )}
                        {field.growing_medium && (
                          <span className="rounded-full bg-background px-2 py-0.5 text-[11px] text-muted border border-border/50">
                            {field.growing_medium}
                          </span>
                        )}
                        {field.last_diagnosis && (
                          <span className="rounded-full bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 text-[11px] text-amber-400">
                            {field.last_diagnosis.slice(0, 30)}{field.last_diagnosis.length > 30 ? '…' : ''}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => openEdit(field)}
                      className="flex-shrink-0 rounded-full p-2 text-muted hover:bg-muted/10 hover:text-foreground transition-colors"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* FAB */}
      {fields.length > 0 && (
        <button
          onClick={openAdd}
          className="fixed bottom-20 right-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-lg transition-transform active:scale-95 hover:bg-primary/90"
        >
          <Plus className="h-6 w-6" />
        </button>
      )}

      {/* Add/Edit Sheet */}
      {sheetOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-t-[28px] bg-background p-6 pb-safe shadow-xl max-h-[90dvh] overflow-y-auto">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-foreground">
                {editingField ? 'Epeksergasia' : 'Neo Xwrafi'}
              </h2>
              <button onClick={closeSheet} className="rounded-full p-2 text-muted hover:bg-muted/10">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">Onoma *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="px. Eleonas Voreia"
                  className="w-full rounded-xl border border-border/50 bg-surface px-4 py-2.5 text-[15px] text-foreground focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">Kalliergeia</label>
                <input
                  type="text"
                  value={form.crop_type}
                  onChange={e => setForm(f => ({ ...f, crop_type: e.target.value }))}
                  placeholder="px. Elies, Ampelonas"
                  className="w-full rounded-xl border border-border/50 bg-surface px-4 py-2.5 text-[15px] text-foreground focus:border-primary focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">Topothe sia</label>
                  <input
                    type="text"
                    value={form.location}
                    onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                    placeholder="px. Kritis"
                    className="w-full rounded-xl border border-border/50 bg-surface px-4 py-2.5 text-[15px] text-foreground focus:border-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">Ektasi (ha)</label>
                  <input
                    type="number"
                    value={form.size_ha}
                    onChange={e => setForm(f => ({ ...f, size_ha: e.target.value }))}
                    placeholder="px. 2.5"
                    className="w-full rounded-xl border border-border/50 bg-surface px-4 py-2.5 text-[15px] text-foreground focus:border-primary focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">Meso Kaллiergias</label>
                <div className="flex flex-wrap gap-2">
                  {GROWING_MEDIUMS.map(m => (
                    <button
                      key={m}
                      onClick={() => setForm(f => ({ ...f, growing_medium: f.growing_medium === m ? '' : m }))}
                      className={clsx(
                        'rounded-full border px-3 py-1.5 text-sm transition-colors',
                        form.growing_medium === m
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border/50 bg-surface text-muted hover:text-foreground'
                      )}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">Tipos Edafous</label>
                <div className="flex flex-wrap gap-2">
                  {SOIL_TYPES.map(s => (
                    <button
                      key={s}
                      onClick={() => setForm(f => ({ ...f, soil_type: f.soil_type === s ? '' : s }))}
                      className={clsx(
                        'rounded-full border px-3 py-1.5 text-sm transition-colors',
                        form.soil_type === s
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border/50 bg-surface text-muted hover:text-foreground'
                      )}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">Ardeysi</label>
                <div className="flex flex-wrap gap-2">
                  {IRRIGATION_TYPES.map(i => (
                    <button
                      key={i}
                      onClick={() => setForm(f => ({ ...f, irrigation_type: f.irrigation_type === i ? '' : i }))}
                      className={clsx(
                        'rounded-full border px-3 py-1.5 text-sm transition-colors',
                        form.irrigation_type === i
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border/50 bg-surface text-muted hover:text-foreground'
                      )}
                    >
                      {i}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                {editingField && (
                  <button
                    onClick={() => { deleteMutation.mutate(editingField.id); closeSheet(); }}
                    className="flex-1 rounded-xl border border-red-500/30 bg-red-500/10 py-3 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/20"
                  >
                    Diagrafi
                  </button>
                )}
                <button
                  onClick={() => saveMutation.mutate()}
                  disabled={!form.name.trim() || saveMutation.isPending}
                  className="flex-1 rounded-xl bg-primary py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {saveMutation.isPending ? 'Apothikeusi...' : 'Apothikeyse'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
