import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, MessageSquare, ClipboardList, Leaf, ChevronRight, Phone, MapPin } from 'lucide-react';
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

export default function ClientDetail() {
  const { growerId } = useParams<{ growerId: string }>();
  const { appUserId } = useAuth();
  const { lang } = useLanguage();
  const navigate = useNavigate();

  const [grower, setGrower] = useState<Grower | null>(null);
  const [diagnoses, setDiagnoses] = useState<Diagnosis[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!growerId || !appUserId) return;
    (async () => {
      const [{ data: growerData }, { data: diagData }] = await Promise.all([
        supabase.from('growers').select('id, name, phone, location, notes').eq('id', growerId).eq('advisor_id', appUserId).maybeSingle(),
        supabase.from('interventions')
          .select('id, problem, cause, severity, confidence_score, product_applied, created_at, fields(name, crop_type)')
          .eq('grower_id', growerId)
          .order('created_at', { ascending: false })
          .limit(50),
      ]);
      if (growerData) setGrower(growerData);
      if (diagData) setDiagnoses(diagData as unknown as Diagnosis[]);
      setLoading(false);
    })();
  }, [growerId, appUserId]);

  const openChat = () => {
    navigate(`/chat?grower=${growerId}`);
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

  return (
    <div className="flex h-full flex-col">
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
            onClick={openChat}
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

      {/* Stats strip */}
      <div className="flex-shrink-0 flex border-b border-border/50 bg-background/60">
        <div className="flex-1 px-4 py-3 text-center border-r border-border/40">
          <p className="text-2xl font-bold text-foreground">{diagnoses.length}</p>
          <p className="text-[11px] text-muted mt-0.5">{lang === 'el' ? 'Διαγνώσεις' : 'Diagnoses'}</p>
        </div>
        <div className="flex-1 px-4 py-3 text-center">
          <p className="text-2xl font-bold text-foreground">
            {diagnoses.filter(d => d.severity === 'high').length}
          </p>
          <p className="text-[11px] text-muted mt-0.5">{lang === 'el' ? 'Υψηλής σοβαρότητας' : 'High severity'}</p>
        </div>
      </div>

      {/* Diagnoses list */}
      <div className="flex-1 overflow-y-auto">
        {diagnoses.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center px-8 py-12">
            <ClipboardList className="h-10 w-10 text-muted/30" />
            <p className="text-sm text-muted">
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
        )}
      </div>
    </div>
  );
}
