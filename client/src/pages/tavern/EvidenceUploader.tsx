import { useRef, useState } from 'react';
import { api } from '../../lib/api';
import type { EvidenceFile } from '../../lib/types';
import { fmtSize } from '../../lib/format';
import { useToast } from '../../context/ToastContext';
export function EvidenceUploader({ files, onChange, label = 'Evidence files (optional, up to 6 files, 15 MB each)' }: { files: EvidenceFile[]; onChange: (next: EvidenceFile[]) => void; label?: string }) {
  const input = useRef<HTMLInputElement>(null); const toast = useToast(); const [busy, setBusy] = useState(false);
  const upload = async (list: FileList | null) => {
    if (!list?.length) return;
    const form = new FormData(); for (const file of Array.from(list).slice(0, 6)) form.append('files', file);
    setBusy(true);
    try { const result = await api<{ files: EvidenceFile[] }>('/upload/evidence', { method: 'POST', raw: form }); onChange([...files, ...result.files].slice(0, 6)); }
    catch (error) { toast.push((error as Error).message, 'bad'); }
    finally { setBusy(false); if (input.current) input.current.value = ''; }
  };
  return <div className="field"><label>{label}</label><input ref={input} type="file" multiple hidden onChange={(event) => upload(event.target.files)} /><button type="button" className="btn btn--sm" onClick={() => input.current?.click()} disabled={busy || files.length >= 6}>{busy ? 'Uploading…' : '📎 Choose files'}</button>{files.length > 0 && <div className="stack" style={{ gap: 4, marginTop: 6 }}>{files.map((file) => <div key={file.id} className="row row--between" style={{ fontSize: 13 }}><span>📎 {file.name} <span className="muted">{fmtSize(file.size)}</span></span><button type="button" className="btn btn--ghost btn--sm" onClick={() => onChange(files.filter((item) => item.id !== file.id))}>Remove</button></div>)}</div>}<div className="hint">Listings marked “Detailed evidence” must attach at least one file to one or more tiers.</div></div>;
}
