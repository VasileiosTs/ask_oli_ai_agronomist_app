export interface GeminiUsage {
  promptTokenCount: number;
  candidatesTokenCount: number;
  totalTokenCount: number;
}

const GEMINI_COST_PER_1K_TOKENS_USD = 0.15;

export function extractGeminiUsage(payload: any): GeminiUsage | null {
  const usage = payload?.usageMetadata;
  if (!usage || typeof usage !== 'object') {
    return null;
  }

  const promptTokenCount = Number(usage.promptTokenCount ?? 0);
  const candidatesTokenCount = Number(usage.candidatesTokenCount ?? 0);
  const totalTokenCount = Number(usage.totalTokenCount ?? promptTokenCount + candidatesTokenCount);

  if (
    Number.isNaN(promptTokenCount) ||
    Number.isNaN(candidatesTokenCount) ||
    Number.isNaN(totalTokenCount)
  ) {
    return null;
  }

  return {
    promptTokenCount,
    candidatesTokenCount,
    totalTokenCount,
  };
}

export function mergeGeminiUsage(
  base: GeminiUsage | null,
  extra: GeminiUsage | null,
): GeminiUsage | null {
  if (!base) {
    return extra;
  }

  if (!extra) {
    return base;
  }

  return {
    promptTokenCount: base.promptTokenCount + extra.promptTokenCount,
    candidatesTokenCount: base.candidatesTokenCount + extra.candidatesTokenCount,
    totalTokenCount: base.totalTokenCount + extra.totalTokenCount,
  };
}

export function estimateGeminiCostUsd(usage: GeminiUsage | null): number {
  if (!usage) {
    return 0;
  }

  return Number(((usage.totalTokenCount / 1000) * GEMINI_COST_PER_1K_TOKENS_USD).toFixed(6));
}

export async function logAiUsageEvent(
  supabaseAdmin: any,
  {
    userId,
    conversationId,
    model,
    requestKind,
    usage,
    metadata,
  }: {
    userId: string;
    conversationId?: string | null;
    model: string;
    requestKind: string;
    usage: GeminiUsage | null;
    metadata?: Record<string, unknown>;
  },
) {
  if (!usage) {
    return;
  }

  await supabaseAdmin.from('ai_usage_events').insert({
    user_id: userId,
    conversation_id: conversationId ?? null,
    model,
    request_kind: requestKind,
    prompt_tokens: usage.promptTokenCount,
    output_tokens: usage.candidatesTokenCount,
    total_tokens: usage.totalTokenCount,
    estimated_cost_usd: estimateGeminiCostUsd(usage),
    metadata: metadata ?? {},
  });
}

export async function logOperationalEvent(
  supabaseAdmin: any,
  {
    userId,
    source,
    eventType,
    severity = 'info',
    message,
    fingerprint,
    metadata,
  }: {
    userId?: string | null;
    source: string;
    eventType: string;
    severity?: 'info' | 'warning' | 'error' | 'critical';
    message: string;
    fingerprint?: string;
    metadata?: Record<string, unknown>;
  },
) {
  await supabaseAdmin.from('operational_events').insert({
    user_id: userId ?? null,
    source,
    event_type: eventType,
    severity,
    message,
    fingerprint: fingerprint ?? null,
    metadata: metadata ?? {},
  });
}

export async function maybeLogGeminiErrorRateAlert(
  supabaseAdmin: any,
  context: {
    userId?: string | null;
    model: string;
    windowMinutes?: number;
    thresholdPercent?: number;
  },
) {
  const windowMinutes = context.windowMinutes ?? 5;
  const thresholdPercent = context.thresholdPercent ?? 5;
  const windowStart = new Date(Date.now() - windowMinutes * 60_000).toISOString();

  const { count: totalCount } = await supabaseAdmin
    .from('operational_events')
    .select('id', { count: 'exact', head: true })
    .eq('source', 'chat')
    .eq('event_type', 'gemini_request')
    .gte('created_at', windowStart);

  const { count: errorCount } = await supabaseAdmin
    .from('operational_events')
    .select('id', { count: 'exact', head: true })
    .eq('source', 'chat')
    .eq('event_type', 'gemini_api')
    .gte('created_at', windowStart);

  const total = totalCount ?? 0;
  const errors = errorCount ?? 0;
  if (total === 0) {
    return;
  }

  const errorRate = (errors / total) * 100;
  if (errorRate < thresholdPercent) {
    return;
  }

  await logOperationalEvent(supabaseAdmin, {
    userId: context.userId ?? null,
    source: 'chat',
    eventType: 'gemini_error_rate_alert',
    severity: 'critical',
    message: `Gemini error rate exceeded ${thresholdPercent}% in the last ${windowMinutes} minutes`,
    fingerprint: `gemini-alert:${context.model}:${windowMinutes}`,
    metadata: {
      model: context.model,
      totalRequests: total,
      errorRequests: errors,
      errorRate,
      windowMinutes,
    },
  });
}
