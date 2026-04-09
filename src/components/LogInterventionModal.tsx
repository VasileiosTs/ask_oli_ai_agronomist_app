import { useState } from 'react';
import { X, Check } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../lib/LanguageContext';
import { trackEvent, Events } from '../lib/analytics';

interface InterventionData {
  crop_mentioned?: string;
  diagnosis_data?: {
    problem?: string;
    product_applied?: string;
    dosage?: string;
    application_method?: string;
    confidence_score?: number;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialData: InterventionData;
  userId: string;
  fieldId: string | null;
  onSuccess: (interventionId: string) => void;
  userLat?: number | null;
  userLon?: number | null;
}

// Four possible outcome responses — the fourth ("Didn't apply it") is new and
// scientifically valuable: it tells the model advice was understood but not acted on.
type OutcomeChip = 'better' | 'same' | 'worse' | 'not_applied';

const OUTCOME_CHIPS: { value: OutcomeChip; labelEl: string; labelEn: string }[] = [
  { value: 'better',      labelEl: 'Βελτίωση',          labelEn: 'Better'          },
  { value: 'same',        labelEl: 'Ίδια κατάσταση',    labelEn: 'No change'       },
  { value: 'worse',       labelEl: 'Χειρότερα',         labelEn: 'Worse'           },
  { value: 'not_applied', labelEl: 'Δεν εφάρμοσα',      labelEn: "Didn't apply it" },
];

type ScoutTemplate = { problem: string; product: string; dosage: string; method: string };

const SCOUTING_TEMPLATES: Record<string, ScoutTemplate[]> = {
  tomato:   [
    { problem: 'Early Blight (Alternaria)',    product: 'Mancozeb 80% WP',        dosage: '250g/100L', method: 'Spray'   },
    { problem: 'Late Blight (Phytophthora)',   product: 'Metalaxyl+Mancozeb',      dosage: '250g/100L', method: 'Spray'   },
    { problem: 'Botrytis (Grey Mould)',        product: 'Iprodione 50%',           dosage: '150g/100L', method: 'Spray'   },
  ],
  grape:    [
    { problem: 'Powdery Mildew (Oidium)',      product: 'Sulphur WP 80%',          dosage: '300g/100L', method: 'Spray'   },
    { problem: 'Downy Mildew (Peronospora)',   product: 'Copper Hydroxide 35%',    dosage: '300g/100L', method: 'Spray'   },
    { problem: 'Botrytis Bunch Rot',           product: 'Fenhexamid 50%',          dosage: '150g/100L', method: 'Spray'   },
  ],
  olive:    [
    { problem: 'Olive Knot (Pseudomonas)',     product: 'Copper Oxychloride 50%',  dosage: '300g/100L', method: 'Spray'   },
    { problem: 'Olive Fly (Bactrocera)',       product: 'Spinosad 0.024%',         dosage: '1L/100L',   method: 'Bait spray'},
    { problem: 'Peacock Spot (Spilocea)',      product: 'Copper Hydroxide 35%',    dosage: '300g/100L', method: 'Spray'   },
  ],
  citrus:   [
    { problem: 'Brown Rot (Phytophthora)',     product: 'Fosetyl-Al 80%',          dosage: '250g/100L', method: 'Spray'   },
    { problem: 'Citrus Canker (Xanthomonas)', product: 'Copper Oxychloride 50%',  dosage: '300g/100L', method: 'Spray'   },
    { problem: 'Spider Mite',                  product: 'Abamectin 1.8% EC',       dosage: '50ml/100L', method: 'Spray'   },
  ],
  potato:   [
    { problem: 'Late Blight (Phytophthora)',   product: 'Chlorothalonil 75% WP',   dosage: '200g/100L', method: 'Spray'   },
    { problem: 'Common Scab (Streptomyces)',   product: 'Seed treatment — Thiram', dosage: '200g/100kg', method: 'Seed treatment'},
    { problem: 'Colorado Beetle',             product: 'Imidacloprid 35%',         dosage: '70ml/100L', method: 'Spray'   },
  ],
  pepper:   [
    { problem: 'Botrytis (Grey Mould)',        product: 'Iprodione 50%',           dosage: '150g/100L', method: 'Spray'   },
    { problem: 'Anthracnose (Colletotrichum)', product: 'Azoxystrobin 25%',        dosage: '80ml/100L', method: 'Spray'   },
    { problem: 'Powdery Mildew',               product: 'Myclobutanil 12.5% EC',   dosage: '40ml/100L', method: 'Spray'   },
  ],
};

function getTemplates(cropType: string): ScoutTemplate[] {
  const lc = cropType.toLowerCase();
  if (lc.includes('tomat') || lc.includes('ντομάτ')) return SCOUTING_TEMPLATES.tomato;
  if (lc.includes('grape') || lc.includes('vine') || lc.includes('αμπελ') || lc.includes('σταφύλ')) return SCOUTING_TEMPLATES.grape;
  if (lc.includes('olive') || lc.includes('ελι') || lc.includes('ελαι')) return SCOUTING_TEMPLATES.olive;
  if (lc.includes('citrus') || lc.includes('lemon') || lc.includes('orange') || lc.includes('εσπεριδ') || lc.includes('λεμόν') || lc.includes('πορτοκάλ')) return SCOUTING_TEMPLATES.citrus;
  if (lc.includes('potato') || lc.includes('πατάτ')) return SCOUTING_TEMPLATES.potato;
  if (lc.includes('pepper') || lc.includes('πιπεριά') || lc.includes('πιπερι')) return SCOUTING_TEMPLATES.pepper;
  return [];
}

export function LogInterventionModal({
  isOpen, onClose, initialData, userId, fieldId, onSuccess, userLat, userLon,
}: Props) {
  const { t, lang } = useLanguage();

  // ── Form state ──
  const [cropType, setCropType]   = useState(initialData?.crop_mentioned ?? '');
  const [problem, setProblem]     = useState(initialData?.diagnosis_data?.problem ?? '');
  const [product, setProduct]     = useState(initialData?.diagnosis_data?.product_applied ?? '');
  const [dosage, setDosage]       = useState(initialData?.diagnosis_data?.dosage ?? '');
  const [method, setMethod]       = useState(initialData?.diagnosis_data?.application_method ?? '');
  const [notes, setNotes]         = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // ── VIO flow state ──
  const [stage, setStage]         = useState<'form' | 'follow_up' | 'outcome'>('form');
  const [interventionId, setInterventionId] = useState<string | null>(null);

  // ── Outcome note state ──
  // Shown after the user taps Better/Same/Worse/Didn't-apply
  const [selectedOutcome, setSelectedOutcome]   = useState<OutcomeChip | null>(null);
  const [outcomeNote, setOutcomeNote]            = useState('');
  const [isSavingOutcome, setIsSavingOutcome]    = useState(false);

  if (!isOpen) return null;

  // ── Step 1: Log the intervention ──
  const handleLog = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const confScore = typeof initialData.diagnosis_data?.confidence_score === 'number'
        ? initialData.diagnosis_data.confidence_score
        : null;
      const { data, error } = await supabase
        .from('interventions')
        .insert({
          user_id:            userId,
          field_id:           fieldId,
          crop_type:          cropType,
          problem:            problem,
          product_applied:    product,
          dosage:             dosage,
          application_method: method,
          notes:              notes,
          date:               new Date().toISOString().split('T')[0],
          applied_at:         new Date().toISOString(),
          ...(confScore !== null ? { confidence_score: confScore } : {}),
          ...(typeof userLat === 'number' ? { location_lat: userLat } : {}),
          ...(typeof userLon === 'number' ? { location_lon: userLon } : {}),
        })
        .select('id')
        .single();

      if (error) throw error;
      if (data) {
        setInterventionId(data.id);
        setStage('follow_up');
      }
    } catch (e) {
      console.error('Error logging intervention', e);
      setErrorMessage(
        lang === 'el'
          ? 'Αποτυχία αποθήκευσης. Δοκιμάστε ξανά.'
          : 'Failed to save. Please try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Step 2: Set follow-up reminder ──
  const handleFollowUp = async (wantsReminder: boolean) => {
    if (wantsReminder && interventionId) {
      const followUpAt = new Date();
      followUpAt.setDate(followUpAt.getDate() + 3); // VIO Step 1: 3 days
      const { error } = await supabase
        .from('interventions')
        .update({ follow_up_at: followUpAt.toISOString(), vio_step: 1 })
        .eq('id', interventionId);
      if (error) console.error('Failed to set follow-up:', error);
    }
    trackEvent(Events.INTERVENTION_LOGGED, { withFollowUp: wantsReminder });
    onSuccess(interventionId!);
    onClose();
  };

  // ── Step 3 (optional): Outcome chip tapped — show note input ──
  const handleOutcomeChipTap = (chip: OutcomeChip) => {
    setSelectedOutcome(chip);
    // For 'not_applied' the note prompt is slightly different but still shown
  };

  // ── Step 3 confirmed: Save outcome + optional note ──
  const handleOutcomeSave = async () => {
    if (!interventionId || !selectedOutcome) return;
    setIsSavingOutcome(true);
    try {
      const updatePayload: Record<string, unknown> = {
        outcome:      selectedOutcome,
        outcome_at:   new Date().toISOString(),
        vio_step:     2,
      };
      // outcome_note is the qualitative ground-truth label — save it even if empty
      // so we can distinguish "user saved with no note" from "note never offered"
      if (outcomeNote.trim()) {
        updatePayload.outcome_note = outcomeNote.trim();
      }
      const { error } = await supabase
        .from('interventions')
        .update(updatePayload)
        .eq('id', interventionId);
      if (error) throw error;
      trackEvent(Events.VIO_OUTCOME_RECORDED, { outcome: selectedOutcome, hasNote: !!outcomeNote.trim() });
      onSuccess(interventionId);
      onClose();
    } catch (e) {
      console.error('Error saving outcome', e);
    } finally {
      setIsSavingOutcome(false);
    }
  };

  const inputCls =
    'w-full rounded-xl border border-border/50 bg-surface px-4 py-2.5 text-[15px] text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary';

  // ── Render: Form stage ──
  if (stage === 'form') {
    return (
      <ModalShell title={t.logIntervention} onClose={onClose}>
        <div className="space-y-4">
          {(
            [
              { label: t.cropType,   value: cropType, set: setCropType },
              { label: t.problem,    value: problem,  set: setProblem  },
              { label: t.product,    value: product,  set: setProduct  },
              { label: t.dosage,     value: dosage,   set: setDosage   },
              { label: t.appMethod,  value: method,   set: setMethod   },
            ] as const
          ).map(({ label, value, set }) => (
            <div key={label}>
              <label className="mb-1.5 block text-sm font-medium text-foreground">{label}</label>
              <input
                type="text"
                value={value}
                onChange={e => set(e.target.value)}
                className={inputCls}
              />
            </div>
          ))}

          {/* Quick-fill scouting templates */}
          {getTemplates(cropType).length > 0 && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                {lang === 'el' ? 'Γρήγορη συμπλήρωση' : 'Quick fill'}
              </label>
              <div className="flex flex-wrap gap-2">
                {getTemplates(cropType).map((tpl, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      setProblem(tpl.problem);
                      setProduct(tpl.product);
                      setDosage(tpl.dosage);
                      setMethod(tpl.method);
                    }}
                    className="rounded-full border border-border/50 bg-surface px-3 py-1.5 text-xs text-muted hover:border-primary/50 hover:text-foreground transition-colors"
                  >
                    {tpl.problem}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">{t.notes}</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              className="w-full resize-none rounded-xl border border-border/50 bg-surface px-4 py-2.5 text-[15px] text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {errorMessage && (
            <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-400">
              {errorMessage}
            </p>
          )}

          <button
            onClick={handleLog}
            disabled={isSubmitting}
            className="mt-2 w-full rounded-xl bg-primary py-3.5 text-[15px] font-semibold text-white shadow-sm transition-all hover:bg-primary/90 active:scale-[0.98] disabled:opacity-70"
          >
            {isSubmitting ? t.logging : t.logIt}
          </button>
        </div>
      </ModalShell>
    );
  }

  // ── Render: Follow-up reminder stage ──
  if (stage === 'follow_up') {
    return (
      <ModalShell title={t.setReminder} onClose={onClose}>
        <div className="flex flex-col items-center py-6 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10">
            <Check className="h-8 w-8 text-green-500" />
          </div>
          <h3 className="mb-2 text-xl font-semibold text-foreground">{t.interventionLogged}</h3>
          <p className="mb-8 text-muted">{t.reminderQuestion}</p>
          <div className="flex w-full gap-3">
            <button
              onClick={() => handleFollowUp(false)}
              className="flex-1 rounded-xl border border-border bg-surface py-3 text-[15px] font-medium text-foreground transition-colors hover:bg-muted/10"
            >
              {t.noThanks}
            </button>
            <button
              onClick={() => handleFollowUp(true)}
              className="flex-1 rounded-xl bg-primary py-3 text-[15px] font-medium text-white transition-colors hover:bg-primary/90"
            >
              {t.setReminder}
            </button>
          </div>
        </div>
      </ModalShell>
    );
  }

  // ── Render: Outcome stage (reached from VIO Step 2 follow-up in chat) ──
  // This stage is used when the modal is opened pre-filled with an intervention
  // awaiting outcome recording (vio_step === 2).
  return (
    <ModalShell
      title={lang === 'el' ? 'Αποτέλεσμα θεραπείας' : 'Treatment outcome'}
      onClose={onClose}
    >
      <div className="space-y-5">
        <p className="text-sm text-muted">
          {lang === 'el'
            ? 'Πώς εξελίχθηκε η κατάσταση μετά τη θεραπεία;'
            : 'How did things develop after the treatment?'}
        </p>

        {/* Four outcome chips */}
        <div className="grid grid-cols-2 gap-2">
          {OUTCOME_CHIPS.map(chip => (
            <button
              key={chip.value}
              onClick={() => handleOutcomeChipTap(chip.value)}
              className={`rounded-xl border px-4 py-3 text-sm font-medium transition-colors ${
                selectedOutcome === chip.value
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border/50 bg-surface text-foreground hover:border-primary/40 hover:bg-primary/5'
              }`}
            >
              {lang === 'el' ? chip.labelEl : chip.labelEn}
            </button>
          ))}
        </div>

        {/* Outcome note — shown as soon as a chip is tapped */}
        {selectedOutcome && (
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              {lang === 'el'
                ? selectedOutcome === 'not_applied'
                  ? 'Γιατί δεν εφαρμόσατε; (προαιρετικό)'
                  : 'Τι παρατηρήσατε; (προαιρετικό)'
                : selectedOutcome === 'not_applied'
                  ? "Why wasn't it applied? (optional)"
                  : 'What did you observe? (optional)'}
            </label>
            <input
              type="text"
              value={outcomeNote}
              onChange={e => setOutcomeNote(e.target.value)}
              placeholder={
                lang === 'el'
                  ? 'π.χ. Τα φύλλα έγιναν κίτρινα...'
                  : 'e.g. Leaves turned yellow after rain...'
              }
              className={inputCls}
              autoFocus
            />
          </div>
        )}

        <button
          onClick={handleOutcomeSave}
          disabled={!selectedOutcome || isSavingOutcome}
          className="w-full rounded-xl bg-primary py-3.5 text-[15px] font-semibold text-white transition-all hover:bg-primary/90 active:scale-[0.98] disabled:opacity-40"
        >
          {isSavingOutcome
            ? (lang === 'el' ? 'Αποθήκευση...' : 'Saving...')
            : (lang === 'el' ? 'Αποθήκευση αποτελέσματος' : 'Save outcome')}
        </button>
      </div>
    </ModalShell>
  );
}

// ── Shared modal shell ──
function ModalShell({
  title, onClose, children,
}: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-md rounded-t-[32px] sm:rounded-[32px] bg-background p-6 shadow-xl max-h-[90dvh] overflow-y-auto"
      >
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-foreground">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-muted hover:bg-muted/10 hover:text-foreground transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
