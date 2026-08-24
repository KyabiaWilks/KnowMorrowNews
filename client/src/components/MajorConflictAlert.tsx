import { useEffect, useState } from 'react';
import { get } from '../lib/api';

export type OpeningAlert = { id: string; title: string; body: string; href: string | null };

export const MAJOR_CONFLICT_PREVIEW: OpeningAlert = {
  id: 'ad_major_conflict_refugee_haven',
  title: 'WARNING',
  body: '# Major Conflict Breaks Out\n\n## Third Island: A Safe Haven for Refugees\n\nSafety is available here.\n\n**Coordinates:** 0, 200\n\nhttps://discord.gg/bRnxFyWGbX',
  href: 'https://discord.gg/bRnxFyWGbX',
};

export function MajorConflictAlert({ preview = false }: { preview?: boolean }) {
  const [advertisement, setAdvertisement] = useState<OpeningAlert | null>(preview ? MAJOR_CONFLICT_PREVIEW : null);
  const [open, setOpen] = useState(preview);
  useEffect(() => {
    if (preview) return;
    void get<{ advertisement: OpeningAlert | null }>('/ads/opening-alert').then((result) => {
      setAdvertisement(result.advertisement);
      setOpen(!!result.advertisement);
    });
  }, [preview]);
  useEffect(() => {
    if (!open) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [open]);
  if (!advertisement || !open) return null;
  return <div className="conflict-alert-backdrop" role="presentation">
    <section className="conflict-alert" role="alertdialog" aria-modal="true" aria-labelledby="conflict-alert-title">
      <div className="conflict-alert__sweep" aria-hidden="true" />
      <div className="conflict-alert__warning"><span aria-hidden="true">⚠</span><strong id="conflict-alert-title">{advertisement.title}</strong><span aria-hidden="true">⚠</span></div>
      <div className="conflict-alert__content">
        <h1>Major Conflict Breaks Out</h1>
        <h2>Third Island: A Safe Haven for Refugees</h2>
        <p>Safety is available here.</p>
        <dl><div><dt>Coordinates:</dt><dd>0, 200</dd></div></dl>
        <a href="https://discord.gg/bRnxFyWGbX" target="_blank" rel="noopener noreferrer sponsored">https://discord.gg/bRnxFyWGbX</a>
      </div>
      <button className="conflict-alert__dismiss" type="button" onClick={() => setOpen(false)} aria-label="Dismiss warning">×</button>
    </section>
  </div>;
}
