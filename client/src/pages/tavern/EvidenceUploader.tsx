import { useRef, useState } from 'react';
import { api } from '../../lib/api';
import type { EvidenceFile } from '../../lib/types';
import { fmtSize } from '../../lib/format';
import { useToast } from '../../context/ToastContext';

export function EvidenceUploader({ files, onChange, label = 'Evidence files (optional, up to 6 items, 50 MB per file)' }: { files: EvidenceFile[]; onChange: (next: EvidenceFile[]) => void; label?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const upload = async (list: FileList | null) => {
    if (!list?.length) return;
    const form = new FormData();
    for (const file of Array.from(list).slice(0, 6 - files.length)) form.append('files', file);
    setBusy(true);
    try {
      const result = await api<{ files: EvidenceFile[] }>('/upload/evidence', { method: 'POST', raw: form });
      onChange([...files, ...result.files].slice(0, 6));
    } catch (error) { toast.push((error as Error).message, 'bad'); }
    finally { setBusy(false); if (input.current) input.current.value = ''; }
  };
  const addYoutube = async () => {
    if (!youtubeUrl.trim() || files.length >= 6) return;
    setBusy(true);
    try {
      const result = await api<{ file: EvidenceFile }>('/upload/evidence/link', { method: 'POST', body: { url: youtubeUrl } });
      onChange([...files, result.file]);
      setYoutubeUrl('');
    } catch (error) { toast.push((error as Error).message, 'bad'); }
    finally { setBusy(false); }
  };
  return <div className="field">
    <label>{label}</label>
    <input ref={input} type="file" accept=".jpg,.jpeg,.png,.webp,.gif,.avif,.mp4,.webm,.pdf,.txt" multiple hidden onChange={(event) => upload(event.target.files)} />
    <button type="button" className="btn btn--sm" onClick={() => input.current?.click()} disabled={busy || files.length >= 6}>{busy ? 'Uploading…' : '📎 Choose files'}</button>
    <div className="row" style={{ marginTop: 8 }}>
      <input className="input" type="url" value={youtubeUrl} placeholder="YouTube or Google Drive sharing URL" onChange={(event) => setYoutubeUrl(event.target.value)} />
      <button type="button" className="btn btn--sm" disabled={busy || !youtubeUrl.trim() || files.length >= 6} onClick={() => void addYoutube()}>Add link</button>
    </div>
    {files.length > 0 && <div className="stack" style={{ gap: 4, marginTop: 6 }}>{files.map((file) => <div key={file.id} className="row row--between" style={{ fontSize: 13 }}><span>📎 {file.name} {file.size > 0 && <span className="muted">{fmtSize(file.size)}</span>}</span><button type="button" className="btn btn--ghost btn--sm" onClick={() => onChange(files.filter((item) => item.id !== file.id))}>Remove</button></div>)}</div>}
    <div className="hint">Maximum 50 MB per file. For larger files, use a valid Google Drive share or YouTube link. Executables, disguised files, and unrecognized sharing links are rejected.</div>
  </div>;
}
