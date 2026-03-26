import { useEffect, useState, useMemo } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Plus, MessageCircle, User, Search, ClipboardList, Sprout } from 'lucide-react';
import OliLogo from './OliLogo';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../lib/LanguageContext';
import clsx from 'clsx';

interface Conversation { id: string; title: string; updated_at: string; }

interface Props {
  isOpen: boolean;
  onClose: () => void;
  activeId?: string;
  onSelect: (id: string) => void;
  onNewChat: () => void;
  desktop?: boolean;
}

export default function ConversationSidebar({ isOpen, onClose, activeId, onSelect, onNewChat, desktop }: Props) {
  const { appUserId, user, profile } = useAuth();
  const { t, lang } = useLanguage();
  const navigate = useNavigate();
  const [convs, setConvs] = useState<Conversation[]>([]);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!appUserId) return;
    supabase
      .from('conversations').select('id, title, updated_at')
      .eq('user_id', appUserId).order('updated_at', { ascending: false }).limit(100)
      .then(({ data }) => { if (data) setConvs(data); });
  }, [appUserId, isOpen, activeId]);

  const filtered = useMemo(() => {
    if (!query.trim()) return convs;
    const q = query.toLowerCase();
    return convs.filter(c => (c.title || '').toLowerCase().includes(q));
  }, [convs, query]);

  const fmtDate = (iso: string) => {
    const d = new Date(iso); const now = new Date();
    const days = Math.floor((now.getTime() - d.getTime()) / 86400000);
    if (days === 0) return t.today;
    if (days === 1) return t.yesterday;
    if (days < 7) return `${days}d`;
    return d.toLocaleDateString();
  };

  const userInitial = user?.email?.[0]?.toUpperCase() ?? 'U';
  const userName = (profile?.name as string) ?? user?.email ?? '';
  const avatarUrl = user?.user_metadata?.avatar_url as string | undefined;
  const searchPlaceholder = lang === 'el' ? 'Αναζήτηση...' : 'Search...';
  const noResults = lang === 'el' ? 'Δεν βρέθηκαν αποτελέσματα' : 'No results found';

  const content = (
    <div className={clsx(
      'flex flex-col h-full bg-surface',
      desktop ? 'w-64 border-r border-border/50' : 'w-72'
    )}>
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 py-4 border-b border-border/50">
        <OliLogo size={20} bg="#161C23" />
        <span className="text-base font-semibold text-primary">Oli</span>
        {!desktop && (
          <button onClick={onClose} aria-label="Close sidebar" className="ml-auto rounded-full p-1 text-muted hover:text-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* New chat */}
      <button onClick={() => { onNewChat(); if (!desktop) onClose(); }}
        className="mx-3 mt-3 flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-4 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-primary/20">
        <Plus className="h-4 w-4" />{t.newChat}
      </button>

      {/* Search */}
      {convs.length > 3 && (
        <div className="mx-3 mt-2 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full rounded-xl border border-border/50 bg-background pl-8 pr-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-primary focus:outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Conversations */}
      <div className="flex-1 overflow-y-auto py-2 mt-1">
        {convs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center px-6">
            <MessageCircle className="h-7 w-7 text-muted/30 mb-2" />
            <p className="text-xs text-muted">{t.noConversations}</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center px-6">
            <Search className="h-6 w-6 text-muted/30 mb-2" />
            <p className="text-xs text-muted">{noResults}</p>
          </div>
        ) : (
          filtered.map(c => (
            <button key={c.id}
              onClick={() => { onSelect(c.id); if (!desktop) onClose(); }}
              className={clsx(
                'w-full px-4 py-2.5 text-left transition-colors hover:bg-background/60 border-b border-border/20',
                activeId === c.id && 'bg-background/80'
              )}>
              <p className="truncate text-sm font-medium text-foreground leading-snug">
                {query ? highlightMatch(c.title || t.newChat, query) : (c.title || t.newChat)}
              </p>
              <p className="text-[11px] text-muted mt-0.5">{fmtDate(c.updated_at)}</p>
            </button>
          ))
        )}
      </div>

      {/* Quick nav links */}
      <div className="border-t border-border/50 px-3 py-2 space-y-0.5">
        {[
          { path: '/history', icon: <ClipboardList className="h-4 w-4" />, label: t.navHistory },
          { path: '/fields', icon: <Sprout className="h-4 w-4" />, label: t.navFields },
        ].map(({ path, icon, label }) => (
          <button key={path}
            onClick={() => { if (!desktop) onClose(); navigate(path); }}
            className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-sm text-muted transition-colors hover:bg-background/60 hover:text-foreground"
          >
            {icon}
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* User footer — click to go to profile */}
      <div className="border-t border-border/50 p-3">
        <button
          onClick={() => { if (!desktop) onClose(); navigate('/profile'); }}
          className="flex w-full items-center gap-3 rounded-xl p-1.5 transition-colors hover:bg-background/60"
        >
          <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full overflow-hidden bg-primary/20 text-xs font-semibold text-primary">
            {avatarUrl
              ? <img src={avatarUrl} alt={userName} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
              : userInitial}
          </div>
          <span className="flex-1 truncate text-sm text-muted text-left">{userName}</span>
          <User className="h-3.5 w-3.5 text-muted/50 flex-shrink-0" />
        </button>
      </div>
    </div>
  );

  if (desktop) return content;
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

// Highlight matching text in conversation title
function highlightMatch(text: string, query: string): ReactNode {
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-primary/20 text-primary rounded px-0.5">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}
