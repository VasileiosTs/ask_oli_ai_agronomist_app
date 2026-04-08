import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Users, Loader2, AlertCircle, TrendingUp, Leaf, ClipboardList, BarChart2, ChevronRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../lib/LanguageContext';

interface CoopMember {
  id: string;
  role: string;
  user: { id: string; name: string | null; location: string | null; tier: string | null };
  stats?: { diagnosisCount: number; clientCount: number; lastActivity: string | null };
}

interface CoopStats {
  totalDiagnoses: number;
  diagnosesThisMonth: number;
  totalClients: number;
  cropBreakdown: { crop: string; count: number }[];
  severityBreakdown: { severity: string; count: number }[];
}

export default function CooperativeAdmin() {
  const { appUserId, profile } = useAuth();
  const { lang } = useLanguage();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [coopId, setCoopId] = useState<string | null>(null);
  const [coopName, setCoopName] = useState('');
  const [members, setMembers] = useState<CoopMember[]>([]);
  const [stats, setStats] = useState<CoopStats | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'members'>('overview');

  const isEnterprise = typeof profile?.tier === 'string' && profile.tier === 'enterprise';

  useEffect(() => {
    if (!appUserId || !isEnterprise) { setLoading(false); return; }
    loadCooperative();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appUserId]);

  const loadCooperative = async () => {
    setLoading(true);
    try {
      // Find cooperative this user admins
      const { data: adminRow } = await supabase
        .from('cooperative_admins')
        .select('cooperative_id, cooperatives(name)')
        .eq('user_id', appUserId!)
        .maybeSingle();

      if (!adminRow) { setLoading(false); return; }

      const cid = adminRow.cooperative_id;
      setCoopId(cid);
      setCoopName((adminRow.cooperatives as unknown as { name: string })?.name ?? '');

      // Load members with user details
      const { data: memberRows } = await supabase
        .from('cooperative_members')
        .select('id, role, user_id, users(id, name, location, tier)')
        .eq('cooperative_id', cid);

      const memberList: CoopMember[] = (memberRows ?? []).map(m => ({
        id: m.id,
        role: m.role,
        user: (m.users as unknown as CoopMember['user']),
      }));

      // Enrich each member with their stats
      const enriched = await Promise.all(memberList.map(async (m) => {
        if (!m.user?.id) return m;

        const [{ count: diagCount }, { count: clientCount }, { data: lastDiag }] = await Promise.all([
          supabase.from('interventions').select('id', { count: 'exact', head: true }).eq('user_id', m.user.id),
          supabase.from('growers').select('id', { count: 'exact', head: true }).eq('advisor_id', m.user.id),
          supabase.from('interventions').select('created_at').eq('user_id', m.user.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
        ]);

        return { ...m, stats: { diagnosisCount: diagCount ?? 0, clientCount: clientCount ?? 0, lastActivity: lastDiag?.created_at ?? null } };
      }));

      setMembers(enriched);

      // Aggregate stats across all members
      const memberUserIds = memberList.map(m => m.user?.id).filter(Boolean) as string[];
      if (memberUserIds.length > 0) {
        const now = new Date();
        const monthStart = new Date(now.getUTCFullYear(), now.getUTCMonth(), 1).toISOString();

        const [{ count: total }, { count: thisMonth }, { data: cropData }, { data: sevData }] = await Promise.all([
          supabase.from('interventions').select('id', { count: 'exact', head: true }).in('user_id', memberUserIds),
          supabase.from('interventions').select('id', { count: 'exact', head: true }).in('user_id', memberUserIds).gte('created_at', monthStart),
          supabase.from('interventions').select('fields(crop_type)').in('user_id', memberUserIds).not('fields', 'is', null).limit(500),
          supabase.from('interventions').select('severity').in('user_id', memberUserIds).not('severity', 'is', null).limit(500),
        ]);

        // Crop breakdown
        const cropMap: Record<string, number> = {};
        (cropData ?? []).forEach(r => {
          const crop = (r.fields as unknown as { crop_type: string } | null)?.crop_type;
          if (crop) cropMap[crop] = (cropMap[crop] ?? 0) + 1;
        });
        const cropBreakdown = Object.entries(cropMap)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([crop, count]) => ({ crop, count }));

        // Severity breakdown
        const sevMap: Record<string, number> = {};
        (sevData ?? []).forEach(r => { if (r.severity) sevMap[r.severity] = (sevMap[r.severity] ?? 0) + 1; });
        const severityBreakdown = Object.entries(sevMap).map(([severity, count]) => ({ severity, count }));

        setStats({
          totalDiagnoses: total ?? 0,
          diagnosesThisMonth: thisMonth ?? 0,
          totalClients: enriched.reduce((s, m) => s + (m.stats?.clientCount ?? 0), 0),
          cropBreakdown,
          severityBreakdown,
        });
      }
    } finally {
      setLoading(false);
    }
  };

  if (!isEnterprise) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
        <AlertCircle className="h-10 w-10 text-muted" />
        <p className="text-sm text-muted">
          {lang === 'el'
            ? 'Το Πίνακα Συνεταιρισμού απαιτεί σχέδιο Enterprise.'
            : 'The Cooperative Panel requires the Enterprise plan.'}
        </p>
        <button onClick={() => navigate('/profile')} className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-white hover:bg-primary/90">
          {lang === 'el' ? 'Αναβάθμιση' : 'Upgrade'}
        </button>
      </div>
    );
  }

  if (loading) {
    return <div className="flex h-full items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  if (!coopId) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
        <Building2 className="h-10 w-10 text-muted/30" />
        <p className="text-sm text-muted">
          {lang === 'el' ? 'Δεν έχεις ανατεθεί ως διαχειριστής συνεταιρισμού.\nΕπικοινώνησε με την υποστήριξη.' : 'You are not assigned as a cooperative admin.\nContact support to set up your cooperative.'}
        </p>
      </div>
    );
  }

  const severityLabel = (s: string) => {
    if (lang === 'el') return { low: 'Χαμηλή', medium: 'Μέτρια', high: 'Υψηλή' }[s] ?? s;
    return { low: 'Low', medium: 'Medium', high: 'High' }[s] ?? s;
  };
  const severityColor = (s: string) => ({ low: 'bg-green-400', medium: 'bg-amber-400', high: 'bg-red-400' }[s] ?? 'bg-muted');

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-border/50 bg-surface px-4 py-4">
        <div className="flex items-center gap-2 mb-1">
          <Building2 className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-semibold text-foreground">{coopName || (lang === 'el' ? 'Συνεταιρισμός' : 'Cooperative')}</h1>
        </div>
        <p className="text-xs text-muted">{members.length} {lang === 'el' ? 'μέλη' : 'members'}</p>

        {/* Tabs */}
        <div className="mt-3 flex gap-1 rounded-xl bg-background p-1">
          {(['overview', 'members'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition-colors ${activeTab === tab ? 'bg-surface text-foreground shadow-sm' : 'text-muted hover:text-foreground'}`}
            >
              {tab === 'overview'
                ? (lang === 'el' ? 'Επισκόπηση' : 'Overview')
                : (lang === 'el' ? 'Μέλη' : 'Members')}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeTab === 'overview' && stats && (
          <div className="p-4 space-y-4">
            {/* KPI cards */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { icon: ClipboardList, value: stats.totalDiagnoses, label: lang === 'el' ? 'Συνολικές Διαγνώσεις' : 'Total Diagnoses' },
                { icon: TrendingUp, value: stats.diagnosesThisMonth, label: lang === 'el' ? 'Αυτόν τον Μήνα' : 'This Month' },
                { icon: Users, value: stats.totalClients, label: lang === 'el' ? 'Παραγωγοί' : 'Clients' },
              ].map(({ icon: Icon, value, label }) => (
                <div key={label} className="rounded-2xl border border-border/50 bg-surface p-3 text-center">
                  <Icon className="h-4 w-4 text-primary mx-auto mb-1" />
                  <p className="text-xl font-bold text-foreground">{value}</p>
                  <p className="text-[10px] text-muted leading-snug mt-0.5">{label}</p>
                </div>
              ))}
            </div>

            {/* Crop breakdown */}
            {stats.cropBreakdown.length > 0 && (
              <div className="rounded-2xl border border-border/50 bg-surface p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Leaf className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold text-foreground">
                    {lang === 'el' ? 'Κατανομή Καλλιεργειών' : 'Crop Breakdown'}
                  </h3>
                </div>
                <div className="space-y-2">
                  {stats.cropBreakdown.map(({ crop, count }) => {
                    const max = stats.cropBreakdown[0].count;
                    return (
                      <div key={crop} className="flex items-center gap-2">
                        <span className="w-28 text-xs text-muted truncate">{crop}</span>
                        <div className="flex-1 h-2 rounded-full bg-background overflow-hidden">
                          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(count / max) * 100}%` }} />
                        </div>
                        <span className="w-8 text-right text-xs text-muted">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Severity breakdown */}
            {stats.severityBreakdown.length > 0 && (
              <div className="rounded-2xl border border-border/50 bg-surface p-4">
                <div className="flex items-center gap-2 mb-3">
                  <BarChart2 className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold text-foreground">
                    {lang === 'el' ? 'Κατανομή Σοβαρότητας' : 'Severity Distribution'}
                  </h3>
                </div>
                <div className="flex gap-3 flex-wrap">
                  {stats.severityBreakdown.map(({ severity, count }) => (
                    <div key={severity} className="flex items-center gap-1.5">
                      <span className={`h-2.5 w-2.5 rounded-full ${severityColor(severity)}`} />
                      <span className="text-xs text-muted">{severityLabel(severity)}: <strong className="text-foreground">{count}</strong></span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'members' && (
          <div className="divide-y divide-border/40">
            {members.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-12 text-center px-8">
                <Users className="h-10 w-10 text-muted/30" />
                <p className="text-sm text-muted">{lang === 'el' ? 'Δεν υπάρχουν μέλη ακόμα.' : 'No members yet.'}</p>
              </div>
            ) : (
              members.map(m => (
                <div key={m.id} className="flex items-center gap-4 px-4 py-3.5">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <span className="text-base font-bold text-primary">
                      {(m.user?.name ?? '?').charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground truncate">{m.user?.name ?? '—'}</p>
                    <p className="text-xs text-muted mt-0.5">
                      {m.user?.location ? `${m.user.location} · ` : ''}
                      {lang === 'el'
                        ? `${m.stats?.diagnosisCount ?? 0} διαγνώσεις · ${m.stats?.clientCount ?? 0} παραγωγοί`
                        : `${m.stats?.diagnosisCount ?? 0} diagnoses · ${m.stats?.clientCount ?? 0} clients`}
                    </p>
                  </div>
                  {m.stats?.lastActivity && (
                    <span className="flex-shrink-0 text-[11px] text-muted">
                      {new Date(m.stats.lastActivity).toLocaleDateString(lang === 'el' ? 'el-GR' : 'en-GB', { day: 'numeric', month: 'short' })}
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
