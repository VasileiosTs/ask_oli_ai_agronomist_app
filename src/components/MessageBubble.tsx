import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import { Star, ClipboardList, Share2, ThumbsUp, ThumbsDown, FileText, AlertCircle, RotateCcw } from 'lucide-react';
import clsx from 'clsx';
import type { T } from '../lib/i18n';
import OliLogo from './OliLogo';

interface MessageAttachment {
  url: string;
  mimeType: string;
  name: string;
}

export interface MessageMetadata {
  diagnosis_data?: {
    problem?: string;
    cause?: string;
    severity?: string;
    product_applied?: string;
    dosage?: string;
    application_method?: string;
    organic_treatments?: string[];
    chemical_treatments?: string[];
    // ── New fields surfaced in UI ──
    confidence_score?: number;       // 0-100 — was computed but never shown
    missing_pillars?: string[];      // e.g. ["THE_EVIDENCE", "TIMING"]
  };
  crop_mentioned?: string;
  intervention_id?: string;
  share_id?: string;
  is_follow_up?: boolean;
  follow_up_intervention_id?: string;
  vio_step?: number;
  vio_step_type?: 'apply_check' | 'outcome_check';
  feedback?: 'positive' | 'negative';
}

export interface ChatMessage {
  id: string;
  db_id?: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  attachments?: MessageAttachment[];
  metadata?: MessageMetadata;
  starred?: boolean;
  interrupted?: boolean;
  retryText?: string;
}

interface Props {
  msg: ChatMessage;
  isFirstAiInSequence: boolean;
  t: T;
  lang: string;
  onStar: (msg: ChatMessage) => void;
  onFeedback: (msg: ChatMessage, feedback: 'positive' | 'negative') => void;
  onLogIntervention: (msg: ChatMessage) => void;
  onShare: (msg: ChatMessage) => void;
  // Updated: outcome now includes 'not_applied'
  onVioApplyConfirm: (interventionId: string, applied: boolean, msgId: string) => void;
  onOutcome: (interventionId: string, outcome: 'better' | 'same' | 'worse' | 'not_applied', msgId: string) => void;
  onRetry?: (text: string) => void;
}

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
}

// ── Confidence indicator ──
// Maps a 0-100 confidence_score to a human-readable label + colour.
function ConfidenceIndicator({ score, lang }: { score: number; lang: string }) {
  const isEl = lang === 'el';

  let colour: string;
  let dot: string;
  let label: string;

  if (score >= 70) {
    colour = 'text-green-400';
    dot = 'bg-green-400';
    label = isEl ? 'Αρκετά σίγουρος' : 'Fairly confident';
  } else if (score >= 40) {
    colour = 'text-amber-400';
    dot = 'bg-amber-400';
    label = isEl ? 'Μέτρια βεβαιότητα' : 'Moderate confidence';
  } else {
    colour = 'text-red-400';
    dot = 'bg-red-400';
    label = isEl ? 'Χαμηλή βεβαιότητα' : 'Low confidence';
  }

  return (
    <div className={`flex items-center gap-1.5 text-xs font-medium ${colour}`}>
      <span className={`h-2 w-2 rounded-full flex-shrink-0 ${dot}`} />
      {label}
    </div>
  );
}

// ── Missing pillars card ──
// Surfaces the missing_pillars array as a "to improve accuracy" card.
// Keys must match exactly what the Gemini system prompt names the pillars:
// "THE VICTIM", "THE SYMPTOMS", "THE TIMELINE", "THE ENVIRONMENT", "THE EVIDENCE"
const PILLAR_LABELS: Record<string, { el: string; en: string }> = {
  'THE VICTIM':      { el: 'Είδος / ποικιλία καλλιέργειας',              en: 'Plant species / crop variety'               },
  'THE SYMPTOMS':    { el: 'Χρώμα, υφή και μοτίβο του προβλήματος',     en: 'Colour, texture and pattern of symptoms'    },
  'THE TIMELINE':    { el: 'Πότε εμφανίστηκε; Στάδιο ανάπτυξης;',       en: 'When did it start? Growth stage? Season?'  },
  'THE ENVIRONMENT': { el: 'Έδαφος, πρόσφατος καιρός, τρόπος άρδευσης', en: 'Soil type, recent weather, irrigation'      },
  'THE EVIDENCE':    { el: 'Κοντινή φωτογραφία της πάσχουσας περιοχής', en: 'A close-up photo of the affected area'      },
  // Legacy / alternate keys kept for backwards compat with older stored data
  'THE_EVIDENCE':    { el: 'Κοντινή φωτογραφία της πάσχουσας περιοχής', en: 'A close-up photo of the affected area'      },
  TIMING:            { el: 'Πότε εμφανίστηκε πρώτα το πρόβλημα',         en: 'When the problem first appeared'            },
  CROP_VARIETY:      { el: 'Ποικιλία καλλιέργειας',                       en: 'Crop variety'                               },
  SOIL_HISTORY:      { el: 'Ιστορικό εδάφους / αρδεύσεων',               en: 'Soil / irrigation history'                  },
  WEATHER_RECENT:    { el: 'Πρόσφατες καιρικές συνθήκες',                 en: 'Recent weather conditions'                  },
};

function MissingPillarsCard({ pillars, lang }: { pillars: string[]; lang: string }) {
  if (!pillars || pillars.length === 0) return null;
  const isEl = lang === 'el';

  return (
    <div className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
      <div className="mb-2 flex items-center gap-1.5">
        <AlertCircle className="h-3.5 w-3.5 text-amber-400 flex-shrink-0" />
        <p className="text-xs font-semibold text-amber-400">
          {isEl ? 'Για μεγαλύτερη ακρίβεια, χρειάζομαι:' : 'To be more certain, I need:'}
        </p>
      </div>
      {pillars.map(p => (
        <p key={p} className="text-[12px] text-foreground/80 leading-snug">
          &bull; {PILLAR_LABELS[p]?.[isEl ? 'el' : 'en'] ?? p}
        </p>
      ))}
    </div>
  );
}

export default function MessageBubble({
  msg, isFirstAiInSequence, t, lang,
  onStar, onFeedback, onLogIntervention, onShare,
  onVioApplyConfirm, onOutcome, onRetry,
}: Props) {
  const isUser = msg.role === 'user';
  const dd = msg.metadata?.diagnosis_data;

  return (
    <div className={clsx('group flex w-full animate-fade-in', isUser ? 'justify-end' : 'justify-start')}>
      {!isUser && (
        <div className="flex-shrink-0 pt-1 mr-2.5">
          {isFirstAiInSequence
            ? <OliLogo size={22} bg="#0D1117" />
            : <div className="w-[22px]" />}
        </div>
      )}

      <div className="flex max-w-[78%] flex-col gap-1">
        {/* Attachments */}
        {msg.attachments && msg.attachments.length > 0 && (
          <div className={clsx('flex flex-wrap gap-2 mb-1', isUser ? 'justify-end' : 'justify-start')}>
            {msg.attachments.map((att, i) =>
              att.mimeType.startsWith('image/') ? (
                <img key={i} src={att.url} alt={att.name} loading="lazy"
                  className="h-24 w-24 rounded-xl border border-border/50 object-cover" />
              ) : (
                <div key={i} className="flex h-24 w-24 flex-col items-center justify-center rounded-xl border border-border/50 bg-surface px-2 text-center">
                  <FileText className="mb-2 h-6 w-6 text-muted" />
                  <span className="line-clamp-2 text-[11px] text-muted">{att.name}</span>
                </div>
              )
            )}
          </div>
        )}

        {/* Bubble */}
        <div className={clsx('px-4 py-3',
          isUser
            ? 'rounded-[18px] rounded-br-[4px] bg-primary text-white'
            : 'rounded-[18px] rounded-bl-[4px] border border-border/50 bg-surface text-foreground',
        )}>
          {isUser ? (
            <p className="whitespace-pre-wrap text-base leading-relaxed">
              {msg.content.replace(/^\[The user attached[^\]]*\]\n?/i, '')}
            </p>
          ) : (
            <div>
              <div className="prose prose-sm prose-invert max-w-none">
                <ReactMarkdown rehypePlugins={[rehypeSanitize]}>{msg.content}</ReactMarkdown>
              </div>

              {/* ── Confidence indicator ── */}
              {dd && typeof dd.confidence_score === 'number' && (
                <div className="mt-2 border-t border-border/20 pt-2">
                  <ConfidenceIndicator score={dd.confidence_score} lang={lang} />
                </div>
              )}

              {/* ── Treatment cards ── */}
              {(dd?.organic_treatments?.length > 0 || dd?.chemical_treatments?.length > 0) && (
                <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border/30 pt-3">
                  {dd?.organic_treatments?.length > 0 && (
                    <div className="rounded-xl bg-green-500/5 border border-green-500/20 p-3">
                      <p className="text-xs font-semibold text-green-400 mb-1.5">{t.organicTreatments}</p>
                      {(dd.organic_treatments as string[]).map((tx, i) => (
                        <p key={i} className="text-[12px] text-foreground/80 leading-snug">&bull; {tx}</p>
                      ))}
                    </div>
                  )}
                  {dd?.chemical_treatments?.length > 0 && (
                    <div className="rounded-xl bg-blue-500/5 border border-blue-500/20 p-3">
                      <p className="text-xs font-semibold text-blue-400 mb-1.5">
                        {t.chemicalTreatments}
                      </p>
                      {(dd.chemical_treatments as string[]).map((tx, i) => (
                        <p key={i} className="text-[12px] text-foreground/80 leading-snug">
                          &bull; {tx}
                          {/* Regulatory disclaimer on chemical treatments */}
                          {i === (dd.chemical_treatments!.length - 1) && (
                            <span className="ml-1 text-[10px] text-amber-400/70">
                              {lang === 'el' ? '⚠ Ελέγξτε τοπικές άδειες' : '⚠ Check local regulations'}
                            </span>
                          )}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── Missing pillars card ── */}
              {dd?.missing_pillars && dd.missing_pillars.length > 0 && (
                <MissingPillarsCard pillars={dd.missing_pillars} lang={lang} />
              )}

              {/* ── VIO Step 1: "Did you apply?" ── */}
              {msg.metadata?.is_follow_up &&
                msg.metadata?.follow_up_intervention_id &&
                msg.metadata?.vio_step_type === 'apply_check' && (
                <div className="mt-3 flex flex-wrap gap-2 border-t border-border/30 pt-3">
                  <button
                    onClick={() => onVioApplyConfirm(msg.metadata!.follow_up_intervention_id!, true, msg.id)}
                    className="rounded-full border border-green-500/30 bg-green-500/5 px-4 py-1.5 text-sm font-medium text-green-400 transition-colors hover:bg-green-500/10 active:scale-[0.97]"
                  >
                    {lang === 'el' ? 'Ναι, εφάρμοσα' : 'Yes, I applied'}
                  </button>
                  <button
                    onClick={() => onVioApplyConfirm(msg.metadata!.follow_up_intervention_id!, false, msg.id)}
                    className="rounded-full border border-border/50 bg-background px-4 py-1.5 text-sm font-medium text-muted transition-colors hover:border-primary/50 hover:bg-primary/5 active:scale-[0.97]"
                  >
                    {lang === 'el' ? 'Όχι ακόμα' : 'Not yet'}
                  </button>
                </div>
              )}

              {/* ── VIO Step 2: Outcome chips (now 4 options) ── */}
              {msg.metadata?.is_follow_up &&
                msg.metadata?.follow_up_intervention_id &&
                msg.metadata?.vio_step_type !== 'apply_check' && (
                <div className="mt-3 flex flex-wrap gap-2 border-t border-border/30 pt-3">
                  {(
                    [
                      { value: 'better',      labelEl: 'Βελτίωση',        labelEn: 'Better'          },
                      { value: 'same',        labelEl: 'Ίδια',            labelEn: 'No change'       },
                      { value: 'worse',       labelEl: 'Χειρότερα',       labelEn: 'Worse'           },
                      { value: 'not_applied', labelEl: 'Δεν εφάρμοσα',   labelEn: "Didn't apply"    },
                    ] as const
                  ).map(chip => (
                    <button
                      key={chip.value}
                      onClick={() => onOutcome(msg.metadata!.follow_up_intervention_id!, chip.value, msg.id)}
                      className="rounded-full border border-border/50 bg-background px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:border-primary/50 hover:bg-primary/5 active:scale-[0.97]"
                    >
                      {lang === 'el' ? chip.labelEl : chip.labelEn}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Timestamp */}
        <span className={clsx(
          'text-[11px] text-muted opacity-0 transition-opacity group-hover:opacity-100',
          isUser ? 'text-right' : 'text-left',
        )}>
          {formatTime(msg.created_at)}
        </span>

        {/* Feedback thumbs */}
        {!isUser && !msg.metadata?.is_follow_up && (
          <div className="mt-1 flex items-center gap-1">
            <button
              onClick={() => onFeedback(msg, 'positive')}
              className={clsx('rounded-full p-1.5 transition-colors',
                msg.metadata?.feedback === 'positive'
                  ? 'text-green-400 bg-green-500/10'
                  : 'text-muted/40 hover:text-green-400 hover:bg-green-500/5',
              )}
            >
              <ThumbsUp className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => onFeedback(msg, 'negative')}
              className={clsx('rounded-full p-1.5 transition-colors',
                msg.metadata?.feedback === 'negative'
                  ? 'text-red-400 bg-red-500/10'
                  : 'text-muted/40 hover:text-red-400 hover:bg-red-500/5',
              )}
            >
              <ThumbsDown className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Stream interrupted — retry button */}
        {!isUser && msg.interrupted && (
          <button
            onClick={() => onRetry?.(msg.retryText ?? '')}
            className="mt-1 flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 px-2.5 py-1 text-xs font-medium text-primary/80 transition-colors hover:bg-primary/10 hover:text-primary"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            {lang === 'el' ? 'Επανάληψη' : 'Retry'}
          </button>
        )}

        {/* Diagnosis action buttons */}
        {!isUser && msg.metadata?.diagnosis_data && !msg.metadata?.is_follow_up && (
          <div className="mt-1 flex flex-wrap gap-2">
            <button
              onClick={() => onStar(msg)}
              className={clsx(
                'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                msg.starred
                  ? 'border-yellow-500/50 bg-yellow-500/10 text-yellow-500'
                  : 'border-border/50 bg-surface text-muted hover:bg-muted/10 hover:text-foreground',
              )}
            >
              <Star className={clsx('h-3.5 w-3.5', msg.starred && 'fill-current')} />
              {t.savedMessage}
            </button>
            <button
              onClick={() => onLogIntervention(msg)}
              className="flex items-center gap-1.5 rounded-full border border-green-500/30 bg-green-500/5 px-2.5 py-1 text-xs font-semibold text-green-400 transition-colors hover:bg-green-500/10"
            >
              <ClipboardList className="h-3.5 w-3.5" />{t.logIntervention}
            </button>
            <button
              onClick={() => onShare(msg)}
              className="flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 px-2.5 py-1 text-xs font-medium text-primary/80 transition-colors hover:bg-primary/10 hover:text-primary"
            >
              <Share2 className="h-3.5 w-3.5" />{t.shareLabel}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
