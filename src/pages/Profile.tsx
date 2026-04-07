import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Leaf, MapPin, Crown, Pencil, BellRing, Globe, LogOut, Trash2, Download, FileText, Shield, ChevronRight, Loader2, X, Users, Copy, Check } from 'lucide-react';
import { getAccessTokenWithFallback, supabase, supabasePublicKey, supabaseUrl } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../lib/LanguageContext';
import { usePushSubscription } from '../hooks/usePushSubscription';
import type { Lang } from '../lib/i18n';
import clsx from 'clsx';
import PaywallModal from '../components/PaywallModal';
import { formatTierLabel, isUnlimitedTier } from '../../shared/subscription';

import { FREE_MESSAGE_LIMIT as FREE_LIMIT } from "../lib/constants";

export default function Profile() {
  const { user, profile, appUserId, logout, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const { t, lang, setLang } = useLanguage();

  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editCrop, setEditCrop] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const push = usePushSubscription(appUserId ?? null);

  if (!profile) {
    return (
      <div className="flex h-[100dvh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const currentProfile = profile;
  const currentTier = typeof currentProfile.tier === 'string' ? currentProfile.tier : null;
  const hasUnlimitedMessages = isUnlimitedTier(
    currentTier,
  );
  const msgCount = (currentProfile.message_count_month as number) ?? 0;
  const msgPercent = Math.min((msgCount / FREE_LIMIT) * 100, 100);

  const openEdit = () => {
    setEditName((currentProfile.name as string) ?? '');
    setEditLocation((currentProfile.location as string) ?? '');
    setEditCrop((currentProfile.primary_crop as string) ?? '');
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!appUserId) return;
    setSaving(true);
    let lat = null, lon = null;
    let geocodeTimeout: ReturnType<typeof setTimeout> | null = null;
    if (editLocation !== currentProfile.location) {
      try {
        const controller = new AbortController();
        geocodeTimeout = setTimeout(() => controller.abort(), 3000);
        const res = await fetch(
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(editLocation)}&count=1&language=el&format=json`,
          { signal: controller.signal },
        );
        const data = await res.json();
        if (data.results?.[0]) { lat = data.results[0].latitude; lon = data.results[0].longitude; }
      } catch { /* geocoding optional */ }
      finally {
        if (geocodeTimeout) clearTimeout(geocodeTimeout);
      }
    }
    const updates: Record<string, unknown> = {
      name: editName.trim(),
      location: editLocation.trim(),
      primary_crop: editCrop.trim(),
    };
    if (lat !== null) { updates.location_lat = lat; updates.location_lon = lon; }
    const { error } = await supabase.from('users').update(updates).eq('id', appUserId);
    if (error) {
      console.error('Profile update failed:', error);
      showToast(t.savingError);
      setSaving(false);
      return;
    }
    await refreshProfile();
    setSaving(false);
    setEditOpen(false);
  };

  /** Fetch all rows from a table with pagination (Supabase default limit is 1000). */
  const fetchAllRows = async (table: string, userId: string) => {
    const PAGE_SIZE = 1000;
    const allRows: Record<string, unknown>[] = [];
    let from = 0;
    let keepGoing = true;
    while (keepGoing) {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .eq('user_id', userId)
        .order('created_at')
        .range(from, from + PAGE_SIZE - 1);
      if (error || !data || data.length === 0) {
        keepGoing = false;
      } else {
        allRows.push(...data);
        if (data.length < PAGE_SIZE) keepGoing = false;
        else from += PAGE_SIZE;
      }
    }
    return allRows;
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const exportData = async () => {
    if (!appUserId) return;
    setExporting(true);
    try {
      const [messages, interventions] = await Promise.all([
        fetchAllRows('chat_messages', appUserId),
        fetchAllRows('interventions', appUserId),
      ]);
      const blob = new Blob([
        JSON.stringify({ profile: currentProfile, messages, interventions }, null, 2)
      ], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `oli-data-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
      showToast(t.exportFailed);
    } finally {
      setExporting(false);
    }
  };

  const deleteAccount = async () => {
    if (!appUserId || !user || deleteConfirm !== t.deleteConfirmWord) return;
    setDeleting(true);
    try {
      const accessToken = await getAccessTokenWithFallback();
      if (!accessToken) {
        throw new Error('Missing access token');
      }

      const response = await fetch(`${supabaseUrl}/functions/v1/delete-account`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
          apikey: supabasePublicKey,
        },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(
          typeof payload?.error === 'string'
            ? payload.error
            : `Delete account failed with status ${response.status}`,
        );
      }

      try {
        await supabase.auth.signOut({ scope: 'local' });
      } catch (logoutError) {
        console.warn('Local sign-out after account deletion failed:', logoutError);
      }
      navigate('/', { replace: true });
    } catch (error) {
      console.error('Delete account failed:', error);
      showToast(lang === 'el' ? 'Η διαγραφή λογαριασμού απέτυχε. Δοκίμασε ξανά.' : 'Account deletion failed. Please try again.');
      setDeleting(false);
    }
  };

  return (
    <main className="h-[100dvh] overflow-y-auto bg-background">
      {/* Header */}
      <div className="px-4 pt-12 pb-4">
        <div className="flex items-center gap-4">
          <div className="flex h-[72px] w-[72px] flex-shrink-0 items-center justify-center rounded-full bg-primary/20">
            <Leaf className="h-8 w-8 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="truncate text-xl font-bold text-foreground">{currentProfile.name as string}</h1>
            <div className="flex items-center gap-1 mt-0.5">
              <MapPin className="h-3 w-3 text-muted flex-shrink-0" />
              <span className="truncate text-sm text-muted">{currentProfile.location as string}</span>
            </div>
            <span className={clsx('mt-1.5 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
              hasUnlimitedMessages ? 'bg-primary/15 text-primary' : 'bg-surface text-muted border border-border/50')}>
              {hasUnlimitedMessages && <Crown className="h-3 w-3" />}
              {hasUnlimitedMessages ? formatTierLabel(currentTier) : lang === 'el' ? 'ΔΩΡΕΑΝ' : 'FREE'}
            </span>
          </div>
        </div>
        <button onClick={openEdit}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-border/50 bg-surface py-2.5 text-sm text-muted transition-colors hover:text-foreground">
          <Pencil className="h-4 w-4" />{t.editProfile}
        </button>
      </div>

      <div className="h-px bg-border/50" />

      {/* Subscription */}
      <div className="px-4 py-4">
        <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted">{t.subscription}</h2>
        {hasUnlimitedMessages ? (
          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 flex items-center justify-between">
            <div>
              <p className="font-semibold text-foreground">{t.unlimited}</p>
              <p className="text-sm text-primary">{formatTierLabel(currentTier)} · {t.active}</p>
            </div>
            <Crown className="h-6 w-6 text-primary" />
          </div>
        ) : (
          <div className="rounded-2xl border border-border/50 bg-surface p-4">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="text-muted">{lang === 'el' ? 'Μηνύματα' : 'Messages'}</span>
              <span className="font-semibold text-foreground">{msgCount}/{FREE_LIMIT}</span>
            </div>
            <div className="h-2 w-full rounded-full bg-background overflow-hidden">
              <div className={clsx('h-full rounded-full transition-all', msgPercent >= 80 ? 'bg-amber-400' : 'bg-primary')}
                style={{ width: `${msgPercent}%` }} />
            </div>
            <button onClick={() => setShowPaywall(true)} className="mt-3 w-full rounded-xl bg-primary py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90">
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
            <div className="flex items-center gap-3">
              <Globe className="h-5 w-5 text-muted" />
              <span className="text-sm text-foreground">{t.languageLabel}</span>
            </div>
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
          {/* Push notifications — full enable/disable toggle */}
          {push.isSupported && (
            <div className="flex items-center justify-between rounded-xl p-3">
              <div className="flex items-center gap-3">
                <BellRing className="h-5 w-5 text-muted" />
                <div>
                  <span className="text-sm text-foreground">{t.pushNotifications}</span>
                  {push.permission === 'denied'
                    ? <p className="text-[11px] text-red-400">{t.pushDenied}</p>
                    : push.isSubscribed
                      ? <p className="text-[11px] text-primary">{lang === 'el' ? 'Ενεργές — λαμβάνεις υπενθυμίσεις VIO' : 'Enabled — receiving VIO reminders'}</p>
                      : <p className="text-[11px] text-muted">{lang === 'el' ? 'Ανενεργές' : 'Disabled'}</p>}
                </div>
              </div>
              {push.permission !== 'denied' && (
                push.isSubscribed ? (
                  <button
                    onClick={() => push.unsubscribe()}
                    disabled={push.loading}
                    className="rounded-full border border-border/50 px-3 py-1 text-xs font-medium text-muted hover:text-foreground transition-colors disabled:opacity-50"
                  >
                    {lang === 'el' ? 'Απενεργοποίηση' : 'Turn off'}
                  </button>
                ) : (
                  <button
                    onClick={() => push.subscribe()}
                    disabled={push.loading}
                    className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-white hover:bg-primary/90 transition-colors disabled:opacity-50"
                  >
                    {lang === 'el' ? 'Ενεργοποίηση' : 'Enable'}
                  </button>
                )
              )}
            </div>
          )}
        </div>
      </div>

      <div className="h-px bg-border/50" />

      {/* Invite Friends */}
      <div className="px-4 py-4">
        <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted">{t.inviteFriends}</h2>
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
          <div className="flex items-start gap-3">
            <Users className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-foreground leading-relaxed">{t.inviteBody}</p>
              <button
                onClick={() => {
                  const link = `${window.location.origin}/auth?ref=${appUserId}`;
                  navigator.clipboard.writeText(link);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="mt-3 flex items-center gap-2 rounded-xl bg-primary/15 px-4 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-primary/25"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? t.inviteCopied : t.copyLink}
              </button>
            </div>
          </div>
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
          <div role="dialog" aria-modal="true" className="w-full max-w-sm rounded-2xl bg-background p-6 shadow-xl">
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
              <button onClick={saveEdit} disabled={saving || !editName.trim()}
                className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-semibold text-white disabled:opacity-50">
                {saving ? t.saving : t.save}
              </button>
            </div>
          </div>
        </div>
      )}

      <PaywallModal isOpen={showPaywall} onClose={() => setShowPaywall(false)} />

      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-20 left-1/2 z-50 -translate-x-1/2 rounded-full bg-foreground/90 px-5 py-2.5 text-sm text-background shadow-lg animate-fade-in">
          {toastMessage}
        </div>
      )}

      {/* Delete Dialog */}
      {deleteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div role="dialog" aria-modal="true" className="w-full max-w-sm rounded-2xl bg-background p-6 shadow-xl">
            <h3 className="mb-2 text-lg font-semibold text-red-400">{t.deleteAccount}</h3>
            <p className="mb-4 text-sm text-muted">{t.deleteConfirmText}</p>
            <input type="text" value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)}
              placeholder={t.deleteConfirmWord}
              className="mb-4 w-full rounded-xl border border-border/50 bg-surface px-4 py-2.5 text-[15px] text-foreground focus:border-red-400 focus:outline-none" />
            <div className="flex gap-3">
              <button onClick={() => { setDeleteOpen(false); setDeleteConfirm(''); }}
                className="flex-1 rounded-xl border border-border bg-surface py-2.5 text-sm text-foreground">{t.cancel}</button>
              <button onClick={deleteAccount} disabled={deleteConfirm !== t.deleteConfirmWord || deleting}
                className="flex-1 rounded-xl bg-red-500 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
                {deleting ? t.deleting : t.deleteAccount}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
