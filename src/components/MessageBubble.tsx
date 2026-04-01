import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import { Star, ClipboardList, Share2, ThumbsUp, ThumbsDown, FileText } from 'lucide-react';
import clsx from 'clsx';
import type { T } from '../lib/i18n';
import OliLogo from './OliLogo';

interface MessageAttachment {
  url: string;
  mimeType: string;
  name: string;
}

export interface ChatMessage {
  id: string;
  db_id?: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  attachments?: MessageAttachment[];
  metadata?: any;
  starred?: boolean;
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
  onVioApplyConfirm: (interventionId: string, applied: boolean, msgId: string) => void;
  onOutcome: (interventionId: string, outcome: 'better' | 'same' | 'worse', msgId: string) => void;
}

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
}

export default function MessageBubble({
  msg, isFirstAiInSequence, t, lang,
  onStar, onFeedback, onLogIntervention, onShare,
  onVioApplyConfirm, onOutcome,
}: Props) {
  const isUser = msg.role === 'user';

  return (
    <div className={clsx("group flex w-full animate-fade-in", isUser ? "justify-end" : "justify-start")}>
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
          <div className={clsx("flex flex-wrap gap-2 mb-1", isUser ? "justify-end" : "justify-start")}>
            {msg.attachments.map((attachment, i) => (
              attachment.mimeType.startsWith('image/') ? (
                <img key={i} src={attachment.url} alt={attachment.name} loading="lazy" className="h-24 w-24 rounded-xl border border-border/50 object-cover" />
              ) : (
                <div key={i} className="flex h-24 w-24 flex-col items-center justify-center rounded-xl border border-border/50 bg-surface px-2 text-center">
                  <FileText className="mb-2 h-6 w-6 text-muted" />
                  <span className="line-clamp-2 text-[11px] text-muted">{attachment.name}</span>
                </div>
              )
            ))}
          </div>
        )}

        {/* Bubble */}
        <div className={clsx("px-4 py-3",
          isUser ? "rounded-[18px] rounded-br-[4px] bg-primary text-white"
                 : "rounded-[18px] rounded-bl-[4px] border border-border/50 bg-surface text-foreground")}>
          {isUser ? (
            <p className="whitespace-pre-wrap text-base leading-relaxed">
              {msg.content.replace(/^\[The user attached[^\]]*\]\n?/i, '')}
            </p>
          ) : (
            <div>
              <div className="prose prose-sm prose-invert max-w-none">
                <ReactMarkdown rehypePlugins={[rehypeSanitize]}>{msg.content}</ReactMarkdown>
              </div>

              {/* Treatment cards */}
              {(msg.metadata?.diagnosis_data?.organic_treatments?.length > 0 || msg.metadata?.diagnosis_data?.chemical_treatments?.length > 0) && (
                <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border/30 pt-3">
                  {msg.metadata.diagnosis_data.organic_treatments?.length > 0 && (
                    <div className="rounded-xl bg-green-500/5 border border-green-500/20 p-3">
                      <p className="text-xs font-semibold text-green-400 mb-1.5">{t.organicTreatments}</p>
                      {(msg.metadata.diagnosis_data.organic_treatments as string[]).map((tx: string, i: number) => (
                        <p key={i} className="text-[12px] text-foreground/80 leading-snug">&bull; {tx}</p>
                      ))}
                    </div>
                  )}
                  {msg.metadata?.diagnosis_data?.chemical_treatments?.length > 0 && (
                    <div className="rounded-xl bg-blue-500/5 border border-blue-500/20 p-3">
                      <p className="text-xs font-semibold text-blue-400 mb-1.5">{t.chemicalTreatments}</p>
                      {(msg.metadata.diagnosis_data.chemical_treatments as string[]).map((tx: string, i: number) => (
                        <p key={i} className="text-[12px] text-foreground/80 leading-snug">&bull; {tx}</p>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* VIO Step 1: "Did you apply?" */}
              {msg.metadata?.is_follow_up && msg.metadata?.follow_up_intervention_id && msg.metadata?.vio_step_type === 'apply_check' && (
                <div className="mt-3 flex flex-wrap gap-2 border-t border-border/30 pt-3">
                  <button onClick={() => onVioApplyConfirm(msg.metadata!.follow_up_intervention_id, true, msg.id)}
                    className="rounded-full border border-green-500/30 bg-green-500/5 px-4 py-1.5 text-sm font-medium text-green-400 transition-colors hover:bg-green-500/10 active:scale-[0.97]">
                    {lang === 'el' ? 'Ναι, εφάρμοσα' : 'Yes, I applied'}
                  </button>
                  <button onClick={() => onVioApplyConfirm(msg.metadata!.follow_up_intervention_id, false, msg.id)}
                    className="rounded-full border border-border/50 bg-background px-4 py-1.5 text-sm font-medium text-muted transition-colors hover:border-primary/50 hover:bg-primary/5 active:scale-[0.97]">
                    {lang === 'el' ? 'Όχι ακόμα' : 'Not yet'}
                  </button>
                </div>
              )}

              {/* VIO Step 2: outcome buttons */}
              {msg.metadata?.is_follow_up && msg.metadata?.follow_up_intervention_id && (msg.metadata?.vio_step_type === 'outcome_check' || !msg.metadata?.vio_step_type) && msg.metadata?.vio_step_type !== 'apply_check' && (
                <div className="mt-3 flex flex-wrap gap-2 border-t border-border/30 pt-3">
                  {(['better', 'same', 'worse'] as const).map(outcome => (
                    <button key={outcome}
                      onClick={() => onOutcome(msg.metadata!.follow_up_intervention_id, outcome, msg.id)}
                      className="rounded-full border border-border/50 bg-background px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:border-primary/50 hover:bg-primary/5 active:scale-[0.97]">
                      {outcome === 'better' ? t.outcomeBetter : outcome === 'same' ? t.outcomeSame : t.outcomeWorse}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Timestamp */}
        <span className={clsx("text-[11px] text-muted opacity-0 transition-opacity group-hover:opacity-100", isUser ? "text-right" : "text-left")}>
          {formatTime(msg.created_at)}
        </span>

        {/* Feedback thumbs */}
        {!isUser && !msg.metadata?.is_follow_up && (
          <div className="mt-1 flex items-center gap-1">
            <button onClick={() => onFeedback(msg, 'positive')}
              className={clsx("rounded-full p-1.5 transition-colors",
                msg.metadata?.feedback === 'positive' ? "text-green-400 bg-green-500/10" : "text-muted/40 hover:text-green-400 hover:bg-green-500/5")}>
              <ThumbsUp className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => onFeedback(msg, 'negative')}
              className={clsx("rounded-full p-1.5 transition-colors",
                msg.metadata?.feedback === 'negative' ? "text-red-400 bg-red-500/10" : "text-muted/40 hover:text-red-400 hover:bg-red-500/5")}>
              <ThumbsDown className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Diagnosis action buttons */}
        {!isUser && msg.metadata?.diagnosis_data && !msg.metadata?.is_follow_up && (
          <div className="mt-1 flex flex-wrap gap-2">
            <button onClick={() => onStar(msg)}
              className={clsx("flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                msg.starred ? "border-yellow-500/50 bg-yellow-500/10 text-yellow-500" : "border-border/50 bg-surface text-muted hover:bg-muted/10 hover:text-foreground")}>
              <Star className={clsx("h-3.5 w-3.5", msg.starred && "fill-current")} />
              {t.savedMessage}
            </button>
            <button onClick={() => onLogIntervention(msg)}
              className="flex items-center gap-1.5 rounded-full border border-green-500/30 bg-green-500/5 px-2.5 py-1 text-xs font-semibold text-green-400 transition-colors hover:bg-green-500/10">
              <ClipboardList className="h-3.5 w-3.5" />{t.logIntervention}
            </button>
            <button onClick={() => onShare(msg)}
              className="flex items-center gap-1.5 rounded-full border border-border/50 bg-surface px-2.5 py-1 text-xs font-medium text-muted transition-colors hover:bg-muted/10 hover:text-foreground">
              <Share2 className="h-3.5 w-3.5" />{t.shareLabel}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
