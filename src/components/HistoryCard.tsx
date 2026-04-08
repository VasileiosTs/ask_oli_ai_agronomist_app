import { useState } from 'react';
import { Leaf, FileText, ChevronDown, ChevronUp } from 'lucide-react';

export interface HistoryDiagnosis {
  id: string;
  problem: string | null;
  cause: string | null;
  severity: string | null;
  product_applied: string | null;
  created_at: string;
  field_name?: string | null;
  field_crop?: string | null;
  outcome?: string | null;
}

interface Props {
  diagnoses: HistoryDiagnosis[];
  lang: string;
  onGenerateReport?: () => void;
}

function severityChipClass(s: string | null) {
  if (s === 'high')   return 'text-red-400 bg-red-500/10 border-red-500/20';
  if (s === 'medium') return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
  return 'text-green-400 bg-green-500/10 border-green-500/20';
}

function outcomeIcon(o: string | null) {
  if (o === 'better') return '✅';
  if (o === 'worse')  return '⬇️';
  if (o === 'same')   return '➡️';
  return null;
}

export default function HistoryCard({ diagnoses, lang, onGenerateReport }: Props) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? diagnoses : diagnoses.slice(0, 3);
  const isEl = lang === 'el';

  if (diagnoses.length === 0) {
    return (
      <div className="mt-2 rounded-2xl border border-border/50 bg-surface px-4 py-3">
        <p className="text-sm text-muted">
          {isEl ? 'Δεν βρέθηκε ιστορικό παρεμβάσεων.' : 'No intervention history found.'}
        </p>
      </div>
    );
  }

  return (
    <div className="mt-2 rounded-2xl border border-border/50 bg-surface overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
        <div className="flex items-center gap-2">
          <Leaf className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">
            {isEl ? `${diagnoses.length} παρεμβάσεις` : `${diagnoses.length} intervention${diagnoses.length !== 1 ? 's' : ''}`}
          </span>
        </div>
        {onGenerateReport && (
          <button
            onClick={onGenerateReport}
            className="flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 px-2.5 py-1 text-xs font-medium text-primary/80 hover:bg-primary/10 hover:text-primary transition-colors"
          >
            <FileText className="h-3.5 w-3.5" />
            {isEl ? 'Εξαγωγή PDF' : 'Generate PDF'}
          </button>
        )}
      </div>

      {/* Timeline */}
      <div className="divide-y divide-border/30">
        {visible.map(d => (
          <div key={d.id} className="flex items-start gap-3 px-4 py-3">
            <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 mt-0.5">
              <Leaf className="h-3.5 w-3.5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-medium text-foreground truncate">
                  {d.problem ?? (isEl ? 'Άγνωστο πρόβλημα' : 'Unknown issue')}
                </p>
                {d.severity && (
                  <span className={`rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${severityChipClass(d.severity)}`}>
                    {isEl
                      ? { low: 'Χαμηλή', medium: 'Μέτρια', high: 'Υψηλή' }[d.severity] ?? d.severity
                      : d.severity}
                  </span>
                )}
                {outcomeIcon(d.outcome ?? null) && (
                  <span className="text-xs">{outcomeIcon(d.outcome ?? null)}</span>
                )}
              </div>
              {d.cause && (
                <p className="text-xs text-muted mt-0.5 truncate">{d.cause}</p>
              )}
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {d.field_name && (
                  <span className="text-[11px] text-muted">{d.field_name}{d.field_crop ? ` · ${d.field_crop}` : ''}</span>
                )}
                {d.product_applied && (
                  <span className="text-[11px] text-primary/70">{d.product_applied}</span>
                )}
              </div>
            </div>
            <span className="flex-shrink-0 text-[11px] text-muted">
              {new Date(d.created_at).toLocaleDateString(isEl ? 'el-GR' : 'en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}
            </span>
          </div>
        ))}
      </div>

      {/* Show more / less */}
      {diagnoses.length > 3 && (
        <button
          onClick={() => setExpanded(e => !e)}
          className="flex w-full items-center justify-center gap-1 border-t border-border/40 py-2.5 text-xs font-medium text-muted hover:text-foreground transition-colors"
        >
          {expanded
            ? <><ChevronUp className="h-3.5 w-3.5" />{isEl ? 'Λιγότερα' : 'Show less'}</>
            : <><ChevronDown className="h-3.5 w-3.5" />{isEl ? `${diagnoses.length - 3} ακόμα` : `${diagnoses.length - 3} more`}</>}
        </button>
      )}
    </div>
  );
}
