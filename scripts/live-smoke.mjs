import { readFileSync, writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

function readEnvFile(path) {
  const text = readFileSync(path, 'utf8');
  const values = {};
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)="?(.*?)"?\s*$/);
    if (match) {
      values[match[1]] = match[2];
    }
  }
  return values;
}

function parseSse(rawSse) {
  return rawSse
    .split('\n\n')
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => {
      const lines = chunk.split('\n');
      const eventLine = lines.find((line) => line.startsWith('event:')) || 'event: message';
      const dataLine = lines.find((line) => line.startsWith('data:')) || 'data: {}';
      return {
        event: eventLine.slice(6).trim(),
        data: JSON.parse(dataLine.slice(5).trim()),
      };
    });
}

async function main() {
  const env = readEnvFile('.env.local');
  const smokeUser = JSON.parse(readFileSync('/tmp/oli_smoke_user.json', 'utf8'));
  const url = env.VITE_SUPABASE_URL;
  const publicKey = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY;
  const authHeader = `Bearer ${smokeUser.accessToken}`;

  if (!url || !publicKey) {
    throw new Error('Missing VITE_SUPABASE_URL or a Supabase public key');
  }

  const authCheck = await fetch(`${url}/auth/v1/user`, {
    headers: {
      apikey: publicKey,
      Authorization: authHeader,
    },
  });

  const authPayload = await authCheck.json();
  if (!authCheck.ok) {
    throw new Error(`Auth user check failed: ${JSON.stringify(authPayload)}`);
  }

  const client = createClient(url, publicKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: authHeader } },
  });

  const messageText = 'My tomato field has yellow leaves and weak growth. What should I check first?';

  const upsertProfile = await client.from('users').upsert(
    {
      auth_id: smokeUser.authUserId,
      name: 'Codex Smoke Test',
      location: 'Athens',
      primary_crop: 'Tomato',
      onboarding_complete: true,
    },
    { onConflict: 'auth_id' }
  );

  if (upsertProfile.error) {
    throw new Error(`Profile upsert failed: ${upsertProfile.error.message}`);
  }

  const profileQuery = await client
    .from('users')
    .select('id, auth_id, onboarding_complete, message_count_month')
    .eq('auth_id', smokeUser.authUserId)
    .single();

  if (profileQuery.error || !profileQuery.data) {
    throw new Error(`Profile fetch failed: ${profileQuery.error?.message ?? 'missing profile'}`);
  }
  const profile = profileQuery.data;

  const conversationInsert = await client
    .from('conversations')
    .insert({ user_id: profile.id, title: 'Smoke test conversation' })
    .select('id')
    .single();

  if (conversationInsert.error || !conversationInsert.data) {
    throw new Error(`Conversation create failed: ${conversationInsert.error?.message ?? 'missing conversation'}`);
  }
  const conversation = conversationInsert.data;

  const userMessageInsert = await client
    .from('chat_messages')
    .insert({
      conversation_id: conversation.id,
      user_id: profile.id,
      role: 'user',
      content: messageText,
    })
    .select('id')
    .single();

  if (userMessageInsert.error || !userMessageInsert.data) {
    throw new Error(`User message insert failed: ${userMessageInsert.error?.message ?? 'missing user message'}`);
  }
  const userMessage = userMessageInsert.data;

  const extractResponse = await fetch(`${url}/functions/v1/chat`, {
    method: 'POST',
    headers: {
      Authorization: authHeader,
      apikey: publicKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      mode: 'extract',
      message: messageText,
      messageId: userMessage.id,
    }),
  });

  const extractJson = await extractResponse.json();
  if (!extractResponse.ok) {
    throw new Error(`Extract call failed: ${JSON.stringify(extractJson)}`);
  }

  if (extractJson.targetFieldId) {
    const updateConversation = await client
      .from('conversations')
      .update({ field_id: extractJson.targetFieldId })
      .eq('id', conversation.id);

    if (updateConversation.error) {
      throw new Error(`Conversation field update failed: ${updateConversation.error.message}`);
    }
  }

  let fieldContext = 'No field context available.';
  const fieldContextQuery = await client.from('field_context_view').select('*').eq('user_id', profile.id);

  if (Array.isArray(fieldContextQuery.data) && fieldContextQuery.data.length > 0) {
    const activeField = extractJson.targetFieldId
      ? fieldContextQuery.data.find((row) => row.id === extractJson.targetFieldId)
      : null;
    const row = activeField || fieldContextQuery.data[0];
    fieldContext =
      'CURRENT ACTIVE FIELD CONTEXT:\n' +
      `Field: ${row.name || 'N/A'} | Crop: ${row.crop_type || 'N/A'} | Size: ${row.size_ha || 'N/A'}ha | Soil: ${row.soil_type || 'N/A'} | Irrigation: ${row.irrigation_type || 'N/A'} | Medium: ${row.growing_medium || 'N/A'} | Last issue: ${row.last_diagnosis || 'None'}`;
  }

  const chatResponse = await fetch(`${url}/functions/v1/chat`, {
    method: 'POST',
    headers: {
      Authorization: authHeader,
      apikey: publicKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages: [{ role: 'user', content: messageText }],
      fieldContext,
      hasActiveField: Boolean(extractJson.targetFieldId),
      fieldId: extractJson.targetFieldId || null,
      conversationId: conversation.id,
      userMessageId: userMessage.id,
    }),
  });

  if (!chatResponse.ok) {
    throw new Error(`Chat call failed with ${chatResponse.status}: ${await chatResponse.text()}`);
  }

  const rawSse = await chatResponse.text();
  const events = parseSse(rawSse);
  const doneEvent = events.find((event) => event.event === 'done');

  if (!doneEvent) {
    throw new Error('No done event returned from chat stream');
  }

  const assistantMessageId = doneEvent.data.assistantMessageId;
  const assistantText = doneEvent.data.assistantText;

  const messagesQuery = await client
    .from('chat_messages')
    .select('id, role, content, conversation_id, field_id, metadata, created_at')
    .eq('conversation_id', conversation.id)
    .order('created_at', { ascending: true });

  if (messagesQuery.error || !messagesQuery.data) {
    throw new Error(`Message fetch failed: ${messagesQuery.error?.message ?? 'missing messages'}`);
  }
  const messages = messagesQuery.data;

  let intervention = null;
  let sharedRow = null;

  if (doneEvent.data.metadata?.diagnosis_data) {
    const diagnosis = doneEvent.data.metadata.diagnosis_data;
    const interventionInsert = await client
      .from('interventions')
      .insert({
        user_id: profile.id,
        message_id: assistantMessageId,
        field_id: extractJson.targetFieldId || null,
        crop_type: doneEvent.data.metadata.crop_mentioned || 'Tomato',
        problem: diagnosis.problem || '',
        product: diagnosis.product_applied || '',
        dosage: diagnosis.dosage || '',
        application_method: diagnosis.application_method || '',
        notes: 'Smoke test diagnosis',
        date: new Date().toISOString().slice(0, 10),
        is_shared: true,
      })
      .select('id, share_id')
      .single();

    if (interventionInsert.error || !interventionInsert.data) {
      throw new Error(`Intervention insert failed: ${interventionInsert.error?.message ?? 'missing intervention'}`);
    }

    intervention = interventionInsert.data;

    const sharedResponse = await fetch(
      `${url}/rest/v1/safe_shared_diagnoses?share_id=eq.${intervention.share_id}&select=*`,
      {
        headers: {
          apikey: publicKey,
          Authorization: `Bearer ${publicKey}`,
        },
      }
    );

    const sharedJson = await sharedResponse.json();
    if (!sharedResponse.ok) {
      throw new Error(`Shared view fetch failed: ${JSON.stringify(sharedJson)}`);
    }
    if (Array.isArray(sharedJson) && sharedJson.length > 0) {
      sharedRow = sharedJson[0];
    }
  }

  const result = {
    smokeUser: { email: smokeUser.email, authUserId: smokeUser.authUserId },
    authCheck: { id: authPayload.id, email: authPayload.email },
    profile,
    conversationId: conversation.id,
    userMessageId: userMessage.id,
    extract: extractJson,
    assistantMessageId,
    assistantText,
    streamedTokenEvents: events.filter((event) => event.event === 'token').length,
    messages,
    intervention,
    sharedRow,
  };

  writeFileSync('/tmp/oli_smoke_result.json', JSON.stringify(result, null, 2));
  console.log(
    JSON.stringify(
      {
        authUserId: authPayload.id,
        conversationId: conversation.id,
        userMessageId: userMessage.id,
        assistantMessageId,
        assistantPreview: String(assistantText).slice(0, 160),
        extractedAction: extractJson.action,
        targetFieldId: extractJson.targetFieldId || null,
        messageCount: messages.length,
        shareVerified: Boolean(sharedRow),
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exit(1);
});
