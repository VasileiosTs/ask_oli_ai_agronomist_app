// validateAi.ts
// Client-side validation helpers only.
// All Gemini calls go through the edge function (supabase/functions/chat).
// This file has NO direct Gemini API calls — removes @google/genai dependency.

export interface DiagnosisData {
  problem: string | null;
  cause: string | null;
  severity: 'low' | 'medium' | 'high' | null;
  product_applied: string | null;
  product_category: string | null;
  dosage: string | null;
  application_method: string | null;
}

export interface AiResponseJson {
  response_text: string;
  intent: 'diagnosis' | 'advice' | 'followup' | 'general' | 'unclear';
  crop_mentioned: string | null;
  field_scope: 'specific' | 'general';
  question_count: number;
  has_banned_opener: boolean;
  diagnosis_data: DiagnosisData | null;
}

export interface ChatMessage {
  role: string;
  content: string;
  images?: { mimeType: string; data: string }[];
}

export function validateResponse(
  json: AiResponseJson,
  hasActiveField: boolean
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (json.question_count > 1) errors.push('question_count > 1');
  if (json.has_banned_opener) errors.push('has_banned_opener == true');
  if (hasActiveField && json.field_scope !== 'specific') errors.push('field_scope not specific');
  if (!json.response_text?.trim()) errors.push('response_text is empty');
  return { valid: errors.length === 0, errors };
}

export function sanitizeAssistantText(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

// Returns null — guest mode shows a sign-up prompt instead of
// making unauthenticated client-side Gemini calls.
export async function generateValidatedResponse(
  _messages: ChatMessage[],
  _fieldContext: string,
  _hasActiveField: boolean
): Promise<AiResponseJson | null> {
  return null;
}
