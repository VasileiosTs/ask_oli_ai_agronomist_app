import { Outlet } from 'react-router-dom';
import BottomNav from './BottomNav';

export default function AppLayout() {
  return (
    <div className="flex h-[100dvh] w-full flex-col bg-background text-foreground">
      <main className="flex-1 overflow-y-auto pb-12">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
