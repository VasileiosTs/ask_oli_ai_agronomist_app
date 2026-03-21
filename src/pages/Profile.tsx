import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Leaf, MapPin, Crown, Pencil, Bell, Globe, LogOut, Trash2, Download, FileText, Shield, ChevronRight, Loader2, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../lib/LanguageContext';
import type { Lang } from '../lib/i18n';
import clsx from 'clsx';

const FREE_LIMIT = 20;

export default function Profile() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { t, lang, setLang } = useLanguage();

  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editCrop, setEditCrop] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from('users').select('*').eq('auth_id', user.id).maybeSingle()
      .then(({ data }) => { if (data) setProfile(data); setLoading(false); });
  }, [user]);

  const openEdit = () => {
    if (!profile) return;
    setEditName(profile.name ?? '');
    setEditLocation(profile.location ?? '');
    setEditCrop(profile.primary_crop ?? '');
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!profile) return;
    setSaving(true);
    let lat = null, lon = null;
    if (editLocation !== profile.location) {
      try {
        const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(editLocation)}&count=1&language=el&format=json`);
        const data = await res.json();
        if (data.results?.[0]) { lat = data.results[0].latitude; lon = data.results[0].longitude; }
      } catch { /* optional */ }
    }
    const updates: any = { name: editName.trim(), location: editLocation.trim(), primary_crop: editCrop.trim() };
    if (lat !== null) { updates.location_lat = lat; updates.location_lon = lon; }
    await supabase.from('users').update(updates).eq('id', profile.id);
    setSaving(false);
    setEditOpen(false);
    supabase.from('users').select('*').eq('auth_id', user!.id).maybeSingle().then(({ data }) => { if (data) setProfile(data); });
  };

  const toggleNotif = async (field: string) => {
    if (!profile) return;
    const newVal = !profile[field];
    await supabase.from('users').update({ [field]: newVal }).eq('id', profile.id);
    setProfile({ ...profile, [field]: newVal });
  };

  const exportData = async () => {
    if (!profile) return;
    setExporting(true);
    const [msgs, ints] = await Promise.all([
      supabase.from('chat_messages').select('*').eq('user_id', profile.id).order('created_at'),
      supabase.from('interventions').select('*').eq('user_id', profile.id).order('created_at'),
    ]);
    const blob = new Blob([JSON.stringify({ profile, messages: msgs.data, interventions: ints.data }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `oli-data-${new Date().toISOString().split('T')[0]}.json`; a.click();
    URL.revokeObjectURL(url);
    setExporting(false);
  };

  const deleteAccount = async () => {
    if (!profile || deleteConfirm !== t.deleteConfirmWord) return;
    setDeleting(true);
    await supabase.from('chat_messages').delete().eq('user_id', profile.id);
    await supabase.from('interventions').delete().eq('user_id', profile.id);
    await supabase.from('users').delete().eq('id', profile.id);
    await logout();
    navigate('/auth');
  };

  if (loading) return <div className="flex h-[100dvh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (!profile) return <div className="flex h-[100dvh] items-center justify-center"><p className="text-muted">{t.noProfile}</p></div>;

  const isPro = profile.tier === 'pro';
  const msgCount = profile.message_count_month ?? 0;
  const msgPercent = Math.min((msgCount / FREE_LIMIT) * 100, 100);

  return (
    <div className="h-[100dvh] overflow-y-auto bg-background">
      {/* Header */}
      <div className="px-4 pt-12 pb-4">
        <div className="flex items-center gap-4">
          <div className="flex h-[72px] w-[72px] flex-shrink-0 items-center justify-center rounded-full bg-primary/20">
            <Leaf className="h-8 w-8 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="truncate text-xl font-bold text-foreground">{profile.name}</h1>
            <div className="flex items-center gap-1 mt-0.5">
              <MapPin className="h-3 w-3 text-muted flex-shrink-0" />
              <span className="truncate text-sm text-muted">{profile.location}</span>
            </div>
            <span className={clsx('mt-1.5 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
              isPro ? 'bg-primary/15 text-primary' : 'bg-surface text-muted border border-border/50')}>
              {isPro && <Crown className="h-3 w-3" />}
              {isPro ? 'PRO' : lang === 'el' ? 'ΔΩΡΕΑΝ' : 'FREE'}
            </span>
          </div>
        </div>
        <button onClick={openEdit} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-border/50 bg-surface py-2.5 text-sm text-muted transition-colors hover:text-foreground">
          <Pencil className="h-4 w-4" />{t.editProfile}
        </button>
      </div>

      <div className="h-px bg-border/50" />

      {/* Subscription */}
      <div className="px-4 py-4">
        <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted">{t.subscription}</h2>
        {isPro ? (
          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 flex items-center justify-between">
            <div><p className="font-semibold text-foreground">{t.unlimited}</p><p className="text-sm text-primary">{t.active}</p></div>
            <Crown className="h-6 w-6 text-primary" />
          </div>
        ) : (
          <div className="rounded-2xl border border-border/50 bg-surface p-4">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="text-muted">{lang === 'el' ? 'Μηνύματα' : 'Messages'}</span>
              <span className="font-semibold text-foreground">{msgCount}/{FREE_LIMIT}</span>
            </div>
            <div className="h-2 w-full rounded-full bg-background overflow-hidden">
              <div className={clsx('h-full rounded-full transition-all', msgPercent >= 80 ? 'bg-amber-400' : 'bg-primary')} style={{ width: `${msgPercent}%` }} />
            </div>
            <button className="mt-3 w-full rounded-xl bg-primary py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90">
              {t.upgradeBtn} — {t.monthly}
            </button>
          </div>
        )}
      </div>

      <div className="h-px bg-border/50" />

      {/* Settings */}
      <div className="px-4 py-4">
        <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted">{t.settings}</h2>
        <div className="space-y-1">
          <div className="flex items-center justify-between rounded-xl p-3">
            <div className="flex items-center gap-3"><Globe className="h-5 w-5 text-muted" /><span className="text-sm text-foreground">{t.languageLabel}</span></div>
            <div className="flex gap-1">
              {(['el', 'en'] as Lang[]).map(l => (
                <button key={l} onClick={() => setLang(l)}
                  className={clsx('rounded-full px-3 py-1 text-xs font-medium transition-colors',
                    lang === l ? 'bg-primary text-white' : 'bg-surface text-muted border border-border/50 hover:text-foreground')}>
                  {l === 'el' ? 'Ελ' : 'En'}
                </button>
              ))}
            </div>
          </div>
          {[
            { key: 'notification_followup', label: t.followUp },
            { key: 'notification_weekly_plan', label: t.weeklyPlan },
          ].map(({ key, label }) => (
            <div key={key} className="flex items-center justify-between rounded-xl p-3">
              <div className="flex items-center gap-3"><Bell className="h-5 w-5 text-muted" /><span className="text-sm text-foreground">{label}</span></div>
              <button onClick={() => toggleNotif(key)}
                className={clsx('relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors', profile[key] ? 'bg-primary' : 'bg-border')}>
                <span className={clsx('pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform', profile[key] ? 'translate-x-5' : 'translate-x-0')} />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="h-px bg-border/50" />

      {/* Account */}
      <div className="px-4 py-4">
        <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted">{t.account}</h2>
        <div className="space-y-1">
          <button onClick={() => navigate('/legal/privacy')} className="flex w-full items-center justify-between rounded-xl p-3 transition-colors hover:bg-surface">
            <div className="flex items-center gap-3"><FileText className="h-5 w-5 text-muted" /><span className="text-sm text-foreground">{t.privacyPolicy}</span></div>
            <ChevronRight className="h-4 w-4 text-muted" />
          </button>
          <button onClick={() => navigate('/legal/terms')} className="flex w-full items-center justify-between rounded-xl p-3 transition-colors hover:bg-surface">
            <div className="flex items-center gap-3"><Shield className="h-5 w-5 text-muted" /><span className="text-sm text-foreground">{t.termsOfService}</span></div>
            <ChevronRight className="h-4 w-4 text-muted" />
          </button>
          <button onClick={exportData} disabled={exporting} className="flex w-full items-center gap-3 rounded-xl p-3 transition-colors hover:bg-surface disabled:opacity-50">
            <Download className="h-5 w-5 text-muted" /><span className="text-sm text-foreground">{exporting ? t.exporting : t.exportData}</span>
          </button>
          <button onClick={() => setDeleteOpen(true)} className="flex w-full items-center gap-3 rounded-xl p-3 text-red-400 transition-colors hover:bg-red-500/5">
            <Trash2 className="h-5 w-5" /><span className="text-sm">{t.deleteAccount}</span>
          </button>
        </div>
      </div>

      <div className="h-px bg-border/50" />

      <div className="px-4 py-4 pb-12">
        <button onClick={logout} className="flex w-full items-center justify-center gap-2 rounded-xl p-3 text-muted transition-colors hover:bg-surface hover:text-foreground">
          <LogOut className="h-5 w-5" /><span className="text-sm">{t.signOut}</span>
        </button>
      </div>

      {/* Edit Dialog */}
      {editOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className="w-full max-w-sm rounded-2xl bg-background p-6 shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-foreground">{t.editProfile}</h3>
              <button onClick={() => setEditOpen(false)} className="rounded-full p-1.5 text-muted hover:bg-muted/10"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-3">
              {[
                { label: t.nameLabel, value: editName, set: setEditName },
                { label: t.locationLabel, value: editLocation, set: setEditLocation },
                { label: t.cropLabel, value: editCrop, set: setEditCrop },
              ].map(({ label, value, set }) => (
                <div key={label}>
                  <label className="mb-1 block text-sm font-medium text-foreground">{label}</label>
                  <input type="text" value={value} onChange={e => set(e.target.value)}
                    className="w-full rounded-xl border border-border/50 bg-surface px-4 py-2.5 text-[15px] text-foreground focus:border-primary focus:outline-none" />
                </div>
              ))}
            </div>
            <div className="mt-5 flex gap-3">
              <button onClick={() => setEditOpen(false)} className="flex-1 rounded-xl border border-border bg-surface py-2.5 text-sm text-foreground">{t.cancel}</button>
              <button onClick={saveEdit} disabled={saving || !editName.trim()} className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-semibold text-white disabled:opacity-50">
                {saving ? t.saving : t.save}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Dialog */}
      {deleteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className="w-full max-w-sm rounded-2xl bg-background p-6 shadow-xl">
            <h3 className="mb-2 text-lg font-semibold text-red-400">{t.deleteAccount}</h3>
            <p className="mb-4 text-sm text-muted">{t.deleteConfirmText}</p>
            <input type="text" value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)}
              placeholder={t.deleteConfirmWord}
              className="mb-4 w-full rounded-xl border border-border/50 bg-surface px-4 py-2.5 text-[15px] text-foreground focus:border-red-400 focus:outline-none" />
            <div className="flex gap-3">
              <button onClick={() => { setDeleteOpen(false); setDeleteConfirm(''); }} className="flex-1 rounded-xl border border-border bg-surface py-2.5 text-sm text-foreground">{t.cancel}</button>
              <button onClick={deleteAccount} disabled={deleteConfirm !== t.deleteConfirmWord || deleting}
                className="flex-1 rounded-xl bg-red-500 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
                {deleting ? t.deleting : t.deleteAccount}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
