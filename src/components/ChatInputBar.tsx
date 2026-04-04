import { useRef } from 'react';
import { Paperclip, Mic, Send, Camera, Image, FileText, X } from 'lucide-react';
import clsx from 'clsx';
import type { T } from '../lib/i18n';
import { FREE_MESSAGE_LIMIT as FREE_LIMIT, MAX_ATTACHMENTS, ALLOWED_FILE_ACCEPT } from '../lib/constants';

export interface ChatInputBarProps {
  input: string;
  attachments: { file: File; previewUrl: string }[];
  isTyping: boolean;
  isListening: boolean;
  hasUnlimitedMessages: boolean;
  messageCount: number;
  showAttachmentSheet: boolean;
  t: T;
  lang: string;
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  fileInputRef: React.RefObject<HTMLInputElement>;
  cameraInputRef: React.RefObject<HTMLInputElement>;
  onInput: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onSend: () => void;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveAttachment: (index: number) => void;
  onToggleListening: () => void;
  onToggleAttachmentSheet: (open: boolean) => void;
}

export default function ChatInputBar({
  input,
  attachments,
  isTyping,
  isListening,
  hasUnlimitedMessages,
  messageCount,
  showAttachmentSheet,
  t,
  textareaRef,
  fileInputRef,
  cameraInputRef,
  onInput,
  onKeyDown,
  onSend,
  onFileSelect,
  onRemoveAttachment,
  onToggleListening,
  onToggleAttachmentSheet,
}: ChatInputBarProps) {
  return (
    <div className="border-t border-border/50 bg-surface/95 backdrop-blur-sm mb-14 md:mb-0">
      {!hasUnlimitedMessages && messageCount >= FREE_LIMIT - 3 && (
        <div className="bg-amber-500/10 py-1.5 text-center text-xs text-amber-400">
          {FREE_LIMIT - messageCount} {t.messagesLeft}
        </div>
      )}
      {/* Field selector removed — field context is auto-detected per message.
           Fields are still tracked in backend for data/AI improvement. */}
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
              <button onClick={() => onRemoveAttachment(i)}
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
              onClick={() => { cameraInputRef.current?.click(); onToggleAttachmentSheet(false); }}>
              <Camera className="h-5 w-5 text-muted" />{t.takePhoto}
            </button>
            <button className="flex w-full items-center gap-3 rounded-lg p-3 text-left text-sm hover:bg-muted/10 text-foreground"
              onClick={() => { fileInputRef.current?.click(); onToggleAttachmentSheet(false); }}>
              <Image className="h-5 w-5 text-muted" />{t.choosePhoto}
            </button>
            <button className="flex w-full items-center gap-3 rounded-lg p-3 text-left text-sm hover:bg-muted/10 text-foreground"
              onClick={() => { fileInputRef.current?.click(); onToggleAttachmentSheet(false); }}>
              <FileText className="h-5 w-5 text-muted" />{t.uploadFile}
            </button>
          </div>
        )}
        <input type="file" ref={cameraInputRef} className="hidden" accept="image/*" capture="environment" onChange={onFileSelect} />
        <input type="file" ref={fileInputRef} className="hidden" accept={ALLOWED_FILE_ACCEPT} multiple onChange={onFileSelect} />
        <button onClick={() => onToggleAttachmentSheet(!showAttachmentSheet)} aria-label="Attach file"
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-muted hover:text-foreground transition-colors">
          <Paperclip className="h-5 w-5" />
        </button>
        <button onClick={onToggleListening} aria-label="Voice input"
          className={clsx("flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full transition-colors",
            isListening ? "text-red-500 animate-pulse bg-red-500/10" : "text-muted hover:text-foreground")}>
          <Mic className="h-5 w-5" />
        </button>
        <div className="relative flex-1">
          <textarea ref={textareaRef} value={input} onChange={onInput} onKeyDown={onKeyDown}
            aria-label={t.inputPlaceholder}
            placeholder={isListening ? t.listening : t.inputPlaceholder}
            className="max-h-[120px] min-h-[40px] w-full resize-none rounded-[22px] border border-border/50 bg-background px-4 py-2.5 text-[15px] text-foreground placeholder:text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            rows={1} />
        </div>
        <button onClick={onSend} disabled={isTyping || (!input.trim() && attachments.length === 0)} aria-label="Send message"
          className={clsx("flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[14px] transition-colors duration-150",
            (!input.trim() && attachments.length === 0) || isTyping ? "bg-muted/50 text-muted/70" : "bg-primary text-white hover:bg-primary/90")}>
          <Send className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
