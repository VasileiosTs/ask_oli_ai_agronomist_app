import { useState } from 'react';
import { X, Check } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../lib/LanguageContext';
import { trackEvent, Events } from '../lib/analytics';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialData: any;
  userId: string;
  fieldId: string | null;
  onSuccess: (interventionId: string) => void;
}

export function LogInterventionModal({ isOpen, onClose, initialData, userId, fieldId, onSuccess }: Props) {
  const { t } = useLanguage();
  const [cropType, setCropType] = useState(initialData?.crop_mentioned || '');
  const [problem, setProblem] = useState(initialData?.diagnosis_data?.problem || '');
  const [product, setProduct] = useState(initialData?.diagnosis_data?.product_applied || '');
  const [dosage, setDosage] = useState(initialData?.diagnosis_data?.dosage || '');
  const [method, setMethod] = useState(initialData?.diagnosis_data?.application_method || '');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showFollowUp, setShowFollowUp] = useState(false);
  const [interventionId, setInterventionId] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleLog = async () => {
    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.from('interventions').insert({
        user_id: userId,
        field_id: fieldId,
        crop_type: cropType,
        problem: problem,
        product_applied: product,
        dosage: dosage,
        application_method: method,
        notes: notes,
        date: new Date().toISOString().split('T')[0],
        applied_at: new Date().toISOString(),
      }).select('id').single();

      if (error) throw error;
      if (data) { setInterventionId(data.id); setShowFollowUp(true); }
    } catch (e) {
      console.error('Error logging intervention', e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFollowUp = async (yes: boolean) => {
    if (yes && interventionId) {
      // VIO multi-step: first check-in at 3 days ("did you apply?")
      const followUp = new Date();
      followUp.setDate(followUp.getDate() + 3);
      await supabase.from('interventions').update({
        follow_up_at: followUp.toISOString(),
        vio_step: 1,
      }).eq('id', interventionId);
    }
    trackEvent(Events.INTERVENTION_LOGGED, { withFollowUp: yes });
    onSuccess(interventionId!);
    onClose();
  };

  const inputCls = "w-full rounded-xl border border-border/50 bg-surface px-4 py-2.5 text-[15px] text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary";

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-t-[32px] sm:rounded-[32px] bg-background p-6 shadow-xl max-h-[90dvh] overflow-y-auto">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-foreground">
            {showFollowUp ? t.setReminder : t.logIntervention}
          </h2>
          <button onClick={onClose} className="rounded-full p-2 text-muted hover:bg-muted/10 hover:text-foreground transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {!showFollowUp ? (
          <div className="space-y-4">
            {[
              { label: t.cropType, value: cropType, set: setCropType },
              { label: t.problem, value: problem, set: setProblem },
              { label: t.product, value: product, set: setProduct },
              { label: t.dosage, value: dosage, set: setDosage },
              { label: t.appMethod, value: method, set: setMethod },
            ].map(({ label, value, set }) => (
              <div key={label}>
                <label className="mb-1.5 block text-sm font-medium text-foreground">{label}</label>
                <input type="text" value={value} onChange={e => set(e.target.value)} className={inputCls} />
              </div>
            ))}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">{t.notes}</label>
              <textarea
                value={notes} onChange={e => setNotes(e.target.value)} rows={3}
                className="w-full resize-none rounded-xl border border-border/50 bg-surface px-4 py-2.5 text-[15px] text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <button onClick={handleLog} disabled={isSubmitting}
              className="mt-2 w-full rounded-xl bg-primary py-3.5 text-[15px] font-semibold text-white shadow-sm transition-all hover:bg-primary/90 active:scale-[0.98] disabled:opacity-70">
              {isSubmitting ? t.logging : t.logIt}
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center py-6 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10">
              <Check className="h-8 w-8 text-green-500" />
            </div>
            <h3 className="mb-2 text-xl font-semibold text-foreground">{t.interventionLogged}</h3>
            <p className="mb-8 text-muted">{t.reminderQuestion}</p>
            <div className="flex w-full gap-3">
              <button onClick={() => handleFollowUp(false)}
                className="flex-1 rounded-xl border border-border bg-surface py-3 text-[15px] font-medium text-foreground transition-colors hover:bg-muted/10">
                {t.noThanks}
              </button>
              <button onClick={() => handleFollowUp(true)}
                className="flex-1 rounded-xl bg-primary py-3 text-[15px] font-medium text-white transition-colors hover:bg-primary/90">
                {t.setReminder}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
