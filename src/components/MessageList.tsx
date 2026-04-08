import MessageBubble, { ChatMessage } from './MessageBubble';
import OliLogo from './OliLogo';
import type { T } from '../lib/i18n';
import type { InlineAttachment } from '../lib/chatFunction';

/** Full message shape used in Chat — extends ChatMessage with upload fields. */
export interface Message extends ChatMessage {
  isDisambiguation?: boolean;
  originalText?: string;
  originalDbId?: string;
  inlineAttachments?: InlineAttachment[];
  attachmentPaths?: string[];
}

export interface MessageListProps {
  messages: Message[];
  isTyping: boolean;
  t: T;
  lang: string;
  messagesEndRef: React.RefObject<HTMLDivElement>;
  onStar: (msg: Message) => void;
  onFeedback: (msg: Message, feedback: 'positive' | 'negative') => void;
  onLogIntervention: (msg: Message) => void;
  onShare: (msg: Message) => void;
  onVioApplyConfirm: (interventionId: string, applied: boolean, msgId: string) => void;
  onOutcome: (interventionId: string, outcome: 'better' | 'same' | 'worse', msgId: string) => void;
  onRetry?: (text: string) => void;
}

export default function MessageList({
  messages,
  isTyping,
  t,
  lang,
  messagesEndRef,
  onStar,
  onFeedback,
  onLogIntervention,
  onShare,
  onVioApplyConfirm,
  onOutcome,
  onRetry,
}: MessageListProps) {
  return (
    <div className="space-y-6">
      {messages.map((msg, index) => (
        <MessageBubble
          key={msg.id}
          msg={msg}
          isFirstAiInSequence={msg.role !== 'user' && (index === 0 || messages[index - 1].role === 'user')}
          t={t}
          lang={lang}
          onStar={onStar}
          onFeedback={onFeedback}
          onLogIntervention={onLogIntervention}
          onShare={onShare}
          onVioApplyConfirm={onVioApplyConfirm}
          onOutcome={onOutcome}
          onRetry={onRetry}
        />
      ))}
      {isTyping && (
        <div className="flex w-full justify-start animate-fade-in">
          {/* Animated Oli logo */}
          <div className="flex-shrink-0 mt-1 mr-2.5" style={{ animation: 'oliThink 2s ease-in-out infinite', transformOrigin: 'center' }}>
            <OliLogo size={26} bg="#161C23" />
          </div>
          {/* Thinking bubble */}
          <div className="flex max-w-[78%] flex-col gap-1">
            <div className="flex items-center gap-1.5 rounded-[18px] rounded-bl-[4px] border border-border/50 bg-surface px-4 py-3">
              <span className="text-sm text-muted select-none">
                {lang === 'el' ? 'Σκέφτομαι' : 'Thinking'}
              </span>
              <span className="animate-think-dot text-muted text-sm" style={{ animationDelay: '0ms' }}>.</span>
              <span className="animate-think-dot text-muted text-sm" style={{ animationDelay: '0.2s' }}>.</span>
              <span className="animate-think-dot text-muted text-sm" style={{ animationDelay: '0.4s' }}>.</span>
            </div>
          </div>
        </div>
      )}
      <div ref={messagesEndRef} />
    </div>
  );
}
