import { useEffect, useState } from 'react';
import { get, post } from '../lib/api';
import type { Transaction, Wallet } from '../lib/types';
import { Spinner, Stat } from '../components/ui';
import { fmtTime, tmt } from '../lib/format';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { RecipientSearch, type RecipientMatch } from '../components/RecipientSearch';

const KIND_LABEL: Record<string, string> = {
  grant: 'Grant',
  topup: 'Top-up',
  tomato_throw: 'Tomato thrown',
  news_tip: 'News tomato tip',
  offer_purchase: 'Information purchased',
  offer_income: 'Information sold',
  escrow_lock: 'Escrow funded',
  escrow_release: 'Escrow returned',
  escrow_settle: 'Request paid',
  escrow_income: 'Request earnings',
  freeze: 'Arbitration freeze',
  arbitration_debit: 'Arbitration debit',
  arbitration_credit: 'Arbitration award',
  user_transfer_out: 'Transfer sent',
  user_transfer_in: 'Transfer received',
  official_transfer: 'Official transfer',
};

const KIND_DESCRIPTION: Record<string, string> = {
  grant: 'Opening Tavern allocation',
  topup: 'Tomato harvest demonstration credit',
  tomato_throw: 'A tomato was thrown',
  news_tip: 'Tomato tip sent to published news',
  offer_purchase: 'Purchased access to a Tavern disclosure',
  offer_income: 'Proceeds from a Tavern disclosure',
  escrow_lock: 'Funds reserved for a reporting request',
  escrow_release: 'Unused request funds returned',
  escrow_settle: 'Payment released from request escrow',
  escrow_income: 'Payment received for an accepted submission',
  freeze: 'Funds held pending an arbitration decision',
  arbitration_debit: 'Funds removed by arbitration decision',
  arbitration_credit: 'Compensation awarded by arbitration',
};

export default function WalletPage() {
  const { user, refresh } = useAuth();
  const toast = useToast();
  const [data, setData] = useState<{ wallet: Wallet; transactions: Transaction[] } | null>(null);
  const [transfer, setTransfer] = useState({ recipient: null as RecipientMatch | null, amount: 1 });
  const [official, setOfficial] = useState({ recipient: null as RecipientMatch | null, amount: 100, memo: '' });
  const [busy, setBusy] = useState(false);
  const load = () => get<{ wallet: Wallet; transactions: Transaction[] }>('/wallet').then(setData);

  useEffect(() => { void load(); }, []);

  const sendTransfer = async (officialTransfer = false) => {
    setBusy(true);
    try {
      const source = officialTransfer ? official : transfer;
      const payload = { recipientId: source.recipient?.id, recipientType: source.recipient?.identityType, amount: source.amount, ...('memo' in source ? { memo: source.memo } : {}) };
      await post(officialTransfer ? '/wallet/official-transfer' : '/wallet/transfer', payload);
      toast.push(officialTransfer ? 'Official transfer sent.' : 'Transfer sent.', 'good');
      if (officialTransfer) setOfficial({ recipient: null, amount: 100, memo: '' });
      else setTransfer({ recipient: null, amount: 1 });
      await load();
      await refresh();
    } catch (err) {
      toast.push((err as Error).message, 'bad');
    } finally {
      setBusy(false);
    }
  };

  if (!data) return <Spinner />;

  return <div className="stack" style={{ gap: 20 }}>
    <div className="page-head">
      <div>
        <div className="eyebrow">TOMATO COIN</div>
        <h1 className="page-title">My Tomato Wallet</h1>
        <div className="page-sub">Throw TMT across the Tavern, or spend it on information someone would rather keep quiet.</div>
      </div>
    </div>

    <div className="grid grid--4">
      <Stat value={data.wallet.coins.toLocaleString('en-US')} label="Total balance" />
      <Stat value={data.wallet.available.toLocaleString('en-US')} label="Available" />
      <Stat value={data.wallet.escrow.toLocaleString('en-US')} label="In escrow" />
      <Stat value={data.wallet.frozen.toLocaleString('en-US')} label="Frozen by arbitration" />
    </div>

    {data.wallet.frozen > 0 && <div className="notice-banner" style={{ borderColor: 'var(--bad)', background: '#fdecea', color: '#8c2c1d' }}>
      {tmt(data.wallet.frozen)} is frozen by arbitration and cannot be spent until a decision is enforced.
    </div>}

    <div className="grid grid--2">
      <section className="card card--pad stack">
        <div><div className="eyebrow">PERSON-TO-PERSON</div><h2>Send Tomato Coin</h2></div>
        <label className="field"><span>Recipient</span><RecipientSearch separateIdentities value={transfer.recipient} onChange={(recipient) => setTransfer({ ...transfer, recipient })} /></label>
        <label className="field"><span>Amount</span><input className="input" type="number" min={1} max={100000} value={transfer.amount} onChange={(event) => setTransfer({ ...transfer, amount: Number(event.target.value) })} /></label>
        <button className="btn btn--primary" disabled={busy || !transfer.recipient || transfer.amount < 1} onClick={() => sendTransfer(false)}>Send {tmt(transfer.amount)}</button>
      </section>

      {['admin', 'read_only_admin'].includes(user?.siteRole || '') && <section className="card card--pad stack">
        <div><div className="eyebrow">OFFICIAL TRANSFER</div><h2>Issue Tavern Funds</h2></div>
        <label className="field"><span>Recipient</span><RecipientSearch separateIdentities value={official.recipient} onChange={(recipient) => setOfficial({ ...official, recipient })} /></label>
        <label className="field"><span>Amount</span><input className="input" type="number" min={1} max={1000000} value={official.amount} onChange={(event) => setOfficial({ ...official, amount: Number(event.target.value) })} /></label>
        <label className="field"><span>Official memo</span><input className="input" value={official.memo} onChange={(event) => setOfficial({ ...official, memo: event.target.value })} placeholder="Tavern allocation" /></label>
        <button className="btn btn--tomato" disabled={busy || !official.recipient || official.amount < 1} onClick={() => sendTransfer(true)}>Issue {tmt(official.amount)}</button>
      </section>}
    </div>

    <div className="card card--pad">
      <div className="eyebrow" style={{ marginBottom: 10 }}>TRANSACTION HISTORY</div>
      <table className="table">
        <thead><tr><th>Time</th><th>Type</th><th>Description</th><th style={{ textAlign: 'right' }}>Amount</th></tr></thead>
        <tbody>
          {data.transactions.map((transaction) => <tr key={transaction.id}>
            <td className="mono">{fmtTime(transaction.createdAt)}</td>
            <td><span className="chip">{KIND_LABEL[transaction.kind] || transaction.kind}</span></td>
            <td>{KIND_DESCRIPTION[transaction.kind] || transaction.memo}</td>
            <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', color: transaction.delta >= 0 ? 'var(--good)' : 'var(--bad)', fontWeight: 700 }}>
              {transaction.delta > 0 ? '+' : ''}{transaction.delta}
            </td>
          </tr>)}
          {data.transactions.length === 0 && <tr><td colSpan={4} className="muted" style={{ textAlign: 'center', padding: 28 }}>No transactions yet.</td></tr>}
        </tbody>
      </table>
    </div>
  </div>;
}
