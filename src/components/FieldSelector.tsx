import { useState, useRef, useEffect } from 'react';
import { Leaf, ChevronDown, X } from 'lucide-react';
import type { Field } from '../lib/fieldContext';

export interface FieldSelectorProps {
  fields: Field[];
  activeFieldId: string | undefined;
  onSelectField: (fieldId: string | undefined) => void;
  lang?: string;
}

/**
 * FieldSelector — a header popover for choosing the active field context.
 */
export default function FieldSelector({
  fields,
  activeFieldId,
  onSelectField,
  lang = 'en',
}: FieldSelectorProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const activeField = activeFieldId ? fields.find(f => f.id === activeFieldId) : undefined;

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  if (fields.length === 0) return null;

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen(prev => !prev)}
        className="flex items-center gap-1.5 rounded-full border border-border/50 bg-surface px-3 py-1.5 text-xs text-foreground transition-colors hover:border-primary/40 hover:bg-primary/5"
        aria-label={lang === 'el' ? 'Επιλογή χωραφιού' : 'Select field'}
        aria-expanded={open}
      >
        <Leaf className="h-3.5 w-3.5 text-primary" />
        <span className="max-w-[120px] truncate">
          {activeField ? activeField.name : (lang === 'el' ? 'Χωράφι' : 'Field')}
        </span>
        {activeField && (
          <span
            role="button"
            tabIndex={0}
            aria-label={lang === 'el' ? 'Εκκαθάριση' : 'Clear'}
            onClick={e => { e.stopPropagation(); onSelectField(undefined); }}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); onSelectField(undefined); } }}
            className="ml-0.5 rounded-full p-0.5 hover:bg-muted/20"
          >
            <X className="h-2.5 w-2.5 text-muted" />
          </span>
        )}
        {!activeField && <ChevronDown className="h-3 w-3 text-muted" />}
      </button>

      {open && (
        <div className="absolute left-0 top-full z-20 mt-1.5 w-52 rounded-xl border border-border/50 bg-surface p-1.5 shadow-lg">
          <button
            onClick={() => { onSelectField(undefined); setOpen(false); }}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-muted hover:bg-muted/10"
          >
            {lang === 'el' ? 'Χωρίς συγκεκριμένο χωράφι' : 'No specific field'}
          </button>
          {fields.map(field => (
            <button
              key={field.id}
              onClick={() => { onSelectField(field.id); setOpen(false); }}
              className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs transition-colors hover:bg-muted/10 ${
                field.id === activeFieldId ? 'text-primary font-medium' : 'text-foreground'
              }`}
            >
              <Leaf className="h-3 w-3 flex-shrink-0 text-primary/70" />
              <span className="truncate">{field.name}</span>
              {field.crop_type && (
                <span className="ml-auto text-[10px] text-muted">{field.crop_type}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
