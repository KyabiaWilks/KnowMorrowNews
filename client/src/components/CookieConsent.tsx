import { useState } from 'react';
import { Link } from 'react-router-dom';

const CONSENT_KEY = 'know-morrow.storage-consent.v1';

export function CookieConsent() {
  const [visible, setVisible] = useState(() => !localStorage.getItem(CONSENT_KEY));
  if (!visible) return null;
  const choose = (choice: 'essential' | 'all') => {
    localStorage.setItem(CONSENT_KEY, JSON.stringify({ choice, recordedAt: new Date().toISOString() }));
    setVisible(false);
  };
  return (
    <aside className="cookie-consent" aria-label="Cookie and storage preferences">
      <div><strong>Cookies &amp; local storage</strong><p>We use essential browser storage for sign-in and security, plus optional preference storage to remember your choices. We do not use advertising cookies.</p><div className="cookie-consent__links"><Link to="/privacy">Privacy Policy</Link><Link to="/terms">Terms</Link></div></div>
      <div className="cookie-consent__actions"><button className="btn" onClick={() => choose('essential')}>Essential only</button><button className="btn btn--primary" onClick={() => choose('all')}>Accept preferences</button></div>
    </aside>
  );
}
