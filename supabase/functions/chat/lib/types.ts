export interface InlineAttachment {
  mimeType: string;
  data: string;
}

export interface ChatMessageInput {
  role: string;
  content: string;
  attachments?: InlineAttachment[];
}

export interface DiagnosisData {
  problem: string | null;
  cause: string | null;
  severity: 'low' | 'medium' | 'high' | null;
  product_applied: string | null;
  product_category: string | null;
  dosage: string | null;
  application_method: string | null;
  organic_treatments: string[] | null;
  chemical_treatments: string[] | null;
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

export interface ExtractionResult {
  crop_type: string | null;
  field_mention: string | null;
  confidence: number | null;
  problem: string | null;
  location_hint: string | null;
  intervention_hint: string | null;
}

export interface FieldContextRow {
  id: string;
  user_id: string;
  name: string;
  crop_type: string | null;
  location: string | null;
  size_ha: number | null;
  soil_type: string | null;
  irrigation_type: string | null;
  growing_medium: string | null;
  last_diagnosis: string | null;
  last_intervention_at: string | null;
  crop_count: number | null;
  intervention_count: number | null;
  pending_follow_up_count: number | null;
  conversation_count: number | null;
  recent_diagnoses: string[] | null;
}

export interface InterventionContextRow {
  id: string;
  field_id: string | null;
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
}

export interface MemorySnapshotRow {
  id: string;
  field_id: string | null;
  summary: string | null;
  snapshot: Record<string, unknown> | null;
  created_at: string;
}

export interface ConversationRow {
  id: string;
  field_id: string | null;
  title: string;
}

export interface ChatRequestBody {
  mode?: 'chat' | 'extract' | 'greeting';
  messages?: ChatMessageInput[];
  message?: string;
  messageId?: string | null;
  fieldContext?: string;
  hasActiveField?: boolean;
  attachmentPaths?: string[];
  imageUrls?: string[];
  conversationId?: string | null;
  fieldId?: string | null;
  userMessageId?: string | null;
  timezone?: string;
  lang?: string;
}

export interface AppUserRow {
  id: string;
  name: string | null;
  location: string | null;
  language: string | null;
  primary_crop: string | null;
  tier: string | null;
  message_count_month: number | null;
  message_reset_date: string | null;
}

export interface FieldContextBundle {
  fieldContext: string;
  activeFieldId: string | null;
  activeFieldName: string | null;
  hasActiveField: boolean;
  recentInterventions: InterventionContextRow[];
  pendingFollowUps: InterventionContextRow[];
}
