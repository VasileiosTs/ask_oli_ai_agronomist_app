/// <reference types="vite/client" />

import { useState, useEffect, useRef, useReducer } from 'react';
import { useSearchParams, useLocation, useNavigate } from 'react-router-dom';
import { SquarePen, Send, Menu } from 'lucide-react';
import OliLogo from '../components/OliLogo';
import OliHomeLink from '../components/OliHomeLink';
import VioFollowUpCard, { type VioFollowUp } from '../components/VioFollowUpCard';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import PaywallModal from '../components/PaywallModal';
import LoginModal from '../components/LoginModal';
import InstallPrompt from '../components/InstallPrompt';
import ConversationSidebar from '../components/ConversationSidebar';
import type { Field } from '../lib/fieldContext';
import { InlineAttachment, streamChatCompletion, guestChatCompletion } from '../lib/chatFunction';
import { useLanguage } from '../lib/LanguageContext';
import { getCachedImage, getCachedImages } from '../lib/imageCache';
import clsx from 'clsx';
import { trackEvent, Events } from '../lib/analytics';
import { isUnlimitedTier } from '../../shared/subscription';

import { FREE_MESSAGE_LIMIT as FREE_LIMIT, SIGNED_URL_EXPIRY, VIO_STEP1_DAYS, VIO_STEP2_DAYS, PAYWALL_WARNING_MESSAGES_REMAINING } from "../lib/constants";

import { LogInterventionModal } from '../components/LogInterventionModal';
import AutoLogBanner, { ActionDetected } from '../components/AutoLogBanner';
import ChatInputBar from '../components/ChatInputBar';
import MessageList, { Message } from '../components/MessageList';
import type { HistoryDiagnosis } from '../components/HistoryCard';
import ShareModal from '../components/ShareModal';
import { enqueueMessage, drainQueue, type QueuedMessage } from '../lib/offlineQueue';
import { messagesReducer, type MsgAction } from './chat/messagesReducer';
import { useChatAttachments, cleanupUploadedAssets, prepareAttachmentsForSend } from './chat/useChatAttachments';
// ── Guest session storage keys ──
const GUEST_SESSION_KEY = 'oli_guest_messages';
const GREETING_SESSION_TTL_MS = 10 * 60 * 1000;
const GUEST_CHAT_ENTRY_KEY = 'oli_guest_chat_entry';

function sameCalendarMonth(isoDate?: string | null) {
  if (!isoDate) return false;
  const date = new Date(isoDate);
  const now = new Date();
  return (
    date.getUTCFullYear() === now.getUTCFullYear()
    && date.getUTCMonth() === now.getUTCMonth()
  );
}

function inferMimeTypeFromPath(path: string) {
  const lower = path.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.heic')) return 'image/heic';
  if (lower.endsWith('.heif')) return 'image/heif';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.mp3')) return 'audio/mpeg';
  if (lower.endsWith('.mp4') || lower.endsWith('.m4a')) return 'audio/mp4';
  if (lower.endsWith('.wav')) return 'audio/wav';
  if (lower.endsWith('.webm')) return 'audio/webm';
  if (lower.endsWith('.ogg')) return 'audio/ogg';
  if (lower.endsWith('.aac')) return 'audio/aac';
  return 'application/octet-stream';
}

export default function Chat() {
  const { user, profile, appUserId, refreshProfile } = useAuth();
  const { t, lang } = useLanguage();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const routeLocation = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarLoading, setSidebarLoading] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const [messages, dispatch] = useReducer(messagesReducer, []);
  // Restore any unsent draft from sessionStorage (survives navigation away → login → back)
  const [input, setInput] = useState(() => {
    try {
      const raw = sessionStorage.getItem('oli_draft_input');
      if (!raw) return '';
      const { text, expires } = JSON.parse(raw) as { text: string; expires: number };
      if (Date.now() < expires) return text;
      sessionStorage.removeItem('oli_draft_input');
    } catch { sessionStorage.removeItem('oli_draft_input'); }
    return '';
  });
  const [isTyping, setIsTyping] = useState(false);
  const [messageCount, setMessageCount] = useState(0);
  const [showPaywall, setShowPaywall] = useState(false);
  const [showPaywallWarning, setShowPaywallWarning] = useState(false);
  const hasUnlimitedMessages = isUnlimitedTier(typeof profile?.tier === 'string' ? profile.tier : null);

  // Initialise message count from profile so the paywall check is accurate on page load
  // (without this, messageCount starts at 0 and the client-side gate never fires even
  //  when the user has already exhausted their monthly quota in a previous session).
  useEffect(() => {
    if (!profile) return;
    if (hasUnlimitedMessages) {
      setShowPaywall(false);
      setShowPaywallWarning(false);
      return;
    }
    const dbCount = typeof profile.message_count_month === 'number' ? profile.message_count_month : 0;
    const count = sameCalendarMonth(profile.message_reset_date) ? dbCount : 0;
    setMessageCount(count);
    const remaining = FREE_LIMIT - count;
    if (remaining <= 0) {
      setShowPaywall(true);
      setShowPaywallWarning(false);
    } else if (remaining <= PAYWALL_WARNING_MESSAGES_REMAINING) {
      setShowPaywall(false);
      setShowPaywallWarning(true);
    } else {
      setShowPaywall(false);
      setShowPaywallWarning(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.message_count_month, profile?.message_reset_date, hasUnlimitedMessages]);

  useEffect(() => {
    if (!appUserId) return;
    refreshProfile({ preserveExisting: true }).catch(() => {});
  }, [appUserId, refreshProfile]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const handleSendRef = useRef<((text: string) => Promise<void>) | null>(null);
  // Holds a message typed before appUserId loaded; drained automatically
  // once the profile lookup completes. Prevents the "send 2-3 times" symptom
  // where a first message would silently fail with a toast and disappear.
  const pendingMessageRef = useRef<string | null>(null);
  useEffect(() => {
    const on = async () => {
      setIsOnline(true);
      // Drain any queued messages from when we were offline
      if (handleSendRef.current) {
        const sent = await drainQueue(async (msg: QueuedMessage) => {
          if (handleSendRef.current) await handleSendRef.current(msg.text);
        });
        if (sent > 0) {
          showToast(
            lang === 'el'
              ? `${sent} μήνυμα${sent > 1 ? 'τα' : ''} εστάλη${sent > 1 ? 'καν' : ''} μετά την επανασύνδεση`
              : `${sent} queued message${sent > 1 ? 's' : ''} sent after reconnect`,
          );
        }
      }
    };
    const off = () => setIsOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, [lang]);

  // ── Personalised greeting (non-blocking; shown in welcome state subtitle) ──
  const [dynamicGreeting, setDynamicGreeting] = useState('');
  const greetingFetchedRef = useRef(false);
  // ── Guest mode state ──
  const guestQuery = searchParams.get('q');
  // ── Engagement deep-link ?prompt= ──
  const promptParam = searchParams.get('prompt');
  // oli_guest_used persists across reloads so the same browser can't get unlimited free messages
  const guestAlreadyUsed = !user && !!localStorage.getItem('oli_guest_used');
  const [isGuestMode, setIsGuestMode] = useState(!user && !!guestQuery && !guestAlreadyUsed);
  const [guestMessageSent, setGuestMessageSent] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  useEffect(() => {
    greetingFetchedRef.current = false;
  }, [user?.id, lang, isGuestMode]);
  useEffect(() => {
    if (!user || !profile || isGuestMode || greetingFetchedRef.current) return;
    greetingFetchedRef.current = true;
    const cacheKey = `oli_dynamic_greeting:${user.id}:${lang}`;
    try {
      const raw = sessionStorage.getItem(cacheKey);
      if (raw) {
        const cached = JSON.parse(raw) as { greeting?: string; cachedAt?: number };
        if (
          typeof cached.greeting === 'string'
          && cached.greeting.trim()
          && typeof cached.cachedAt === 'number'
          && Date.now() - cached.cachedAt < GREETING_SESSION_TTL_MS
        ) {
          setDynamicGreeting(cached.greeting.trim());
          return;
        }
      }
    } catch {
      // Ignore cache parse errors and refetch.
    }

    supabase.functions.invoke('chat', {
      body: {
        mode: 'greeting',
        lang,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
    })
      .then(({ data, error }) => {
        if (!error && typeof data?.greeting === 'string' && data.greeting.trim()) {
          const greeting = data.greeting.trim();
          setDynamicGreeting(greeting);
          try {
            sessionStorage.setItem(cacheKey, JSON.stringify({
              greeting,
              cachedAt: Date.now(),
            }));
          } catch {
            // Ignore sessionStorage quota errors.
          }
        }
      })
      .catch(() => { /* fail silently, static subtitle is the fallback */ });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, !!profile, lang, isGuestMode]);
  
  const [fields, setFields] = useState<Field[]>([]);
  const [activeFieldId, setActiveFieldId] = useState<string | undefined>();
  const [activeGrowerId, setActiveGrowerId] = useState<string | undefined>();
  const [activeConversationId, setActiveConversationId] = useState<string | undefined>();
  const [sidebarRefresh, setSidebarRefresh] = useState(0);
  // Stores fieldId passed via router state before fields have loaded (race condition fix)
  const pendingNavFieldIdRef = useRef<string | null>(null);
  // True when the user navigated here from a field page — triggers auto-send of field intro message
  const fromFieldNavRef = useRef(false);
  // Prevents double-sending the field intro message on re-renders
  const fieldNavSentRef = useRef(false);
  // True when the user navigated from a client card (no specific field) — triggers grower intro message
  const fromGrowerNavRef = useRef(false);
  const growerNavSentRef = useRef(false);
  // Grower name passed via state for the grower-level auto-send message
  const pendingNavGrowerNameRef = useRef<string | null>(null);

  // Hydrate ?grower= / ?field= URL params (e.g. when navigating from a client's profile).
  useEffect(() => {
    const growerParam = searchParams.get('grower');
    const fieldParam = searchParams.get('field');
    if (growerParam) setActiveGrowerId(growerParam);
    if (fieldParam) setActiveFieldId(fieldParam);
    if (growerParam || fieldParam) {
      const next = new URLSearchParams(searchParams);
      next.delete('grower');
      next.delete('field');
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  const [isListening, setIsListening] = useState(false);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [shareModalData, setShareModalData] = useState<{ url: string; text?: string; title?: string } | null>(null);
  const [logModalData, setLogModalData] = useState<Record<string, unknown> | null>(null);
  const [pendingAutoLog, setPendingAutoLog] = useState<ActionDetected | null>(null);
  const [reminderChip, setReminderChip] = useState<{ task: string; due_days: number } | null>(null);
  const [inlineLogMsgId, setInlineLogMsgId] = useState<string | null>(null);
  const [pendingVioFollowUps, setPendingVioFollowUps] = useState<VioFollowUp[]>([]);

  const {
    attachments,
    attachmentsRef,
    cameraInputRef,
    fileInputRef,
    showAttachmentSheet,
    setAttachments,
    setShowAttachmentSheet,
    handleFileSelect: handleFileSelectFromHook,
    removeAttachment,
  } = useChatAttachments({ t });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const desktopTextareaRef = useRef<HTMLTextAreaElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const messagesRef = useRef(messages);
  /** Incremented on each conversation load/clear to detect stale async loads (L2: prevents blob URL leaks). */
  const loadGenerationRef = useRef(0);
  const lastSendAttemptRef = useRef(0);
  const queryMessageSentRef = useRef(false);
  const promptSentRef = useRef(false);

  // Only use explicitly selected field, never auto-select.
  // Field context is inferred per-message via extraction, not forced globally.
  const activeField = activeFieldId
    ? fields.find((field) => field.id === activeFieldId)
    : undefined;

  const safeRevokeObjectUrl = (url: string) => {
    if (url.startsWith('blob:')) {
      URL.revokeObjectURL(url);
    }
  };

  const revokeMessageAttachments = (messageList: Message[]) => {
    messageList.forEach((message) => {
      message.attachments?.forEach((attachment) => {
        safeRevokeObjectUrl(attachment.url);
      });
    });
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) =>
    handleFileSelectFromHook(e, showToast);

  const buildConversationTitle = (rawText: string) => {
    const cleaned = rawText
      .replace(/^\[The user attached[^\]]*\]\n?/i, '')
      .trim();
    return cleaned.slice(0, 80) || 'New conversation';
  };

  const recoverConversationLink = async (
    userText: string,
    fieldId: string | null,
    userMessageDbId: string | null,
    assistantMessageDbId: string | null,
  ) => {
    if (!appUserId || (!userMessageDbId && !assistantMessageDbId)) {
      return null;
    }

    const { data: conversation, error: conversationError } = await supabase
      .from('conversations')
      .insert({
        user_id: appUserId,
        field_id: fieldId,
        grower_id: activeGrowerId ?? null,
        title: buildConversationTitle(userText),
      })
      .select('id')
      .single();

    if (conversationError || !conversation?.id) {
      console.error('Failed to repair missing conversation link:', conversationError);
      return null;
    }

    const messageIds = [userMessageDbId, assistantMessageDbId].filter((value): value is string => Boolean(value));

    if (messageIds.length > 0) {
      const { error: messageUpdateError } = await supabase
        .from('chat_messages')
        .update({ conversation_id: conversation.id })
        .in('id', messageIds);

      if (messageUpdateError) {
        console.error('Failed to attach messages to repaired conversation:', messageUpdateError);
      }
    }

    return conversation.id;
  };

  const handleStarMessage = async (msg: Message) => {
    if (!appUserId) { setShowLoginModal(true); return; }
    if (!msg.db_id) return;

    const newStarred = !msg.starred;
    dispatch({ type: 'update', id: msg.id, patch: { starred: newStarred } });

    const { error } = await supabase.from('chat_messages').update({ starred: newStarred }).eq('id', msg.db_id);
    if (error) {
      dispatch({ type: 'update', id: msg.id, patch: { starred: msg.starred } });
      showToast(t.starSaveError);
      return;
    }

    showToast(newStarred ? t.savedMessage : t.removedMessage);
  };

  const handleVioApplyConfirm = async (interventionId: string, applied: boolean, msgId: string) => {
    if (!appUserId) return;
    if (applied) {
      // User confirmed they applied treatment → advance to step 2, check improvements in VIO_STEP2_DAYS
      const nextFollowUp = new Date();
      nextFollowUp.setDate(nextFollowUp.getDate() + VIO_STEP2_DAYS);
      await supabase.from('interventions').update({
        applied_confirmed: true,
        vio_step: 2,
        follow_up_at: nextFollowUp.toISOString(),
      }).eq('id', interventionId);

      const confirmMsg: Message = {
        id: `vio-applied-${Date.now()}`,
        role: 'assistant',
        content: lang === 'el'
          ? 'Τέλεια! Θα σε ρωτήσω σύντομα αν βλέπεις βελτίωση.'
          : "Great! I'll follow up soon to see if you notice any improvement.",
        created_at: new Date().toISOString(),
      };
      dispatch({ type: 'replace', id: msgId, message: confirmMsg });
      trackEvent(Events.VIO_APPLIED_CONFIRMED, { interventionId });
    } else {
      // User didn't apply → close the loop, no further follow-ups
      await supabase.from('interventions').update({
        applied_confirmed: false,
        vio_step: 3,
        outcome: 'not_applied',
        outcome_recorded_at: new Date().toISOString(),
      }).eq('id', interventionId);

      const confirmMsg: Message = {
        id: `vio-not-applied-${Date.now()}`,
        role: 'assistant',
        content: lang === 'el'
          ? 'Εντάξει, κανένα πρόβλημα. Αν χρειαστείς βοήθεια στο μέλλον, είμαι εδώ!'
          : "No worries! If you need help in the future, I'm here.",
        created_at: new Date().toISOString(),
      };
      dispatch({ type: 'replace', id: msgId, message: confirmMsg });
    }
    showToast(lang === 'el' ? 'Καταχωρήθηκε' : 'Recorded');
  };

  const handleOutcome = async (interventionId: string, outcome: 'better' | 'same' | 'worse' | 'not_applied', msgId: string) => {
    if (!appUserId) return;
    await supabase.from('interventions').update({
      outcome,
      vio_step: 3,
      followed_up_at: new Date().toISOString(),
      outcome_recorded_at: new Date().toISOString(),
    }).eq('id', interventionId);

    // Update crop status based on outcome
    const { data: interv } = await supabase.from('interventions').select('field_id, crop_type').eq('id', interventionId).single();
    if (interv?.field_id) {
      const cropStatus = outcome === 'worse' ? 'critical' : outcome === 'same' ? 'warning' : 'healthy';
      await supabase.from('crops').update({ status: cropStatus }).eq('field_id', interv.field_id);
    }

    // Replace the follow-up message with a confirmation
    const outcomeLabels = { better: t.outcomeBetter, same: t.outcomeSame, worse: t.outcomeWorse };
    const confirmContent = lang === 'el'
      ? `${outcomeLabels[outcome]}, ευχαριστώ για την ενημέρωση. Έχω καταχωρήσει το αποτέλεσμα.`
      : `${outcomeLabels[outcome]}, thanks for the update. I've recorded the outcome.`;
    const confirmMsg: Message = {
      id: `outcome-confirm-${Date.now()}`,
      role: 'assistant',
      content: confirmContent,
      created_at: new Date().toISOString(),
    };
    dispatch({ type: 'replace', id: msgId, message: confirmMsg });
    showToast(t.outcomeRecorded);
    trackEvent(Events.VIO_OUTCOME_RECORDED, { outcome, interventionId });
  };

  const handleFeedback = async (msg: Message, feedback: 'positive' | 'negative') => {
    if (!msg.db_id) return;
    const previousFeedback = msg.metadata?.feedback;
    // Optimistic update
    dispatch({ type: 'update', id: msg.id, patch: { metadata: { ...msg.metadata, feedback } } });
    const { error } = await supabase.from('chat_messages').update({ feedback }).eq('id', msg.db_id);
    if (error) {
      // Revert on error
      dispatch({ type: 'update', id: msg.id, patch: { metadata: { ...msg.metadata, feedback: previousFeedback } } });
      showToast(t.starSaveError);
      return;
    }
    trackEvent(feedback === 'positive' ? Events.FEEDBACK_POSITIVE : Events.FEEDBACK_NEGATIVE, {
      messageId: msg.db_id,
      hasDiagnosis: !!msg.metadata?.diagnosis_data,
    });
    showToast(feedback === 'positive'
      ? (lang === 'el' ? 'Ευχαριστώ!' : 'Thanks!')
      : (lang === 'el' ? 'Θα βελτιωθώ!' : "I'll improve!"));
  };

  const handleAutoLogConfirm = async (action: ActionDetected) => {
    if (!appUserId) return;
    // VIO is per-field. In general chat there is no field to track, so a logged
    // intervention would be an orphan that still triggers the 3-day follow-up
    // crons (push/email). Never create the VIO loop without a field.
    if (!activeFieldId) {
      showToast(lang === 'el'
        ? 'Διάλεξε χωράφι για να καταγράψω και να παρακολουθήσω τη θεραπεία.'
        : 'Open this in a field to log and track the treatment.');
      setPendingAutoLog(null);
      return;
    }
    const fieldId = activeFieldId;
    try {
      await supabase.from('interventions').insert({
        user_id: appUserId,
        field_id: fieldId,
        diagnosis: action.action_type,
        product_applied: action.product || null,
        dosage: action.quantity || null,
        applied_at: new Date().toISOString(),
        // VIO step 1 = the "did you apply?" check the push/email crons fire
        // VIO_STEP1_DAYS (3d) after logging. Column is vio_step (not step), and
        // interventions has no `source` column; writing either made PostgREST
        // reject the whole insert, which silently killed auto-log.
        vio_step: 1,
        follow_up_at: new Date(Date.now() + VIO_STEP1_DAYS * 86400000).toISOString(),
      });
      showToast(lang === 'el' ? 'Καταγράφηκε!' : 'Logged!');
    } catch {
      showToast(lang === 'el' ? 'Σφάλμα καταγραφής' : 'Failed to log');
    }
    setPendingAutoLog(null);
  };

  const handleLogIntervention = (msg: Message) => {
    if (!msg.metadata?.diagnosis_data) return;
    // Toggle the inline form open/close for this message
    setInlineLogMsgId(prev => prev === msg.id ? null : msg.id);
  };

  const handleShare = async (msg: Message) => {
    if (!appUserId) { setShowLoginModal(true); return; }
    if (!msg.db_id) { showToast(lang === 'el' ? 'Παρακαλώ περιμένετε...' : 'Please wait...'); return; }
    if (!msg.metadata?.diagnosis_data) {
      // Try to re-fetch metadata from DB in case it wasn't set in state
      const { data: dbMsg } = await supabase
        .from('chat_messages')
        .select('metadata')
        .eq('id', msg.db_id)
        .single();
      if (dbMsg?.metadata?.diagnosis_data) {
        // Update message in state and retry
        dispatch({ type: 'update', id: msg.id, patch: { metadata: dbMsg.metadata } });
        // Re-run with updated msg
        await handleShareWithData({ ...msg, metadata: dbMsg.metadata });
        return;
      }
      showToast(lang === 'el' ? 'Δεν βρέθηκε διάγνωση' : 'No diagnosis found');
      return;
    }
    await handleShareWithData(msg);
  };

  const handleShareWithData = async (msg: Message) => {

    let interventionId = msg.metadata.intervention_id;
    let publicShareId = msg.metadata.share_id;

    if (!interventionId) {
      const dd = msg.metadata.diagnosis_data;
      const shareSummary = dd?.cause
        ? `${dd.problem || 'Issue detected'}. Cause: ${dd.cause}.`
        : (dd?.problem || 'Issue detected');

      const { data, error } = await supabase.from('interventions').insert({
        user_id: appUserId,
        field_id: activeFieldId || null,
        crop_type: msg.metadata.crop_mentioned || '',
        problem: dd?.problem || '',
        cause: dd?.cause || '',
        severity: dd?.severity || null,
        product_applied: dd?.product_applied || '',
        product: dd?.product_applied || '',
        dosage: dd?.dosage || '',
        application_method: dd?.application_method || '',
        organic_treatments: dd?.organic_treatments || [],
        chemical_treatments: dd?.chemical_treatments || [],
        share_summary: shareSummary,
        date: new Date().toISOString().split('T')[0],
        is_shared: true,
      }).select('id, share_id').single();

      if (data && !error) {
        interventionId = data.id;
        publicShareId = data.share_id;
        const newMetadata = { ...msg.metadata, intervention_id: interventionId, share_id: publicShareId };
        dispatch({ type: 'update', id: msg.id, patch: { metadata: newMetadata } });
        await supabase.from('chat_messages').update({ metadata: newMetadata }).eq('id', msg.db_id);
      } else {
        showToast(t.shareError);
        return;
      }
    } else {
      const { data, error } = await supabase
        .from('interventions')
        .update({ is_shared: true })
        .eq('id', interventionId)
        .select('id, share_id')
        .single();

      if (error || !data) {
        showToast(t.shareError);
        return;
      }

      publicShareId = data.share_id;

      if (publicShareId && publicShareId !== msg.metadata.share_id) {
        const newMetadata = { ...msg.metadata, intervention_id: interventionId, share_id: publicShareId };
        dispatch({ type: 'update', id: msg.id, patch: { metadata: newMetadata } });
        await supabase.from('chat_messages').update({ metadata: newMetadata }).eq('id', msg.db_id);
      }
    }

    if (!publicShareId) {
      showToast(t.shareLinkError);
      return;
    }

    const shareUrl = `${window.location.origin}/d/${publicShareId}`;
    const dd = msg.metadata?.diagnosis_data;
    const problem = dd?.problem || '';
    const crop = (msg.metadata?.crop_mentioned as string | undefined) || '';
    const shareTitle =
      problem && crop
        ? `${problem} — ${crop}`
        : problem || (lang === 'el' ? 'Διάγνωση από τον Oli' : 'Diagnosis from Oli');
    const shareText = problem || msg.content || t.shareDefaultText;
    trackEvent(Events.SHARE_DIAGNOSIS, { shareId: publicShareId });

    // Try Web Share API first (native on mobile)
    if (navigator.share) {
      try {
        await navigator.share({ title: shareTitle, text: shareText, url: shareUrl });
        showToast(t.linkCopied);
        return;
      } catch (e) {
        if ((e as Error).name === 'AbortError') return;
      }
    }

    // Try clipboard API
    try {
      await navigator.clipboard.writeText(shareUrl);
      showToast(t.linkCopied);
    } catch {
      setShareModalData({ url: shareUrl, text: shareText, title: shareTitle });
    }

    setShareModalData({ url: shareUrl, text: shareText, title: shareTitle });
  };

  useEffect(() => {
    if (appUserId) {
      supabase.from('field_context_view').select('*').eq('user_id', appUserId).then(({ data, error }) => {
        if (error) console.error('fields load error:', error.message);
        if (data) setFields(data as Field[]);
      });

      // Check for pending follow-ups, VIO multi-step loop (stack all that are due)
      supabase
        .from('interventions')
        .select('id, crop_type, diagnosis, problem, applied_at, follow_up_at, field_id, vio_step, product_applied, fields(name, crop_type)')
        .eq('user_id', appUserId)
        .lte('follow_up_at', new Date().toISOString())
        .is('outcome', null)
        .not('follow_up_at', 'is', null)
        .order('follow_up_at', { ascending: true })
        .limit(5)
        .then(({ data: due }) => {
          if (!due || due.length === 0) return;
          const fallbackCrop = lang === 'el' ? 'τη φυτεία σου' : 'your crop';
          const followUps: VioFollowUp[] = (due as Record<string, unknown>[]).map((row) => {
            const field = row.fields as { name?: string | null; crop_type?: string | null } | null;
            const cropLabel = (row.crop_type as string | null) || field?.crop_type || (row.diagnosis as string | null) || fallbackCrop;
            const problemLabel = (row.diagnosis as string | null) || (row.problem as string | null) || null;
            const step = (row.vio_step as number | null) ?? 1;
            const appliedAt = row.applied_at as string | null;
            const daysAgo = appliedAt
              ? Math.max(0, Math.floor((Date.now() - new Date(appliedAt).getTime()) / 86400000))
              : null;
            return {
              id: row.id as string,
              fieldId: (row.field_id as string | null) ?? null,
              fieldName: field?.name ?? null,
              cropLabel,
              problemLabel,
              productApplied: (row.product_applied as string | null) ?? null,
              daysAgo,
              vioStepType: step <= 1 ? 'apply_check' : 'outcome_check',
            };
          });
          setPendingVioFollowUps(followUps);
        });

      // No API call for greeting, the empty state UI already serves as the welcome.
      return;
    }
    setFields([]);
  }, [appUserId]);

  // Phase 1: capture incoming fieldId / growerName / conversationId from router state immediately,
  // before fields have loaded (fixes race condition where fields.length === 0 on navigation).
  useEffect(() => {
    const state = routeLocation.state as {
      fieldId?: string;
      conversationId?: string;
      growerName?: string; // set when navigating from a client card (no specific field)
    } | null;
    if (state?.fieldId) {
      pendingNavFieldIdRef.current = state.fieldId;
      fromFieldNavRef.current = true;
      fieldNavSentRef.current = false; // allow auto-send for this new navigation
    }
    if (state?.growerName) {
      pendingNavGrowerNameRef.current = state.growerName;
      fromGrowerNavRef.current = true;
      growerNavSentRef.current = false;
    }
    if (state?.conversationId) {
      setActiveConversationId(state.conversationId);
    }
    if (state?.fieldId || state?.conversationId || state?.growerName) {
      window.history.replaceState({}, '');
    }
  }, [routeLocation.state]);

  // Phase 2: apply pending fieldId once fields have loaded.
  useEffect(() => {
    if (!pendingNavFieldIdRef.current || fields.length === 0) return;
    const id = pendingNavFieldIdRef.current;
    if (fields.some(f => f.id === id)) {
      setActiveFieldId(id);
      pendingNavFieldIdRef.current = null;
    }
  }, [fields]);

  const prevMessageCountRef = useRef(0);
  useEffect(() => {
    const currentCount = messages.length + (isTyping ? 1 : 0);
    if (currentCount > prevMessageCountRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
    prevMessageCountRef.current = currentCount;
  }, [messages.length, isTyping]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      attachmentsRef.current.forEach((attachment) => {
        safeRevokeObjectUrl(attachment.previewUrl);
      });
      revokeMessageAttachments(messagesRef.current);
    };
  }, []);

  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = lang === 'el' ? 'el-GR' : 'en-US';

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognitionRef.current.onresult = (event: any) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          }
        }
        if (finalTranscript) {
          setInput(prev => prev + (prev ? ' ' : '') + finalTranscript);
        }
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error', event.error);
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
  }, [lang]);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      showToast(t.voiceNotSupported);
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      recognitionRef.current?.start();
      setIsListening(true);
      trackEvent(Events.VOICE_INPUT);
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    requestAnimationFrame(() => {
      el.style.height = 'auto';
      el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
    });
  };

  // ── Guest chat: send one unauthenticated message ──
  const sendGuestMessage = async (text: string) => {
    setGuestMessageSent(true);

    // Pick up any photo attached on the landing page
    let heroInline: InlineAttachment | undefined;
    let heroPreviewUrl: string | undefined;
    try {
      const raw = sessionStorage.getItem('oli_hero_attachment');
      if (raw) {
        sessionStorage.removeItem('oli_hero_attachment');
        const stored = JSON.parse(raw) as { mimeType: string; data: string; previewUrl?: string };
        heroInline = { mimeType: stored.mimeType, data: stored.data };
        heroPreviewUrl = stored.previewUrl;
      }
    } catch { /* ignore parse errors */ }

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      created_at: new Date().toISOString(),
      attachments: heroPreviewUrl ? [{ url: heroPreviewUrl, mimeType: heroInline!.mimeType, name: 'photo' }] : undefined,
    };
    dispatch({ type: 'append', message: userMsg });
    setIsTyping(true);

    try {
      const result = await guestChatCompletion(text, lang, heroInline);

      const assistantMsg: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: result.assistantText,
        created_at: new Date().toISOString(),
        metadata: result.metadata,
      };
      dispatch({ type: 'append', message: assistantMsg });

      // Persist in sessionStorage so it survives onboarding redirect
      sessionStorage.setItem(GUEST_SESSION_KEY, JSON.stringify({
        userText: text,
        assistantText: result.assistantText,
        metadata: result.metadata,
      }));

      // Mark this browser as having used the guest quota, persists across reloads
      localStorage.setItem('oli_guest_used', '1');

      trackEvent(Events.MESSAGE_SENT, { guest: true });
    } catch (err) {
      const status = typeof err === 'object' && err !== null && 'status' in err
        ? Number((err as { status?: unknown }).status)
        : undefined;

      if (status === 429) {
        sessionStorage.setItem('oli_pending_input', text);
        setShowLoginModal(true);
        setIsTyping(false);
        return;
      }

      const errMsg = err instanceof Error ? err.message : null;
      const fallback = lang === 'el'
        ? 'Κάτι πήγε στραβά. Δοκίμασε ξανά σε λίγο.'
        : 'Something went wrong. Please try again in a moment.';
      dispatch({ type: 'append', message: {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: (errMsg && errMsg.length < 200) ? errMsg : fallback,
        created_at: new Date().toISOString(),
      }});
    } finally {
      setIsTyping(false);
    }
  };

  // Persist unsent draft to sessionStorage so it survives navigation → login → return.
  // Uses a 30-min TTL so stale drafts from old sessions never bleed in.
  // NOT cleared on unmount — intentional, so OAuth redirect → return restores the draft.
  useEffect(() => {
    if (input) {
      sessionStorage.setItem('oli_draft_input', JSON.stringify({ text: input, expires: Date.now() + 30 * 60 * 1000 }));
    } else {
      sessionStorage.removeItem('oli_draft_input');
    }
  }, [input]);

  // Auto-send landing-page query from ?q= for guests and authenticated users.
  useEffect(() => {
    if (!guestQuery || queryMessageSentRef.current) return;

    const text = decodeURIComponent(guestQuery);

    if (user && appUserId && !isGuestMode) {
      queryMessageSentRef.current = true;
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('q');
      setSearchParams(newParams, { replace: true });
      sessionStorage.removeItem('oli_draft_input');
      setInput('');
      handleSend(text);
      return;
    }

    if (guestAlreadyUsed && !user) {
      queryMessageSentRef.current = true;
      sessionStorage.setItem('oli_pending_input', text);
      setShowLoginModal(true);
      return;
    }

    if (!isGuestMode || guestMessageSent) return;

    queryMessageSentRef.current = true;
    // Clear the ?q= param to prevent re-send on re-render
    const newParams = new URLSearchParams(searchParams);
    newParams.delete('q');
    setSearchParams(newParams, { replace: true });

    // Clear any stale draft, the ?q= param is the canonical input here
    sessionStorage.removeItem('oli_draft_input');
    setInput('');

    sendGuestMessage(text);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guestQuery, isGuestMode, appUserId, user?.id]);

  // Auto-send ?prompt= deep-link (weekly engagement emails, agronomist client links, etc.)
  // Only fires for authenticated users — guests use the ?q= flow instead.
  useEffect(() => {
    if (!promptParam || promptSentRef.current) return;
    if (!user || !appUserId) return;
    promptSentRef.current = true;
    const text = decodeURIComponent(promptParam);
    const next = new URLSearchParams(searchParams);
    next.delete('prompt');
    setSearchParams(next, { replace: true });
    sessionStorage.removeItem('oli_draft_input');
    setInput('');
    // Defer one tick so handleSend has the latest closure
    setTimeout(() => { void handleSend(text); }, 0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [promptParam, user?.id, appUserId]);

  // Migrate guest messages after login + onboarding
  useEffect(() => {
    if (!appUserId) return;

    sessionStorage.removeItem(GUEST_CHAT_ENTRY_KEY);

    // User is now authenticated — clear the guest quota flag so it doesn't affect their experience
    localStorage.removeItem('oli_guest_used');

    // Restore any question that was pending before login (e.g. from ?q= when quota was used)
    const pendingInput = sessionStorage.getItem('oli_pending_input');
    if (pendingInput) {
      sessionStorage.removeItem('oli_pending_input');
      setInput(pendingInput);
    }

    const raw = sessionStorage.getItem(GUEST_SESSION_KEY);
    if (!raw) return;

    sessionStorage.removeItem(GUEST_SESSION_KEY);
    setIsGuestMode(false);

    let guestData: { userText: string; assistantText: string; metadata?: Record<string, unknown> };
    try {
      guestData = JSON.parse(raw);
    } catch {
      return;
    }

    (async () => {
      // Create conversation
      const { data: conv } = await supabase.from('conversations').insert({
        user_id: appUserId,
        grower_id: activeGrowerId ?? null,
        field_id: activeFieldId ?? null,
        title: guestData.userText.slice(0, 50) + ' – ' + new Date().toLocaleString('en', { month: 'short', year: 'numeric' }),
      }).select('id').single();

      if (conv?.id) {
        setActiveConversationId(conv.id);
        setSidebarRefresh(n => n + 1);

        // Insert user message
        await supabase.from('chat_messages').insert({
          conversation_id: conv.id,
          user_id: appUserId,
          role: 'user',
          content: guestData.userText,
        });

        // Insert assistant message
        await supabase.from('chat_messages').insert({
          conversation_id: conv.id,
          user_id: appUserId,
          role: 'assistant',
          content: guestData.assistantText,
          metadata: { ...(guestData.metadata ?? {}), source: 'guest-migration' },
        });
      }

      // Count the guest message once the migrated conversation is attached to the account.
      const currentCount = sameCalendarMonth(profile?.message_reset_date)
        ? (profile?.message_count_month ?? 0)
        : 0;
      await supabase.from('users').update({
        message_count_month: currentCount + 1,
        message_reset_date: new Date().toISOString(),
      }).eq('id', appUserId);
      setMessageCount(currentCount + 1);
      refreshProfile({ preserveExisting: true }).catch(() => {});

      // Re-load messages for the new conversation
      if (conv?.id) {
        const { data: msgs } = await supabase.from('chat_messages')
          .select('id, role, content, created_at, metadata, starred, image_urls')
          .eq('conversation_id', conv.id)
          .order('created_at', { ascending: true });

        if (msgs) {
          dispatch({ type: 'set', messages: msgs.map(m => ({
            id: m.id,
            db_id: m.id,
            role: m.role as 'user' | 'assistant',
            content: m.content,
            created_at: m.created_at,
            metadata: m.metadata as Record<string, unknown> | undefined,
            starred: m.starred,
            attachments: m.image_urls?.map((u: string) => ({
              url: u,
              mimeType: inferMimeTypeFromPath(u),
              name: u.split('/').pop() ?? 'attachment',
            })),
          }))});
        }
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appUserId]);

  const sendMessageToAI = async (
    currentMessages: Message[],
    userText: string,
    currentActiveFieldId: string | undefined,
    currentConversationId: string | undefined,
    base64Images?: InlineAttachment[],
    attachmentPaths?: string[]
  ) => {
    // Cancel any in-flight request
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsTyping(true);

    const recentMessages = currentMessages.slice(-10);
    const latestUserMessage = [...recentMessages].reverse().find((message) => message.role === 'user');
    const latestUserMessageId = latestUserMessage?.id;
    const latestInlineAttachments = base64Images ?? latestUserMessage?.inlineAttachments ?? [];
    const latestAttachmentPaths = attachmentPaths ?? latestUserMessage?.attachmentPaths ?? [];

    const assistantMsgId = crypto.randomUUID();
    let messageAdded = false;
    let streamedContent = '';

    try {
      // Field and treatment history are assembled server-side so the backend
      // stays authoritative as we expand field memory.
      const fieldContext = '';
      const completion = await streamChatCompletion(
        {
          messages: recentMessages.map((message) => ({
            role: message.role,
            content: message.content,
            attachments:
              message.role === 'user' && message.id === latestUserMessageId && latestInlineAttachments.length > 0
                ? latestInlineAttachments
                : undefined,
          })),
          fieldContext,
          hasActiveField: !!currentActiveFieldId,
          fieldId: currentActiveFieldId || null,
          growerId: activeGrowerId || null,
          conversationId: currentConversationId || null,
          userMessageId: null,
          attachmentPaths: latestAttachmentPaths,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          lang,
        },
        {
          signal: controller.signal,
          onToken: (token) => {
            if (controller.signal.aborted) return;
            streamedContent += token;
            if (!messageAdded) {
              messageAdded = true;
              dispatch({ type: 'append', message: { id: assistantMsgId, role: 'assistant', content: streamedContent, created_at: new Date().toISOString() } });
            } else {
              dispatch({ type: 'update', id: assistantMsgId, patch: { content: streamedContent } });
            }
          },
        }
      );

      if (controller.signal.aborted) return;

      const finalContent = streamedContent || completion.assistantText;
      if (!messageAdded && finalContent) {
        dispatch({ type: 'append', message: { id: assistantMsgId, role: 'assistant', content: finalContent, created_at: new Date().toISOString() } });
        messageAdded = true;
      }

      // Finalize assistant + user messages in one batch
      const updates: Array<{ id: string; patch: Partial<Message> }> = [
        { id: assistantMsgId, patch: { content: streamedContent || completion.assistantText, db_id: completion.assistantMessageId || undefined, metadata: completion.metadata } },
      ];
      if (latestUserMessageId && completion.userMessageId) {
        updates.push({ id: latestUserMessageId, patch: { db_id: completion.userMessageId } });
      }
      dispatch({ type: 'batch_update', updates });

      // Set isTyping false AFTER the final message content is finalized
      setIsTyping(false);

      if (typeof completion.messageCountMonth === 'number') {
        setMessageCount(completion.messageCountMonth);
        if (!hasUnlimitedMessages) {
          const remaining = FREE_LIMIT - completion.messageCountMonth;
          if (remaining > 0 && remaining <= PAYWALL_WARNING_MESSAGES_REMAINING) {
            setShowPaywallWarning(true);
          }
        }
      }

      let resolvedConversationId = completion.conversationId;
      if (!resolvedConversationId && !currentConversationId) {
        resolvedConversationId = await recoverConversationLink(
          userText,
          completion.fieldId ?? currentActiveFieldId ?? null,
          completion.userMessageId ?? latestUserMessage?.db_id ?? null,
          completion.assistantMessageId ?? null,
        );
      }

      if (resolvedConversationId && resolvedConversationId !== currentConversationId) {
        setActiveConversationId(resolvedConversationId);
        setSidebarRefresh(n => n + 1);
      }

      if (completion.fieldId && completion.fieldId !== currentActiveFieldId) {
        setActiveFieldId(completion.fieldId);
      }

      // Auto-log detection: only prompt in field chat. VIO is per-field, so in
      // general chat there is nothing to track and the banner would create an
      // orphan intervention. (completion.fieldId may have just set the field above.)
      const detected = completion.metadata?.action_detected;
      const autoLogFieldId = completion.fieldId ?? activeFieldId;
      if (autoLogFieldId && detected && typeof detected === 'object' && 'action_type' in detected && 'confidence' in detected) {
        setPendingAutoLog(detected as ActionDetected);
      }

      // Reminder chip: show confirmation when AI created a scheduled reminder
      if (completion.scheduleReminder) {
        setReminderChip({ task: completion.scheduleReminder.task, due_days: completion.scheduleReminder.due_days });
        setTimeout(() => setReminderChip(null), 6000);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setIsTyping(false);
      const status = typeof error === 'object' && error !== null && 'status' in error
        ? Number((error as { status?: unknown }).status)
        : undefined;
      const code = typeof error === 'object' && error !== null && 'code' in error
        ? String((error as { code?: unknown }).code)
        : undefined;
      const latestUserMessagePersisted = !!latestUserMessage?.db_id;

      // Only remove unpersisted user message if no partial content was streamed
      if (!streamedContent && latestUserMessageId && !latestUserMessagePersisted && !controller.signal.aborted) {
        dispatch({ type: 'filter', predicate: (msg) => msg.id !== latestUserMessageId });
        setInput((currentInput) => currentInput || userText);
      }

      // 401, session expired. Try to refresh silently; if that fails, redirect to /auth.
      if (status === 401) {
        dispatch({ type: 'filter', predicate: (msg) => !(msg.role === 'assistant' && !msg.content) });
        if (latestUserMessageId && !latestUserMessagePersisted) {
          dispatch({ type: 'filter', predicate: (msg) => msg.id !== latestUserMessageId });
          setInput((currentInput) => currentInput || userText);
        }
        try {
          const { error: refreshError } = await supabase.auth.refreshSession();
          if (refreshError) throw refreshError;
          // Session refreshed, restore input so user can resend
          showToast(
            lang === 'el'
              ? 'Η σύνδεσή σου ανανεώθηκε. Δοκίμασε ξανά.'
              : 'Session refreshed. Please try again.',
          );
        } catch {
          // Refresh failed, session is dead, send to auth
          showToast(
            lang === 'el'
              ? 'Η σύνδεσή σου έληξε. Παρακαλώ συνδέσου ξανά.'
              : 'Your session has expired. Please sign in again.',
          );
          setTimeout(() => navigate('/auth', { replace: true }), 1500);
        }
        return;
      }

      if (status === 429) {
        if (!latestUserMessagePersisted && latestAttachmentPaths.length > 0) {
          await cleanupUploadedAssets(latestAttachmentPaths);
        }

        dispatch({ type: 'filter', predicate: (msg) => !(msg.role === 'assistant' && !msg.content) });
        if (code === 'monthly_limit') {
          setShowPaywall(true);
        } else {
          showToast(
            lang === 'el'
              ? 'Περίμενε ένα στιγμιότυπο πριν στείλεις νέο μήνυμα.'
              : 'Please wait a moment before sending another message.',
          );
        }
        return;
      }

      // 503, AI service temporarily at capacity (Gemini quota exhausted across all models)
      if (status === 503) {
        if (!latestUserMessagePersisted && latestAttachmentPaths.length > 0) {
          await cleanupUploadedAssets(latestAttachmentPaths);
        }
        dispatch({ type: 'filter', predicate: (msg) => !(msg.role === 'assistant' && !msg.content) });
        if (streamedContent.length > 0) {
          dispatch({ type: 'update', id: assistantMsgId, patch: { interrupted: true, retryText: userText } });
        } else if (!messageAdded) {
          const capacityMsg = lang === 'el'
            ? 'Η υπηρεσία AI είναι προσωρινά σε πλήρη χρήση. Δοκίμασε ξανά σε λίγα λεπτά.'
            : 'AI service is temporarily at capacity. Please try again in a few minutes.';
          dispatch({
            type: 'append',
            message: {
              id: assistantMsgId,
              role: 'assistant',
              content: capacityMsg,
              created_at: new Date().toISOString(),
              interrupted: true,
              retryText: userText,
            },
          });
        } else {
          const capacityMsg = lang === 'el'
            ? 'Η υπηρεσία AI είναι προσωρινά σε πλήρη χρήση. Δοκίμασε ξανά σε λίγα λεπτά.'
            : 'AI service is temporarily at capacity. Please try again in a few minutes.';
          dispatch({ type: 'update_by', predicate: (msg) => msg.role === 'assistant' && !msg.content, patch: { content: capacityMsg, interrupted: true, retryText: userText } });
        }
        return;
      }

      if (typeof status === 'number' && !latestUserMessagePersisted && latestAttachmentPaths.length > 0) {
        await cleanupUploadedAssets(latestAttachmentPaths);
      }

      // If partial content was streamed, mark message as interrupted (keep content + show retry)
      // Otherwise show error text on the empty assistant bubble with retry option
      if (streamedContent.length > 0) {
        dispatch({ type: 'update', id: assistantMsgId, patch: { interrupted: true, retryText: userText } });
      } else if (!messageAdded) {
        dispatch({
          type: 'append',
          message: {
            id: assistantMsgId,
            role: 'assistant',
            content: t.connectionError,
            created_at: new Date().toISOString(),
            interrupted: true,
            retryText: userText,
          },
        });
      } else {
        dispatch({ type: 'update_by', predicate: (msg) => msg.role === 'assistant' && !msg.content, patch: { content: t.connectionError, interrupted: true, retryText: userText } });
      }
    } finally {
      const latestUserMessage = [...currentMessages].reverse().find((message) => message.role === 'user');
      if (latestUserMessage?.id) {
        dispatch({ type: 'update', id: latestUserMessage.id, patch: { inlineAttachments: undefined, attachmentPaths: undefined } });
      }
    }
  };

  /** Returns true if the message looks like a history / "show me what I did" query. */
  const isHistoryQuery = (text: string): boolean => {
    const t = text.toLowerCase();
    const historyKeywords = [
      'show me', 'δείξε μου', 'ιστορικό', 'history', 'what did i do', 'τι έκανα',
      'τι έχω κάνει', 'what have i done', 'παρεμβάσεις', 'interventions',
      'last month', 'πέρσι', 'τελευταίο μήνα', 'last week', 'τελευταία εβδομάδα',
      'τι εφάρμοσα', 'what did i apply', 'show history', 'δες ιστορικό',
    ];
    return historyKeywords.some(kw => t.includes(kw));
  };

  /** Handles a history query: queries DB, appends user + HistoryCard assistant messages. */
  const handleHistoryQuery = async (text: string) => {
    if (!appUserId) return;
    const userMsgId = crypto.randomUUID();
    const assistantMsgId = crypto.randomUUID();
    const now = new Date().toISOString();

    // Add user message immediately
    dispatch({ type: 'append', message: { id: userMsgId, role: 'user', content: text, created_at: now } });
    setInput('');
    setIsTyping(true);

    try {
      // Determine field filter from context or text
      let fieldId: string | null = activeFieldId ?? null;

      // Check if a specific field is mentioned in the text
      if (!fieldId && fields.length > 0) {
        const lower = text.toLowerCase();
        const matched = fields.find(f => lower.includes(f.name.toLowerCase()));
        if (matched) fieldId = matched.id;
      }

      // Query interventions
      let query = supabase
        .from('interventions')
        .select('id, problem, cause, severity, product_applied, created_at, outcome, field_id, fields(name, crop_type)')
        .eq('user_id', appUserId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (fieldId) query = query.eq('field_id', fieldId);

      // Date filter if "last month" / "last week" mentioned
      const lower = text.toLowerCase();
      if (lower.includes('last month') || lower.includes('τελευταίο μήνα') || lower.includes('τελευταίο μήνα')) {
        const cutoff = new Date();
        cutoff.setMonth(cutoff.getMonth() - 1);
        query = query.gte('created_at', cutoff.toISOString());
      } else if (lower.includes('last week') || lower.includes('τελευταία εβδομάδα')) {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 7);
        query = query.gte('created_at', cutoff.toISOString());
      }

      const { data } = await query;
      const diagnoses: HistoryDiagnosis[] = (data ?? []).map((d: Record<string, unknown>) => ({
        id: String(d.id),
        problem: d.problem as string | null,
        cause: d.cause as string | null,
        severity: d.severity as string | null,
        product_applied: d.product_applied as string | null,
        created_at: String(d.created_at),
        outcome: d.outcome as string | null,
        field_name: (d.fields as { name?: string } | null)?.name ?? null,
        field_crop: (d.fields as { crop_type?: string } | null)?.crop_type ?? null,
      }));

      const count = diagnoses.length;
      const responseText = count === 0
        ? (lang === 'el' ? 'Δεν βρέθηκαν παρεμβάσεις.' : 'No interventions found.')
        : (lang === 'el'
            ? `Βρήκα ${count} παρέμβαση${count !== 1 ? 'εις' : ''}.`
            : `Found ${count} intervention${count !== 1 ? 's' : ''}.`);

      dispatch({ type: 'append', message: {
        id: assistantMsgId,
        role: 'assistant',
        content: responseText,
        created_at: new Date().toISOString(),
        metadata: { history_data: diagnoses, history_field_id: fieldId },
      }});
    } catch {
      dispatch({ type: 'append', message: {
        id: assistantMsgId,
        role: 'assistant',
        content: lang === 'el' ? 'Δεν μπόρεσα να φορτώσω το ιστορικό.' : 'Could not load history.',
        created_at: new Date().toISOString(),
      }});
    } finally {
      setIsTyping(false);
    }
  };

  const handleSend = async (text: string = input) => {
    const messageText = text.trim() || input.trim();
    if ((!messageText && attachments.length === 0) || isTyping) return;

    // Offline, queue the message and show feedback
    if (!navigator.onLine && messageText) {
      await enqueueMessage({ id: crypto.randomUUID(), text: messageText, enqueuedAt: Date.now() });
      setInput('');
      showToast(
        lang === 'el'
          ? 'Χωρίς σύνδεση, το μήνυμα θα σταλεί αυτόματα όταν επιστρέψει το internet'
          : 'Offline, your message will send automatically when you reconnect',
      );
      return;
    }

    // History query, intercept before sending to AI, handle locally with DB query
    if (messageText && !isGuestMode && appUserId && isHistoryQuery(messageText) && attachments.length === 0) {
      await handleHistoryQuery(messageText);
      return;
    }

    // Guest mode: gate 2nd message with login modal, save pending input so it survives login
    if (isGuestMode) {
      if (messageText) sessionStorage.setItem('oli_pending_input', messageText);
      setShowLoginModal(true);
      trackEvent(Events.PAYWALL_HIT, { guest: true });
      return;
    }

    if (!appUserId) {
      // Profile is still loading, queue the message and let the effect
      // below drain it as soon as appUserId becomes available. The user's
      // text is already in the input so no work is lost.
      if (messageText) {
        pendingMessageRef.current = messageText;
        // Keep input populated so user sees their text wasn't dropped
        setInput(messageText);
      }
      return;
    }

    if (!hasUnlimitedMessages && messageCount >= FREE_LIMIT) {
      setShowPaywall(true);
      trackEvent(Events.PAYWALL_HIT, { messageCount });
      return;
    }

    const now = Date.now();
    if (now - lastSendAttemptRef.current < 2000) {
      showToast(
        lang === 'el'
          ? 'Περίμενε ένα στιγμιότυπο πριν στείλεις νέο μήνυμα.'
          : 'Please wait a moment before sending another message.',
      );
      return;
    }
    lastSendAttemptRef.current = now;

    let finalMessageText = messageText;
    let uploadedPaths: string[] = [];
    let base64Images: { mimeType: string; data: string }[] = [];
    let messageAttachments: Array<{ url: string; mimeType: string; name: string }> = [];

    if (attachments.length > 0) {
      const prepared = await prepareAttachmentsForSend({
        attachments,
        userId: user?.id,
        showToast,
      });
      uploadedPaths = prepared.uploadedPaths;
      base64Images = prepared.inlineAttachments;
      messageAttachments = prepared.messageAttachments;
      if (prepared.attachmentSummary) {
        finalMessageText = `[The user attached ${prepared.attachmentSummary}. Analyze every attachment carefully for crop disease, pest damage, physiological issues, or any relevant document details.]\n${finalMessageText}`;
      }
    }

    const newUserMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: finalMessageText,
      created_at: new Date().toISOString(),
      inlineAttachments: base64Images,
      attachmentPaths: uploadedPaths,
      attachments: messageAttachments,
    };

    dispatch({ type: 'append', message: newUserMsg });
    setInput('');
    setAttachments([]);

    // Analytics
    const hasPhotos = base64Images.length > 0 || uploadedPaths.length > 0;
    trackEvent(Events.MESSAGE_SENT, { hasPhotos, messageCount: messageCount + 1 });
    if (hasPhotos) trackEvent(Events.FIRST_PHOTO);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    // No extraction pipeline, the main Gemini call already returns crop_mentioned
    // in its response metadata. This saves a second API call per message.
    const currentActiveFieldId = activeFieldId;

    await sendMessageToAI(
      [...messages, newUserMsg],
      finalMessageText,
      currentActiveFieldId,
      activeConversationId,
      base64Images,
      uploadedPaths
    );
  };

  // Keep ref current so the online-drain callback can call handleSend
  handleSendRef.current = handleSend;

  // Drain a pending first message as soon as appUserId becomes available.
  // Fires when the user typed and hit send before the profile lookup completed.
  useEffect(() => {
    if (!appUserId) return;
    const pending = pendingMessageRef.current;
    if (!pending) return;
    pendingMessageRef.current = null;
    // Defer to next tick so the latest closure of handleSend (with appUserId set)
    // is the one that runs.
    const t = setTimeout(() => { void handleSend(pending); }, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appUserId]);

  // Auto-send field intro message when the user navigates to chat from a field page.
  // Fires once activeField + appUserId are both ready; uses fieldNavSentRef to prevent double-send.
  useEffect(() => {
    if (!fromFieldNavRef.current || fieldNavSentRef.current) return;
    if (!activeField || !appUserId) return;

    fieldNavSentRef.current = true;
    fromFieldNavRef.current = false;

    const text = lang === 'el'
      ? `Θέλω να μιλήσω για το χωράφι μου «${activeField.name}»${activeField.crop_type ? ` (${activeField.crop_type})` : ''}.`
      : `I want to discuss my field "${activeField.name}"${activeField.crop_type ? ` (${activeField.crop_type})` : ''}.`;

    // Defer to next tick so handleSendRef is up-to-date with current closure
    const t = setTimeout(() => { void handleSendRef.current?.(text); }, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeField?.id, appUserId]);

  // Auto-send grower intro message when navigating from a client card (no specific field).
  // Fires once activeGrowerId + appUserId are both ready; growerNavSentRef prevents double-send.
  useEffect(() => {
    if (!fromGrowerNavRef.current || growerNavSentRef.current) return;
    if (!activeGrowerId || !appUserId) return;
    const name = pendingNavGrowerNameRef.current;
    if (!name) return;

    growerNavSentRef.current = true;
    fromGrowerNavRef.current = false;
    pendingNavGrowerNameRef.current = null;

    const text = lang === 'el'
      ? `Δώσε μου μια σύνοψη για τον παραγωγό «${name}» — τι καλλιέργειες και χωράφια έχει και αν υπάρχει κάτι που χρειάζεται την προσοχή μου.`
      : `Give me a summary for farmer "${name}" — what crops and fields they have, and if there's anything that needs my attention.`;

    const t = setTimeout(() => { void handleSendRef.current?.(text); }, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeGrowerId, appUserId]);

  // Disambiguation removed, field context detected silently from AI response metadata.

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const clearChat = () => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    loadGenerationRef.current += 1; // L2: invalidate any in-flight conversation loads
    attachments.forEach((attachment) => {
      safeRevokeObjectUrl(attachment.previewUrl);
    });
    revokeMessageAttachments(messages);
    attachmentsRef.current = [];
    messagesRef.current = [];
    dispatch({ type: 'clear' });
    setAttachments([]);
    setInput('');
    setIsTyping(false);
    setActiveConversationId(undefined);
    setActiveFieldId(undefined); // Reset field context, each chat starts fresh
    setActiveGrowerId(undefined); // Reset grower context too (advisors)
    fromFieldNavRef.current = false;
    fieldNavSentRef.current = false;
    fromGrowerNavRef.current = false;
    growerNavSentRef.current = false;
    pendingNavGrowerNameRef.current = null;
    setShowAttachmentSheet(false);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const formatTime = (isoString: string) => {
    const locale = lang === 'el' ? 'el-GR' : 'en-US';
    return new Date(isoString).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  };


  const handleSidebarSelect = async (id: string) => {
    clearChat();
    const thisGeneration = loadGenerationRef.current;
    setSidebarLoading(true);
    setActiveConversationId(id);
    try {
      // Restore field + grower context for this conversation
      const { data: convData } = await supabase
        .from('conversations')
        .select('field_id, grower_id')
        .eq('id', id)
        .single();
      if (loadGenerationRef.current !== thisGeneration) return; // stale load
      if (convData?.field_id) {
        setActiveFieldId(convData.field_id);
      } else {
        setActiveFieldId(undefined);
      }
      if (convData?.grower_id) {
        setActiveGrowerId(convData.grower_id);
      } else {
        setActiveGrowerId(undefined);
      }

      const { data } = await supabase
        .from('chat_messages')
        .select('id, role, content, metadata, starred, image_urls, created_at')
        .eq('conversation_id', id)
        .order('created_at', { ascending: true })
        .limit(50);
      if (loadGenerationRef.current !== thisGeneration) return; // stale load
      if (data) {
        // L2: Track all blob URLs created during this load so we can revoke them if the load goes stale.
        const blobUrlsCreated: string[] = [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const messages: Message[] = await Promise.all(data.map(async (m: any) => {
          const base: Message = {
            id: m.id, db_id: m.id, role: m.role, content: m.content,
            metadata: m.metadata, starred: m.starred, created_at: m.created_at,
          };
          // Resolve stored image paths into displayable URLs
          if (Array.isArray(m.image_urls) && m.image_urls.length > 0) {
            const attachments: NonNullable<Message['attachments']> = [];
            const uncached: string[] = [];
            const cachedMap = await getCachedImages(m.image_urls);
            for (const path of m.image_urls) {
              const mimeType = inferMimeTypeFromPath(path);
              const name = path.split('/').pop() ?? 'attachment';
              const cached = cachedMap.get(path);
              if (cached && mimeType.startsWith('image/')) {
                blobUrlsCreated.push(cached);
                attachments.push({ url: cached, mimeType, name });
              } else {
                uncached.push(path);
              }
            }
            if (uncached.length > 0) {
              const { data: signed } = await supabase.storage
                .from('chat_uploads')
                .createSignedUrls(uncached, SIGNED_URL_EXPIRY);
              if (signed) {
                for (const s of signed) {
                  if (s.signedUrl) {
                    const path = s.path || '';
                    attachments.push({
                      url: s.signedUrl,
                      mimeType: inferMimeTypeFromPath(path),
                      name: path.split('/').pop() ?? 'attachment',
                    });
                  }
                }
              }
            }
            if (attachments.length > 0) base.attachments = attachments;
          }
          return base;
        }));
        if (loadGenerationRef.current !== thisGeneration) {
          blobUrlsCreated.forEach(url => URL.revokeObjectURL(url));
          return;
        }
        dispatch({ type: 'set', messages });
      }
    } finally {
      if (loadGenerationRef.current === thisGeneration) {
        setSidebarLoading(false);
      }
    }
  };

  const removeVioFollowUp = (id: string) =>
    setPendingVioFollowUps(prev => prev.filter(x => x.id !== id));

  // Open the conversation a VIO follow-up refers to: the field's most recent
  // thread, or the field detail page if no conversation exists yet.
  const openFollowUpContext = async (fieldId: string) => {
    setSidebarOpen(false);
    try {
      const { data } = await supabase
        .from('conversations')
        .select('id')
        .eq('field_id', fieldId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data?.id) {
        await handleSidebarSelect(data.id);
        return;
      }
    } catch {
      // fall through to field page
    }
    navigate(`/fields/${fieldId}`);
  };

  const messageListProps = {
    messages,
    isTyping,
    t,
    lang,
    messagesEndRef,
    onStar: handleStarMessage,
    onFeedback: handleFeedback,
    onLogIntervention: handleLogIntervention,
    onShare: handleShare,
    onVioApplyConfirm: handleVioApplyConfirm,
    onOutcome: handleOutcome,
    onRetry: (text: string) => handleSend(text),
    inlineLogMsgId,
    onInlineLogClose: () => setInlineLogMsgId(null),
    onInlineLogSuccess: (interventionId: string) => {
      setInlineLogMsgId(null);
      showToast(lang === 'el' ? 'Καταγράφηκε! Θα επικοινωνήσω σε 7 μέρες.' : 'Logged! I\'ll follow up in 7 days.');
      // Mark the message as having an intervention logged
      if (inlineLogMsgId) {
        dispatch({ type: 'update', id: inlineLogMsgId, patch: { metadata: { ...messages.find(m => m.id === inlineLogMsgId)?.metadata, intervention_id: interventionId } } });
      }
    },
    userId: appUserId ?? undefined,
    activeFieldId,
    userLat: typeof profile?.location_lat === 'number' ? profile.location_lat : null,
    userLon: typeof profile?.location_lon === 'number' ? profile.location_lon : null,
    onGenerateReport: (fieldId: string | null) => {
      if (fieldId) {
        navigate(`/fields/${fieldId}?report=1`);
      } else if (activeFieldId) {
        navigate(`/fields/${activeFieldId}?report=1`);
      } else if (fields.length > 0) {
        navigate(`/fields/${fields[0].id}?report=1`);
      } else {
        navigate('/fields');
      }
    },
    onRequestPhoto: () => setShowAttachmentSheet(true),
  };

  const inputBarProps = {
    input,
    attachments,
    isTyping,
    isListening,
    hasUnlimitedMessages,
    messageCount,
    showAttachmentSheet,
    t,
    lang,
    textareaRef,
    fileInputRef,
    cameraInputRef,
    onInput: handleInput,
    onKeyDown: handleKeyDown,
    onSend: () => handleSend(),
    onFileSelect: handleFileSelect,
    onRemoveAttachment: removeAttachment,
    onToggleListening: toggleListening,
    onToggleAttachmentSheet: setShowAttachmentSheet,
    activeField: activeField ? { name: activeField.name, crop_type: activeField.crop_type } : null,
    onChangeField: fields.length > 0 ? () => setSidebarOpen(true) : undefined,
  };

  const desktopInputBarProps = {
    ...inputBarProps,
    textareaRef: desktopTextareaRef,
  };

  return (
    <div className="flex h-[100dvh] bg-background overflow-hidden pt-safe">

      {/* ── DESKTOP: permanent sidebar (hidden in guest mode) ── */}
      {!isGuestMode && (
        <div className="hidden md:block flex-shrink-0">
          <ConversationSidebar isOpen={true} onClose={() => {}} desktop={true}
            activeId={activeConversationId} onSelect={handleSidebarSelect} onNewChat={clearChat}
            refreshSignal={sidebarRefresh} />
        </div>
      )}

      {/* ── MOBILE: slide-over sidebar (hidden in guest mode) ── */}
      {!isGuestMode && (
        <div className="md:hidden">
          <ConversationSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)}
            activeId={activeConversationId} onSelect={handleSidebarSelect} onNewChat={clearChat}
            refreshSignal={sidebarRefresh} />
        </div>
      )}

      {/* ── MAIN AREA ── */}
      <main className="flex flex-1 flex-col min-w-0">

        {/* Desktop guest header, sign-in bar, only shown in guest mode on md+ */}
        {isGuestMode && (
          <header className="hidden md:flex h-12 flex-shrink-0 items-center justify-between border-b border-border/50 bg-surface px-6">
            <OliHomeLink size={18} />
            <button
              onClick={() => { if (input.trim()) sessionStorage.setItem('oli_pending_input', input.trim()); setShowLoginModal(true); }}
              className="text-sm font-semibold text-white px-4 py-1.5 rounded-full"
              style={{ background: 'linear-gradient(135deg, #194121 0%, #305936 100%)' }}
            >
              {lang === 'el' ? 'Σύνδεση' : 'Sign in'}
            </button>
          </header>
        )}

        {/* Mobile header */}
        <header className="md:hidden flex h-12 flex-shrink-0 items-center justify-between border-b border-border/50 bg-surface px-4">
          <div className="flex items-center gap-3">
            {!isGuestMode && (
              <button onClick={() => setSidebarOpen(true)} aria-label="Open menu" className="text-muted hover:text-foreground transition-colors">
                <Menu className="h-5 w-5" />
              </button>
            )}
            <OliHomeLink size={18} />
          </div>
          {isGuestMode ? (
            <button
              onClick={() => { if (input.trim()) sessionStorage.setItem('oli_pending_input', input.trim()); setShowLoginModal(true); }}
              className="text-sm font-semibold text-white px-4 py-1.5 rounded-full"
              style={{ background: 'linear-gradient(135deg, #194121 0%, #305936 100%)' }}
            >
              {lang === 'el' ? 'Σύνδεση' : 'Sign in'}
            </button>
          ) : (
            <button onClick={clearChat} aria-label="New chat" className="text-muted hover:text-foreground transition-colors">
              <SquarePen className="h-5 w-5" />
            </button>
          )}
        </header>

        {/* Desktop: no top header, sidebar owns all navigation */}

        {/* ── OFFLINE BANNER ── */}
        {!isOnline && (
          <div className="flex items-center justify-center gap-2 bg-amber-500/15 px-4 py-2 text-xs font-medium text-amber-700 dark:text-amber-400">
            <span>●</span>
            <span>{lang === 'el' ? 'Δεν υπάρχει σύνδεση, τα μηνύματα δεν αποστέλλονται' : 'No internet connection, messages cannot be sent'}</span>
          </div>
        )}

        {/* ── VIO FOLLOW-UP CARDS (empty-home state) ── */}
        {!isGuestMode && messages.length === 0 && pendingVioFollowUps.map(item => (
          <VioFollowUpCard
            key={item.id}
            item={item}
            className="mx-4 mt-3"
            onApply={(id, applied) => { handleVioApplyConfirm(id, applied, `vio-banner-${id}`); removeVioFollowUp(id); }}
            onOutcome={(id, outcome) => { handleOutcome(id, outcome, `vio-banner-${id}`); removeVioFollowUp(id); }}
            onOpen={openFollowUpContext}
            onDismiss={removeVioFollowUp}
          />
        ))}

        {/* ── DESKTOP WELCOME (no messages) ── */}
        {messages.length === 0 && (
          <div className="hidden md:flex flex-1 flex-col items-center justify-center px-8 animate-fade-in">
            <div className="w-full max-w-2xl">
              <div className="mb-3 flex items-center justify-center gap-3">
                <OliLogo size={40} bg="#0D1117" />
                <h1 className="text-4xl font-semibold text-primary">Oli</h1>
              </div>
              <p className="mb-1 text-center text-xl font-medium text-foreground">{t.welcomeTitle}</p>
              <p className="mb-8 text-center text-sm text-muted">{dynamicGreeting || t.welcomeSubtitle}</p>
              <div className="mb-6 grid grid-cols-3 gap-4">
                {[
                  { title: t.feature1Title, desc: t.feature1Desc, icon: '📷' },
                  { title: t.feature2Title, desc: t.feature2Desc, icon: '🧠' },
                  { title: t.feature3Title, desc: t.feature3Desc, icon: '📋' },
                ].map((f, i) => (
                  <div key={i} className="rounded-2xl border border-border/50 bg-surface p-4 text-left">
                    <div className="mb-2 text-2xl">{f.icon}</div>
                    <p className="text-sm font-medium text-foreground">{f.title}</p>
                    <p className="mt-1 text-xs text-muted leading-relaxed">{f.desc}</p>
                  </div>
                ))}
              </div>
              <div className="mb-5 grid grid-cols-2 gap-3">
                {t.suggestions.map((sugg, i) => (
                  <button key={i} onClick={() => handleSend(sugg)}
                    className="rounded-2xl border border-border/50 bg-surface px-4 py-3 text-left text-sm text-foreground transition-all hover:border-primary/40 hover:bg-primary/5 active:scale-[0.98]">
                    {sugg}
                  </button>
                ))}
              </div>
              <div className="rounded-[28px] border border-border/40 bg-surface/70 p-2">
                <ChatInputBar {...desktopInputBarProps} />
              </div>
              <p className="mt-2 text-center text-[11px] text-muted/80">{t.aiDisclaimer}</p>
            </div>
          </div>
        )}

        {/* ── MOBILE EMPTY STATE ── */}
        {messages.length === 0 && (
          <div className="md:hidden flex flex-1 flex-col">
            <div className="flex flex-1 flex-col items-center justify-center text-center px-4 animate-fade-in">
              <OliLogo size={40} bg="#0D1117" />
              <h1 className="mb-1 mt-3 text-2xl font-semibold text-primary">Oli</h1>
              <p className="text-sm text-muted mb-5">{dynamicGreeting || t.chatSubtitle}</p>

              {/* Quick feature hints */}
              <div className="flex gap-2 mb-5 flex-wrap justify-center">
                {[
                  { icon: '📷', label: lang === 'el' ? 'Φωτό' : 'Photo' },
                  { icon: '🎤', label: lang === 'el' ? 'Φωνή' : 'Voice' },
                  { icon: '🌿', label: lang === 'el' ? 'Διάγνωση' : 'Diagnose' },
                ].map((f, i) => (
                  <span key={i} className="inline-flex items-center gap-1.5 rounded-full border border-border/50 bg-surface/50 px-3 py-1.5 text-xs text-muted">
                    <span>{f.icon}</span>{f.label}
                  </span>
                ))}
              </div>

              {/* Suggestion buttons */}
              <div className="grid w-full max-w-md grid-cols-2 gap-2.5">
                {t.suggestions.map((sugg, i) => (
                  <button key={i} onClick={() => handleSend(sugg)}
                    className="rounded-2xl border border-border/50 bg-surface px-3.5 py-3 text-left text-[13px] leading-snug text-foreground transition-all active:scale-[0.97] hover:border-primary/30">
                    {sugg}
                  </button>
                ))}
              </div>
            </div>
            <ChatInputBar {...inputBarProps} />
            <p className="px-4 pb-2 text-center text-[11px] text-muted/80">{t.aiDisclaimer}</p>
          </div>
        )}

        {/* ── CHAT ACTIVE (both desktop + mobile) ── */}
        {messages.length > 0 && (
          <div className="flex flex-1 flex-col min-h-0">
            <div className="flex-1 overflow-y-auto px-4 py-4 md:px-6 md:py-6">
              <div className={`mx-auto ${isGuestMode ? 'max-w-2xl md:max-w-3xl' : 'max-w-2xl'}`}>
                {sidebarLoading ? (
                  <div className="flex h-full items-center justify-center py-20">
                    <OliLogo size={32} bg="#161C23" animate="cascade" />
                  </div>
                ) : <MessageList {...messageListProps} />}
              </div>
            </div>
            <div className="flex-shrink-0">
              <div className={`mx-auto ${isGuestMode ? 'max-w-2xl md:max-w-3xl md:px-4 md:pb-4' : 'max-w-2xl md:px-2 md:pb-4'}`}>
                {pendingVioFollowUps.map(item => (
                  <VioFollowUpCard
                    key={item.id}
                    item={item}
                    className="mx-4 mb-2"
                    onApply={(id, applied) => { handleVioApplyConfirm(id, applied, `vio-banner-${id}`); removeVioFollowUp(id); }}
                    onOutcome={(id, outcome) => { handleOutcome(id, outcome, `vio-banner-${id}`); removeVioFollowUp(id); }}
                    onOpen={openFollowUpContext}
                    onDismiss={removeVioFollowUp}
                  />
                ))}
                {/* Reminder set confirmation chip */}
                {reminderChip && (
                  <div className="mx-4 mb-2 flex items-center gap-2 rounded-2xl border border-primary/30 bg-primary/10 px-4 py-2.5 animate-fade-in">
                    <span className="text-base">🔔</span>
                    <p className="flex-1 text-xs text-foreground leading-snug">
                      {lang === 'el'
                        ? `Υπενθύμιση ορίστηκε: ${reminderChip.task} — σε ${reminderChip.due_days} μέρες`
                        : `Reminder set: ${reminderChip.task} — in ${reminderChip.due_days} day${reminderChip.due_days === 1 ? '' : 's'}`}
                    </p>
                    <button onClick={() => setReminderChip(null)} className="text-muted hover:text-foreground">
                      <span className="text-xs">✕</span>
                    </button>
                  </div>
                )}
                {pendingAutoLog && (
                  <AutoLogBanner
                    action={pendingAutoLog}
                    lang={lang}
                    onConfirm={handleAutoLogConfirm}
                    onDismiss={() => setPendingAutoLog(null)}
                  />
                )}
                {/* Guest conversion nudge, appears after first AI reply */}
                {isGuestMode && messages.length >= 2 && !isTyping && (
                  <div className="mx-4 mb-2 flex items-center justify-between gap-3 rounded-2xl border border-primary/25 bg-primary/8 px-4 py-3 animate-fade-in">
                    <p className="text-xs text-foreground/80 leading-snug">
                      {lang === 'el'
                        ? '🌿 Συνέχισε δωρεάν, 20 ερωτήσεις τον μήνα'
                        : '🌿 Continue free, 20 questions/month'}
                    </p>
                    <a
                      href="/auth"
                      className="flex-shrink-0 rounded-full bg-primary px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-primary/90 transition-colors"
                    >
                      {lang === 'el' ? 'Εγγραφή' : 'Sign up'}
                    </a>
                  </div>
                )}
                {showPaywallWarning && !isGuestMode && (
                  <div className="mx-4 mb-2 flex items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/8 px-4 py-2.5">
                    <p className="text-xs text-amber-400">
                      {lang === 'el'
                        ? `Σου μένουν ${FREE_LIMIT - messageCount} δωρεάν ερωτήσεις αυτόν τον μήνα.`
                        : `You have ${FREE_LIMIT - messageCount} free messages left this month.`}
                    </p>
                    <button
                      onClick={() => { setShowPaywall(true); setShowPaywallWarning(false); }}
                      className="flex-shrink-0 rounded-full bg-amber-500 px-3 py-1 text-xs font-semibold text-white hover:bg-amber-600 transition-colors"
                    >
                      {lang === 'el' ? 'Αναβάθμιση' : 'Upgrade'}
                    </button>
                  </div>
                )}
                <ChatInputBar {...inputBarProps} />
                <p className="px-4 pb-1 pt-1 text-center text-[11px] text-muted/80">{t.aiDisclaimer}</p>
              </div>
            </div>
          </div>
        )}

      </main>

      <PaywallModal isOpen={showPaywall} onClose={() => setShowPaywall(false)} />
      {showLoginModal && <LoginModal onClose={() => setShowLoginModal(false)} />}
      {!isGuestMode && <InstallPrompt />}

      {logModalData && user && (
        <LogInterventionModal
          isOpen={!!logModalData}
          onClose={() => setLogModalData(null)}
          initialData={logModalData}
          userId={appUserId || user.id}
          fieldId={logModalData.field_id as string | undefined}
          userLat={typeof profile?.location_lat === 'number' ? profile.location_lat : null}
          userLon={typeof profile?.location_lon === 'number' ? profile.location_lon : null}
          onSuccess={async (id) => {
            showToast(t.interventionLogged);
            const msg = messages.find(m => m.id === logModalData.msg_id);
            if (msg && msg.db_id) {
              const newMetadata = { ...msg.metadata, intervention_id: id };
              dispatch({ type: 'update', id: msg.id, patch: { metadata: newMetadata } });
              await supabase.from('chat_messages').update({ metadata: newMetadata }).eq('id', msg.db_id);
            }
          }}
        />
      )}

      <ShareModal
        isOpen={!!shareModalData}
        onClose={() => setShareModalData(null)}
        url={shareModalData?.url ?? ''}
        title={shareModalData?.title ?? (lang === 'el' ? 'Διάγνωση από τον Oli' : 'Diagnosis from Oli')}
        text={shareModalData?.text}
        lang={lang}
      />

      <div role="status" aria-live="polite" aria-atomic="true" className="pointer-events-none fixed bottom-8 left-1/2 z-50 -translate-x-1/2">
        {toastMessage && (
          <div className="animate-in fade-in slide-in-from-bottom-4">
            <div className="rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background shadow-lg">
              {toastMessage}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
