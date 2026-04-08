import { useLocation, useNavigate } from 'react-router-dom';
import { MessageCircle, User, Users, Building2 } from 'lucide-react';
import { useLanguage } from '../lib/LanguageContext';
import { useAuth } from '../hooks/useAuth';
import { isUnlimitedTier } from '../../shared/subscription';
import clsx from 'clsx';

export default function BottomNav() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { t, lang } = useLanguage();
  const { profile } = useAuth();

  const tier = typeof profile?.tier === 'string' ? profile.tier : null;
  const showClients = isUnlimitedTier(tier);

  const isEnterprise = tier === 'enterprise';

  const tabs = [
    { path: '/chat', icon: MessageCircle, label: t.navChat },
    ...(showClients ? [{ path: '/clients', icon: Users, label: lang === 'el' ? 'Παραγωγοί' : 'Clients' }] : []),
    ...(isEnterprise ? [{ path: '/cooperative', icon: Building2, label: lang === 'el' ? 'Συνεταιρισμός' : 'Coop' }] : []),
    { path: '/profile', icon: User, label: t.navProfile },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 border-t border-border/50 bg-surface/95 backdrop-blur-md pb-safe">
      <div className="flex items-center justify-around h-14">
        {tabs.map(({ path, icon: Icon, label }) => {
          const active = pathname === path || pathname.startsWith(path + '/');
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              aria-label={label}
              className={clsx(
                'flex flex-1 flex-col items-center gap-0.5 py-1.5 transition-colors',
                active ? 'text-primary' : 'text-muted'
              )}
            >
              <Icon className="h-5 w-5" strokeWidth={active ? 2.5 : 1.5} />
              <span className="text-[10px] font-medium">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
