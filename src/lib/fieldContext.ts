import { supabase } from './supabase';

export interface Field {
  id: string;
  name: string;
  crop_type: string;
  size_ha: number;
  soil_type: string;
  irrigation_type: string;
  growing_medium: string;
  last_diagnosis: string;
}

interface InterventionHistory {
  id: string;
  crop_type: string | null;
  diagnosis: string | null;
  problem: string | null;
  product_applied: string | null;
  product: string | null;
  dosage: string | null;
  application_method: string | null;
  outcome: string | null;
  outcome_score: number | null;
  vio_step: number | null;
  follow_up_at: string | null;
  applied_at: string | null;
  date: string | null;
  field_id: string | null;
}

export function formatFieldContextBlock(field: Field): string {
  const parts = [
    `Field: ${field.name}`,
    `Crop: ${field.crop_type || 'N/A'}`,
    field.size_ha ? `Size: ${field.size_ha}ha` : null,
    field.soil_type ? `Soil: ${field.soil_type}` : null,
    field.irrigation_type ? `Irrigation: ${field.irrigation_type}` : null,
    field.growing_medium ? `Medium: ${field.growing_medium}` : null,
  ].filter(Boolean);
  return parts.join(' | ');
}

function formatIntervention(item: InterventionHistory): string {
  const date = item.applied_at?.split('T')[0] || item.date || '?';
  const problem = item.diagnosis || item.problem || 'Unknown issue';
  const treatment = item.product_applied || item.product || 'No product recorded';
  const method = item.application_method ? ` (${item.application_method})` : '';
  const dosage = item.dosage ? ` ${item.dosage}` : '';

  let status: string;
  if (item.outcome) {
    status = `Outcome: ${item.outcome}`;
    if (item.outcome_score) status += ` (${item.outcome_score}/5)`;
  } else if (item.follow_up_at) {
    const followDate = item.follow_up_at.split('T')[0];
    const daysUntil = Math.ceil(
      (new Date(item.follow_up_at).getTime() - Date.now()) / 86400000
    );
    if (daysUntil <= 0) {
      status = `Follow-up OVERDUE (was due ${followDate})`;
    } else {
      status = `Follow-up in ${daysUntil} day${daysUntil === 1 ? '' : 's'} (${followDate})`;
    }
  } else {
    status = 'No follow-up set';
  }

  return `- ${date}: ${problem} → ${treatment}${dosage}${method} → ${status}`;
}

async function fetchInterventionHistory(
  userId: string,
  fieldId?: string,
  limit = 5
): Promise<InterventionHistory[]> {
  try {
    let query = supabase
      .from('interventions')
      .select(
        'id, crop_type, diagnosis, problem, product_applied, product, dosage, ' +
        'application_method, outcome, outcome_score, vio_step, follow_up_at, ' +
        'applied_at, date, field_id'
      )
      .eq('user_id', userId)
      .order('applied_at', { ascending: false, nullsFirst: false })
      .limit(limit);

    // If a specific field is active, prioritize its interventions
    if (fieldId) {
      query = query.eq('field_id', fieldId);
    }

    const { data: rawData, error } = await query;
    if (error || !rawData) return [];
    const data = rawData as unknown as InterventionHistory[];

    // If field-scoped query returned fewer than limit, backfill with other fields
    if (fieldId && data.length < limit) {
      const existingIds = new Set(data.map(d => d.id));
      const { data: others } = await supabase
        .from('interventions')
        .select(
          'id, crop_type, diagnosis, problem, product_applied, product, dosage, ' +
          'application_method, outcome, outcome_score, vio_step, follow_up_at, ' +
          'applied_at, date, field_id'
        )
        .eq('user_id', userId)
        .neq('field_id', fieldId)
        .order('applied_at', { ascending: false, nullsFirst: false })
        .limit(limit - data.length);

      if (others) {
        for (const item of (others as unknown as InterventionHistory[])) {
          if (!existingIds.has(item.id)) data.push(item);
        }
      }
    }

    return data;
  } catch {
    return [];
  }
}

async function fetchPendingFollowUps(userId: string): Promise<InterventionHistory[]> {
  try {
    const { data } = await supabase
      .from('interventions')
      .select(
        'id, crop_type, diagnosis, problem, product_applied, product, ' +
        'follow_up_at, applied_at, date, field_id, vio_step'
      )
      .eq('user_id', userId)
      .is('outcome', null)
      .not('follow_up_at', 'is', null)
      .order('follow_up_at', { ascending: true })
      .limit(5);

    return (data ?? []) as unknown as InterventionHistory[];
  } catch {
    return [];
  }
}

export async function assembleFieldContext(
  userId: string,
  activeFieldId?: string,
  _growerId?: string
): Promise<string> {
  try {
    // Fetch fields, interventions, and pending follow-ups in parallel
    const [fieldsResult, interventions, pendingFollowUps] = await Promise.all([
      supabase.from('field_context_view').select('*').eq('user_id', userId),
      fetchInterventionHistory(userId, activeFieldId),
      fetchPendingFollowUps(userId),
    ]);

    const fields = fieldsResult.data as Field[] | null;
    const sections: string[] = [];

    // ── FIELD INFO ──
    if (fields && fields.length > 0) {
      if (activeFieldId) {
        const active = fields.find(f => f.id === activeFieldId);
        if (active) {
          sections.push(`ACTIVE FIELD:\n${formatFieldContextBlock(active)}`);
        }
      } else if (fields.length === 1) {
        sections.push(`USER FIELD:\n${formatFieldContextBlock(fields[0])}`);
      } else {
        const summaries = fields.map(f => formatFieldContextBlock(f)).join('\n');
        sections.push(
          `USER HAS ${fields.length} FIELDS:\n${summaries}\n(No specific field selected for this conversation.)`
        );
      }
    }

    // ── TREATMENT HISTORY ──
    if (interventions.length > 0) {
      const lines = interventions.map(formatIntervention);
      sections.push(`TREATMENT HISTORY (last ${interventions.length}):\n${lines.join('\n')}`);
    }

    // ── PENDING FOLLOW-UPS ──
    if (pendingFollowUps.length > 0) {
      const lines = pendingFollowUps.map(item => {
        const problem = item.diagnosis || item.problem || 'treatment';
        const product = item.product_applied || item.product || '';
        const date = item.applied_at?.split('T')[0] || item.date || '?';
        const dueDate = item.follow_up_at?.split('T')[0] || '?';
        return `- ${problem}${product ? ` (${product})` : ''} from ${date} — check due ${dueDate}`;
      });
      sections.push(
        `PENDING FOLLOW-UPS (${pendingFollowUps.length}):\n${lines.join('\n')}`
      );
    }

    if (sections.length === 0) {
      return 'No field or treatment history available yet.';
    }

    return sections.join('\n\n');
  } catch (e) {
    console.error('Error assembling field context:', e);
    return 'Error retrieving field context.';
  }
}
