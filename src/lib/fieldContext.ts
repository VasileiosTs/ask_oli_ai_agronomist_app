import { supabase } from './supabase';

export interface Field {
  id: string;
  name: string;
  crop_type: string | null;
  size_ha: number | null;
  soil_type: string | null;
  irrigation_type: string | null;
  growing_medium: string | null;
  last_diagnosis: string | null;
  intervention_count?: number | null;
  pending_follow_up_count?: number | null;
  conversation_count?: number | null;
  recent_diagnoses?: string[] | null;
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
  follow_up_at: string | null;
  applied_at: string | null;
  date: string | null;
  field_id: string | null;
}

export function formatFieldContextBlock(field: Field): string {
  const parts = [
    `Field: ${field.name}`,
    `Crop: ${field.crop_type || 'N/A'}`,
    field.size_ha != null ? `Size: ${field.size_ha}ha` : null,
    field.soil_type ? `Soil: ${field.soil_type}` : null,
    field.irrigation_type ? `Irrigation: ${field.irrigation_type}` : null,
    field.growing_medium ? `Medium: ${field.growing_medium}` : null,
    `Last issue: ${field.last_diagnosis || 'None'}`,
    field.intervention_count ? `Interventions: ${field.intervention_count}` : null,
    field.pending_follow_up_count ? `Pending follow-ups: ${field.pending_follow_up_count}` : null,
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
    if (item.outcome_score) {
      status += ` (${item.outcome_score}/5)`;
    }
  } else if (item.follow_up_at) {
    const followDate = item.follow_up_at.split('T')[0];
    const daysUntil = Math.ceil(
      (new Date(item.follow_up_at).getTime() - Date.now()) / 86_400_000
    );

    status = daysUntil <= 0
      ? `Follow-up overdue (${followDate})`
      : `Follow-up in ${daysUntil} day${daysUntil === 1 ? '' : 's'} (${followDate})`;
  } else {
    status = 'No follow-up set';
  }

  return `- ${date}: ${problem} -> ${treatment}${dosage}${method} -> ${status}`;
}

async function fetchInterventionHistory(
  userId: string,
  fieldId?: string,
  limit = 5
): Promise<InterventionHistory[]> {
  const columns =
    'id, crop_type, diagnosis, problem, product_applied, product, dosage, ' +
    'application_method, outcome, outcome_score, follow_up_at, applied_at, date, field_id';

  try {
    let query = supabase
      .from('interventions')
      .select(columns)
      .eq('user_id', userId)
      .order('applied_at', { ascending: false, nullsFirst: false })
      .limit(limit);

    if (fieldId) {
      query = query.eq('field_id', fieldId);
    }

    const { data, error } = await query;
    if (error || !data) {
      return [];
    }

    const interventions = data as unknown as InterventionHistory[];

    if (!fieldId || interventions.length >= limit) {
      return interventions;
    }

    const existingIds = new Set(interventions.map((item) => item.id));
    const { data: backfill } = await supabase
      .from('interventions')
      .select(columns)
      .eq('user_id', userId)
      .neq('field_id', fieldId)
      .order('applied_at', { ascending: false, nullsFirst: false })
      .limit(limit - interventions.length);

    if (backfill) {
      for (const item of backfill as unknown as InterventionHistory[]) {
        if (!existingIds.has(item.id)) {
          interventions.push(item);
        }
      }
    }

    return interventions;
  } catch {
    return [];
  }
}

async function fetchPendingFollowUps(userId: string, fieldId?: string): Promise<InterventionHistory[]> {
  try {
    let query = supabase
      .from('interventions')
      .select(
        'id, crop_type, diagnosis, problem, product_applied, product, follow_up_at, applied_at, date, field_id'
      )
      .eq('user_id', userId)
      .is('outcome', null)
      .not('follow_up_at', 'is', null)
      .order('follow_up_at', { ascending: true })
      .limit(5);

    if (fieldId) {
      query = query.eq('field_id', fieldId);
    }

    const { data } = await query;
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
    const [fieldsResult, interventions, pendingFollowUps] = await Promise.all([
      supabase.from('field_context_view').select('*').eq('user_id', userId),
      fetchInterventionHistory(userId, activeFieldId),
      fetchPendingFollowUps(userId, activeFieldId),
    ]);

    const fields = fieldsResult.data as Field[] | null;
    const sections: string[] = [];

    if (fields && fields.length > 0) {
      if (activeFieldId) {
        const activeField = fields.find((field) => field.id === activeFieldId);
        if (activeField) {
          sections.push(`ACTIVE FIELD:\n${formatFieldContextBlock(activeField)}`);

          if (Array.isArray(activeField.recent_diagnoses) && activeField.recent_diagnoses.length > 0) {
            sections.push(`RECENT DIAGNOSES:\n- ${activeField.recent_diagnoses.join('\n- ')}`);
          }
        }
      } else if (fields.length === 1) {
        sections.push(`USER FIELD:\n${formatFieldContextBlock(fields[0])}`);
      } else {
        sections.push(
          `USER HAS ${fields.length} FIELDS:\n${fields.map((field) => formatFieldContextBlock(field)).join('\n')}\n(No specific field selected for this conversation.)`
        );
      }
    }

    if (interventions.length > 0) {
      sections.push(
        `TREATMENT HISTORY (last ${interventions.length}):\n${interventions.map(formatIntervention).join('\n')}`
      );
    }

    if (pendingFollowUps.length > 0) {
      const followUpLines = pendingFollowUps.map((item) => {
        const problem = item.diagnosis || item.problem || 'treatment';
        const product = item.product_applied || item.product || '';
        const appliedDate = item.applied_at?.split('T')[0] || item.date || '?';
        const dueDate = item.follow_up_at?.split('T')[0] || '?';
        return `- ${problem}${product ? ` (${product})` : ''} from ${appliedDate} -> check due ${dueDate}`;
      });

      sections.push(`PENDING FOLLOW-UPS (${pendingFollowUps.length}):\n${followUpLines.join('\n')}`);
    }

    if (sections.length === 0) {
      return 'No field or treatment history available yet.';
    }

    return sections.join('\n\n');
  } catch (error) {
    console.error('Error assembling field context:', error);
    return 'Error retrieving field context.';
  }
}
