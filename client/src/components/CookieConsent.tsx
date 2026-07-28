import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

const CONSENT_KEY = 'know-morrow.storage-consent.v1';
const OPTIONAL_KEYS = ['know-morrow.tomatoes.enabled', 'know-morrow.tavern-notice.opt-out.v2'];

type Choice = { necessary: true; preferences: boolean; recordedAt: string };

export function CookieConsent() {
  const [visible, setVisible] = useState(() => !localStorage.getItem(CONSENT_KEY));
  const [customizing, setCustomizing] = useState(false);
  const [preferences, setPreferences] = useState(false);

  useEffect(() => {
    const open = () => {
      const saved = localStorage.getItem(CONSENT_KEY);
      if (saved) {
        try { setPreferences(Boolean((JSON.parse(saved) as Choice).preferences)); } catch { setPreferences(false); }
      }
      setCustomizing(true);
      setVisible(true);
    };
    window.addEventListener('know-morrow:cookie-settings', open);
    return () => window.removeEventListener('know-morrow:cookie-settings', open);
  }, []);

  if (!visible) return null;

  const save = (allowPreferences: boolean) => {
    if (!allowPreferences) OPTIONAL_KEYS.forEach((key) => localStorage.removeItem(key));
    const choice: Choice = { necessary: true, preferences: allowPreferences, recordedAt: new Date().toISOString() };
    localStorage.setItem(CONSENT_KEY, JSON.stringify(choice));
    setVisible(false);
    setCustomizing(false);
  };

  return (
    <aside className="cookie-consent" aria-label="Cookie and storage preferences">
      <div className="cookie-consent__copy">
        <strong>Cookies &amp; local storage</strong>
        <p>Necessary storage supports sign-in and security. Optional preference storage remembers interface choices. We do not use advertising cookies.</p>
        <div className="cookie-consent__links"><Link to="/privacy">Privacy Policy</Link><Link to="/terms">Terms</Link></div>
        {customizing && (
          <div className="cookie-consent__options">
            <label><span><strong>Necessary</strong><small>Authentication, security and your consent record.</small></span><input type="checkbox" checked disabled /></label>
            <label><span><strong>Preferences</strong><small>Tavern notice and tomato display choices.</small></span><input type="checkbox" checked={preferences} onChange={(event) => setPreferences(event.target.checked)} /></label>
          </div>
        )}
      </div>
      <div className="cookie-consent__actions">
        {customizing ? (
          <button className="btn btn--primary" onClick={() => save(preferences)}>Save choices</button>
        ) : (
          <>
            <button className="btn" onClick={() => save(false)}>Reject optional</button>
            <button className="btn" onClick={() => setCustomizing(true)}>Customize</button>
            <button className="btn btn--primary" onClick={() => save(true)}>Accept all</button>
          </>
        )}
      </div>
    </aside>
  );
}
