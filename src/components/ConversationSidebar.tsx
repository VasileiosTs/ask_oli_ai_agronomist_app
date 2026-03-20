import { useEffect, useState } from 'react';
import { X, Plus, MessageCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../lib/LanguageContext';
import clsx from 'clsx';

interface Conversation {
  id: string;
  title: string;
  updated_at: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  activeId?: string;
  onSelect: (id: string) => void;
  onNewChat: () => void;
}

export default function ConversationSidebar({ isOpen, onClose, activeId, onSelect, onNewChat }: Props) {
  const { appUserId } = useAuth();
  const { t } = useLanguage();
  const [convs, setConvs] = useState<Conversation[]>([]);

  useEffect(() => {
    if (!appUserId || !isOpen) return;
    supabase
      .from('conversations')
      .select('id, title, updated_at')
      .eq('user_id', appUserId)
      .order('updated_at', { ascending: false })
      .limit(60)
      .then(({ data }) => { if (data) setConvs(data); });
  }, [appUserId, isOpen]);

  const fmtDate = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const days = Math.floor((now.getTime() - d.getTime()) / 86400000);
    if (days === 0) return t.today;
    if (days === 1) return t.yesterday;
    if (days < 7) return `${days}d`;
    return d.toLocaleDateString();
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed left-0 top-0 z-50 h-full w-72 bg-surface border-r border-border/50 flex flex-col"
        style={{ animation: 'slideInLeft 0.2s ease-out' }}>
        <div className="flex items-center justify-between px-4 py-4 border-b border-border/50">
          <span className="font-semibold text-foreground text-sm">{t.chatHistory}</span>
          <button onClick={onClose} className="rounded-full p-1.5 text-muted hover:text-foreground transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <button
          onClick={() => { onNewChat(); onClose(); }}
          className="mx-3 mt-3 flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-4 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-primary/20"
        >
          <Plus className="h-4 w-4" />
          {t.newChat}
        </button>

        <div className="flex-1 overflow-y-auto py-2 mt-1">
          {convs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-6">
              <MessageCircle className="h-8 w-8 text-muted/30 mb-3" />
              <p className="text-sm text-muted">{t.noConversations}</p>
            </div>
          ) : (
            convs.map(c => (
              <button
                key={c.id}
                onClick={() => { onSelect(c.id); onClose(); }}
                className={clsx(
                  'w-full px-4 py-3 text-left transition-colors hover:bg-background border-b border-border/20',
                  activeId === c.id && 'bg-background'
                )}
              >
                <p className="truncate text-sm font-medium text-foreground leading-snug">
                  {c.title || t.newChat}
                </p>
                <p className="text-[11px] text-muted mt-0.5">{fmtDate(c.updated_at)}</p>
              </button>
            ))
          )}
        </div>
      </div>
    </>
  );
}
