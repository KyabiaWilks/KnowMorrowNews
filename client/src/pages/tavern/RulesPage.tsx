import { Link } from 'react-router-dom';
import { RULES } from './TavernNotice';

const PENALTIES = [
  { level: 'Minor', color: 'chip--warn', items: ['Warning recorded', 'Content removed'] },
  { level: 'Major', color: 'chip--danger', items: ['All masks suspended', 'Funds frozen', 'Compensation paid from frozen funds'] },
  { level: 'Severe', color: 'chip--danger', items: ['All major sanctions', 'Public disclosure of the site account'] },
];

export default function RulesPage() {
  return (
    <div className="tavern">
      <div className="tavern-rules stack">
        <header className="tavern-rules__head">
          <div className="eyebrow">TAVERN HOUSE RULES</div>
          <h1 className="page-title">Rules &amp; safeguards</h1>
          <div className="page-sub">Anonymity protects patrons. It does not excuse abuse.</div>
        </header>

        <section className="card tavern-rules__principles">
          {RULES.map((rule) => (
            <article key={rule.title} className="tavern-rule">
              <div className="tavern-rule__icon">{rule.icon}</div>
              <div>
                <h2>{rule.title}</h2>
                <div className="soft">{rule.text}</div>
              </div>
            </article>
          ))}
        </section>

        <section className="card card--pad stack tavern-rules__penalties">
          <div className="eyebrow">PENALTY SCALE</div>
          {PENALTIES.map((penalty) => (
            <div key={penalty.level} className="tavern-penalty">
              <span className={`chip ${penalty.color}`}>{penalty.level}</span>
              <div className="soft">{penalty.items.join(' · ')}</div>
            </div>
          ))}
        </section>

        <div className="tavern-rules__details">
          <section className="card card--pad stack">
            <div className="eyebrow">IDENTITY</div>
            <p className="soft">One account may hold up to six masks. Other participants cannot connect those masks to one another. Arbitration is the only exception: when a report enters review, the team may inspect all masks attached to the reported account, and sanctions apply to the account rather than a single alias.</p>
          </section>
          <section className="card card--pad stack">
            <div className="eyebrow">PAYMENTS &amp; ESCROW</div>
            <p className="soft">Transactions use tomato coin (TMT). Sellers set tiered prices; buyers unlock only what they need. A request must escrow at least its highest reward. Accepted submissions are paid directly from escrow, and unused funds return when the request closes.</p>
          </section>
        </div>

        <div className="tavern-rules__actions">
          <Link to="/tavern" className="btn btn--primary">Enter the Tavern</Link>
          <Link to="/tavern/disclosures" className="btn">Public disclosures</Link>
        </div>
      </div>
    </div>
  );
}
