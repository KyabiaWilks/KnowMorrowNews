import { useEffect, useState } from 'react';
import type { EvidenceFile } from '../../lib/types';
import { openProtectedFile, protectedFileUrl } from '../../lib/api';
import { fmtSize } from '../../lib/format';
import { useToast } from '../../context/ToastContext';

export function EvidencePreview({ file }: { file: EvidenceFile }) {
  const toast = useToast();
  const [objectUrl, setObjectUrl] = useState('');
  const previewable = file.mime.startsWith('image/') || file.mime.startsWith('video/');

  useEffect(() => {
    if (!previewable || file.videoProvider === 'youtube') return;
    let active = true;
    let created = '';
    void protectedFileUrl(file.url).then((url) => {
      created = url;
      if (active) setObjectUrl(url);
      else URL.revokeObjectURL(url);
    }).catch((reason) => toast.push(reason.message, 'bad'));
    return () => {
      active = false;
      if (created) URL.revokeObjectURL(created);
    };
  }, [file.url, file.videoProvider, previewable, toast]);

  if (file.videoProvider === 'youtube' && file.videoId) {
    return <div className="stack" style={{ gap: 8 }}>
      <div style={{ position: 'relative', width: '100%', paddingTop: '56.25%', overflow: 'hidden', borderRadius: 6, background: '#111' }}>
        <iframe title={file.name} src={`https://www.youtube-nocookie.com/embed/${file.videoId}`} allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" sandbox="allow-scripts allow-same-origin allow-presentation" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }} />
      </div>
      <a className="btn btn--ghost btn--sm" href={file.sourceUrl || file.url} target="_blank" rel="noreferrer">Open on YouTube</a>
    </div>;
  }

  if (file.mime.startsWith('image/')) {
    return objectUrl ? <figure style={{ margin: 0 }}><img src={objectUrl} alt={file.name} style={{ display: 'block', maxWidth: '100%', maxHeight: 720, objectFit: 'contain', borderRadius: 6 }} /><figcaption className="muted" style={{ marginTop: 6 }}>{file.name} · {fmtSize(file.size)}</figcaption></figure> : <div className="muted">Loading image preview…</div>;
  }
  if (file.mime.startsWith('video/')) {
    return objectUrl ? <video src={objectUrl} controls preload="metadata" style={{ display: 'block', width: '100%', maxHeight: 640, borderRadius: 6 }} /> : <div className="muted">Loading video preview…</div>;
  }
  return <button type="button" className="btn btn--ghost btn--sm" onClick={() => void openProtectedFile(file.url, file.name).catch((reason) => toast.push(reason.message, 'bad'))}>📎 {file.name} <span className="muted">{fmtSize(file.size)}</span></button>;
}
