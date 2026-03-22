// Shared constants — single source of truth
// Edge function has its own copy (separate Deno runtime)

export const FREE_MESSAGE_LIMIT = 20;    // messages per month on free tier
export const FOLLOW_UP_DAYS = 13;        // days after intervention to follow up
export const MAX_ATTACHMENTS = 3;        // max files per message
export const MAX_CONVERSATION_HISTORY = 10; // messages sent to AI context
export const SIGNED_URL_EXPIRY = 3600;   // seconds (1 hour) for storage signed URLs
