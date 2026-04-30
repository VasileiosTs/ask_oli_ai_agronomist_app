import { useEffect, useState, useMemo } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Plus, MessageCircle, User, Search, Sprout, Users, ChevronDown, ChevronRight } from 'lucide-react';
import OliLogo from './OliLogo';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../lib/LanguageContext';
import { isAdvisorTier } from '../../shared/subscription';
import clsx from 'clsx';

interface Conversation {
  id: string;
  title: string;
  updated_at: string;
  grower_id: string | null;
  field_id: string | null;
}
interface GroupMeta { id: string; label: string; }
interface FieldItem { id: string; name: string; crop_type: string | null; }

interface Props {
  isOpen: boolean;
  onClose: () => void;
  activeId?: string;
  onSelect: (id: string) => void;
  onNewChat: () => void;
  desktop?: boolean;
  /** Increment this to force a conversation list refresh (e.g. after sending first message). */
  refreshSignal?: number;
}

export default function ConversationSidebar({ isOpen, onClose, activeId, onSelect, onNewChat, desktop, refreshSignal }: Props) {
  const { appUserId, user, profile } = useAuth();
  const { t, lang } = useLanguage();
  const navigate = useNavigate();
  const [convs, setConvs] = useState<Conversation[]>([]);
  const [growers, setGrowers] = useState<Record<string, string>>({});
  const [fields, setFields] = useState<Record<string, string>>({});
  const [fieldsList, setFieldsList] = useState<FieldItem[]>([]);
  const [growersList, setGrowersList] = useState<FieldItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;
  const advisor = isAdvisorTier(profile?.tier as string | undefined);

  // Collapsible section state
  const [fieldsOpen, setFieldsOpen] = useState(true);
  const [convsOpen, setConvsOpen] = useState(true);

  useEffect(() => {
    if (!appUserId) { setLoading(false); return; }
    setLoading(true);
    setPage(1);
    Promise.resolve(
      supabase
        .from('conversations').select('id, title, updated_at, grower_id, field_id')
        .eq('user_id', appUserId).order('updated_at', { ascending: false }).range(0, PAGE_SIZE - 1)
    ).then(({ data }) => { if (data) setConvs(data as Conversation[]); setLoading(false); })
      .catch(() => { setLoading(false); });

    // Growers (advisor)
    Promise.resolve(
      supabase.from('growers').select('id, name').eq('advisor_id', appUserId).order('name').limit(50)
    ).then(({ data }) => {
      if (data) {
        setGrowers(Object.fromEntries(data.map(g => [g.id, g.name])));
        setGrowersList(data.map(g => ({ id: g.id, name: g.name, crop_type: null })));
      }
    }).catch(() => {});

    // Fields (farmer)
    Promise.resolve(
      supabase.from('fields').select('id, name, crop_type').eq('user_id', appUserId).eq('is_active', true).order('name').limit(50)
    ).then(({ data }) => {
      if (data) {
        setFields(Object.fromEntries(data.map(f => [f.id, f.name])));
        setFieldsList(data as FieldItem[]);
      }
    }).catch(() => {});
  }, [appUserId, isOpen, refreshSignal]);

  const loadMore = () => {
    if (!appUserId) return;
    const nextPage = page + 1;
    Promise.resolve(
      supabase
        .from('conversations').select('id, title, updated_at, grower_id, field_id')
        .eq('user_id', appUserId).order('updated_at', { ascending: false })
        .range(page * PAGE_SIZE, nextPage * PAGE_SIZE - 1)
    ).then(({ data }) => {
        if (data && data.length > 0) setConvs(prev => [...prev, ...(data as Conversation[])]);
        setPage(nextPage);
      })
      .catch(() => {});
  };

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
  const ungroupedLabel = lang === 'el' ? 'Γενικές συζητήσεις' : 'General chats';

  // Section labels
  const fieldsSectionLabel = advisor
    ? (lang === 'el' ? 'Οι Παραγωγοί μου' : 'My Growers')
    : (lang === 'el' ? 'Τα Χωράφια μου' : 'My Fields');
  const convsSectionLabel = lang === 'el' ? 'Συζητήσεις' : 'Conversations';

  // Grouped conversations by grower/field
  const grouped = useMemo(() => {
    if (query.trim()) return null;
    const groups: { meta: GroupMeta; items: Conversation[] }[] = [];
    const byKey = new Map<string, number>();

    const pushInto = (key: string, label: string, c: Conversation) => {
      const idx = byKey.get(key);
      if (idx !== undefined) { groups[idx].items.push(c); return; }
      byKey.set(key, groups.length);
      groups.push({ meta: { id: key, label }, items: [c] });
    };

    for (const c of filtered) {
      if (advisor && c.grower_id && growers[c.grower_id]) {
        pushInto(`g:${c.grower_id}`, growers[c.grower_id], c);
      } else if (!advisor && c.field_id && fields[c.field_id]) {
        pushInto(`f:${c.field_id}`, fields[c.field_id], c);
      } else {
        pushInto('__none__', ungroupedLabel, c);
      }
    }
    const hasNamed = groups.some(g => g.meta.id !== '__none__');
    return hasNamed ? groups : null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, advisor, growers, fields, query, ungroupedLabel]);

  // Items for the fields/growers section
  const listItems = advisor ? growersList : fieldsList;
  const listPath = (id: string) => advisor ? `/clients/${id}` : `/fields/${id}`;
  const listAllPath = advisor ? '/clients' : '/fields';

  const SectionHeader = ({ label, count, open, toggle }: { label: string; count: number; open: boolean; toggle: () => void }) => (
    <button
      onClick={toggle}
      className="flex w-full items-center gap-1.5 px-4 py-2 text-left transition-colors hover:bg-background/40"
    >
      {open ? <ChevronDown className="h-3 w-3 text-muted flex-shrink-0" /> : <ChevronRight className="h-3 w-3 text-muted flex-shrink-0" />}
      <span className="flex-1 text-[11px] font-semibold uppercase tracking-wider text-muted">{label}</span>
      {count > 0 && <span className="text-[10px] text-muted/60">{count}</span>}
    </button>
  );

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

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto mt-2">

        {/* ── Fields / Clients section ── */}
        {(listItems.length > 0 || advisor) && (
          <div className="mb-1">
            <SectionHeader label={fieldsSectionLabel} count={listItems.length} open={fieldsOpen} toggle={() => setFieldsOpen(v => !v)} />
            {fieldsOpen && (
              <div className="pb-1">
                {/* Add new client/field button — always visible at top */}
                <button
                  onClick={() => { navigate(listAllPath); if (!desktop) onClose(); }}
                  className="flex w-full items-center gap-2 px-4 py-2 text-left transition-colors hover:bg-primary/10"
                >
                  <Plus className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                  <span className="text-sm font-medium text-primary">
                    {advisor
                      ? (lang === 'el' ? 'Νέος πελάτης' : 'New client')
                      : (lang === 'el' ? 'Νέο χωράφι' : 'New field')}
                  </span>
                </button>
                {listItems.length === 0 && (
                  <p className="px-4 py-2 text-xs text-muted">
                    {advisor
                      ? (lang === 'el' ? 'Δεν έχεις πελάτες ακόμα' : 'No clients yet')
                      : (lang === 'el' ? 'Δεν έχεις χωράφια ακόμα' : 'No fields yet')}
                  </p>
                )}
                {listItems.slice(0, 5).map(item => (
                  <button key={item.id}
                    onClick={() => { navigate(listPath(item.id)); if (!desktop) onClose(); }}
                    className="flex w-full items-center gap-2 px-4 py-2 text-left transition-colors hover:bg-background/60">
                    {advisor
                      ? <Users className="h-3.5 w-3.5 text-muted flex-shrink-0" />
                      : <Sprout className="h-3.5 w-3.5 text-muted flex-shrink-0" />}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-foreground leading-snug">{item.name}</p>
                      {item.crop_type && <p className="truncate text-[11px] text-muted">{item.crop_type}</p>}
                    </div>
                  </button>
                ))}
                <button
                  onClick={() => { navigate(listAllPath); if (!desktop) onClose(); }}
                  className="flex w-full items-center justify-between px-4 py-1.5 text-xs text-primary hover:text-primary/80 transition-colors"
                >
                  <span>{listItems.length > 5 ? (lang === 'el' ? `Δες όλα (${listItems.length})` : `See all (${listItems.length})`) : (lang === 'el' ? 'Διαχείριση' : 'Manage')}</span>
                  <ChevronRight className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>
        )}

        <div className="h-px bg-border/30 mx-3 my-1" />

        {/* ── Conversations section ── */}
        <div>
          <SectionHeader label={convsSectionLabel} count={convs.length} open={convsOpen} toggle={() => setConvsOpen(v => !v)} />
          {convsOpen && (
            <>
              {/* Search — only when enough convs */}
              {convs.length > 3 && (
                <div className="mx-3 mb-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted pointer-events-none" />
                  <input
                    type="text"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder={searchPlaceholder}
                    aria-label={searchPlaceholder}
                    className="w-full rounded-xl border border-border/50 bg-background pl-8 pr-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-primary focus:outline-none"
                  />
                  {query && (
                    <button onClick={() => setQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-foreground">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              )}

              {loading ? (
                <div className="space-y-1 px-4 py-2">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="animate-pulse">
                      <div className="h-4 rounded bg-muted/20 mb-1.5" style={{ width: `${70 - i * 8}%` }} />
                      <div className="h-3 w-12 rounded bg-muted/10 mb-3" />
                    </div>
                  ))}
                </div>
              ) : convs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center px-6">
                  <MessageCircle className="h-7 w-7 text-muted/30 mb-2" />
                  <p className="text-xs text-muted">{t.noConversations}</p>
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-6 text-center px-6">
                  <Search className="h-6 w-6 text-muted/30 mb-2" />
                  <p className="text-xs text-muted">{noResults}</p>
                </div>
              ) : (
                <>
                  {grouped ? (
                    grouped.map(group => (
                      <div key={group.meta.id} className="mb-2">
                        <p className="px-4 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted/70">
                          {group.meta.label}
                        </p>
                        {group.items.map(c => (
                          <button key={c.id}
                            onClick={() => { onSelect(c.id); if (!desktop) onClose(); }}
                            className={clsx(
                              'w-full px-4 py-2.5 text-left transition-colors hover:bg-background/60 border-b border-border/20',
                              activeId === c.id && 'bg-background/80'
                            )}>
                            <p className="truncate text-sm font-medium text-foreground leading-snug">
                              {c.title || t.newChat}
                            </p>
                            <p className="text-[11px] text-muted mt-0.5">{fmtDate(c.updated_at)}</p>
                          </button>
                        ))}
                      </div>
                    ))
                  ) : filtered.map(c => (
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
                  ))}
                  {!query && convs.length === page * PAGE_SIZE && (
                    <button
                      onClick={loadMore}
                      className="w-full px-4 py-2.5 text-xs text-muted hover:text-foreground transition-colors text-center"
                    >
                      {lang === 'el' ? 'Φόρτωση περισσότερων' : 'Load more'}
                    </button>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* User footer */}
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
