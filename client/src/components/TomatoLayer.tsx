import type { MouseEvent } from 'react';
import { useTomato } from '../context/TomatoContext';
import { useAuth } from '../context/AuthContext';

function TomatoSplat({ splat, size = 38 }: { splat: string; size?: number }) {
  const index = { 'splat-a': 0, 'splat-b': 1, 'splat-c': 2, 'splat-d': 3 }[splat] ?? 0;
  const blobs = [
    'M50 8c22 0 40 17 40 39 0 26-24 45-40 45S10 73 10 47C10 25 28 8 50 8z',
    'M50 6c26 4 42 22 40 44-2 27-22 42-42 42S8 74 10 48C12 24 26 2 50 6z',
    'M52 9c24-2 38 20 38 40 0 25-20 43-42 43S8 71 10 46 28 11 52 9z',
    'M48 7c25 0 42 19 42 41s-19 44-41 44S9 72 9 48 23 7 48 7z',
  ];
  return <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true"><ellipse cx="50" cy="70" rx="38" ry="26" fill="#e8492f" opacity=".28" /><path d={blobs[index]} fill="#e8492f" /><path d={blobs[(index + 1) % 4]} fill="#c9351f" opacity=".45" transform="scale(.7) translate(21 22)" /><circle cx="38" cy="36" r="7" fill="#ff8c73" opacity=".75" /><path d="M50 10c-6-6-14-7-20-4 3 7 10 11 17 10l-1 6h8l-1-6c7 1 14-3 17-10-6-3-14-2-20 4z" fill="#3f9c5a" /></svg>;
}

export function TomatoLayer() {
  const { enabled, armed, tomatoes, throwAt, wipe, page } = useTomato();
  const { user } = useAuth();
  if (!enabled || !page) return null;
  const onClick = (event: MouseEvent<HTMLDivElement>) => {
    if (!armed) return;
    const rect = event.currentTarget.getBoundingClientRect();
    void throwAt(((event.clientX - rect.left) / rect.width) * 100, ((event.clientY - rect.top) / rect.height) * 100);
  };
  return <div className={`tomato-layer ${armed ? 'tomato-layer--armed' : ''}`} onClick={onClick}>
    {tomatoes.map((tomato) => <button key={tomato.id} type="button" className="tomato" style={{ left: `${tomato.x}%`, top: `${tomato.y}%`, transform: `translate(-50%, -50%) rotate(${tomato.rot}deg) scale(${tomato.scale})` }} onClick={(event) => { event.stopPropagation(); if (tomato.mine || user?.siteRole === 'admin') void wipe(tomato.id); }} disabled={!tomato.mine && user?.siteRole !== 'admin'} title={tomato.mine ? 'Click to remove your tomato' : tomato.alias}><TomatoSplat splat={tomato.splat} /><span className="tomato__note">{tomato.note ? `“${tomato.note}” — ` : ''}{tomato.alias}</span></button>)}
  </div>;
}

export function TomatoToolbar() {
  const { enabled, toggle, armed, setArmed, note, setNote, tomatoes, price, page } = useTomato();
  const { user } = useAuth();
  if (!page) return null;
  const canThrow = !!user && !user.readOnly;
  return <div className="tomato-toolbar">
    {enabled && armed && <div className="tomato-hud"><div>Click anywhere to throw · {price} TMT each</div><input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Add a message (optional)" maxLength={60} /></div>}
    {enabled && <button className={`tomato-fab ${armed ? 'tomato-fab--armed tomato-fab--on' : ''}`} onClick={() => setArmed(!armed)} disabled={!canThrow} title={!user ? 'Sign in with Discord to throw' : user.readOnly ? 'Event Staff access is read-only' : ''}>🍅 {armed ? 'Cancel throw' : 'Throw a tomato'}</button>}
    <button className={`tomato-fab ${enabled ? 'tomato-fab--on' : ''}`} onClick={toggle}><span aria-hidden="true">🍅</span>{enabled ? `Comments on · ${tomatoes.length}` : 'Comments off'}</button>
  </div>;
}
