import OliLogo from './OliLogo';

export default function LoadingSpinner() {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <OliLogo size={40} bg="#0D1117" animate="cascade" />
    </div>
  );
}
