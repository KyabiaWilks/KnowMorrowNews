import { useEffect, useState } from 'react';
import { Modal } from '../../components/ui';

const NOTICE_OPT_OUT_KEY = 'know-morrow.tavern-notice.opt-out.v2';

export const RULES = [
  {
    icon: '🎭',
    title: 'Anonymity is a rule, not a shield',
    text: 'Participants appear only through their masks. Buyers and sellers do not learn one another’s account identity, but the editorial arbitration team may verify accounts when a dispute is filed.',
  },
  {
    icon: '⚖️',
    title: 'Fraud and deliberate non-payment enter arbitration',
    text: 'Verified abuse is reviewed by the Know Morrow arbitration team and handled according to its severity.',
  },
  {
    icon: '🚨',
    title: 'Sanctions follow the account',
    text: 'Penalties may suspend every mask on an account, freeze funds to compensate harmed parties, and—only in the most serious cases—result in a public disclosure.',
  },
  {
    icon: '💵',
    title: 'Requests require escrow',
    text: 'A bounty request must deposit at least its highest reward tier. Unused funds are returned when the request closes.',
  },
];

export function TavernNotice() {
  const [open, setOpen] = useState(false);
  const [doNotShowAgain, setDoNotShowAgain] = useState(false);

  useEffect(() => {
    setOpen(localStorage.getItem(NOTICE_OPT_OUT_KEY) !== '1');
  }, []);

  const accept = () => {
    if (doNotShowAgain) {
      localStorage.setItem(NOTICE_OPT_OUT_KEY, '1');
    } else {
      localStorage.removeItem(NOTICE_OPT_OUT_KEY);
    }
    setOpen(false);
  };

  return (
    <Modal
      open={open}
      className="modal--tavern-notice"
      dismissable={false}
      onClose={() => {}}
      title="Before entering the Tavern, read these four rules"
      subtitle="This notice appears on every visit unless you choose not to show it again."
      footer={(
        <div className="tavern-notice__footer">
          <label className="tavern-notice__opt-out">
            <input
              type="checkbox"
              checked={doNotShowAgain}
              onChange={(event) => setDoNotShowAgain(event.target.checked)}
            />
            <span>Don’t show this again</span>
          </label>
          <button className="btn btn--primary" onClick={accept}>I understand and accept</button>
        </div>
      )}
    >
      <div className="stack tavern-notice" style={{ gap: 16 }}>
        {RULES.map((rule) => (
          <div key={rule.title} className="tavern-notice__rule">
            <div className="tavern-notice__icon" aria-hidden="true">{rule.icon}</div>
            <div>
              <div className="tavern-notice__title">{rule.title}</div>
              <div className="tavern-notice__text">{rule.text}</div>
            </div>
          </div>
        ))}
        <div className="tavern-notice__report">
          Every offer and request includes a report control. Reports are visible only to the arbitration team and never disclose the reporter to the other party.
        </div>
      </div>
    </Modal>
  );
}
