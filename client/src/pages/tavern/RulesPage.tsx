import { Link } from 'react-router-dom';
import { RULES } from './TavernNotice';

const PENALTIES = [
  { level: 'Minor', color: 'chip--warn', items: ['Warning recorded', 'Content removed'] },
  { level: 'Major', color: 'chip--danger', items: ['All masks suspended', 'Funds frozen', 'Compensation paid from frozen funds'] },
  { level: 'Severe', color: 'chip--danger', items: ['All major sanctions', 'Public disclosure of the site account'] },
];

export default function RulesPage() {
  return <div className="tavern stack" style={{ gap: 20, maxWidth: 860, margin: '0 auto' }}>
    <div><div className="eyebrow">TAVERN HOUSE RULES</div><h1 className="page-title">Rules &amp; safeguards</h1><div className="page-sub">Anonymity protects patrons. It does not excuse abuse.</div></div>
    <div className="card card--pad stack" style={{ gap: 16 }}>{RULES.map((rule) => <div key={rule.title} className="row" style={{ gap: 13, alignItems: 'flex-start', flexWrap: 'nowrap' }}><div style={{ fontSize: 22 }}>{rule.icon}</div><div><div style={{ fontWeight: 720, marginBottom: 3 }}>{rule.title}</div><div className="soft">{rule.text}</div></div></div>)}</div>
    <div className="card card--pad stack"><div className="eyebrow">PENALTY SCALE</div>{PENALTIES.map((penalty) => <div key={penalty.level} className="row" style={{ gap: 12, alignItems: 'flex-start', flexWrap: 'nowrap', padding: '10px 0', borderBottom: '1px solid rgba(143,180,255,.12)' }}><span className={`chip ${penalty.color}`} style={{ minWidth: 78, justifyContent: 'center' }}>{penalty.level}</span><div className="soft">{penalty.items.join(' · ')}</div></div>)}</div>
    <div className="card card--pad stack"><div className="eyebrow">IDENTITY</div><p className="soft" style={{ margin: 0 }}>One account may hold up to six masks. Other participants cannot connect those masks to one another. Arbitration is the only exception: when a report enters review, the team may inspect all masks attached to the reported account, and sanctions apply to the account rather than a single alias.</p></div>
    <div className="card card--pad stack"><div className="eyebrow">PAYMENTS &amp; ESCROW</div><p className="soft" style={{ margin: 0 }}>Transactions use tomato coin (TMT). Sellers set tiered prices; buyers unlock only what they need. A request must escrow at least its highest reward. Accepted submissions are paid directly from escrow, and unused funds return when the request closes.</p></div>
    <div className="row"><Link to="/tavern" className="btn btn--primary">Enter the Tavern</Link><Link to="/tavern/disclosures" className="btn">Public disclosures</Link></div>
  </div>;
}
