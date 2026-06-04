import { useNavigate } from 'react-router-dom';
import { Leaf } from 'lucide-react';
import OliLogo from './OliLogo';

interface Props {
  /** Icon size in px. Default 18. */
  size?: number;
  /** Render the lucide Leaf mark instead of the OliLogo clover (matches the legacy ChatLayout header). */
  useLeaf?: boolean;
  /** Background hex the mark sits on, used by OliLogo to auto-pick ink. Default '#161C23'. */
  bg?: string;
  /** Wordmark text classes. Default matches the chat header. */
  labelClassName?: string;
  /** Extra classes on the button wrapper (e.g. 'ml-auto'). */
  className?: string;
  /** Fired after navigation, e.g. to close a mobile sidebar. */
  onNavigate?: () => void;
}

/** Tappable Oli mark + wordmark that routes to the app home (/chat) from any page. */
export default function OliHomeLink({
  size = 18,
  useLeaf = false,
  bg = '#161C23',
  labelClassName = 'text-[16px] font-medium text-primary',
  className = '',
  onNavigate,
}: Props) {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={() => { navigate('/chat'); onNavigate?.(); }}
      aria-label="Go to Oli home"
      className={`flex items-center gap-2 transition-opacity active:opacity-70 ${className}`}
    >
      {useLeaf
        ? <Leaf size={size} className="text-primary" />
        : <OliLogo size={size} bg={bg} />}
      <span className={labelClassName}>Oli</span>
    </button>
  );
}
