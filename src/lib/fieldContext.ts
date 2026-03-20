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

export function formatFieldContextBlock(field: Field): string {
  return `Field: ${field.name} | Crop: ${field.crop_type || 'N/A'} | Size: ${field.size_ha || 'N/A'}ha | Soil: ${field.soil_type || 'N/A'} | Irrigation: ${field.irrigation_type || 'N/A'} | Medium: ${field.growing_medium || 'N/A'} | Last issue: ${field.last_diagnosis || 'None'}`;
}

export async function assembleFieldContext(userId: string, activeFieldId?: string, growerId?: string): Promise<string> {
  try {
    const { data: fields, error } = await supabase
      .from('field_context_view')
      .select('*')
      .eq('user_id', userId);

    if (error || !fields || fields.length === 0) {
      return "No field context available.";
    }

    if (activeFieldId) {
      const activeField = fields.find(f => f.id === activeFieldId);
      if (activeField) {
        return `CURRENT ACTIVE FIELD CONTEXT:\n${formatFieldContextBlock(activeField)}`;
      }
    }

    if (fields.length > 1) {
      const summaries = fields.map(f => formatFieldContextBlock(f)).join('\n');
      return `USER HAS MULTIPLE FIELDS. SUMMARY:\n${summaries}\n(Note: User has not selected a specific active field yet.)`;
    }

    if (fields.length === 1) {
      return `USER FIELD CONTEXT:\n${formatFieldContextBlock(fields[0])}`;
    }

    return "No field context available.";
  } catch (e) {
    console.error("Error assembling field context:", e);
    return "Error retrieving field context.";
  }
}
