/// <reference types="vite/client" />

import { useState, useEffect, useRef } from 'react';
import { Leaf, SquarePen, Send, Menu } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import PaywallModal from '../components/PaywallModal';
import InstallPrompt from '../components/InstallPrompt';
import ConversationSidebar from '../components/ConversationSidebar';
import { assembleFieldContext, Field } from '../lib/fieldContext';
import { InlineAttachment, streamChatCompletion } from '../lib/chatFunction';
import { useLanguage } from '../lib/LanguageContext';
import { compressImage, cacheImage, getCachedImage } from '../lib/imageCache';
import clsx from 'clsx';
import { trackEvent, Events } from '../lib/analytics';

import { FREE_MESSAGE_LIMIT as FREE_LIMIT, MAX_ATTACHMENTS, SIGNED_URL_EXPIRY, ALLOWED_FILE_TYPES, MAX_FILE_SIZE, VIO_STEP2_DAYS } from "../lib/constants";

import { LogInterventionModal } from '../components/LogInterventionModal';
import PushPrompt from '../components/PushPrompt';
import ChatInputBar from '../components/ChatInputBar';
import MessageList, { Message } from '../components/MessageList';
import FieldSelector from '../components/FieldSelector';

export default function Chat() {
  const { user, profile, appUserId } = useAuth();
  const { t, lang } = useLanguage();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarLoading, setSidebarLoading] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [messageCount, setMessageCount] = useState(0);
  const [showPaywall, setShowPaywall] = useState(false);
  
  const [fields, setFields] = useState<Field[]>([]);
  const [activeFieldId, setActiveFieldId] = useState<string | undefined>();
  const [activeConversationId, setActiveConversationId] = useState<string | undefined>();
  
  const [attachments, setAttachments] = useState<{ file: File; previewUrl: string }[]>([]);
  const [showAttachmentSheet, setShowAttachmentSheet] = useState(false);
  const [isListening, setIsListening] = useState(false);
  
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [shareModalUrl, setShareModalUrl] = useState<string | null>(null);
  const [logModalData, setLogModalData] = useState<any | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const desktopTextareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  const attachmentsRef = useRef(attachments);
  const messagesRef = useRef(messages);
  /** Incremented on each conversation load/clear to detect stale async loads (L2: prevents blob URL leaks). */
  const loadGenerationRef = useRef(0);

  // Only use explicitly selected field — never auto-select.
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

  const handleStarMessage = async (msg: Message) => {
    if (!appUserId || !msg.db_id) return;

    const newStarred = !msg.starred;
    setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, starred: newStarred } : m));

    const { error } = await supabase.from('chat_messages').update({ starred: newStarred }).eq('id', msg.db_id);
    if (error) {
      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, starred: msg.starred } : m));
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
      setMessages(prev => prev.map(m => m.id === msgId ? confirmMsg : m));
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
      setMessages(prev => prev.map(m => m.id === msgId ? confirmMsg : m));
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
    setMessages(prev => prev.map(m => m.id === msgId ? confirmMsg : m));
    showToast(t.outcomeRecorded);
    trackEvent(Events.VIO_OUTCOME_RECORDED, { outcome, interventionId });
  };

  const handleFeedback = async (msg: Message, feedback: 'positive' | 'negative') => {
    if (!msg.db_id) return;
    const previousFeedback = msg.metadata?.feedback;
    // Optimistic update
    setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, metadata: { ...m.metadata, feedback } } : m));
    const { error } = await supabase.from('chat_messages').update({ feedback }).eq('id', msg.db_id);
    if (error) {
      // Revert on error
      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, metadata: { ...m.metadata, feedback: previousFeedback } } : m));
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
        setMessages(prev => prev.map(m =>
          m.id === msg.id ? { ...m, metadata: dbMsg.metadata } : m
        ));
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
        setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, metadata: newMetadata } : m));
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
        setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, metadata: newMetadata } : m));
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
          setMessages(prev => prev.length === 0 ? [followUpMsg] : prev);
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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      const validFiles = newFiles.filter(f => {
        const isValidType = (ALLOWED_FILE_TYPES as readonly string[]).includes(f.type);
        const isValidSize = f.size <= MAX_FILE_SIZE;
        return isValidType && isValidSize;
      });

      if (validFiles.length !== newFiles.length) {
        showToast(t.fileRejected);
      }

      const availableSlots = Math.max(MAX_ATTACHMENTS - attachments.length, 0);
      const filesToAdd = validFiles.slice(0, availableSlots);

      if (filesToAdd.length < validFiles.length) {
        showToast(t.tooManyFiles);
      }

      setAttachments(prev => [
        ...prev,
        ...filesToAdd.map(f => ({
          file: f,
          previewUrl: URL.createObjectURL(f)
        }))
      ]);
    }
    e.target.value = '';
    setShowAttachmentSheet(false);
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => {
      const newAtt = [...prev];
      if (!newAtt[index]) {
        return prev;
      }
      safeRevokeObjectUrl(newAtt[index].previewUrl);
      newAtt.splice(index, 1);
      return newAtt;
    });
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
    dbMessageId?: string | null,
    base64Images?: InlineAttachment[],
    attachmentPaths?: string[]
  ) => {
    // Cancel any in-flight request
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsTyping(true);

    try {
      const assistantMsgId = crypto.randomUUID();
      let messageAdded = false;

      let fieldContext = '';
      if (appUserId) {
        fieldContext = await assembleFieldContext(appUserId, currentActiveFieldId);
      }

      const recentMessages = currentMessages.slice(-10);
      const latestUserMessage = [...recentMessages].reverse().find((message) => message.role === 'user');
      const latestUserMessageId = latestUserMessage?.id;
      const latestInlineAttachments = base64Images ?? latestUserMessage?.inlineAttachments ?? [];
      const latestAttachmentPaths = attachmentPaths ?? latestUserMessage?.attachmentPaths ?? [];

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
          userMessageId: dbMessageId || null,
          attachmentPaths: latestAttachmentPaths,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          lang,
        },
        {
          onToken: (token) => {
            if (controller.signal.aborted) return;
            streamedContent += token;
            if (!messageAdded) {
              messageAdded = true;
              setMessages((prev) => [
                ...prev,
                { id: assistantMsgId, role: 'assistant', content: streamedContent, created_at: new Date().toISOString() }
              ]);
            } else {
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMsgId ? { ...msg, content: streamedContent } : msg
                )
              );
            }
          },
        }
      );

      if (controller.signal.aborted) return;

      const finalContent = streamedContent || completion.assistantText;
      if (!messageAdded && finalContent) {
        setMessages((prev) => [
          ...prev,
          { id: assistantMsgId, role: 'assistant', content: finalContent, created_at: new Date().toISOString() }
        ]);
        messageAdded = true;
      }

      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.id === assistantMsgId) {
            return {
              ...msg,
              content: streamedContent || completion.assistantText,
              db_id: completion.assistantMessageId || undefined,
              metadata: completion.metadata,
            };
          }

          if (msg.id === latestUserMessageId && !msg.db_id && completion.userMessageId) {
            return {
              ...msg,
              db_id: completion.userMessageId,
            };
          }

          return msg;
        })
      );

      // Set isTyping false AFTER the final message content is finalized
      setIsTyping(false);

      if (typeof completion.messageCountMonth === 'number') {
        setMessageCount(completion.messageCountMonth);
      }

      // Post-response: silently link conversation to detected crop's field (if any)
      const cropMentioned = completion.metadata?.crop_mentioned;
      if (cropMentioned && !currentActiveFieldId && appUserId) {
        const matchingField = fields.find(f =>
          f.crop_type?.toLowerCase() === (cropMentioned as string).toLowerCase()
        );
        if (matchingField) {
          setActiveFieldId(matchingField.id);
          if (activeConversationId) {
            supabase.from('conversations').update({ field_id: matchingField.id }).eq('id', activeConversationId).then(({ error }) => {
              if (error) console.error('Failed to link field to conversation:', error);
            });
          }
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setIsTyping(false);
      const status = typeof error === 'object' && error !== null && 'status' in error
        ? Number((error as { status?: unknown }).status)
        : undefined;

      if (status === 429) {
        setShowPaywall(true);
        setMessages((prev) => prev.filter((msg) => !(msg.role === 'assistant' && !msg.content)));
        return;
      }

      setMessages((prev) =>
        prev.map((msg) =>
          msg.role === 'assistant' && !msg.content
            ? { ...msg, content: t.connectionError }
            : msg
        )
      );
    } finally {
      const latestUserMessage = [...currentMessages].reverse().find((message) => message.role === 'user');
      if (latestUserMessage?.id) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === latestUserMessage.id
              ? { ...msg, inlineAttachments: undefined, attachmentPaths: undefined }
              : msg
          )
        );
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

    if (messageCount >= FREE_LIMIT) {
      setShowPaywall(true);
      trackEvent(Events.PAYWALL_HIT, { messageCount });
      return;
    }

    let uploadedPaths: string[] = [];
    let base64Images: { mimeType: string; data: string }[] = [];
    let finalMessageText = messageText;

    if (attachments.length > 0) {
      const imageCount = attachments.filter((attachment) => attachment.file.type.startsWith('image/')).length;
      const documentCount = attachments.length - imageCount;
      const attachmentSummary: string[] = [];

      if (imageCount > 0) {
        attachmentSummary.push(`${imageCount} image${imageCount === 1 ? '' : 's'}`);
      }
      if (documentCount > 0) {
        attachmentSummary.push(`${documentCount} document${documentCount === 1 ? '' : 's'}`);
      }

      finalMessageText = `[The user attached ${attachmentSummary.join(' and ')}. Analyze every attachment carefully for crop disease, pest damage, physiological issues, or any relevant document details.]\n${finalMessageText}`;
      
      for (const att of attachments) {
        try {
          let base64: string;
          let mimeType: string;
          let uploadBlob: Blob;

          if (att.file.type.startsWith('image/')) {
            // Compress images before sending (max 1000×1000, JPEG 80%)
            const compressed = await compressImage(att.file);
            base64 = compressed.base64;
            mimeType = compressed.mimeType;
            uploadBlob = compressed.blob;
          } else {
            // PDFs: send as-is
            const buffer = await att.file.arrayBuffer();
            base64 = btoa(new Uint8Array(buffer).reduce((d, b) => d + String.fromCharCode(b), ''));
            mimeType = att.file.type;
            uploadBlob = att.file;
          }

          base64Images.push({ mimeType, data: base64 });

          if (user) {
            const fileExt = mimeType === 'image/jpeg' ? 'jpg' : att.file.name.split('.').pop();
            const fileName = `${Date.now()}_${crypto.randomUUID().slice(0, 8)}.${fileExt}`;
            const filePath = `${user.id}/${fileName}`;

            const { error: uploadError } = await supabase.storage
              .from('chat_uploads')
              .upload(filePath, uploadBlob);

            if (!uploadError) {
              uploadedPaths.push(filePath);
              // Cache compressed image locally for instant re-display
              if (mimeType.startsWith('image/')) {
                await cacheImage(filePath, uploadBlob);
              }
            }
          }
        } catch (e) {
          console.error('Error processing attachment', e);
        }
      }
    }

    const newUserMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: finalMessageText,
      created_at: new Date().toISOString(),
      inlineAttachments: base64Images,
      attachmentPaths: uploadedPaths,
      attachments: attachments.map((attachment) => ({
        url: attachment.previewUrl,
        mimeType: attachment.file.type,
        name: attachment.file.name,
      }))
    };

    setMessages((prev) => [...prev, newUserMsg]);
    setInput('');
    setAttachments([]);

    // Analytics
    const hasPhotos = base64Images.length > 0 || uploadedPaths.length > 0;
    trackEvent(Events.MESSAGE_SENT, { hasPhotos, messageCount: messageCount + 1 });
    if (hasPhotos) trackEvent(Events.FIRST_PHOTO);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    if (desktopTextareaRef.current) desktopTextareaRef.current.style.height = 'auto';

    let currentConversationId = activeConversationId;
    if (appUserId && !currentConversationId) {
      const { data: conversationData, error: conversationError } = await supabase
        .from('conversations')
        .insert({
          user_id: appUserId,
          field_id: activeFieldId || null,
          title: (messageText || 'New conversation').slice(0, 80),
        })
        .select('id')
        .single();

      if (conversationError) {
        console.error('Failed to create conversation:', conversationError);
        showToast(t.conversationCreateError);
      } else if (conversationData?.id) {
        currentConversationId = conversationData.id;
        setActiveConversationId(conversationData.id);
      }
    }

    let dbMessageId: string | null = null;
    if (appUserId) {
      const { data, error: insertError } = await supabase.from('chat_messages').insert({
        conversation_id: currentConversationId || null,
        user_id: appUserId,
        role: 'user',
        content: finalMessageText,
        field_id: activeFieldId || null,
        metadata: uploadedPaths.length > 0 ? { attachments: uploadedPaths } : null
      }).select('id').single();

      if (insertError) {
        console.error('Failed to save message:', insertError);
      } else if (data) {
        dbMessageId = data.id;
        setMessages((prev) => prev.map(m => m.id === newUserMsg.id ? { ...m, db_id: data.id } : m));
      }
    }

    // No extraction pipeline — the main Gemini call already returns crop_mentioned
    // in its response metadata. This saves a second API call per message.
    const currentActiveFieldId = activeFieldId;

    await sendMessageToAI(
      [...messages, newUserMsg],
      finalMessageText,
      currentActiveFieldId,
      currentConversationId,
      dbMessageId,
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
    setMessages([]);
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
          // 1. Check IndexedDB cache for all paths first (instant, no network)
          for (const path of m.image_urls) {
            const cached = await getCachedImage(path);
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
      setMessages(messages);
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
  };

  return (
    <div className="flex h-[100dvh] bg-background overflow-hidden">

      {/* ── DESKTOP: permanent sidebar ── */}
      <div className="hidden md:block flex-shrink-0">
        <ConversationSidebar isOpen={true} onClose={() => {}} desktop={true}
          activeId={activeConversationId} onSelect={handleSidebarSelect} onNewChat={clearChat} />
      </div>

      {/* ── MOBILE: slide-over sidebar ── */}
      <div className="md:hidden">
        <ConversationSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)}
          activeId={activeConversationId} onSelect={handleSidebarSelect} onNewChat={clearChat} />
      </div>

      {/* ── MAIN AREA ── */}
      <div className="flex flex-1 flex-col min-w-0">

        {/* Mobile header */}
        <header className="md:hidden flex h-12 flex-shrink-0 items-center justify-between border-b border-border/50 bg-surface px-4">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} aria-label="Open menu" className="text-muted hover:text-foreground transition-colors">
              <Menu className="h-5 w-5" />
            </button>
            <Leaf className="h-[18px] w-[18px] text-primary" />
            <span className="text-[16px] font-medium text-primary">Oli</span>
          </div>
          {fields.length > 0 && (
            <FieldSelector
              fields={fields}
              activeFieldId={activeFieldId}
              onSelectField={setActiveFieldId}
              lang={lang}
            />
          )}
          <button onClick={clearChat} aria-label="New chat" className="text-muted hover:text-foreground transition-colors">
            <SquarePen className="h-5 w-5" />
          </button>
        </header>

        {/* Desktop: no top header — sidebar owns all navigation */}

        {/* ── DESKTOP WELCOME (no messages) ── */}
        {messages.length === 0 && (
          <div className="hidden md:flex flex-1 flex-col items-center justify-center px-8 animate-fade-in">
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
              <div className="relative">
                <textarea ref={desktopTextareaRef} value={input} onChange={handleInput} onKeyDown={handleKeyDown}
                  aria-label={t.inputPlaceholder}
                  placeholder={t.inputPlaceholder} rows={1}
                  className="max-h-[120px] min-h-[52px] w-full resize-none rounded-[22px] border border-border/50 bg-surface px-5 py-3.5 pr-14 text-[15px] text-foreground placeholder:text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" />
                <button onClick={() => handleSend()} disabled={isTyping || (!input.trim() && attachments.length === 0)} aria-label="Send message"
                  className={clsx("absolute right-2 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-[14px] transition-colors duration-150",
                    (!input.trim() && attachments.length === 0) || isTyping ? "bg-muted/50 text-muted/70" : "bg-primary text-white hover:bg-primary/90")}>
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── MOBILE EMPTY STATE ── */}
        {messages.length === 0 && (
          <div className="md:hidden flex flex-1 flex-col">
            <div className="flex flex-1 flex-col items-center justify-center text-center px-4 animate-fade-in">
              <Leaf className="mb-3 h-10 w-10 text-primary" />
              <h1 className="mb-1 text-2xl font-semibold text-primary">Oli</h1>
              <p className="text-sm text-muted mb-5">{t.chatSubtitle}</p>

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
          </div>
        )}

        {/* ── CHAT ACTIVE (both desktop + mobile) ── */}
        {messages.length > 0 && (
          <div className="flex flex-1 flex-col min-h-0">
            <div className="flex-1 overflow-y-auto px-4 py-4 md:px-6 md:py-6">
              <div className="mx-auto max-w-2xl">
                {sidebarLoading ? (
                  <div className="flex h-full items-center justify-center py-20">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-primary" />
                  </div>
                ) : <MessageList {...messageListProps} />}
              </div>
            </div>
            <div className="flex-shrink-0">
              <div className="mx-auto max-w-2xl md:px-2 md:pb-4">
                <PushPrompt userId={appUserId ?? null} messageCount={messages.length} />
                <ChatInputBar {...inputBarProps} />
              </div>
            </div>
          </div>
        )}

      </div>

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
              setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, metadata: newMetadata } : m));
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
    </div>
  );
}
