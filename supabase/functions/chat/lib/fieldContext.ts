import type {
  AiResponseJson,
  ConversationRow,
  ExtractionResult,
  FieldContextBundle,
  FieldContextRow,
  InterventionContextRow,
  MemorySnapshotRow,
} from './types.ts';

const FIELD_ROWS_CACHE_TTL_MS = 60_000;
const FIELD_CONTEXT_CACHE_TTL_MS = 60_000;

const fieldRowsCache = new Map<string, { expiresAt: number; value: FieldContextRow[] }>();
const fieldContextCache = new Map<string, { expiresAt: number; value: FieldContextBundle }>();

function getCachedValue<T>(
  cache: Map<string, { expiresAt: number; value: T }>,
  key: string,
): T | null {
  const cached = cache.get(key);
  if (!cached) {
    return null;
  }

  if (cached.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }

  return cached.value;
}

function setCachedValue<T>(
  cache: Map<string, { expiresAt: number; value: T }>,
  key: string,
  value: T,
  ttlMs: number,
) {
  cache.set(key, {
    expiresAt: Date.now() + ttlMs,
    value,
  });
}

export function invalidateFieldContextCache(appUserId: string) {
  fieldRowsCache.delete(appUserId);

  for (const key of fieldContextCache.keys()) {
    if (key.startsWith(`${appUserId}:`)) {
      fieldContextCache.delete(key);
    }
  }
}

function formatFieldContextBlock(field: FieldContextRow): string {
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

function formatInterventionContext(item: InterventionContextRow, fieldName?: string): string {
  const date = item.applied_at?.split('T')[0] || item.date || '?';
  const problem = item.diagnosis || item.problem || 'Unknown issue';
  const treatment = item.product_applied || item.product || 'No product recorded';
  const dosage = item.dosage ? ` ${item.dosage}` : '';
  const method = item.application_method ? ` (${item.application_method})` : '';
  const fieldPrefix = fieldName ? `${fieldName} | ` : '';

  let status: string;
  if (item.outcome) {
    status = `Outcome: ${item.outcome}`;
    if (item.outcome_score) {
      status += ` (${item.outcome_score}/5)`;
    }
  } else if (item.follow_up_at) {
    const daysUntil = Math.ceil(
      (new Date(item.follow_up_at).getTime() - Date.now()) / 86400000,
    );
    const vioStepLabel = (item as any).vio_step != null
      ? `VIO step ${(item as any).vio_step}: `
      : '';
    if (daysUntil <= 0) {
      status = `${vioStepLabel}Follow-up OVERDUE (was due ${item.follow_up_at.split('T')[0]})`;
    } else {
      status = `${vioStepLabel}Follow-up due in ${daysUntil} day${daysUntil === 1 ? '' : 's'} (${item.follow_up_at.split('T')[0]})`;
    }
  } else {
    status = 'No follow-up set';
  }

  return `- ${fieldPrefix}${date}: ${problem} -> ${treatment}${dosage}${method} -> ${status}`;
}

export async function fetchFieldContextRows(supabaseAdmin: any, appUserId: string): Promise<FieldContextRow[]> {
  const cached = getCachedValue(fieldRowsCache, appUserId);
  if (cached) {
    return cached;
  }

  const { data, error } = await supabaseAdmin
    .from('field_context_view')
    .select('*')
    .eq('user_id', appUserId)
    .order('created_at', { ascending: true });

  if (error || !Array.isArray(data)) {
    return [];
  }

  const rows = data as FieldContextRow[];
  setCachedValue(fieldRowsCache, appUserId, rows, FIELD_ROWS_CACHE_TTL_MS);
  return rows;
}

async function fetchContextInterventions(
  supabaseAdmin: any,
  appUserId: string,
  fieldId?: string | null,
  limit = 5,
): Promise<InterventionContextRow[]> {
  const columns =
    'id, field_id, diagnosis, problem, product_applied, product, dosage, ' +
    'application_method, outcome, outcome_score, follow_up_at, applied_at, date';

  let query = supabaseAdmin
    .from('interventions')
    .select(columns)
    .eq('user_id', appUserId)
    .order('applied_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(limit);

  if (fieldId) {
    query = query.eq('field_id', fieldId);
  }

  const { data, error } = await query;
  if (error || !Array.isArray(data)) {
    return [];
  }

  const interventions = data as InterventionContextRow[];
  if (!fieldId || interventions.length >= limit) {
    return interventions;
  }

  const { data: backfill } = await supabaseAdmin
    .from('interventions')
    .select(columns)
    .eq('user_id', appUserId)
    .neq('field_id', fieldId)
    .order('applied_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(limit - interventions.length);

  if (Array.isArray(backfill)) {
    const seen = new Set(interventions.map((item) => item.id));
    for (const item of backfill as InterventionContextRow[]) {
      if (!seen.has(item.id)) {
        interventions.push(item);
      }
    }
  }

  return interventions;
}

async function fetchPendingFollowUps(
  supabaseAdmin: any,
  appUserId: string,
  fieldId?: string | null,
  limit = 5,
): Promise<InterventionContextRow[]> {
  const columns =
    'id, field_id, diagnosis, problem, product_applied, product, dosage, ' +
    'application_method, outcome, outcome_score, follow_up_at, applied_at, date';

  let query = supabaseAdmin
    .from('interventions')
    .select(columns)
    .eq('user_id', appUserId)
    .is('outcome', null)
    .not('follow_up_at', 'is', null)
    .order('follow_up_at', { ascending: true })
    .limit(limit);

  if (fieldId) {
    query = query.eq('field_id', fieldId);
  }

  const { data, error } = await query;
  if (error || !Array.isArray(data)) {
    return [];
  }

  const followUps = data as InterventionContextRow[];
  if (!fieldId || followUps.length >= limit) {
    return followUps;
  }

  const { data: backfill } = await supabaseAdmin
    .from('interventions')
    .select(columns)
    .eq('user_id', appUserId)
    .is('outcome', null)
    .not('follow_up_at', 'is', null)
    .neq('field_id', fieldId)
    .order('follow_up_at', { ascending: true })
    .limit(limit - followUps.length);

  if (Array.isArray(backfill)) {
    const seen = new Set(followUps.map((item) => item.id));
    for (const item of backfill as InterventionContextRow[]) {
      if (!seen.has(item.id)) {
        followUps.push(item);
      }
    }
  }

  return followUps;
}

async function fetchLatestMemorySnapshot(
  supabaseAdmin: any,
  appUserId: string,
  fieldId?: string | null,
): Promise<MemorySnapshotRow | null> {
  let query = supabaseAdmin
    .from('memory_snapshots')
    .select('id, field_id, summary, snapshot, created_at')
    .eq('user_id', appUserId)
    .order('created_at', { ascending: false })
    .limit(1);

  if (fieldId) {
    query = query.eq('field_id', fieldId);
  }

  const { data, error } = await query.maybeSingle();
  if (error || !data) {
    return null;
  }

  return data as MemorySnapshotRow;
}

export async function assembleServerFieldContext(
  supabaseAdmin: any,
  appUserId: string,
  fields: FieldContextRow[],
  activeFieldId?: string | null,
  fallbackFieldContext = '',
): Promise<FieldContextBundle> {
  const cacheKey = `${appUserId}:${activeFieldId ?? 'all'}`;
  const cached = getCachedValue(fieldContextCache, cacheKey);
  if (cached) {
    return cached;
  }

  const [interventions, pendingFollowUps, latestSnapshot] = await Promise.all([
    fetchContextInterventions(supabaseAdmin, appUserId, activeFieldId),
    fetchPendingFollowUps(supabaseAdmin, appUserId, activeFieldId),
    fetchLatestMemorySnapshot(supabaseAdmin, appUserId, activeFieldId),
  ]);

  const fieldMap = new Map(fields.map((field) => [field.id, field]));
  const sections: string[] = [];
  const activeField =
    (activeFieldId ? fields.find((field) => field.id === activeFieldId) : null) ??
    (fields.length === 1 ? fields[0] : null);

  if (activeField) {
    sections.push(`ACTIVE FIELD:\n${formatFieldContextBlock(activeField)}`);

    if (Array.isArray(activeField.recent_diagnoses) && activeField.recent_diagnoses.length > 0) {
      sections.push(`RECENT DIAGNOSES:\n- ${activeField.recent_diagnoses.join('\n- ')}`);
    }
  } else if (fields.length > 1) {
    sections.push(
      `USER HAS ${fields.length} FIELDS:\n${fields.map((field) => formatFieldContextBlock(field)).join('\n')}\n(No specific field selected for this conversation.)`,
    );
  } else if (fields.length === 1) {
    sections.push(`USER FIELD:\n${formatFieldContextBlock(fields[0])}`);
  }

  if (interventions.length > 0) {
    const lines = interventions.map((item) =>
      formatInterventionContext(
        item,
        !activeFieldId && item.field_id ? fieldMap.get(item.field_id)?.name : undefined,
      ),
    );
    sections.push(`TREATMENT HISTORY (last ${interventions.length}):\n${lines.join('\n')}`);
  }

  if (pendingFollowUps.length > 0) {
    const lines = pendingFollowUps.map((item) => {
      const problem = item.diagnosis || item.problem || 'treatment';
      const product = item.product_applied || item.product || '';
      const date = item.applied_at?.split('T')[0] || item.date || '?';
      const dueDate = item.follow_up_at?.split('T')[0] || '?';
      const fieldLabel =
        !activeFieldId && item.field_id ? `${fieldMap.get(item.field_id)?.name || 'Field'} | ` : '';

      return `- ${fieldLabel}${problem}${product ? ` (${product})` : ''} from ${date} -> check due ${dueDate}`;
    });

    sections.push(`PENDING FOLLOW-UPS (${pendingFollowUps.length}):\n${lines.join('\n')}`);
  }

  if (latestSnapshot?.summary) {
    sections.push(`LATEST MEMORY SNAPSHOT:\n- ${latestSnapshot.summary}`);
  }

  const value: FieldContextBundle = {
    fieldContext: sections.length > 0
      ? sections.join('\n\n')
      : fallbackFieldContext || 'No field data or treatment history on record yet.',
    activeFieldId: activeField?.id ?? activeFieldId ?? null,
    activeFieldName: activeField?.name ?? null,
    hasActiveField: Boolean(activeField?.id ?? activeFieldId),
    recentInterventions: interventions,
    pendingFollowUps,
  };

  setCachedValue(fieldContextCache, cacheKey, value, FIELD_CONTEXT_CACHE_TTL_MS);
  return value;
}

export async function fetchOwnedConversation(
  supabaseAdmin: any,
  appUserId: string,
  conversationId?: string | null,
): Promise<ConversationRow | null> {
  if (!conversationId) {
    return null;
  }

  const { data, error } = await supabaseAdmin
    .from('conversations')
    .select('id, field_id, title')
    .eq('id', conversationId)
    .eq('user_id', appUserId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as ConversationRow;
}

function buildInitialConversationTitle(rawText: string): string {
  const cleaned = rawText
    .replace(/^\[The user attached[^\]]*\]\n?/i, '')
    .trim();

  if (!cleaned) {
    return 'New conversation';
  }

  return cleaned.slice(0, 80);
}

export async function createConversation(
  supabaseAdmin: any,
  appUserId: string,
  fieldId: string | null,
  latestMessageText: string,
): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from('conversations')
    .insert({
      user_id: appUserId,
      field_id: fieldId,
      title: buildInitialConversationTitle(latestMessageText),
    })
    .select('id, field_id, title')
    .single();

  if (error || !data?.id) {
    console.error('Failed to create conversation:', error?.message ?? 'Conversation insert returned no id');
    return null;
  }

  return data.id as string;
}

export async function updateConversationFieldLink(
  supabaseAdmin: any,
  appUserId: string,
  conversationId: string | null | undefined,
  fieldId: string | null,
) {
  if (!conversationId || !fieldId) {
    return;
  }

  await supabaseAdmin
    .from('conversations')
    .update({ field_id: fieldId })
    .eq('id', conversationId)
    .eq('user_id', appUserId);
}

export async function mergeMessageMetadata(
  supabaseAdmin: any,
  appUserId: string,
  messageId: string,
  patch: Record<string, unknown>,
  fieldId?: string | null,
  conversationId?: string | null,
) {
  const { data: existing } = await supabaseAdmin
    .from('chat_messages')
    .select('metadata')
    .eq('id', messageId)
    .eq('user_id', appUserId)
    .maybeSingle();

  const updateData: Record<string, unknown> = {};

  if (Object.keys(patch).length > 0) {
    updateData.metadata = {
      ...((existing?.metadata as Record<string, unknown> | null) ?? {}),
      ...patch,
    };
  }

  if (typeof fieldId !== 'undefined') {
    updateData.field_id = fieldId;
  }

  if (typeof conversationId !== 'undefined') {
    updateData.conversation_id = conversationId;
  }

  if (Object.keys(updateData).length === 0) {
    return;
  }

  await supabaseAdmin
    .from('chat_messages')
    .update(updateData)
    .eq('id', messageId)
    .eq('user_id', appUserId);
}

export async function cleanupFailedChatAttempt(
  supabaseAdmin: any,
  appUserId: string,
  userMessageId: string | null,
  conversationId: string | null,
  conversationCreatedByFunction: boolean,
) {
  if (userMessageId) {
    await supabaseAdmin
      .from('chat_messages')
      .delete()
      .eq('id', userMessageId)
      .eq('user_id', appUserId);
  }

  if (!conversationCreatedByFunction || !conversationId) {
    return;
  }

  const { count } = await supabaseAdmin
    .from('chat_messages')
    .select('id', { count: 'exact', head: true })
    .eq('conversation_id', conversationId)
    .eq('user_id', appUserId);

  if ((count ?? 0) > 0) {
    return;
  }

  await supabaseAdmin
    .from('conversations')
    .delete()
    .eq('id', conversationId)
    .eq('user_id', appUserId);
}

function buildSnapshotSummary(aiResponse: AiResponseJson): string | null {
  const diagnosis = aiResponse.diagnosis_data?.problem || aiResponse.crop_mentioned || null;
  const severity = aiResponse.diagnosis_data?.severity || null;
  const product =
    aiResponse.diagnosis_data?.product_applied ||
    aiResponse.diagnosis_data?.chemical_treatments?.[0] ||
    aiResponse.diagnosis_data?.organic_treatments?.[0] ||
    null;

  if (!diagnosis && !product) {
    return null;
  }

  return [
    diagnosis || 'Agronomy follow-up',
    severity ? `severity ${severity}` : null,
    product ? `suggested ${product}` : null,
  ].filter(Boolean).join(' | ');
}

export async function persistFieldMemorySnapshot(
  supabaseAdmin: any,
  appUserId: string,
  fieldId: string | null,
  userMessageId: string,
  assistantMessageId: string,
  aiResponse: AiResponseJson,
  assistantText: string,
  recentInterventions: InterventionContextRow[],
  pendingFollowUps: InterventionContextRow[],
) {
  if (!fieldId) {
    return null;
  }

  const summary = buildSnapshotSummary(aiResponse);
  const snapshot = {
    intent: aiResponse.intent,
    crop_mentioned: aiResponse.crop_mentioned,
    field_scope: aiResponse.field_scope,
    diagnosis_data: aiResponse.diagnosis_data,
    assistant_text_excerpt: assistantText.slice(0, 600),
    recent_interventions: recentInterventions.slice(0, 3).map((item) => ({
      id: item.id,
      diagnosis: item.diagnosis || item.problem,
      product: item.product_applied || item.product,
      outcome: item.outcome,
      applied_at: item.applied_at || item.date,
    })),
    pending_follow_ups: pendingFollowUps.slice(0, 3).map((item) => ({
      id: item.id,
      diagnosis: item.diagnosis || item.problem,
      due_at: item.follow_up_at,
    })),
  };

  const { data, error } = await supabaseAdmin
    .from('memory_snapshots')
    .insert({
      user_id: appUserId,
      field_id: fieldId,
      summary,
      snapshot,
      source_message_ids: [userMessageId, assistantMessageId],
    })
    .select('id')
    .single();

  if (error || !data) {
    console.error('Failed to persist memory snapshot', error);
    return null;
  }

  return data.id as string;
}

async function resolveFieldCandidates(supabaseAdmin: any, appUserId: string, fieldMention: string) {
  const trimmedMention = fieldMention.trim();
  if (!trimmedMention) {
    return [];
  }

  const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc('resolve_field', {
    p_user_id: appUserId,
    p_mention: trimmedMention,
  });

  if (!rpcError && Array.isArray(rpcData) && rpcData.length > 0) {
    return rpcData.map((field: any) => ({
      id: field.field_id,
      name: field.field_name,
      confidence: typeof field.confidence === 'number' ? field.confidence : null,
    }));
  }

  const { data: fallbackData, error: fallbackError } = await supabaseAdmin
    .from('fields')
    .select('id, name')
    .eq('user_id', appUserId)
    .ilike('name', `%${trimmedMention}%`)
    .limit(3);

  if (fallbackError || !Array.isArray(fallbackData)) {
    return [];
  }

  return fallbackData.map((field) => ({
    id: field.id,
    name: field.name,
    confidence: null,
  }));
}

export async function resolveSingleFieldByHint(
  supabaseAdmin: any,
  appUserId: string,
  hint: string,
  minConfidence = 0.35,
) {
  const candidates = await resolveFieldCandidates(supabaseAdmin, appUserId, hint);
  if (candidates.length === 0) {
    return null;
  }

  const [bestCandidate, secondCandidate] = candidates;
  const bestConfidence = typeof bestCandidate.confidence === 'number' ? bestCandidate.confidence : null;
  const secondConfidence = typeof secondCandidate?.confidence === 'number' ? secondCandidate.confidence : null;

  if (bestConfidence != null && bestConfidence >= minConfidence) {
    if (secondConfidence == null || bestConfidence - secondConfidence >= 0.08) {
      return bestCandidate;
    }
  }

  if (candidates.length === 1) {
    return bestCandidate;
  }

  return null;
}

export async function applyExtractedFieldContext(
  supabaseAdmin: any,
  appUserId: string,
  messageId: string | null | undefined,
  extracted: ExtractionResult,
) {
  let action: 'none' | 'auto_set' | 'disambiguate' = 'none';
  let targetFieldId: string | undefined;
  let disambiguateFields: Array<{ id: string; name: string; confidence: number | null }> = [];

  const metadata: Record<string, unknown> = {};
  if (extracted.intervention_hint) {
    metadata.intervention_hint = extracted.intervention_hint;
  }

  const confidence = typeof extracted.confidence === 'number' ? extracted.confidence : 0;

  if (extracted.field_mention) {
    const candidates = await resolveFieldCandidates(supabaseAdmin, appUserId, extracted.field_mention);
    const [bestCandidate, secondCandidate] = candidates;
    const bestConfidence = typeof bestCandidate?.confidence === 'number' ? bestCandidate.confidence : null;
    const secondConfidence = typeof secondCandidate?.confidence === 'number' ? secondCandidate.confidence : null;

    if (bestCandidate && confidence >= 0.7 && (secondConfidence == null || (bestConfidence ?? 0) - secondConfidence >= 0.08)) {
      action = 'auto_set';
      targetFieldId = bestCandidate.id;
      metadata.resolved_field_name = bestCandidate.name;
      metadata.field_resolution_source = 'extract';
      metadata.field_resolution_confidence = confidence;
    } else if (candidates.length > 0) {
      action = 'disambiguate';
      disambiguateFields = candidates;
    }
  }

  if (messageId) {
    const updateData: Record<string, unknown> = {};
    if (action === 'auto_set' && targetFieldId) {
      updateData.field_id = targetFieldId;
    }
    updateData.metadata = {
      extracted_context: extracted,
      ...metadata,
      ...(action === 'disambiguate' ? { disambiguate_fields: disambiguateFields } : {}),
    };

    await supabaseAdmin
      .from('chat_messages')
      .update(updateData)
      .eq('id', messageId)
      .eq('user_id', appUserId);
  }

  return {
    action,
    fieldId: targetFieldId ?? null,
    candidates: disambiguateFields,
    extracted,
  };
}
