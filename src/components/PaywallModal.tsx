import { X } from 'lucide-react';

interface PaywallModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function PaywallModal({ isOpen, onClose }: PaywallModalProps) {
  if (!isOpen) return null;

  const handleCheckout = async (plan: 'monthly' | 'yearly') => {
    // In a real app, this would call a Stripe Edge Function
    console.log(`Checkout initiated for ${plan} plan`);
    alert(`Stripe checkout for ${plan} plan would open here.`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-1 text-muted hover:bg-background hover:text-foreground transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="mb-6 text-center">
          <h2 className="mb-2 text-2xl font-bold text-foreground">Xekleidwste to Oli Pro</h2>
          <p className="text-sm text-muted">
            Exete ftasei to orio twn dorean minimatwn gia ayto to mina.
            Anavathmiste gia aperioristi prosvasi.
          </p>
        </div>

        <div className="space-y-4">
          <button
            onClick={() => handleCheckout('monthly')}
            className="group relative flex w-full items-center justify-between rounded-xl border border-border bg-background p-4 transition-all hover:border-primary hover:ring-1 hover:ring-primary"
          >
            <div className="flex flex-col items-start">
              <span className="font-semibold text-foreground">Miniaio Plano</span>
              <span className="text-sm text-muted">Aperiorista minimata</span>
            </div>
            <div className="text-right">
              <span className="text-lg font-bold text-foreground">€4.99</span>
              <span className="block text-xs text-muted">/ minas</span>
            </div>
          </button>

          <button
            onClick={() => handleCheckout('yearly')}
            className="group relative flex w-full items-center justify-between rounded-xl border-2 border-primary bg-primary/5 p-4 transition-all hover:bg-primary/10"
          >
            <div className="absolute -top-3 left-4 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
              -18% Oikonomia
            </div>
            <div className="flex flex-col items-start">
              <span className="font-semibold text-foreground">Etisio Plano</span>
              <span className="text-sm text-muted">Aperiorista minimata</span>
            </div>
            <div className="text-right">
              <span className="text-lg font-bold text-foreground">€49</span>
              <span className="block text-xs text-muted">/ etos</span>
            </div>
          </button>
        </div>

        <div className="mt-6 text-center">
          <p className="text-xs text-muted">
            Mporeite na akyrwsete opoiadipote stigmi.
          </p>
        </div>
      </div>
    </div>
  );
}
