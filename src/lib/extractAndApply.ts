import { supabase, supabasePublicKey, supabaseUrl } from './supabase';

export interface ExtractionResult {
  crop_type: string | null;
  field_mention: string | null;
  confidence: number | null;
  problem: string | null;
  location_hint: string | null;
  intervention_hint: string | null;
}

export interface ApplyExtractionResult {
  action: 'none' | 'auto_set' | 'disambiguate';
  targetFieldId?: string;
  disambiguateFields: Array<{ id: string; name: string; confidence: number | null }>;
  extracted?: ExtractionResult | null;
}

function emptyResult(): ApplyExtractionResult {
  return {
    action: 'none',
    targetFieldId: undefined,
    disambiguateFields: [],
    extracted: null,
  };
}

async function readErrorMessage(response: Response): Promise<string> {
  const contentType = response.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    try {
      const payload = await response.json();
      if (payload && typeof payload.error === 'string') {
        return payload.error;
      }
    } catch (error) {
      console.error('Failed to parse extraction error JSON:', error);
    }
  }

  const text = await response.text();
  return text || `Extraction request failed with status ${response.status}`;
}

export async function extractAndApply(message: string, _userId: string, messageId: string) {
  if (!supabaseUrl || !supabasePublicKey || !messageId) {
    return emptyResult();
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    return emptyResult();
  }

  try {
    const { data, error, response } = await supabase.functions.invoke('chat', {
      body: {
        mode: 'extract',
        message,
        messageId,
      },
    });

    if (error || !data) {
      if (response) {
        console.error('Extraction request failed:', await readErrorMessage(response));
      } else {
        console.error('Extraction request failed:', error?.message || 'Unknown function error');
      }
      return emptyResult();
    }

    if (response && !response.ok) {
      console.error('Extraction request failed:', await readErrorMessage(response));
      return emptyResult();
    }

    const payload = data as Record<string, unknown>;
    return {
      action: payload.action === 'auto_set' || payload.action === 'disambiguate' ? payload.action : 'none',
      targetFieldId: typeof payload.targetFieldId === 'string' ? payload.targetFieldId : undefined,
      disambiguateFields: Array.isArray(payload.disambiguateFields)
        ? payload.disambiguateFields.filter(
            (field): field is { id: string; name: string; confidence: number | null } =>
              typeof field?.id === 'string' && typeof field?.name === 'string'
          )
        : [],
      extracted: (payload.extracted as ExtractionResult | null | undefined) ?? null,
    };
  } catch (error) {
    console.error('Extraction request error:', error);
    return emptyResult();
  }
}
