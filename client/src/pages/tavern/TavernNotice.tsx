import { useEffect, useState } from 'react';
import { Modal } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';

const GUEST_KEY = 'jontop.tavern.notice';
export const RULES = [
  { icon: '🎭', title: 'Anonymity is a rule, not a shield', text: 'Participants appear only through their masks. Buyers and sellers do not learn one another’s account identity, but the editorial arbitration team may verify accounts when a dispute is filed.' },
  { icon: '⚖️', title: 'Fraud and deliberate non-payment enter arbitration', text: 'Verified abuse is reviewed by the Know Morrow arbitration team and handled according to its severity.' },
  { icon: '🚨', title: 'Sanctions follow the account', text: 'Penalties may suspend every mask on an account, freeze funds to compensate harmed parties, and—only in the most serious cases—result in a public disclosure.' },
  { icon: '💵', title: 'Requests require escrow', text: 'A bounty request must deposit at least its highest reward tier. Unused funds are returned when the request closes.' },
];

export function TavernNotice() {
  const { user, ackNotice } = useAuth();
  const [open, setOpen] = useState(false);
  useEffect(() => { setOpen(user ? !user.noticeAckedAt : localStorage.getItem(GUEST_KEY) !== '1'); }, [user]);
  const accept = async () => {
    localStorage.setItem(GUEST_KEY, '1');
    if (user) { try { await ackNotice(); } catch { /* shown again next time */ } }
    setOpen(false);
  };
  return <Modal open={open} dismissable={false} onClose={() => {}} title="Before entering the Newsroom, read these four rules" subtitle="We show this notice once before your first visit." footer={<button className="btn btn--primary" onClick={accept}>I understand and accept</button>}>
    <div className="stack" style={{ gap: 14 }}>{RULES.map((rule) => <div key={rule.title} className="row" style={{ gap: 13, alignItems: 'flex-start', flexWrap: 'nowrap' }}><div style={{ fontSize: 22 }}>{rule.icon}</div><div><div style={{ fontWeight: 720, marginBottom: 3 }}>{rule.title}</div><div className="muted">{rule.text}</div></div></div>)}<div className="notice-banner">Every offer and request includes a report control. Reports are visible only to the arbitration team and never disclose the reporter to the other party.</div></div>
  </Modal>;
}
