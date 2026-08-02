import type { MouseEvent } from 'react';
import { useTomato } from '../context/TomatoContext';
import { useAuth } from '../context/AuthContext';
import { TomatoIcon } from './TomatoIcon';

function TomatoSplat({ splat, size = 48 }: { splat: string; size?: number }) {
  const variant = ({ tmt1: 1, tmt3: 3, tmt4: 4, tmt5: 5 } as const)[splat as 'tmt1' | 'tmt3' | 'tmt4' | 'tmt5'] || 1;
  return <TomatoIcon variant={variant} size={size} />;
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
  const { enabled, toggle, armed, setArmed, note, setNote, tomatoes, totalTomatoes, price, page } = useTomato();
  const { user } = useAuth();
  if (!page) return null;
  const canThrow = !!user && (!user.readOnly || user.siteRole === 'read_only_user');
  return <div className="tomato-toolbar">
    {enabled && armed && <div className="tomato-hud"><div>Click anywhere to throw · {price} TMT each</div><div className="tomato-hud__message"><input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Add a message (optional)" maxLength={60} aria-describedby="tomato-message-limit" /><span id="tomato-message-limit">{note.length}/60</span></div></div>}
    {enabled && <button className={`tomato-fab ${armed ? 'tomato-fab--armed tomato-fab--on' : ''}`} onClick={() => setArmed(!armed)} disabled={!canThrow} title={!user ? 'Sign in with Discord to throw' : user.siteRole === 'read_only_admin' ? 'Event Staff access is read-only' : ''}><TomatoIcon size={24} /> {armed ? 'Cancel throw' : 'Throw a tomato'}</button>}
    <button className={`tomato-fab ${enabled ? 'tomato-fab--on' : ''}`} onClick={toggle} title={enabled && totalTomatoes > tomatoes.length ? `${tomatoes.length} shown from ${totalTomatoes}; refresh for another random selection` : ''}><TomatoIcon size={24} />{enabled ? `Tomatoes on · ${totalTomatoes}` : 'Tomatoes off'}</button>
  </div>;
}
