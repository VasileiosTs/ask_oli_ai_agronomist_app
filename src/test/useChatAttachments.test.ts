import { describe, expect, it, vi, beforeAll } from 'vitest';
import type { ChangeEvent } from 'react';
import { act, renderHook } from '@testing-library/react';

// The hook imports these at module load; stub them so importing it doesn't
// spin up a real Supabase client or the image cache. Our code paths under test
// (handleFileSelect / setAttachments / removeAttachment) never call into them.
vi.mock('../lib/supabase', () => ({ supabase: {} }));
vi.mock('../lib/imageCache', () => ({
  cacheImage: vi.fn(),
  compressImage: vi.fn(),
  deleteCachedImage: vi.fn(),
}));

import { useChatAttachments } from '../pages/chat/useChatAttachments';
import type { T } from '../lib/i18n';

beforeAll(() => {
  // jsdom doesn't implement object URLs.
  let n = 0;
  globalThis.URL.createObjectURL = vi.fn(() => `blob:mock/${n++}`);
  globalThis.URL.revokeObjectURL = vi.fn();
});

const t = { fileRejected: 'rejected', tooManyFiles: 'too many' } as unknown as T;
const noopToast = () => {};

function selectEvent(files: File[]): ChangeEvent<HTMLInputElement> {
  return { target: { files, value: 'x' } } as unknown as ChangeEvent<HTMLInputElement>;
}

function imageFile(name: string): File {
  return new File(['x'], name, { type: 'image/jpeg' });
}

describe('useChatAttachments', () => {
  it('does not carry the previous message\'s attachments into the next upload after send', () => {
    const { result } = renderHook(() => useChatAttachments({ t }));

    // 1. User attaches a photo to the first message.
    act(() => result.current.handleFileSelect(selectEvent([imageFile('first.jpg')]), noopToast));
    expect(result.current.attachments.map((a) => a.file.name)).toEqual(['first.jpg']);

    // 2. Message is sent — the send handler clears via setAttachments([]).
    act(() => result.current.setAttachments([]));
    expect(result.current.attachments).toHaveLength(0);

    // 3. User picks a new photo for the next message. The old one must NOT reappear.
    act(() => result.current.handleFileSelect(selectEvent([imageFile('second.jpg')]), noopToast));
    expect(result.current.attachments.map((a) => a.file.name)).toEqual(['second.jpg']);
  });

  it('frees all attachment slots again after a clear', () => {
    const { result } = renderHook(() => useChatAttachments({ t }));

    // Fill all 3 slots (MAX_ATTACHMENTS).
    act(() =>
      result.current.handleFileSelect(
        selectEvent([imageFile('a.jpg'), imageFile('b.jpg'), imageFile('c.jpg')]),
        noopToast,
      ),
    );
    expect(result.current.attachments).toHaveLength(3);

    act(() => result.current.setAttachments([]));

    // After clearing, all 3 slots are available again (ref length reset to 0).
    act(() =>
      result.current.handleFileSelect(
        selectEvent([imageFile('d.jpg'), imageFile('e.jpg'), imageFile('f.jpg')]),
        noopToast,
      ),
    );
    expect(result.current.attachments.map((a) => a.file.name)).toEqual(['d.jpg', 'e.jpg', 'f.jpg']);
  });
});
