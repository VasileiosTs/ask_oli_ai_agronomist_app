// Shared constants — single source of truth
// Edge function has its own copy (separate Deno runtime)

export const FREE_MESSAGE_LIMIT = 20;    // messages per month on free tier
export const VIO_STEP1_DAYS = 3;         // days after logging → "did you apply?"
export const VIO_STEP2_DAYS = 3;         // days after apply confirm → "any improvement?"
export const MAX_ATTACHMENTS = 3;        // max files per message
export const MAX_CONVERSATION_HISTORY = 10; // messages sent to AI context
export const SIGNED_URL_EXPIRY = 3600;   // seconds (1 hour) for storage signed URLs

// Allowed MIME types for file uploads
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'] as const;
export const ALLOWED_DOCUMENT_TYPES = ['application/pdf'] as const;
export const ALLOWED_FILE_TYPES = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_DOCUMENT_TYPES] as const;
export const ALLOWED_FILE_ACCEPT = 'image/jpeg,image/png,image/webp,image/heic,application/pdf';
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
