import { Leaf, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../lib/LanguageContext';
import { useAuth } from '../hooks/useAuth';

interface Props { isOpen: boolean; onClose: () => void; }

export default function SignInModal({ isOpen, onClose }: Props) {
  const { t } = useLanguage();
  const { exitGuest } = useAuth();
  const navigate = useNavigate();

  if (!isOpen) return null;

  const handleSignIn = () => {
    onClose();
    exitGuest();           // clears localStorage + sets isGuest=false in context
    navigate('/auth');     // now /auth will render properly (no redirect loop)
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-sm rounded-2xl border border-border bg-surface p-6 shadow-2xl">
        <button onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-1 text-muted hover:bg-background hover:text-foreground transition-colors">
          <X className="h-5 w-5" />
        </button>

        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <Leaf className="h-7 w-7 text-primary" />
          </div>
          <h2 className="mb-1 text-xl font-bold text-foreground">{t.signInToUse}</h2>
          <p className="text-sm text-muted">{t.signInToUseBody}</p>
        </div>

        <div className="space-y-3">
          <button onClick={handleSignIn}
            className="w-full rounded-[22px] bg-primary px-4 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90">
            {t.signInBtn}
          </button>
          <button onClick={onClose}
            className="w-full rounded-[22px] border border-border bg-background px-4 py-3 text-sm font-medium text-muted transition-colors hover:text-foreground">
            {t.continueAsGuest}
          </button>
        </div>
      </div>
    </div>
  );
}
