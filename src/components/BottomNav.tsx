import { NavLink } from 'react-router-dom';
import { MessageCircle, Sprout, User } from 'lucide-react';

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-12 w-full items-center justify-around border-t border-border bg-surface pb-safe">
      <NavLink
        to="/chat"
        className={({ isActive }) =>
          `flex flex-col items-center justify-center w-full h-full transition-colors ${
            isActive ? 'text-primary' : 'text-muted hover:text-foreground'
          }`
        }
      >
        <MessageCircle className="h-5 w-5" />
      </NavLink>
      <NavLink
        to="/fields"
        className={({ isActive }) =>
          `flex flex-col items-center justify-center w-full h-full transition-colors ${
            isActive ? 'text-primary' : 'text-muted hover:text-foreground'
          }`
        }
      >
        <Sprout className="h-5 w-5" />
      </NavLink>
      <NavLink
        to="/profile"
        className={({ isActive }) =>
          `flex flex-col items-center justify-center w-full h-full transition-colors ${
            isActive ? 'text-primary' : 'text-muted hover:text-foreground'
          }`
        }
      >
        <User className="h-5 w-5" />
      </NavLink>
    </nav>
  );
}
