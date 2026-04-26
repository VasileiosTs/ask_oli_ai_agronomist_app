import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../lib/LanguageContext';
import OliLogo from '../components/OliLogo';
import { Eye, EyeOff, CheckCircle2 } from 'lucide-react';

export default function UpdatePassword() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const navigate = useNavigate();
  const { lang } = useLanguage();
  const isEl = lang === 'el';

  const inputStyle = {
    background: '#f5f4ef',
    color: '#1b1c19',
    border: '1px solid #e3e3de',
  };
  const onFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.borderColor = '#194121';
    e.currentTarget.style.boxShadow = '0 0 0 2px rgba(25,65,33,0.15)';
  };
  const onBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.borderColor = '#e3e3de';
    e.currentTarget.style.boxShadow = 'none';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      setError(isEl ? 'Τουλάχιστον 8 χαρακτήρες.' : 'At least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError(isEl ? 'Οι κωδικοί δεν ταιριάζουν.' : 'Passwords do not match.');
      return;
    }
    setLoading(true);
    setError('');
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setError(error.message);
    } else {
      setDone(true);
      setTimeout(() => navigate('/chat', { replace: true }), 2000);
    }
    setLoading(false);
  };

  return (
    <div className="flex min-h-[100dvh] items-center justify-center p-4"
      style={{ background: '#faf9f4', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <main className="w-full max-w-[420px] rounded-[24px] bg-white p-8 md:p-10"
        style={{ boxShadow: '0 8px 40px rgba(25,65,33,0.08)', border: '1px solid rgba(194, 201, 187, 0.2)' }}>

        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4">
            <OliLogo size={48} bg="#faf9f4" />
          </div>
          <h1 className="text-xl font-bold" style={{ color: '#194121' }}>
            {isEl ? 'Νέος κωδικός πρόσβασης' : 'Set new password'}
          </h1>
        </div>

        {done ? (
          <div className="flex flex-col items-center text-center gap-4 animate-fade-in">
            <div className="flex h-14 w-14 items-center justify-center rounded-full" style={{ background: '#c0eec0' }}>
              <CheckCircle2 className="h-7 w-7" style={{ color: '#194121' }} />
            </div>
            <div>
              <p className="font-semibold" style={{ color: '#194121' }}>
                {isEl ? 'Κωδικός ενημερώθηκε!' : 'Password updated!'}
              </p>
              <p className="text-sm mt-1" style={{ color: '#606659' }}>
                {isEl ? 'Μεταφορά...' : 'Redirecting...'}
              </p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'} required autoFocus
                value={password} onChange={e => setPassword(e.target.value)}
                placeholder={isEl ? 'Νέος κωδικός (min 8)' : 'New password (min 8 chars)'}
                className="w-full rounded-full px-5 py-3.5 text-sm focus:outline-none pr-12"
                style={inputStyle} onFocus={onFocus} onBlur={onBlur}
              />
              <button type="button" onClick={() => setShowPw(v => !v)}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-1"
                style={{ color: '#606659' }}
                aria-label={showPw ? 'Hide password' : 'Show password'}>
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <input
              type={showPw ? 'text' : 'password'} required
              value={confirm} onChange={e => setConfirm(e.target.value)}
              placeholder={isEl ? 'Επιβεβαίωση κωδικού' : 'Confirm password'}
              className="w-full rounded-full px-5 py-3.5 text-sm focus:outline-none"
              style={inputStyle} onFocus={onFocus} onBlur={onBlur}
            />
            {error && <p className="px-2 text-xs" style={{ color: '#ba1a1a' }}>{error}</p>}
            <button
              type="submit"
              disabled={loading || !password || !confirm}
              className="w-full rounded-full px-4 py-3.5 text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: 'linear-gradient(135deg, #194121 0%, #305936 100%)' }}
            >
              {loading ? '...' : isEl ? 'Αποθήκευση κωδικού' : 'Save password'}
            </button>
          </form>
        )}
      </main>
    </div>
  );
}
