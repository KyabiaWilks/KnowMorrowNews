import { useRef, useState } from 'react';
import { api } from '../lib/api';
import { useToast } from '../context/ToastContext';

export function ImageUploadButton({ onUploaded, label = 'Upload image' }: { onUploaded: (url: string) => void; label?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const upload = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    const form = new FormData();
    form.append('file', file);
    try {
      const result = await api<{ url: string }>('/upload/image', { method: 'POST', raw: form });
      onUploaded(result.url);
      toast.push('Image uploaded.', 'good');
    } catch (error) {
      toast.push((error as Error).message, 'bad');
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };
  return <><input ref={input} hidden type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" onChange={(event) => void upload(event.target.files?.[0])} /><button type="button" className="btn btn--sm" disabled={busy} onClick={() => input.current?.click()}>{busy ? 'Uploading…' : label}</button></>;
}
