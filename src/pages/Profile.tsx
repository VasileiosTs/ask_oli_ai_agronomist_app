import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Leaf, MapPin, Crown, Pencil, Bell, Globe, LogOut,
  Trash2, Download, FileText, Shield, ChevronRight,
  Loader2, Check, X,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import clsx from 'clsx';

interface UserProfile {
  id: string;
  name: string;
  location: string;
  primary_crop: string;
  tier: string;
  language: string;
  message_count_month: number;
  notification_followup: boolean;
  notification_weekly_plan: boolean;
  created_at: string;
}

const FREE_LIMIT = 20;

export default function Profile() {
  const { user, logout, isGuest } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile | null>(null);
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
    fetchProfile();
  }, [user]);

  const fetchProfile = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('auth_id', user.id)
      .maybeSingle();
    if (data) setProfile(data as UserProfile);
    setLoading(false);
  };

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
        const res = await fetch(
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(editLocation)}&count=1&language=el&format=json`
        );
        const data = await res.json();
        if (data.results?.[0]) {
          lat = data.results[0].latitude;
          lon = data.results[0].longitude;
        }
      } catch { /* geocoding optional */ }
    }

    const updates: Record<string, unknown> = {
      name: editName.trim(),
      location: editLocation.trim(),
      primary_crop: editCrop.trim(),
    };
    if (lat !== null) { updates.location_lat = lat; updates.location_lon = lon; }

    await supabase.from('users').update(updates).eq('id', profile.id);
    setSaving(false);
    setEditOpen(false);
    fetchProfile();
  };

  const toggleLanguage = async () => {
    if (!profile) return;
    const newLang = profile.language === 'el' ? 'en' : 'el';
    await supabase.from('users').update({ language: newLang }).eq('id', profile.id);
    setProfile({ ...profile, language: newLang });
  };

  const toggleNotif = async (field: 'notification_followup' | 'notification_weekly_plan') => {
    if (!profile) return;
    const newVal = !profile[field];
    await supabase.from('users').update({ [field]: newVal }).eq('id', profile.id);
    setProfile({ ...profile, [field]: newVal });
    if (newVal && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  };

  const exportData = async () => {
    if (!profile) return;
    setExporting(true);
    const [msgs, ints, crops] = await Promise.all([
      supabase.from('chat_messages').select('*').eq('user_id', profile.id).order('created_at'),
      supabase.from('interventions').select('*').eq('user_id', profile.id).order('created_at'),
      supabase.from('crops').select('*').eq('user_id', profile.id),
    ]);
    const blob = new Blob(
      [JSON.stringify({ profile, messages: msgs.data, interventions: ints.data, crops: crops.data }, null, 2)],
      { type: 'application/json' }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `oli-data-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setExporting(false);
  };

  const deleteAccount = async () => {
    if (!profile || deleteConfirm !== 'DIAGRAFI') return;
    setDeleting(true);
    await supabase.from('chat_messages').delete().eq('user_id', profile.id);
    await supabase.from('interventions').delete().eq('user_id', profile.id);
    await supabase.from('crops').delete().eq('user_id', profile.id);
    await supabase.from('users').delete().eq('id', profile.id);
    await logout();
    navigate('/auth');
  };

  if (isGuest) {
    return (
      <div className="flex h-[calc(100dvh-48px)] flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/20">
          <Leaf className="h-10 w-10 text-primary" />
        </div>
        <h2 className="text-xl font-bold text-foreground">Guest Mode</h2>
        <p className="text-sm text-muted">Syndesu gia na apothikeyeis ta dedomena sou kai na exeis pliri prsvasi.</p>
        <button
          onClick={() => navigate('/auth')}
          className="rounded-full bg-primary px-6 py-3 font-medium text-white"
        >
          Sindesi / Eggrafh
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex h-[calc(100dvh-48px)] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex h-[calc(100dvh-48px)] items-center justify-center">
        <p className="text-muted">Den vretike profil.</p>
      </div>
    );
  }

  const isPro = profile.tier === 'pro';
  const msgCount = profile.message_count_month ?? 0;
  const msgPercent = Math.min((msgCount / FREE_LIMIT) * 100, 100);

  return (
    <div className="h-[calc(100dvh-48px)] overflow-y-auto bg-background">
      {/* Profile header */}
      <div className="px-4 pt-6 pb-4">
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
            <span className={clsx(
              'mt-1.5 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
              isPro ? 'bg-primary/15 text-primary' : 'bg-surface text-muted border border-border/50'
            )}>
              {isPro && <Crown className="h-3 w-3" />}
              {isPro ? 'PRO' : 'DWREAN'}
            </span>
          </div>
        </div>
        <button
          onClick={openEdit}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-border/50 bg-surface py-2.5 text-sm text-muted transition-colors hover:text-foreground"
        >
          <Pencil className="h-4 w-4" />
          Epeksergasia profilou
        </button>
      </div>

      <div className="h-px bg-border/50" />

      {/* Subscription */}
      <div className="px-4 py-4">
        <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted">Syndromh</h2>
        {isPro ? (
          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-foreground">Apeiriota minymata</p>
                <p className="text-sm text-primary">Energo</p>
              </div>
              <Crown className="h-6 w-6 text-primary" />
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-border/50 bg-surface p-4">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="text-muted">Minymata</span>
              <span className="font-semibold text-foreground">{msgCount}/{FREE_LIMIT}</span>
            </div>
            <div className="h-2 w-full rounded-full bg-background overflow-hidden">
              <div
                className={clsx('h-full rounded-full transition-all', msgPercent >= 80 ? 'bg-amber-400' : 'bg-primary')}
                style={{ width: `${msgPercent}%` }}
              />
            </div>
            <button className="mt-3 w-full rounded-xl bg-primary py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90">
              Anavathmise se Pro — €4.99/mhna
            </button>
          </div>
        )}
      </div>

      <div className="h-px bg-border/50" />

      {/* Settings */}
      <div className="px-4 py-4">
        <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted">Rythmiseis</h2>
        <div className="space-y-1">
          <button
            onClick={toggleLanguage}
            className="flex w-full items-center justify-between rounded-xl p-3 transition-colors hover:bg-surface"
          >
            <div className="flex items-center gap-3">
              <Globe className="h-5 w-5 text-muted" />
              <span className="text-sm text-foreground">Glwssa</span>
            </div>
            <span className="text-sm font-medium text-primary">
              {profile.language === 'el' ? 'Ellinika' : 'English'}
            </span>
          </button>

          <div className="flex items-center justify-between rounded-xl p-3">
            <div className="flex items-center gap-3">
              <Bell className="h-5 w-5 text-muted" />
              <span className="text-sm text-foreground">Eidopoihseis follow-up</span>
            </div>
            <button
              onClick={() => toggleNotif('notification_followup')}
              className={clsx(
                'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors',
                profile.notification_followup ? 'bg-primary' : 'bg-border'
              )}
            >
              <span className={clsx(
                'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform',
                profile.notification_followup ? 'translate-x-5' : 'translate-x-0'
              )} />
            </button>
          </div>

          <div className="flex items-center justify-between rounded-xl p-3">
            <div className="flex items-center gap-3">
              <Bell className="h-5 w-5 text-muted" />
              <span className="text-sm text-foreground">Ebdomadieo plano</span>
            </div>
            <button
              onClick={() => toggleNotif('notification_weekly_plan')}
              className={clsx(
                'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors',
                profile.notification_weekly_plan ? 'bg-primary' : 'bg-border'
              )}
            >
              <span className={clsx(
                'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform',
                profile.notification_weekly_plan ? 'translate-x-5' : 'translate-x-0'
              )} />
            </button>
          </div>
        </div>
      </div>

      <div className="h-px bg-border/50" />

      {/* Account */}
      <div className="px-4 py-4">
        <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted">Logariasmos</h2>
        <div className="space-y-1">
          <button onClick={() => navigate('/legal/privacy')} className="flex w-full items-center justify-between rounded-xl p-3 transition-colors hover:bg-surface">
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-muted" />
              <span className="text-sm text-foreground">Politikh Aporritoy</span>
            </div>
            <ChevronRight className="h-4 w-4 text-muted" />
          </button>
          <button onClick={() => navigate('/legal/terms')} className="flex w-full items-center justify-between rounded-xl p-3 transition-colors hover:bg-surface">
            <div className="flex items-center gap-3">
              <Shield className="h-5 w-5 text-muted" />
              <span className="text-sm text-foreground">Oroi Xrhshs</span>
            </div>
            <ChevronRight className="h-4 w-4 text-muted" />
          </button>
          <button onClick={exportData} disabled={exporting} className="flex w-full items-center justify-between rounded-xl p-3 transition-colors hover:bg-surface disabled:opacity-50">
            <div className="flex items-center gap-3">
              <Download className="h-5 w-5 text-muted" />
              <span className="text-sm text-foreground">{exporting ? 'Eksagwgh...' : 'Eksagwgh dedomenon'}</span>
            </div>
          </button>
          <button onClick={() => setDeleteOpen(true)} className="flex w-full items-center gap-3 rounded-xl p-3 text-red-400 transition-colors hover:bg-red-500/5">
            <Trash2 className="h-5 w-5" />
            <span className="text-sm">Diagrafh logariasou</span>
          </button>
        </div>
      </div>

      <div className="h-px bg-border/50" />

      <div className="px-4 py-4 pb-8">
        <button onClick={logout} className="flex w-full items-center justify-center gap-2 rounded-xl p-3 text-muted transition-colors hover:bg-surface hover:text-foreground">
          <LogOut className="h-5 w-5" />
          <span className="text-sm">Apostndesh</span>
        </button>
      </div>

      {/* Edit Profile Dialog */}
      {editOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className="w-full max-w-sm rounded-2xl bg-background p-6 shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-foreground">Epeksergasia</h3>
              <button onClick={() => setEditOpen(false)} className="rounded-full p-1.5 text-muted hover:bg-muted/10">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-3">
              {[
                { label: 'Onoma', value: editName, set: setEditName, placeholder: 'To onoma sas' },
                { label: 'Topothe sia', value: editLocation, set: setEditLocation, placeholder: 'Poli, perioxh' },
                { label: 'Kyria Kalliergeia', value: editCrop, set: setEditCrop, placeholder: 'px. Elies' },
              ].map(({ label, value, set, placeholder }) => (
                <div key={label}>
                  <label className="mb-1 block text-sm font-medium text-foreground">{label}</label>
                  <input
                    type="text"
                    value={value}
                    onChange={e => set(e.target.value)}
                    placeholder={placeholder}
                    className="w-full rounded-xl border border-border/50 bg-surface px-4 py-2.5 text-[15px] text-foreground focus:border-primary focus:outline-none"
                  />
                </div>
              ))}
            </div>
            <div className="mt-5 flex gap-3">
              <button onClick={() => setEditOpen(false)} className="flex-1 rounded-xl border border-border bg-surface py-2.5 text-sm text-foreground">
                Akyro
              </button>
              <button
                onClick={saveEdit}
                disabled={saving || !editName.trim()}
                className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {saving ? 'Apothikeusi...' : 'Apothikeyse'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Account Dialog */}
      {deleteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className="w-full max-w-sm rounded-2xl bg-background p-6 shadow-xl">
            <h3 className="mb-2 text-lg font-semibold text-red-400">Diagrafh Logariasou</h3>
            <p className="mb-4 text-sm text-muted">
              Ayth h energeia einai monimh. Ola ta dedomena sou tha diagrafoun.
              Grapse <strong className="text-foreground">DIAGRAFI</strong> gia epivevaiosi.
            </p>
            <input
              type="text"
              value={deleteConfirm}
              onChange={e => setDeleteConfirm(e.target.value)}
              placeholder="DIAGRAFI"
              className="mb-4 w-full rounded-xl border border-border/50 bg-surface px-4 py-2.5 text-[15px] text-foreground focus:border-red-400 focus:outline-none"
            />
            <div className="flex gap-3">
              <button onClick={() => { setDeleteOpen(false); setDeleteConfirm(''); }} className="flex-1 rounded-xl border border-border bg-surface py-2.5 text-sm text-foreground">
                Akyro
              </button>
              <button
                onClick={deleteAccount}
                disabled={deleteConfirm !== 'DIAGRAFI' || deleting}
                className="flex-1 rounded-xl bg-red-500 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {deleting ? 'Diagrafh...' : 'Diagrafi'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
