import { X, Copy, Share2, Check, MessageCircle, Send, Mail, Facebook, Twitter } from 'lucide-react';
import { useState } from 'react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  url: string;
  title?: string;
  text?: string;
  lang: string;
}

export default function ShareModal({ isOpen, onClose, url, title, text, lang }: Props) {
  const [copiedTarget, setCopiedTarget] = useState<'link' | 'text' | null>(null);
  if (!isOpen) return null;

  const l = lang === 'el' ? 'el' : 'en';
  const labels = {
    share: { en: 'Share', el: 'Κοινοποίηση' },
    copyLink: { en: 'Copy link', el: 'Αντιγραφή συνδέσμου' },
    copyText: { en: 'Copy answer', el: 'Αντιγραφή απάντησης' },
    copied: { en: 'Copied!', el: 'Αντιγράφηκε!' },
    scanQR: { en: 'Scan QR code', el: 'Σαρώστε τον κωδικό QR' },
    nativeShare: { en: 'Share via...', el: 'Κοινοποίηση μέσω...' },
    whatsapp: { en: 'Share on WhatsApp', el: 'Κοινοποίηση στο WhatsApp' },
    telegram: { en: 'Share on Telegram', el: 'Κοινοποίηση στο Telegram' },
    facebook: { en: 'Share on Facebook', el: 'Κοινοποίηση στο Facebook' },
    x: { en: 'Share on X', el: 'Κοινοποίηση στο X' },
    email: { en: 'Share by email', el: 'Κοινοποίηση με email' },
  };

  const shareText = [title, text, url].filter(Boolean).join('\n\n');

  const openShareLink = (shareUrl: string) => {
    window.open(shareUrl, '_blank', 'noopener,noreferrer');
  };

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}`;

  const handleCopy = async (value: string, target: 'link' | 'text') => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedTarget(target);
      setTimeout(() => setCopiedTarget(null), 2000);
    } catch { /* fallback */ }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: title || 'Oli Report', text, url });
      } catch { /* user cancelled */ }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-foreground">{labels.share[l]}</h3>
          <button onClick={onClose} className="rounded-full p-1 text-muted hover:text-foreground transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* QR Code */}
        <div className="flex justify-center mb-4">
          <div className="rounded-xl bg-white p-3">
            <img src={qrUrl} alt="QR Code" className="h-[160px] w-[160px]" loading="eager" />
          </div>
        </div>
        <p className="text-center text-xs text-muted mb-4">{labels.scanQR[l]}</p>

        {/* Actions */}
        <div className="space-y-2">
          {/* Copy link */}
          <button
            onClick={() => handleCopy(url, 'link')}
            className="flex w-full items-center gap-3 rounded-xl border border-border bg-background px-4 py-3 text-sm font-medium text-foreground hover:bg-surface transition-colors"
          >
            {copiedTarget === 'link' ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4 text-muted" />}
            {copiedTarget === 'link' ? labels.copied[l] : labels.copyLink[l]}
          </button>

          {text && (
            <button
              onClick={() => handleCopy(text, 'text')}
              className="flex w-full items-center gap-3 rounded-xl border border-border bg-background px-4 py-3 text-sm font-medium text-foreground hover:bg-surface transition-colors"
            >
              {copiedTarget === 'text' ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4 text-muted" />}
              {copiedTarget === 'text' ? labels.copied[l] : labels.copyText[l]}
            </button>
          )}

          <button
            onClick={() => openShareLink(`https://wa.me/?text=${encodeURIComponent(shareText)}`)}
            className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-white transition-colors"
            style={{ background: '#25D366' }}
          >
            <MessageCircle className="h-4 w-4" />
            {labels.whatsapp[l]}
          </button>

          <button
            onClick={() => openShareLink(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent([title, text].filter(Boolean).join('\n\n'))}`)}
            className="flex w-full items-center gap-3 rounded-xl bg-[#229ED9] px-4 py-3 text-sm font-medium text-white transition-colors hover:opacity-90"
          >
            <Send className="h-4 w-4" />
            {labels.telegram[l]}
          </button>

          <button
            onClick={() => openShareLink(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`)}
            className="flex w-full items-center gap-3 rounded-xl bg-[#1877F2] px-4 py-3 text-sm font-medium text-white transition-colors hover:opacity-90"
          >
            <Facebook className="h-4 w-4" />
            {labels.facebook[l]}
          </button>

          <button
            onClick={() => openShareLink(`https://twitter.com/intent/tweet?text=${encodeURIComponent([title, text].filter(Boolean).join('\n\n'))}&url=${encodeURIComponent(url)}`)}
            className="flex w-full items-center gap-3 rounded-xl bg-black px-4 py-3 text-sm font-medium text-white transition-colors hover:opacity-90"
          >
            <Twitter className="h-4 w-4" />
            {labels.x[l]}
          </button>

          <button
            onClick={() => {
              window.location.href = `mailto:?subject=${encodeURIComponent(title || 'Oli Report')}&body=${encodeURIComponent(shareText)}`;
            }}
            className="flex w-full items-center gap-3 rounded-xl border border-border bg-background px-4 py-3 text-sm font-medium text-foreground hover:bg-surface transition-colors"
          >
            <Mail className="h-4 w-4 text-muted" />
            {labels.email[l]}
          </button>

          {/* Native share (mobile) */}
          {typeof navigator.share === 'function' && (
            <button
              onClick={handleNativeShare}
              className="flex w-full items-center gap-3 rounded-xl bg-primary px-4 py-3 text-sm font-medium text-white hover:bg-primary/90 transition-colors"
            >
              <Share2 className="h-4 w-4" />
              {labels.nativeShare[l]}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
