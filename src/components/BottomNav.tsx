import { useLocation, useNavigate } from 'react-router-dom';
import { MessageCircle, ClipboardList, Sprout, User } from 'lucide-react';
import { useLanguage } from '../lib/LanguageContext';
import clsx from 'clsx';

const tabs = [
  { path: '/chat', icon: MessageCircle, labelKey: 'navChat' as const },
  { path: '/history', icon: ClipboardList, labelKey: 'navHistory' as const },
  { path: '/fields', icon: Sprout, labelKey: 'navFields' as const },
  { path: '/profile', icon: User, labelKey: 'navProfile' as const },
];

export default function BottomNav() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { t } = useLanguage();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 border-t border-border/50 bg-surface/95 backdrop-blur-md" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
      <div className="flex items-center justify-around h-14">
        {tabs.map(({ path, icon: Icon, labelKey }) => {
          const active = pathname === path;
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              aria-label={t[labelKey]}
              className={clsx(
                'flex flex-col items-center gap-0.5 px-3 py-1 transition-colors',
                active ? 'text-primary' : 'text-muted'
              )}
            >
              <Icon className="h-5 w-5" strokeWidth={active ? 2.5 : 1.5} />
              <span className="text-[10px] font-medium">{t[labelKey]}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
