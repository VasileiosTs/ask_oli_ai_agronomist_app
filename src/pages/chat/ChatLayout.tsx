import { Leaf, Menu, Send, SquarePen } from 'lucide-react';
import clsx from 'clsx';
import OliLogo from '../../components/OliLogo';
import type { ReactNode } from 'react';
import ConversationSidebar from '../../components/ConversationSidebar';
import ChatInputBar, { type ChatInputBarProps } from '../../components/ChatInputBar';
import FieldSelector from '../../components/FieldSelector';
import MessageList, { type MessageListProps, type Message } from '../../components/MessageList';
import type { T } from '../../lib/i18n';
import type { Field } from '../../lib/fieldContext';

interface Props {
  activeConversationId?: string;
  activeFieldId?: string;
  fields: Field[];
  handleSend: (text?: string) => void;
  inputBarProps: ChatInputBarProps;
  inputTop?: ReactNode;
  lang: string;
  messageListProps: MessageListProps;
  messages: Message[];
  onSelectConversation: (conversationId: string) => void;
  onSelectField: (fieldId: string | undefined) => void;
  onToggleSidebar: (open: boolean) => void;
  onNewChat: () => void;
  sidebarLoading: boolean;
  sidebarOpen: boolean;
  t: T;
}

export default function ChatLayout({
  activeConversationId,
  activeFieldId,
  fields,
  handleSend,
  inputBarProps,
  inputTop,
  lang,
  messageListProps,
  messages,
  onSelectConversation,
  onSelectField,
  onToggleSidebar,
  onNewChat,
  sidebarLoading,
  sidebarOpen,
  t,
}: Props) {
  return (
    <div className="flex h-[100dvh] overflow-hidden bg-background">
      <div className="hidden flex-shrink-0 md:block">
        <ConversationSidebar
          isOpen
          onClose={() => {}}
          desktop
          activeId={activeConversationId}
          onSelect={onSelectConversation}
          onNewChat={onNewChat}
        />
      </div>

      <div className="md:hidden">
        <ConversationSidebar
          isOpen={sidebarOpen}
          onClose={() => onToggleSidebar(false)}
          activeId={activeConversationId}
          onSelect={onSelectConversation}
          onNewChat={onNewChat}
        />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 flex-shrink-0 items-center justify-between border-b border-border/50 bg-surface px-4 md:hidden">
          <div className="flex items-center gap-3">
            <button
              onClick={() => onToggleSidebar(true)}
              aria-label="Open menu"
              className="text-muted transition-colors hover:text-foreground"
            >
              <Menu className="h-5 w-5" />
            </button>
            <Leaf className="h-[18px] w-[18px] text-primary" />
            <span className="text-[16px] font-medium text-primary">Oli</span>
          </div>
          {fields.length > 0 && (
            <FieldSelector
              fields={fields}
              activeFieldId={activeFieldId}
              onSelectField={onSelectField}
              lang={lang}
            />
          )}
          <button
            onClick={onNewChat}
            aria-label="New chat"
            className="text-muted transition-colors hover:text-foreground"
          >
            <SquarePen className="h-5 w-5" />
          </button>
        </header>

        {messages.length === 0 && (
          <>
            <div className="hidden flex-1 animate-fade-in flex-col items-center justify-center px-8 md:flex">
              <div className="w-full max-w-2xl">
                <div className="mb-3 flex items-center justify-center gap-3">
                  <Leaf className="h-10 w-10 text-primary" />
                  <h1 className="text-4xl font-semibold text-primary">Oli</h1>
                </div>
                <p className="mb-1 text-center text-xl font-medium text-foreground">{t.welcomeTitle}</p>
                <p className="mb-8 text-center text-sm text-muted">{t.welcomeSubtitle}</p>
                <div className="mb-6 grid grid-cols-3 gap-4">
                  {[
                    { title: t.feature1Title, desc: t.feature1Desc, icon: '📷' },
                    { title: t.feature2Title, desc: t.feature2Desc, icon: '🧠' },
                    { title: t.feature3Title, desc: t.feature3Desc, icon: '📋' },
                  ].map((feature, index) => (
                    <div key={index} className="rounded-2xl border border-border/50 bg-surface p-4 text-left">
                      <div className="mb-2 text-2xl">{feature.icon}</div>
                      <p className="text-sm font-medium text-foreground">{feature.title}</p>
                      <p className="mt-1 text-xs leading-relaxed text-muted">{feature.desc}</p>
                    </div>
                  ))}
                </div>
                <div className="mb-5 grid grid-cols-2 gap-3">
                  {t.suggestions.map((suggestion, index) => (
                    <button
                      key={index}
                      onClick={() => handleSend(suggestion)}
                      className="rounded-2xl border border-border/50 bg-surface px-4 py-3 text-left text-sm text-foreground transition-all hover:border-primary/40 hover:bg-primary/5 active:scale-[0.98]"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
                <div className="rounded-[28px] border border-border/40 bg-surface/70 p-2">
                  {inputTop}
                  <ChatInputBar {...inputBarProps} />
                </div>
              </div>
            </div>

            <div className="flex flex-1 flex-col md:hidden">
              <div className="flex flex-1 animate-fade-in flex-col items-center justify-center px-4 text-center">
                <Leaf className="mb-3 h-10 w-10 text-primary" />
                <h1 className="mb-1 text-2xl font-semibold text-primary">Oli</h1>
                <p className="mb-5 text-sm text-muted">{t.chatSubtitle}</p>

                <div className="mb-5 flex flex-wrap justify-center gap-2">
                  {[
                    { icon: '📷', label: lang === 'el' ? 'Φωτό' : 'Photo' },
                    { icon: '🎤', label: lang === 'el' ? 'Φωνή' : 'Voice' },
                    { icon: '🌿', label: lang === 'el' ? 'Διάγνωση' : 'Diagnose' },
                  ].map((feature, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center gap-1.5 rounded-full border border-border/50 bg-surface/50 px-3 py-1.5 text-xs text-muted"
                    >
                      <span>{feature.icon}</span>
                      {feature.label}
                    </span>
                  ))}
                </div>

                <div className="grid w-full max-w-md grid-cols-2 gap-2.5">
                  {t.suggestions.map((suggestion, index) => (
                    <button
                      key={index}
                      onClick={() => handleSend(suggestion)}
                      className="rounded-2xl border border-border/50 bg-surface px-3.5 py-3 text-left text-[13px] leading-snug text-foreground transition-all hover:border-primary/30 active:scale-[0.97]"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
              <ChatInputBar {...inputBarProps} />
            </div>
          </>
        )}

        {messages.length > 0 && (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex-1 overflow-y-auto px-4 py-4 md:px-6 md:py-6">
              <div className="mx-auto max-w-2xl">
                {sidebarLoading ? (
                  <div className="flex h-full items-center justify-center py-20">
                    <OliLogo size={32} bg="#161C23" animate="cascade" />
                  </div>
                ) : (
                  <MessageList {...messageListProps} />
                )}
              </div>
            </div>
            <div className="flex-shrink-0">
              <div className="mx-auto max-w-2xl md:px-2 md:pb-4">
                {inputTop}
                <ChatInputBar {...inputBarProps} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
