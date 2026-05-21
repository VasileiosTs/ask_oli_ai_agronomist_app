import { X, Copy, Share2, Check, MessageCircle, Send, Mail, Facebook, Twitter, Linkedin } from 'lucide-react';
import { useState } from 'react';

function RedditIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
      <path d="M22 12a2 2 0 0 0-2-2 2 2 0 0 0-1.37.55C17.06 9.7 15.12 9.12 13 9l.9-4.1 2.83.6a1.5 1.5 0 1 0 1.52-1.5 1.5 1.5 0 0 0-1.35.84L14 4.22 12.79 9c-2.12.1-4.06.68-5.52 1.6A2 2 0 0 0 4 12a2 2 0 0 0 1 1.73 3.7 3.7 0 0 0 0 .44c0 2.72 3.13 4.93 7 4.93s7-2.21 7-4.93a3.7 3.7 0 0 0 0-.44A2 2 0 0 0 22 12zm-10 4.16c-1.19 0-2-.68-2-.68s.46.18 2 .18 2-.18 2-.18-.81.68-2 .68zm3.5-2.5a1 1 0 1 1 0-2 1 1 0 0 1 0 2zm-7 0a1 1 0 1 1 0-2 1 1 0 0 1 0 2z"/>
    </svg>
  );
}

function LineIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
      <path d="M19.95 12.06c0-3.86-3.87-7-8.63-7S2.69 8.2 2.69 12.06c0 3.46 3.07 6.36 7.21 6.91.28.06.66.18.76.42.09.22.06.56.03.78l-.12.74c-.04.22-.17.85.75.46.92-.39 4.96-2.92 6.77-5A6.23 6.23 0 0 0 19.95 12.06zM9.2 14.07H7.67a.44.44 0 0 1-.44-.44V9.9a.44.44 0 0 1 .88 0v3.29H9.2a.44.44 0 0 1 0 .88zm1.67-.44a.44.44 0 0 1-.88 0V9.9a.44.44 0 0 1 .88 0zm5.08 0a.44.44 0 0 1-.81.23l-1.8-2.46v2.23a.44.44 0 0 1-.88 0V9.9a.44.44 0 0 1 .81-.23l1.8 2.46V9.9a.44.44 0 0 1 .88 0zm2.03-2.67a.44.44 0 0 1 0 .88h-1.08v.67h1.08a.44.44 0 0 1 0 .88h-1.53a.44.44 0 0 1-.44-.44V9.9a.44.44 0 0 1 .44-.44h1.53a.44.44 0 0 1 0 .88h-1.08v.66z"/>
    </svg>
  );
}

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
    viber: { en: 'Share on Viber', el: 'Κοινοποίηση στο Viber' },
    telegram: { en: 'Share on Telegram', el: 'Κοινοποίηση στο Telegram' },
    facebook: { en: 'Share on Facebook', el: 'Κοινοποίηση στο Facebook' },
    x: { en: 'Share on X', el: 'Κοινοποίηση στο X' },
    linkedin: { en: 'Share on LinkedIn', el: 'Κοινοποίηση στο LinkedIn' },
    reddit: { en: 'Share on Reddit', el: 'Κοινοποίηση στο Reddit' },
    line: { en: 'Share on Line', el: 'Κοινοποίηση στο Line' },
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
            onClick={() => openShareLink(`viber://forward?text=${encodeURIComponent(shareText)}`)}
            className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-white transition-colors hover:opacity-90"
            style={{ background: '#7360F2' }}
          >
            <MessageCircle className="h-4 w-4" />
            {labels.viber[l]}
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
            onClick={() => openShareLink(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`)}
            className="flex w-full items-center gap-3 rounded-xl bg-[#0A66C2] px-4 py-3 text-sm font-medium text-white transition-colors hover:opacity-90"
          >
            <Linkedin className="h-4 w-4" />
            {labels.linkedin[l]}
          </button>

          <button
            onClick={() => openShareLink(`https://reddit.com/submit?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title || '')}`)}
            className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-white transition-colors hover:opacity-90"
            style={{ background: '#FF4500' }}
          >
            <RedditIcon />
            {labels.reddit[l]}
          </button>

          <button
            onClick={() => openShareLink(`https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(url)}`)}
            className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-white transition-colors hover:opacity-90"
            style={{ background: '#00B900' }}
          >
            <LineIcon />
            {labels.line[l]}
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
