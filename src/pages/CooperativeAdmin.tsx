import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Loader2, AlertCircle, TrendingUp, ClipboardList, UserPlus, Trash2, ArrowLeft, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../lib/LanguageContext';

interface Member {
  memberId: string;
  userId: string;
  name: string | null;
  location: string | null;
  diagnosisCount: number;
  clientCount: number;
  lastActivity: string | null;
}

export default function CooperativeAdmin() {
  const { appUserId, profile } = useAuth();
  const { lang } = useLanguage();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [coopId, setCoopId] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [totalDiagnoses, setTotalDiagnoses] = useState(0);
  const [diagnosesThisMonth, setDiagnosesThisMonth] = useState(0);
  const [addEmail, setAddEmail] = useState('');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);

  const isEnterprise = typeof profile?.tier === 'string' && profile.tier === 'enterprise';
  const l = lang === 'el' ? 'el' : 'en';

  useEffect(() => {
    if (!appUserId || !isEnterprise) { setLoading(false); return; }
    void loadTeam();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appUserId]);

  const loadTeam = async () => {
    setLoading(true);
    try {
      const { data: adminRow } = await supabase
        .from('cooperative_admins')
        .select('cooperative_id')
        .eq('user_id', appUserId!)
        .maybeSingle();

      if (!adminRow) { setLoading(false); return; }
      const cid = adminRow.cooperative_id;
      setCoopId(cid);

      const { data: memberRows } = await supabase
        .from('cooperative_members')
        .select('id, user_id, users(id, name, location)')
        .eq('cooperative_id', cid);

      const enriched: Member[] = await Promise.all(
        (memberRows ?? []).map(async (m) => {
          const user = m.users as unknown as { id: string; name: string | null; location: string | null };
          const uid = user?.id ?? m.user_id;

          const [{ count: diags }, { count: clients }, { data: lastDiag }] = await Promise.all([
            supabase.from('interventions').select('id', { count: 'exact', head: true }).eq('user_id', uid),
            supabase.from('growers').select('id', { count: 'exact', head: true }).eq('advisor_id', uid),
            supabase.from('interventions').select('created_at').eq('user_id', uid).order('created_at', { ascending: false }).limit(1).maybeSingle(),
          ]);

          return {
            memberId: m.id,
            userId: uid,
            name: user?.name ?? null,
            location: user?.location ?? null,
            diagnosisCount: diags ?? 0,
            clientCount: clients ?? 0,
            lastActivity: lastDiag?.created_at ?? null,
          };
        }),
      );

      setMembers(enriched);

      if (enriched.length > 0) {
        const memberUserIds = enriched.map(m => m.userId);
        const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
        const [{ count: total }, { count: thisMonth }] = await Promise.all([
          supabase.from('interventions').select('id', { count: 'exact', head: true }).in('user_id', memberUserIds),
          supabase.from('interventions').select('id', { count: 'exact', head: true }).in('user_id', memberUserIds).gte('created_at', monthStart),
        ]);
        setTotalDiagnoses(total ?? 0);
        setDiagnosesThisMonth(thisMonth ?? 0);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAddMember = async () => {
    if (!addEmail.trim() || !coopId || adding) return;
    setAdding(true);
    setAddError(null);
    try {
      const { data, error } = await supabase.rpc('add_coop_member', {
        p_cooperative_id: coopId,
        p_member_email: addEmail.trim().toLowerCase(),
      });
      if (error || data?.error) {
        const code = data?.error ?? error?.message ?? 'unknown';
        setAddError(code === 'user_not_found'
          ? (l === 'el' ? 'Δεν βρέθηκε χρήστης με αυτό το email.' : 'No user found with that email.')
          : (l === 'el' ? 'Σφάλμα κατά την προσθήκη.' : 'Error adding member.'));
        return;
      }
      setAddEmail('');
      await loadTeam();
    } finally {
      setAdding(false);
    }
  };

  const handleRemoveMember = async (memberId: string, userId: string) => {
    if (!coopId || removingId) return;
    setRemovingId(memberId);
    try {
      await supabase.rpc('remove_coop_member', {
        p_cooperative_id: coopId,
        p_member_user_id: userId,
      });
      setMembers(prev => prev.filter(m => m.memberId !== memberId));
    } finally {
      setRemovingId(null);
    }
  };

  if (!isEnterprise) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
        <AlertCircle className="h-10 w-10 text-muted" />
        <p className="text-sm text-muted">
          {l === 'el' ? 'Απαιτείται σχέδιο Enterprise.' : 'Enterprise plan required.'}
        </p>
      </div>
    );
  }

  if (loading) {
    return <div className="flex h-full items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  if (!coopId) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
        <Users className="h-10 w-10 text-muted/30" />
        <p className="text-sm text-muted">
          {l === 'el'
            ? 'Δεν έχεις ανατεθεί ως διαχειριστής. Επικοινώνησε με την υποστήριξη.'
            : 'You are not assigned as an admin. Contact support to set up your team.'}
        </p>
      </div>
    );
  }

  return (
    <main className="flex h-full flex-col">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-border/50 bg-surface px-4 py-4">
        <div className="flex items-center gap-3 mb-3">
          <button onClick={() => navigate('/clients')} className="rounded-full p-1.5 text-muted hover:bg-background transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-lg font-semibold text-foreground">
              {l === 'el' ? 'Ομάδα Γεωπόνων' : 'Agronomist Team'}
            </h1>
            <p className="text-xs text-muted">{members.length} {l === 'el' ? 'μέλη' : 'members'}</p>
          </div>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { icon: Users, value: members.length, label: l === 'el' ? 'Γεωπόνοι' : 'Agronomists' },
            { icon: ClipboardList, value: totalDiagnoses, label: l === 'el' ? 'Συν. Διαγνώσεις' : 'Total Diagnoses' },
            { icon: TrendingUp, value: diagnosesThisMonth, label: l === 'el' ? 'Αυτόν τον Μήνα' : 'This Month' },
          ].map(({ icon: Icon, value, label }) => (
            <div key={label} className="rounded-xl border border-border/50 bg-background p-2.5 text-center">
              <Icon className="h-3.5 w-3.5 text-primary mx-auto mb-0.5" />
              <p className="text-base font-bold text-foreground">{value}</p>
              <p className="text-[10px] text-muted leading-tight">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Add member */}
        <div className="px-4 pt-4 pb-3 border-b border-border/40">
          <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">
            {l === 'el' ? 'Προσθήκη Γεωπόνου' : 'Add Agronomist'}
          </p>
          <div className="flex gap-2">
            <input
              type="email"
              value={addEmail}
              onChange={e => { setAddEmail(e.target.value); setAddError(null); }}
              onKeyDown={e => { if (e.key === 'Enter') void handleAddMember(); }}
              placeholder={l === 'el' ? 'Email γεωπόνου...' : 'Agronomist email...'}
              className="flex-1 rounded-xl border border-border/50 bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-primary focus:outline-none"
            />
            <button
              onClick={() => void handleAddMember()}
              disabled={adding || !addEmail.trim()}
              className="flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-white disabled:opacity-50 transition-opacity"
            >
              {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            </button>
          </div>
          {addError && <p className="mt-1.5 text-xs text-red-400">{addError}</p>}
          <p className="mt-1.5 text-[11px] text-muted">
            {l === 'el'
              ? 'Ο γεωπόνος πρέπει να έχει ήδη λογαριασμό στο Oli.'
              : 'The agronomist must already have an Oli account.'}
          </p>
        </div>

        {/* Member list */}
        {members.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-center px-8">
            <Users className="h-10 w-10 text-muted/30" />
            <p className="text-sm text-muted">
              {l === 'el' ? 'Δεν υπάρχουν γεωπόνοι ακόμα.' : 'No agronomists yet.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/40">
            {members.map(m => (
              <div key={m.memberId} className="flex items-center gap-3 px-4 py-3.5">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <span className="text-base font-bold text-primary">
                    {(m.name ?? 'A').charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground truncate">{m.name ?? (l === 'el' ? 'Άγνωστος' : 'Unknown')}</p>
                  <p className="text-xs text-muted mt-0.5 truncate">
                    {m.location ? `${m.location} · ` : ''}
                    {l === 'el'
                      ? `${m.clientCount} παραγωγοί · ${m.diagnosisCount} διαγνώσεις`
                      : `${m.clientCount} clients · ${m.diagnosisCount} diagnoses`}
                  </p>
                </div>
                {m.lastActivity && (
                  <span className="flex-shrink-0 text-[11px] text-muted">
                    {new Date(m.lastActivity).toLocaleDateString(l === 'el' ? 'el-GR' : 'en-GB', { day: 'numeric', month: 'short' })}
                  </span>
                )}
                {confirmRemoveId === m.memberId ? (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => { void handleRemoveMember(m.memberId, m.userId); setConfirmRemoveId(null); }}
                      disabled={!!removingId}
                      className="rounded-full bg-red-500/10 border border-red-500/30 px-2.5 py-1 text-[11px] font-semibold text-red-400 hover:bg-red-500/20 disabled:opacity-40 transition-colors"
                    >
                      {removingId === m.memberId
                        ? <Loader2 className="h-3 w-3 animate-spin" />
                        : (l === 'el' ? 'Επιβεβαίωση' : 'Confirm')}
                    </button>
                    <button
                      onClick={() => setConfirmRemoveId(null)}
                      className="rounded-full p-1 text-muted hover:bg-background transition-colors"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmRemoveId(m.memberId)}
                    disabled={!!removingId}
                    className="flex-shrink-0 rounded-full p-1.5 text-muted hover:text-red-400 hover:bg-red-400/10 disabled:opacity-40 transition-colors"
                    aria-label={l === 'el' ? 'Αφαίρεση μέλους' : 'Remove member'}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
