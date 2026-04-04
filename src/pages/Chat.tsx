import { useState, useEffect, useRef, useReducer } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import PaywallModal from '../components/PaywallModal';
import InstallPrompt from '../components/InstallPrompt';
import type { Field } from '../lib/fieldContext';
import { InlineAttachment, streamChatCompletion } from '../lib/chatFunction';
import { useLanguage } from '../lib/LanguageContext';
import { getCachedImages } from '../lib/imageCache';
import { trackEvent, Events } from '../lib/analytics';
import { isUnlimitedTier } from '../../shared/subscription';

import { FREE_MESSAGE_LIMIT as FREE_LIMIT, SIGNED_URL_EXPIRY, VIO_STEP2_DAYS } from "../lib/constants";

import { LogInterventionModal } from '../components/LogInterventionModal';
import PushPrompt from '../components/PushPrompt';
import { Message } from '../components/MessageList';
import ChatLayout from './chat/ChatLayout';
import { messagesReducer } from './chat/messagesReducer';
import {
  cleanupUploadedAssets,
  prepareAttachmentsForSend,
  useChatAttachments,
} from './chat/useChatAttachments';

export default function Chat() {
  const { user, profile, appUserId } = useAuth();
  const { t, lang } = useLanguage();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarLoading, setSidebarLoading] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  
  const [messages, dispatch] = useReducer(messagesReducer, []);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [messageCount, setMessageCount] = useState(0);
  const [showPaywall, setShowPaywall] = useState(false);
  
  const [fields, setFields] = useState<Field[]>([]);
  const [activeFieldId, setActiveFieldId] = useState<string | undefined>();
  const [activeConversationId, setActiveConversationId] = useState<string | undefined>();
  const [isListening, setIsListening] = useState(false);
  
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [shareModalUrl, setShareModalUrl] = useState<string | null>(null);
  const [logModalData, setLogModalData] = useState<any | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const desktopTextareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);
  const messagesRef = useRef(messages);
  /** Incremented on each conversation load/clear to detect stale async loads (L2: prevents blob URL leaks). */
  const loadGenerationRef = useRef(0);
  const lastSendAttemptRef = useRef(0);
  const {
    attachments,
    attachmentsRef,
    cameraInputRef,
    fileInputRef,
    showAttachmentSheet,
    setAttachments,
    setShowAttachmentSheet,
    handleFileSelect,
    removeAttachment,
  } = useChatAttachments({ t });
  const hasUnlimitedMessages = isUnlimitedTier(typeof profile?.tier === 'string' ? profile.tier : null);

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
    if (!appUserId || !msg.db_id) return;

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
          ? 'Τέλεια! Θα σε ρωτήσω σε 3 μέρες αν βλέπεις βελτίωση.'
          : "Great! I'll check back in 3 days to see if you notice any improvement.",
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

  const handleOutcome = async (interventionId: string, outcome: 'better' | 'same' | 'worse', msgId: string) => {
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
      ? `${outcomeLabels[outcome]} — ευχαριστώ για την ενημέρωση. Έχω καταχωρήσει το αποτέλεσμα.`
      : `${outcomeLabels[outcome]} — thanks for the update. I've recorded the outcome.`;
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

  const handleLogIntervention = (msg: Message) => {
    if (!msg.metadata?.diagnosis_data) return;
    setLogModalData({
      ...msg.metadata.diagnosis_data,
      crop_mentioned: msg.metadata.crop_mentioned,
      message_id: msg.db_id,
      field_id: activeFieldId || null,
      msg_id: msg.id // internal id
    });
  };

  const handleShare = async (msg: Message) => {
    if (!appUserId) { showToast(t.profileSyncing); return; }
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

    const shareUrl = `${window.location.origin}/d/${publicShareId}?ref=${publicShareId}`;
    trackEvent(Events.SHARE_DIAGNOSIS, { shareId: publicShareId });

    // Try Web Share API first (native on mobile)
    if (navigator.share) {
      try {
        await navigator.share({
          title: t.shareTitle,
          text: msg.metadata?.diagnosis_data?.problem || t.shareDefaultText,
          url: shareUrl,
        });
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
      // Clipboard blocked — always show the modal with the URL so user can copy manually
      setShareModalUrl(shareUrl);
    }
  };

  useEffect(() => {
    if (profile) {
      setMessageCount(profile.message_count_month || 0);
      return;
    }
    setMessageCount(0);
  }, [profile]);

  useEffect(() => {
    if (appUserId) {
      supabase.from('field_context_view').select('*').eq('user_id', appUserId).then(({ data, error }) => {
        if (error) console.error('fields load error:', error.message);
        if (data) setFields(data as Field[]);
      });

      // Check for pending follow-ups — VIO multi-step loop
      supabase
        .from('interventions')
        .select('id, crop_type, diagnosis, follow_up_at, field_id, vio_step, product_applied')
        .eq('user_id', appUserId)
        .lte('follow_up_at', new Date().toISOString())
        .is('outcome', null)
        .not('follow_up_at', 'is', null)
        .order('follow_up_at', { ascending: true })
        .limit(1)
        .then(({ data: due }) => {
          if (!due || due.length === 0) return;
          const item = due[0] as any;
          const cropLabel = item.crop_type || item.diagnosis || (lang === 'el' ? 'τη φυτεία σου' : 'your crop');
          const step = item.vio_step ?? 1;

          let followUpContent: string;
          let vioStepType: string;

          if (step <= 1) {
            // Step 1: Did you apply the treatment?
            followUpContent = lang === 'el'
              ? `Πριν λίγες μέρες μιλήσαμε για **${item.diagnosis || 'πρόβλημα'}** στο **${cropLabel}**. Εφάρμοσες κάποια θεραπεία;`
              : `A few days ago we discussed **${item.diagnosis || 'a problem'}** in **${cropLabel}**. Did you apply any treatment?`;
            vioStepType = 'apply_check';
          } else {
            // Step 2: Any improvements?
            followUpContent = lang === 'el'
              ? `Πώς πάει το **${cropLabel}** μετά τη θεραπεία${item.product_applied ? ` με ${item.product_applied}` : ''}; Βλέπεις βελτίωση;`
              : `How is **${cropLabel}** doing after the treatment${item.product_applied ? ` with ${item.product_applied}` : ''}? Any improvement?`;
            vioStepType = 'outcome_check';
          }

          const followUpMsg = {
            id: `followup-${item.id}`,
            role: 'assistant' as const,
            content: followUpContent,
            created_at: new Date().toISOString(),
            metadata: {
              follow_up_intervention_id: item.id,
              is_follow_up: true,
              vio_step: step,
              vio_step_type: vioStepType,
            },
          };
          dispatch({ type: 'set_if_empty', message: followUpMsg });
        });

      // No API call for greeting — the empty state UI already serves as the welcome.
      return;
    }
    setFields([]);
  }, [appUserId]);

  const prevMessageCountRef = useRef(0);
  useEffect(() => {
    const currentCount = messages.length + (isTyping ? 1 : 0);
    if (currentCount > prevMessageCountRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
    prevMessageCountRef.current = currentCount;
  }, [messages.length, isTyping]);

  useEffect(() => {
    attachmentsRef.current = attachments;
  }, [attachments]);

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
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = lang === 'el' ? 'el-GR' : 'en-US';

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

    try {
      const assistantMsgId = crypto.randomUUID();
      let messageAdded = false;

      // Field and treatment history are assembled server-side so the backend
      // stays authoritative as we expand field memory.
      const fieldContext = '';

      let streamedContent = '';
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
      }

      if (completion.fieldId && completion.fieldId !== currentActiveFieldId) {
        setActiveFieldId(completion.fieldId);
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

      if (latestUserMessageId && !latestUserMessagePersisted && !controller.signal.aborted) {
        dispatch({ type: 'filter', predicate: (msg) => msg.id !== latestUserMessageId });
        setInput((currentInput) => currentInput || userText);
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

      if (typeof status === 'number' && !latestUserMessagePersisted && latestAttachmentPaths.length > 0) {
        await cleanupUploadedAssets(latestAttachmentPaths);
      }

      dispatch({ type: 'update_by', predicate: (msg) => msg.role === 'assistant' && !msg.content, patch: { content: t.connectionError } });
    } finally {
      const latestUserMessage = [...currentMessages].reverse().find((message) => message.role === 'user');
      if (latestUserMessage?.id) {
        dispatch({ type: 'update', id: latestUserMessage.id, patch: { inlineAttachments: undefined, attachmentPaths: undefined } });
      }
    }
  };

  const handleSend = async (text: string = input) => {
    const messageText = text.trim() || input.trim();
    if ((!messageText && attachments.length === 0) || isTyping) return;

    if (!appUserId) {
      showToast(t.profileSyncing);
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

    let uploadedPaths: string[] = [];
    let base64Images: { mimeType: string; data: string }[] = [];
    let finalMessageText = messageText;
    let messageAttachments: Array<{ url: string; mimeType: string; name: string }> = [];

    if (attachments.length > 0) {
      const prepared = await prepareAttachmentsForSend({
        attachments,
        userId: user?.id,
        showToast,
      });

      if (prepared.attachmentSummary) {
        finalMessageText =
          `[The user attached ${prepared.attachmentSummary}. Analyze every attachment carefully for crop disease, pest damage, physiological issues, or any relevant document details.]\n${finalMessageText}`;
      }

      uploadedPaths = prepared.uploadedPaths;
      base64Images = prepared.inlineAttachments;
      messageAttachments = prepared.messageAttachments;
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
    if (desktopTextareaRef.current) desktopTextareaRef.current.style.height = 'auto';

    // No extraction pipeline — the main Gemini call already returns crop_mentioned
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

  // Disambiguation removed — field context detected silently from AI response metadata.

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
    setActiveFieldId(undefined); // Reset field context — each chat starts fresh
    setShowAttachmentSheet(false);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      if (desktopTextareaRef.current) desktopTextareaRef.current.style.height = 'auto';
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

    // Restore field context for this conversation
    const { data: convData } = await supabase
      .from('conversations')
      .select('field_id')
      .eq('id', id)
      .single();
    if (loadGenerationRef.current !== thisGeneration) return; // stale load
    if (convData?.field_id) {
      setActiveFieldId(convData.field_id);
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
      const messages: Message[] = await Promise.all(data.map(async (m: any) => {
        const base: Message = {
          id: m.id, db_id: m.id, role: m.role, content: m.content,
          metadata: m.metadata, starred: m.starred, created_at: m.created_at,
        };
        // Resolve stored image paths into displayable URLs
        if (Array.isArray(m.image_urls) && m.image_urls.length > 0) {
          const attachments: NonNullable<Message['attachments']> = [];
          const uncached: string[] = [];
          // 1. Batch check IndexedDB cache (single transaction instead of per-image)
          const cachedMap = await getCachedImages(m.image_urls);
          for (const path of m.image_urls) {
            const cached = cachedMap.get(path);
            if (cached) {
              blobUrlsCreated.push(cached);
              attachments.push({ url: cached, mimeType: 'image/jpeg', name: path.split('/').pop() ?? 'photo' });
            } else {
              uncached.push(path);
            }
          }
          // 2. Batch sign all uncached paths in ONE API call
          if (uncached.length > 0) {
            const { data: signed } = await supabase.storage
              .from('chat_uploads')
              .createSignedUrls(uncached, SIGNED_URL_EXPIRY);
            if (signed) {
              for (const s of signed) {
                if (s.signedUrl) {
                  attachments.push({ url: s.signedUrl, mimeType: 'image/jpeg', name: (s.path || '').split('/').pop() ?? 'photo' });
                }
              }
            }
          }
          if (attachments.length > 0) base.attachments = attachments;
        }
        return base;
      }));
      // L2: If another load/clear happened while we were resolving images, revoke the orphaned blob URLs
      if (loadGenerationRef.current !== thisGeneration) {
        blobUrlsCreated.forEach(url => URL.revokeObjectURL(url));
        return;
      }
      dispatch({ type: 'set', messages });
    }
    setSidebarLoading(false);
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
    onFileSelect: (event: React.ChangeEvent<HTMLInputElement>) => handleFileSelect(event, showToast),
    onRemoveAttachment: removeAttachment,
    onToggleListening: toggleListening,
    onToggleAttachmentSheet: setShowAttachmentSheet,
  };

  return (
    <>
      <ChatLayout
        activeConversationId={activeConversationId}
        activeFieldId={activeFieldId}
        attachments={attachments}
        desktopTextareaRef={desktopTextareaRef}
        fields={fields}
        handleInput={handleInput}
        handleKeyDown={handleKeyDown}
        handleSend={handleSend}
        input={input}
        inputBarProps={inputBarProps}
        inputTop={<PushPrompt userId={appUserId ?? null} messageCount={messages.length} />}
        isTyping={isTyping}
        lang={lang}
        messageListProps={messageListProps}
        messages={messages}
        onSelectConversation={handleSidebarSelect}
        onSelectField={setActiveFieldId}
        onToggleSidebar={setSidebarOpen}
        onNewChat={clearChat}
        sidebarLoading={sidebarLoading}
        sidebarOpen={sidebarOpen}
        t={t}
      />

      <PaywallModal isOpen={showPaywall} onClose={() => setShowPaywall(false)} />
      <InstallPrompt />

      {logModalData && user && (
        <LogInterventionModal
          isOpen={!!logModalData}
          onClose={() => setLogModalData(null)}
          initialData={logModalData}
          userId={appUserId || user.id}
          fieldId={logModalData.field_id}
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

      {shareModalUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={() => setShareModalUrl(null)}>
          <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-5 shadow-2xl"
            onClick={e => e.stopPropagation()}>
            <p className="mb-3 text-sm font-medium text-foreground">
              {lang === 'el' ? 'Σύνδεσμος κοινοποίησης' : 'Share link'}
            </p>
            <div className="flex gap-2">
              <input
                readOnly
                value={shareModalUrl}
                className="flex-1 rounded-xl border border-border/50 bg-background px-3 py-2 text-xs text-muted focus:outline-none"
                onFocus={e => e.target.select()}
              />
              <button
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(shareModalUrl);
                    showToast(t.linkCopied);
                    setShareModalUrl(null);
                  } catch {
                    showToast(lang === 'el' ? 'Επέλεξε και αντέγραψε χειροκίνητα' : 'Select and copy manually');
                  }
                }}
                className="rounded-xl bg-primary px-3 py-2 text-xs font-medium text-white"
              >
                {lang === 'el' ? 'Αντιγραφή' : 'Copy'}
              </button>
            </div>
            <button onClick={() => setShareModalUrl(null)}
              className="mt-3 w-full text-center text-xs text-muted hover:text-foreground">
              {t.cancel}
            </button>
          </div>
        </div>
      )}

      {toastMessage && (
        <div className="fixed bottom-8 left-1/2 z-50 -translate-x-1/2 animate-in fade-in slide-in-from-bottom-4">
          <div className="rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background shadow-lg">
            {toastMessage}
          </div>
        </div>
      )}
    </>
  );
}
