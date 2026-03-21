/// <reference types="vite/client" />

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Leaf, SquarePen, Paperclip, Mic, Send, Camera, Image, FileText, X, Star, ClipboardList, Share2, Menu } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import PaywallModal from '../components/PaywallModal';
import ConversationSidebar from '../components/ConversationSidebar';
import { assembleFieldContext, Field } from '../lib/fieldContext';
import { InlineAttachment, streamChatCompletion } from '../lib/chatFunction';
import { extractAndApply } from '../lib/extractAndApply';
import { generateValidatedResponse } from '../lib/validateAi';
import { useLanguage } from '../lib/LanguageContext';
import clsx from 'clsx';

const FREE_LIMIT = 20;
const MAX_ATTACHMENTS = 3;

interface MessageAttachment {
  url: string;
  mimeType: string;
  name: string;
}

interface Message {
  id: string;
  db_id?: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  isDisambiguation?: boolean;
  originalText?: string;
  originalDbId?: string;
  attachments?: MessageAttachment[];
  inlineAttachments?: InlineAttachment[];
  attachmentPaths?: string[];
  metadata?: any;
  starred?: boolean;
}

import { LogInterventionModal } from '../components/LogInterventionModal';

export default function Chat() {
  const { user, profile, appUserId, isGuest } = useAuth();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
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
  const [logModalData, setLogModalData] = useState<any | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  const attachmentsRef = useRef(attachments);
  const messagesRef = useRef(messages);

  const activeField = activeFieldId
    ? fields.find((field) => field.id === activeFieldId)
    : fields.length === 1
      ? fields[0]
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
    if (!appUserId || !msg.db_id || !msg.metadata?.diagnosis_data) return;

    let interventionId = msg.metadata.intervention_id;
    let publicShareId = msg.metadata.share_id;

    if (!interventionId) {
      const { data, error } = await supabase.from('interventions').insert({
        user_id: appUserId,
        field_id: activeFieldId || null,
        crop_type: msg.metadata.crop_mentioned || '',
        problem: msg.metadata.diagnosis_data.problem || '',
        product: msg.metadata.diagnosis_data.product_applied || '',
        dosage: msg.metadata.diagnosis_data.dosage || '',
        application_method: msg.metadata.diagnosis_data.application_method || '',
        notes: `Diagnosis: ${msg.metadata.diagnosis_data.problem || 'Unknown'}\nCause: ${msg.metadata.diagnosis_data.cause || 'Unknown'}`,
        date: new Date().toISOString().split('T')[0],
        is_shared: true
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

    const shareUrl = `${window.location.origin}/d/${publicShareId}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      showToast(t.linkCopied);
    } catch (error) {
      console.error('Clipboard write failed:', error);
      showToast(t.shareClipboardError);
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
    if (appUserId && !isGuest) {
      supabase.from('field_context_view').select('*').eq('user_id', appUserId).then(({ data }) => {
        if (data) setFields(data as Field[]);
      });
      return;
    }
    setFields([]);
  }, [appUserId, isGuest]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  useEffect(() => {
    attachmentsRef.current = attachments;
  }, [attachments]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    return () => {
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
      recognitionRef.current.lang = 'el-GR';

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
  }, []);

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
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      const validFiles = newFiles.filter(f => {
        const isValidType = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'].includes(f.type);
        const isValidSize = f.size <= 10 * 1024 * 1024; // 10MB
        return isValidType && isValidSize;
      });

      if (validFiles.length !== newFiles.length) {
        alert(t.fileRejected);
      }

      const availableSlots = Math.max(MAX_ATTACHMENTS - attachments.length, 0);
      const filesToAdd = validFiles.slice(0, availableSlots);

      if (filesToAdd.length < validFiles.length) {
        alert(t.tooManyFiles);
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
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
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
    setIsTyping(true);

    try {
      // Create a placeholder for the assistant message
      const assistantMsgId = (Date.now() + 1).toString();
      setMessages((prev) => [
        ...prev,
        { id: assistantMsgId, role: 'assistant', content: '', created_at: new Date().toISOString() }
      ]);

      let fieldContext = '';
      if (!isGuest && appUserId) {
        fieldContext = await assembleFieldContext(appUserId, currentActiveFieldId);
      }

      const recentMessages = currentMessages.slice(-10);
      const latestUserMessage = [...recentMessages].reverse().find((message) => message.role === 'user');
      const latestUserMessageId = latestUserMessage?.id;
      const latestInlineAttachments = base64Images ?? latestUserMessage?.inlineAttachments ?? [];
      const latestAttachmentPaths = attachmentPaths ?? latestUserMessage?.attachmentPaths ?? [];

      if (isGuest) {
        setIsTyping(false);
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMsgId
              ? {
                  ...msg,
                  content: t.guestPrompt,
                }
              : msg
          )
        );
        return;
      }

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
        },
        {
          onToken: (token) => {
            streamedContent += token;
            setIsTyping(false);
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMsgId ? { ...msg, content: streamedContent } : msg
              )
            );
          },
        }
      );

      setIsTyping(false);
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

      if (typeof completion.messageCountMonth === 'number') {
        setMessageCount(completion.messageCountMonth);
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

    if (!isGuest && !appUserId) {
      showToast(t.profileSyncing);
      return;
    }

    if (!isGuest && messageCount >= FREE_LIMIT) {
      setShowPaywall(true);
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
          const buffer = await att.file.arrayBuffer();
          const base64 = btoa(new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), ''));
          base64Images.push({ mimeType: att.file.type, data: base64 });

          if (!isGuest && user) {
            const fileExt = att.file.name.split('.').pop();
            const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
            const filePath = `${user.id}/${fileName}`;
            
            const { error: uploadError } = await supabase.storage
              .from('chat_uploads')
              .upload(filePath, att.file);
              
            if (!uploadError) {
              uploadedPaths.push(filePath);
            }
          }
        } catch (e) {
          console.error("Error processing attachment", e);
        }
      }
    }

    const newUserMsg: Message = {
      id: Date.now().toString(),
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
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    let currentConversationId = activeConversationId;
    if (!isGuest && appUserId && !currentConversationId) {
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
      } else if (conversationData?.id) {
        currentConversationId = conversationData.id;
        setActiveConversationId(conversationData.id);
      }
    }

    let dbMessageId: string | null = null;
    if (!isGuest && appUserId) {
      const { data } = await supabase.from('chat_messages').insert({
        conversation_id: currentConversationId || null,
        user_id: appUserId,
        role: 'user',
        content: finalMessageText,
        field_id: activeFieldId || null,
        metadata: uploadedPaths.length > 0 ? { attachments: uploadedPaths } : null
      }).select('id').single();
      
      if (data) {
        dbMessageId = data.id;
        setMessages((prev) => prev.map(m => m.id === newUserMsg.id ? { ...m, db_id: data.id } : m));
        
        // Store in photo_reviews
        if (uploadedPaths.length > 0) {
          for (const path of uploadedPaths) {
            await supabase.from('photo_reviews').insert({
              user_id: appUserId,
              storage_path: path
            });
          }
        }
      }
    }

    let currentActiveFieldId = activeFieldId;

    if (dbMessageId && !isGuest && appUserId) {
      const result = await extractAndApply(finalMessageText, appUserId, dbMessageId);
      if (result?.action === 'auto_set' && result.targetFieldId) {
        setActiveFieldId(result.targetFieldId);
        currentActiveFieldId = result.targetFieldId;
        if (currentConversationId) {
          await supabase.from('conversations').update({ field_id: result.targetFieldId }).eq('id', currentConversationId);
        }
        // Refresh fields
        supabase.from('field_context_view').select('*').eq('user_id', appUserId).then(({ data }) => {
          if (data) setFields(data as Field[]);
        });
      } else if (result?.action === 'disambiguate' && result.disambiguateFields && result.disambiguateFields.length > 0) {
        const disambiguationMsg: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: 'Vrika kapoia xwrafia pou tairiazoun. Gia poio milame;',
          created_at: new Date().toISOString(),
          isDisambiguation: true,
          originalText: finalMessageText,
          originalDbId: dbMessageId,
        };
        setMessages((prev) => [...prev, disambiguationMsg]);
        setIsTyping(false);
        return;
      }
    }

    if (!isGuest && fields.length > 1 && !currentActiveFieldId) {
      const disambiguationMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Gia poio xwrafi milame;',
        created_at: new Date().toISOString(),
        isDisambiguation: true,
        originalText: finalMessageText,
        originalDbId: dbMessageId || undefined,
      };
      
      setMessages((prev) => [...prev, disambiguationMsg]);
      setIsTyping(false);
      return;
    }

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

  const handleDisambiguation = async (fieldId: string, originalText: string, msgId: string, originalDbId?: string) => {
    setActiveFieldId(fieldId);
    
    if (originalDbId && !isGuest) {
      await supabase.from('chat_messages').update({ field_id: fieldId }).eq('id', originalDbId);
    }

    if (activeConversationId && !isGuest) {
      await supabase.from('conversations').update({ field_id: fieldId }).eq('id', activeConversationId);
    }

    const filteredMessages = messages.filter((message) => message.id !== msgId);
    setMessages(filteredMessages);
    await sendMessageToAI(filteredMessages, originalText, fieldId, activeConversationId, originalDbId);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const clearChat = () => {
    attachments.forEach((attachment) => {
      safeRevokeObjectUrl(attachment.previewUrl);
    });
    revokeMessageAttachments(messages);
    attachmentsRef.current = [];
    messagesRef.current = [];
    setMessages([]);
    setAttachments([]);
    setInput('');
    setActiveConversationId(undefined);
    setShowAttachmentSheet(false);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' });
  };


  const handleSidebarSelect = async (id: string) => {
    clearChat();
    setActiveConversationId(id);
    const { data } = await supabase
      .from('chat_messages')
      .select('id, role, content, metadata, starred, image_urls, created_at')
      .eq('conversation_id', id)
      .order('created_at', { ascending: true })
      .limit(50);
    if (data) {
      setMessages(data.map((m: any) => ({
        id: m.id, db_id: m.id, role: m.role, content: m.content,
        metadata: m.metadata, starred: m.starred, created_at: m.created_at,
      })));
    }
  };

  const MessagesList = () => (
    <div className="space-y-6">
      {messages.map((msg, index) => {
        const isUser = msg.role === 'user';
        const isFirstAiInSequence = !isUser && (index === 0 || messages[index - 1].role === 'user');
        return (
          <div key={msg.id} className={clsx("group flex w-full animate-fade-in", isUser ? "justify-end" : "justify-start")}>
            {!isUser && (
              <div className="w-6 flex-shrink-0 pt-3">
                {isFirstAiInSequence && <div className="h-2 w-2 rounded-full bg-primary/60" />}
              </div>
            )}
            <div className="flex max-w-[78%] flex-col gap-1">
              {msg.attachments && msg.attachments.length > 0 && (
                <div className={clsx("flex flex-wrap gap-2 mb-1", isUser ? "justify-end" : "justify-start")}>
                  {msg.attachments.map((attachment, i) => (
                    attachment.mimeType.startsWith('image/') ? (
                      <img key={i} src={attachment.url} alt={attachment.name} className="h-24 w-24 rounded-xl border border-border/50 object-cover" />
                    ) : (
                      <div key={i} className="flex h-24 w-24 flex-col items-center justify-center rounded-xl border border-border/50 bg-surface px-2 text-center">
                        <FileText className="mb-2 h-6 w-6 text-muted" />
                        <span className="line-clamp-2 text-[11px] text-muted">{attachment.name}</span>
                      </div>
                    )
                  ))}
                </div>
              )}
              <div className={clsx("px-4 py-3",
                isUser ? "rounded-[18px] rounded-br-[4px] bg-primary text-white"
                       : "rounded-[18px] rounded-bl-[4px] border border-border/50 bg-surface text-foreground")}>
                {isUser ? (
                  <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{msg.content}</p>
                ) : msg.isDisambiguation ? (
                  <div className="flex flex-col gap-3">
                    <p className="text-[15px]">{msg.content}</p>
                    <div className="flex flex-wrap gap-2">
                      {fields.map(f => (
                        <button key={f.id}
                          onClick={() => handleDisambiguation(f.id, msg.originalText || '', msg.id, msg.originalDbId)}
                          className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-primary/20">
                          {f.name}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="prose prose-sm prose-invert max-w-none">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                )}
              </div>
              <span className={clsx("text-[11px] text-muted opacity-0 transition-opacity group-hover:opacity-100", isUser ? "text-right" : "text-left")}>
                {formatTime(msg.created_at)}
              </span>
              {!isUser && msg.metadata?.diagnosis_data && (
                <div className="mt-1 flex flex-wrap gap-2">
                  <button onClick={() => handleStarMessage(msg)}
                    className={clsx("flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                      msg.starred ? "border-yellow-500/50 bg-yellow-500/10 text-yellow-500" : "border-border/50 bg-surface text-muted hover:bg-muted/10 hover:text-foreground")}>
                    <Star className={clsx("h-3.5 w-3.5", msg.starred && "fill-current")} />
                    {t.savedMessage}
                  </button>
                  <button onClick={() => handleLogIntervention(msg)}
                    className="flex items-center gap-1.5 rounded-full border border-border/50 bg-surface px-2.5 py-1 text-xs font-medium text-muted transition-colors hover:bg-muted/10 hover:text-foreground">
                    <ClipboardList className="h-3.5 w-3.5" />{t.logIntervention}
                  </button>
                  <button onClick={() => handleShare(msg)}
                    className="flex items-center gap-1.5 rounded-full border border-border/50 bg-surface px-2.5 py-1 text-xs font-medium text-muted transition-colors hover:bg-muted/10 hover:text-foreground">
                    <Share2 className="h-3.5 w-3.5" />{t.shareLabel}
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })}
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

  const InputBar = () => (
    <div className="border-t border-border/50 bg-surface/95 pb-safe backdrop-blur-sm">
      {!isGuest && messageCount >= FREE_LIMIT - 3 && (
        <div className="bg-amber-500/10 py-1.5 text-center text-xs text-amber-400">
          {FREE_LIMIT - messageCount} {t.messagesLeft}
        </div>
      )}
      {!isGuest && fields.length > 0 && (
        <div className="flex gap-2 overflow-x-auto px-4 pt-3 pb-1 scrollbar-hide">
          <button onClick={() => setActiveFieldId(undefined)}
            className={clsx("whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition-colors",
              !activeFieldId ? "bg-primary text-white" : "bg-background border border-border/50 text-muted hover:text-foreground")}>
            {t.allFields}
          </button>
          {fields.map(f => (
            <button key={f.id} onClick={() => setActiveFieldId(f.id)}
              className={clsx("whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition-colors",
                activeFieldId === f.id ? "bg-primary text-white" : "bg-background border border-border/50 text-muted hover:text-foreground")}>
              {f.name}
            </button>
          ))}
        </div>
      )}
      {attachments.length > 0 && (
        <div className="flex gap-2 overflow-x-auto px-4 pt-3 pb-1">
          {attachments.map((att, i) => (
            <div key={i} className="relative h-16 w-16 flex-shrink-0">
              {att.file.type.startsWith('image/') ? (
                <img src={att.previewUrl} alt="preview" className="h-full w-full rounded-xl object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center rounded-xl bg-muted/20">
                  <FileText className="h-8 w-8 text-muted" />
                </div>
              )}
              <button onClick={() => removeAttachment(i)}
                className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white shadow-sm hover:bg-red-600">
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="relative flex items-end gap-2 px-4 py-3">
        {showAttachmentSheet && (
          <div className="absolute bottom-full left-4 mb-2 w-52 rounded-xl bg-surface p-2 shadow-lg border border-border/50">
            <button className="flex w-full items-center gap-3 rounded-lg p-3 text-left text-sm hover:bg-muted/10 text-foreground"
              onClick={() => { cameraInputRef.current?.click(); setShowAttachmentSheet(false); }}>
              <Camera className="h-5 w-5 text-muted" />{t.takePhoto}
            </button>
            <button className="flex w-full items-center gap-3 rounded-lg p-3 text-left text-sm hover:bg-muted/10 text-foreground"
              onClick={() => { fileInputRef.current?.click(); setShowAttachmentSheet(false); }}>
              <Image className="h-5 w-5 text-muted" />{t.choosePhoto}
            </button>
            <button className="flex w-full items-center gap-3 rounded-lg p-3 text-left text-sm hover:bg-muted/10 text-foreground"
              onClick={() => { fileInputRef.current?.click(); setShowAttachmentSheet(false); }}>
              <FileText className="h-5 w-5 text-muted" />{t.uploadFile}
            </button>
          </div>
        )}
        <input type="file" ref={cameraInputRef} className="hidden" accept="image/*" capture="environment" onChange={handleFileSelect} />
        <input type="file" ref={fileInputRef} className="hidden" accept="image/jpeg,image/png,image/webp,image/heic,application/pdf" multiple onChange={handleFileSelect} />
        <button onClick={() => setShowAttachmentSheet(!showAttachmentSheet)}
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-muted hover:text-foreground transition-colors">
          <Paperclip className="h-5 w-5" />
        </button>
        <button onClick={toggleListening}
          className={clsx("flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full transition-colors",
            isListening ? "text-red-500 animate-pulse bg-red-500/10" : "text-muted hover:text-foreground")}>
          <Mic className="h-5 w-5" />
        </button>
        <div className="relative flex-1">
          <textarea ref={textareaRef} value={input} onChange={handleInput} onKeyDown={handleKeyDown}
            placeholder={isListening ? t.listening : t.inputPlaceholder}
            className="max-h-[120px] min-h-[40px] w-full resize-none rounded-[22px] border border-border/50 bg-background px-4 py-2.5 text-[15px] text-foreground placeholder:text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            rows={1} />
        </div>
        <button onClick={() => handleSend()} disabled={isTyping || (!input.trim() && attachments.length === 0)}
          className={clsx("flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[14px] transition-colors duration-150",
            (!input.trim() && attachments.length === 0) || isTyping ? "bg-muted/50 text-muted-foreground" : "bg-primary text-white hover:bg-primary/90")}>
          <Send className="h-5 w-5" />
        </button>
      </div>
    </div>
  );

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
            <button onClick={() => setSidebarOpen(true)} className="text-muted hover:text-foreground transition-colors">
              <Menu className="h-5 w-5" />
            </button>
            <Leaf className="h-[18px] w-[18px] text-primary" />
            <span className="text-[16px] font-medium text-primary">Oli</span>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={clearChat} className="text-muted hover:text-foreground transition-colors">
              <SquarePen className="h-5 w-5" />
            </button>
            <button onClick={() => navigate('/profile')}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/20 text-sm font-medium text-primary">
              {user?.email ? user.email[0].toUpperCase() : 'G'}
            </button>
          </div>
        </header>

        {/* Desktop header — only when chat active */}
        {messages.length > 0 && (
          <header className="hidden md:flex h-12 flex-shrink-0 items-center justify-end border-b border-border/50 bg-surface px-6 gap-3">
            <button onClick={clearChat} className="text-muted hover:text-foreground transition-colors" title={t.newChat}>
              <SquarePen className="h-5 w-5" />
            </button>
            <button onClick={() => navigate('/profile')}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/20 text-sm font-medium text-primary">
              {user?.email ? user.email[0].toUpperCase() : 'G'}
            </button>
          </header>
        )}

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
                <textarea ref={textareaRef} value={input} onChange={handleInput} onKeyDown={handleKeyDown}
                  placeholder={t.inputPlaceholder} rows={1}
                  className="max-h-[120px] min-h-[52px] w-full resize-none rounded-[22px] border border-border/50 bg-surface px-5 py-3.5 pr-14 text-[15px] text-foreground placeholder:text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary" />
                <button onClick={() => handleSend()} disabled={isTyping || (!input.trim() && attachments.length === 0)}
                  className={clsx("absolute right-2 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-[14px] transition-colors duration-150",
                    (!input.trim() && attachments.length === 0) || isTyping ? "bg-muted/50 text-muted-foreground" : "bg-primary text-white hover:bg-primary/90")}>
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
              <Leaf className="mb-4 h-12 w-12 text-primary" />
              <h1 className="mb-2 text-[28px] font-semibold text-primary">Oli</h1>
              <p className="text-sm text-muted">{t.chatSubtitle}</p>
              <div className="mt-6 grid w-full max-w-md grid-cols-2 gap-3">
                {t.suggestions.map((sugg, i) => (
                  <button key={i} onClick={() => handleSend(sugg)}
                    className="rounded-2xl border border-border bg-surface px-4 py-3 text-left text-sm text-foreground transition-transform active:scale-[0.97]">
                    {sugg}
                  </button>
                ))}
              </div>
              <div className="mt-6 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                {isGuest ? t.guestMode : activeField?.growing_medium ?? 'Oli'}
              </div>
            </div>
            <InputBar />
          </div>
        )}

        {/* ── CHAT ACTIVE (both desktop + mobile) ── */}
        {messages.length > 0 && (
          <div className="flex flex-1 flex-col min-h-0">
            <div className="flex-1 overflow-y-auto px-4 py-4 md:px-6 md:py-6">
              <div className="mx-auto max-w-2xl">
                <MessagesList />
              </div>
            </div>
            <div className="flex-shrink-0">
              <div className="mx-auto max-w-2xl md:px-2 md:pb-4">
                <InputBar />
              </div>
            </div>
          </div>
        )}

      </div>

      <PaywallModal isOpen={showPaywall} onClose={() => setShowPaywall(false)} />

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
