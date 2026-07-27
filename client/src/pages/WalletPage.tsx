import { useEffect, useState } from 'react';
import { get, post } from '../lib/api';
import type { Transaction, Wallet } from '../lib/types';
import { Spinner, Stat } from '../components/ui';
import { fmtTime, tmt } from '../lib/format';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

const KIND_LABEL: Record<string, string> = {
  grant: 'Grant',
  topup: 'Top-up',
  tomato_throw: 'Tomato thrown',
  offer_purchase: 'Information purchased',
  offer_income: 'Information sold',
  escrow_lock: 'Escrow funded',
  escrow_release: 'Escrow returned',
  escrow_settle: 'Request paid',
  escrow_income: 'Request earnings',
  freeze: 'Arbitration freeze',
  arbitration_debit: 'Arbitration debit',
  arbitration_credit: 'Arbitration award',
};

const KIND_DESCRIPTION: Record<string, string> = {
  grant: 'Opening newsroom allocation',
  topup: 'Tomato harvest demonstration credit',
  tomato_throw: 'A tomato was thrown',
  offer_purchase: 'Purchased access to a newsroom disclosure',
  offer_income: 'Proceeds from a newsroom disclosure',
  escrow_lock: 'Funds reserved for a reporting request',
  escrow_release: 'Unused request funds returned',
  escrow_settle: 'Payment released from request escrow',
  escrow_income: 'Payment received for an accepted submission',
  freeze: 'Funds held pending an arbitration decision',
  arbitration_debit: 'Funds removed by arbitration decision',
  arbitration_credit: 'Compensation awarded by arbitration',
};

export default function WalletPage() {
  const { refresh } = useAuth();
  const toast = useToast();
  const [data, setData] = useState<{ wallet: Wallet; transactions: Transaction[] } | null>(null);
  const load = () => get<{ wallet: Wallet; transactions: Transaction[] }>('/wallet').then(setData);

  useEffect(() => { void load(); }, []);

  const topup = async (amount: number) => {
    try {
      await post('/wallet/topup', { amount });
      toast.push(`Added ${amount} TMT`, 'good');
      await load();
      await refresh();
    } catch (err) {
      toast.push((err as Error).message, 'bad');
    }
  };

  if (!data) return <Spinner />;

  return <div className="stack" style={{ gap: 20 }}>
    <div className="page-head">
      <div>
        <div className="eyebrow">TOMATO COIN</div>
        <h1 className="page-title">My Tomato Wallet</h1>
        <div className="page-sub">Throw TMT across the newsroom, or spend it on information someone would rather keep quiet.</div>
      </div>
      <div className="row">
        <button className="btn" onClick={() => topup(100)}>+100 TMT</button>
        <button className="btn btn--tomato" onClick={() => topup(500)}>+500 TMT · Demo faucet</button>
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
