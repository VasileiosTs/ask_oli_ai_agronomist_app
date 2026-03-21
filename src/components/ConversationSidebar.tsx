import { useEffect, useState } from 'react';
import { X, Plus, MessageCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../lib/LanguageContext';
import clsx from 'clsx';

interface Conversation { id: string; title: string; updated_at: string; }

interface Props {
  // mobile: slide-over controlled by isOpen
  // desktop: always rendered, isOpen ignored
  isOpen: boolean;
  onClose: () => void;
  activeId?: string;
  onSelect: (id: string) => void;
  onNewChat: () => void;
  desktop?: boolean; // if true, renders as permanent column (no overlay)
}

export default function ConversationSidebar({ isOpen, onClose, activeId, onSelect, onNewChat, desktop }: Props) {
  const { appUserId, user, profile } = useAuth();
  const { t } = useLanguage();
  const [convs, setConvs] = useState<Conversation[]>([]);

  useEffect(() => {
    if (!appUserId) return;
    supabase
      .from('conversations').select('id, title, updated_at')
      .eq('user_id', appUserId).order('updated_at', { ascending: false }).limit(60)
      .then(({ data }) => { if (data) setConvs(data); });
  }, [appUserId, isOpen, activeId]);

  const fmtDate = (iso: string) => {
    const d = new Date(iso); const now = new Date();
    const days = Math.floor((now.getTime() - d.getTime()) / 86400000);
    if (days === 0) return t.today; if (days === 1) return t.yesterday;
    if (days < 7) return `${days}d`; return d.toLocaleDateString();
  };

  const userInitial = user?.email?.[0]?.toUpperCase() ?? 'U';
  const userName = profile?.name ?? user?.email ?? '';

  const content = (
    <div className={clsx(
      'flex flex-col h-full bg-surface',
      desktop ? 'w-64 border-r border-border/50' : 'w-72'
    )}>
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 py-4 border-b border-border/50">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="#2EA043">
          <path d="M17 8C8 10 5.9 16.17 3.82 21.34L5.71 22l1-2.3A4.49 4.49 0 0 0 8 20C19 20 22 3 22 3c-1 2-8 2-13 6 0 0 .93-.98 2-2z"/>
        </svg>
        <span className="text-base font-semibold text-primary">Oli</span>
        {!desktop && (
          <button onClick={onClose} className="ml-auto rounded-full p-1 text-muted hover:text-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* New chat */}
      <button onClick={() => { onNewChat(); if (!desktop) onClose(); }}
        className="mx-3 mt-3 flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-4 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-primary/20">
        <Plus className="h-4 w-4" />{t.newChat}
      </button>

      {/* Conversations */}
      <div className="flex-1 overflow-y-auto py-2 mt-1">
        {convs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center px-6">
            <MessageCircle className="h-7 w-7 text-muted/30 mb-2" />
            <p className="text-xs text-muted">{t.noConversations}</p>
          </div>
        ) : (
          convs.map(c => (
            <button key={c.id}
              onClick={() => { onSelect(c.id); if (!desktop) onClose(); }}
              className={clsx(
                'w-full px-4 py-2.5 text-left transition-colors hover:bg-background/60 border-b border-border/20',
                activeId === c.id && 'bg-background/80'
              )}>
              <p className="truncate text-sm font-medium text-foreground leading-snug">{c.title || t.newChat}</p>
              <p className="text-[11px] text-muted mt-0.5">{fmtDate(c.updated_at)}</p>
            </button>
          ))
        )}
      </div>

      {/* User footer */}
      <div className="border-t border-border/50 p-3">
        <div className="flex items-center gap-3">
          <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs font-semibold text-primary">
            {userInitial}
          </div>
          <span className="truncate text-sm text-muted">{userName}</span>
        </div>
      </div>
    </div>
  );

  // Desktop: permanent column, no overlay
  if (desktop) return content;

  // Mobile: slide-over with backdrop
  if (!isOpen) return null;
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed left-0 top-0 z-50 h-full" style={{ animation: 'slideInLeft 0.2s ease-out' }}>
        {content}
      </div>
    </>
  );
}
