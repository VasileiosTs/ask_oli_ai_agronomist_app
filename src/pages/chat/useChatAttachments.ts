import { useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { supabase } from '../../lib/supabase';
import {
  cacheImage,
  compressImage,
  deleteCachedImage,
} from '../../lib/imageCache';
import type { T } from '../../lib/i18n';
import type { InlineAttachment } from '../../lib/chatFunction';
import {
  ALLOWED_FILE_TYPES,
  MAX_ATTACHMENTS,
  MAX_FILE_SIZE,
} from '../../lib/constants';

interface PendingAttachment {
  file: File;
  previewUrl: string;
}

interface PrepareAttachmentsOptions {
  attachments: PendingAttachment[];
  userId?: string;
  showToast: (message: string) => void;
}

export async function cleanupUploadedAssets(paths: string[]) {
  if (paths.length === 0) {
    return;
  }

  await Promise.all(paths.map((path) => deleteCachedImage(path)));

  const { error } = await supabase.storage
    .from('chat_uploads')
    .remove(paths);

  if (error) {
    console.error('Failed to clean up uploaded files:', error);
  }
}

export async function prepareAttachmentsForSend({
  attachments,
  userId,
  showToast,
}: PrepareAttachmentsOptions): Promise<{
  attachmentSummary: string;
  inlineAttachments: InlineAttachment[];
  uploadedPaths: string[];
  messageAttachments: Array<{ url: string; mimeType: string; name: string }>;
}> {
  const imageCount = attachments.filter((attachment) => attachment.file.type.startsWith('image/')).length;
  const documentCount = attachments.length - imageCount;
  const summaryParts: string[] = [];

  if (imageCount > 0) {
    summaryParts.push(`${imageCount} image${imageCount === 1 ? '' : 's'}`);
  }
  if (documentCount > 0) {
    summaryParts.push(`${documentCount} document${documentCount === 1 ? '' : 's'}`);
  }

  const inlineAttachments: InlineAttachment[] = [];
  const uploadedPaths: string[] = [];

  for (const attachment of attachments) {
    try {
      let base64: string;
      let mimeType: string;
      let uploadBlob: Blob;

      if (attachment.file.type.startsWith('image/')) {
        const compressed = await compressImage(attachment.file);
        base64 = compressed.base64;
        mimeType = compressed.mimeType;
        uploadBlob = compressed.blob;
      } else {
        const buffer = await attachment.file.arrayBuffer();
        base64 = btoa(new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), ''));
        mimeType = attachment.file.type;
        uploadBlob = attachment.file;
      }

      inlineAttachments.push({ mimeType, data: base64 });

      if (!userId) {
        continue;
      }

      const fileExt = mimeType === 'image/jpeg' ? 'jpg' : attachment.file.name.split('.').pop();
      const fileName = `${Date.now()}_${crypto.randomUUID().slice(0, 8)}.${fileExt}`;
      const filePath = `${userId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('chat_uploads')
        .upload(filePath, uploadBlob);

      if (uploadError) {
        continue;
      }

      uploadedPaths.push(filePath);

      if (mimeType.startsWith('image/')) {
        await cacheImage(filePath, uploadBlob);
      }
    } catch (error) {
      console.error('Error processing attachment', error);
      showToast('Attachment processing failed.');
    }
  }

  return {
    attachmentSummary: summaryParts.join(' and '),
    inlineAttachments,
    uploadedPaths,
    messageAttachments: attachments.map((attachment) => ({
      url: attachment.previewUrl,
      mimeType: attachment.file.type,
      name: attachment.file.name,
    })),
  };
}

export function useChatAttachments({
  t,
}: {
  t: T;
}) {
  const [attachments, setAttachmentsState] = useState<PendingAttachment[]>([]);
  const [showAttachmentSheet, setShowAttachmentSheet] = useState(false);
  const attachmentsRef = useRef<PendingAttachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Single writer for attachment state. Every update flows through here so the ref
  // (which handleFileSelect reads when appending newly-picked files) can never drift
  // from React state. Before this, sending a message called setAttachments([]) which
  // cleared the state but left the ref populated, so the next file the user picked
  // silently re-attached the previous message's photos/files.
  const setAttachments = (
    next: PendingAttachment[] | ((current: PendingAttachment[]) => PendingAttachment[]),
  ) => {
    const resolved = typeof next === 'function' ? next(attachmentsRef.current) : next;
    attachmentsRef.current = resolved;
    setAttachmentsState(resolved);
  };

  const handleFileSelect = (event: ChangeEvent<HTMLInputElement>, showToast: (message: string) => void) => {
    if (event.target.files) {
      const newFiles = Array.from(event.target.files);
      const validFiles = newFiles.filter((file) => {
        const isValidType = (ALLOWED_FILE_TYPES as readonly string[]).includes(file.type);
        const isValidSize = file.size <= MAX_FILE_SIZE;
        return isValidType && isValidSize;
      });

      if (validFiles.length !== newFiles.length) {
        showToast(t.fileRejected);
      }

      const availableSlots = Math.max(MAX_ATTACHMENTS - attachmentsRef.current.length, 0);
      const filesToAdd = validFiles.slice(0, availableSlots);

      if (filesToAdd.length < validFiles.length) {
        showToast(t.tooManyFiles);
      }

      const nextAttachments = [
        ...attachmentsRef.current,
        ...filesToAdd.map((file) => ({
          file,
          previewUrl: URL.createObjectURL(file),
        })),
      ];

      setAttachments(nextAttachments);
    }

    event.target.value = '';
    setShowAttachmentSheet(false);
  };

  const removeAttachment = (index: number) => {
    setAttachments((current) => {
      const nextAttachments = [...current];
      if (!nextAttachments[index]) {
        return current;
      }

      const [removed] = nextAttachments.splice(index, 1);
      if (removed.previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(removed.previewUrl);
      }

      return nextAttachments;
    });
  };

  return {
    attachments,
    attachmentsRef,
    cameraInputRef,
    fileInputRef,
    showAttachmentSheet,
    setAttachments,
    setShowAttachmentSheet,
    handleFileSelect,
    removeAttachment,
  };
}
