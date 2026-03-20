import { Outlet } from 'react-router-dom';

export default function AppLayout() {
  return (
    <div className="flex h-[100dvh] w-full flex-col bg-background text-foreground">
      <Outlet />
    </div>
  );
}
