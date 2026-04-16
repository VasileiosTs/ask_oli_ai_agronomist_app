import { Component, ReactNode } from 'react';
import { Leaf } from 'lucide-react';

// Lazy Sentry reference — avoids pulling the full SDK into the critical bundle.
// Populated by the deferred dynamic import in main.tsx after first paint.
let _captureException: ((e: Error, extra: Record<string, unknown>) => void) | null = null;
import('../lib/sentry').then(({ Sentry }) => {
  _captureException = (e, extra) => Sentry.captureException(e, { extra });
});

interface Props { children: ReactNode; }
interface State { hasError: boolean; error?: Error; }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: any) {
    console.error('Oli error boundary caught:', error, info);
    _captureException?.(error, { componentStack: info.componentStack });
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    // Determine language from localStorage (class components cannot use hooks)
    const storedLang = localStorage.getItem('oli_lang_manual') || localStorage.getItem('oli_lang') || 'en';
    const isGreek = storedLang === 'el';

    return (
      <div className="flex h-[100dvh] flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          <Leaf className="h-8 w-8 text-primary" />
        </div>
        <div>
          <h2 className="mb-2 text-lg font-semibold text-foreground">
            {isGreek ? 'Κάτι πήγε στραβά' : 'Something went wrong'}
          </h2>
          <p className="text-sm text-muted">
            {isGreek ? 'Παρουσιάστηκε σφάλμα. Ανανεώστε τη σελίδα.' : 'An error occurred. Please refresh the page.'}
          </p>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
        >
          {isGreek ? 'Ανανέωση' : 'Refresh'}
        </button>
        {this.state.error && (
          <p className="text-[11px] text-muted/50 max-w-sm">{this.state.error.message}</p>
        )}
      </div>
    );
  }
}
