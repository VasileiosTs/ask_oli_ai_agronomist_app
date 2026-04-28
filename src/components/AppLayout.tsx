import { Outlet } from 'react-router-dom';
import BottomNav from './BottomNav';

export default function AppLayout() {
  return (
    <div className="flex h-[100dvh] w-full flex-col bg-background text-foreground pt-safe">
      <Outlet />
      <BottomNav />
    </div>
  );
}
