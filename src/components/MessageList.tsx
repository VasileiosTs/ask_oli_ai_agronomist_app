import MessageBubble, { ChatMessage } from './MessageBubble';
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
        />
      ))}
      {isTyping && (
        <div className="group flex w-full justify-start animate-fade-in">
          <div className="w-6 flex-shrink-0 pt-3"><div className="h-2 w-2 rounded-full bg-primary/60" /></div>
          <div className="flex max-w-[78%] flex-col gap-1">
            <div className="flex items-center gap-1 rounded-[18px] rounded-bl-[4px] border border-border/50 bg-surface px-4 py-4">
              <div className="h-1.5 w-1.5 animate-bounce-dot rounded-full bg-muted" style={{ animationDelay: '0ms' }} />
              <div className="h-1.5 w-1.5 animate-bounce-dot rounded-full bg-muted" style={{ animationDelay: '150ms' }} />
              <div className="h-1.5 w-1.5 animate-bounce-dot rounded-full bg-muted" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        </div>
      )}
      <div ref={messagesEndRef} />
    </div>
  );
}
