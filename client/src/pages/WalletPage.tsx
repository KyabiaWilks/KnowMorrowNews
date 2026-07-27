import { useEffect, useState } from 'react';
import { get, post } from '../lib/api';
import type { Transaction, Wallet } from '../lib/types';
import { Spinner, Stat } from '../components/ui';
import { fmtTime, tmt } from '../lib/format';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

const KIND_LABEL: Record<string, string> = {
  grant: '发放',
  topup: '充值',
  tomato_throw: '扔番茄',
  offer_purchase: '购买情报',
  offer_income: '售出情报',
  escrow_lock: '保证金托管',
  escrow_release: '保证金退回',
  escrow_settle: '委托付款',
  escrow_income: '委托收款',
  freeze: '仲裁冻结',
  arbitration_debit: '仲裁划扣',
  arbitration_credit: '仲裁赔偿',
};

export default function WalletPage() {
  const { refresh } = useAuth();
  const toast = useToast();
  const [data, setData] = useState<{ wallet: Wallet; transactions: Transaction[] } | null>(null);

  const load = () => get<{ wallet: Wallet; transactions: Transaction[] }>('/wallet').then(setData);

  useEffect(() => {
    void load();
  }, []);

  const topup = async (amount: number) => {
    try {
      await post('/wallet/topup', { amount });
      toast.push(`+${amount} TMT`, 'good');
      await load();
      await refresh();
    } catch (err) {
      toast.push((err as Error).message, 'bad');
    }
  };

  if (!data) return <Spinner />;

  return (
    <div className="stack" style={{ gap: 20 }}>
      <div className="page-head">
        <div>
          <div className="eyebrow">TOMATO COIN</div>
          <h1 className="page-title">我的番茄钱包</h1>
          <div className="page-sub">TMT 既能扔在页面上，也能用来买一条别人不想说的话。</div>
        </div>
        <div className="row">
          <button className="btn" onClick={() => topup(100)}>
            +100 TMT
          </button>
          <button className="btn btn--tomato" onClick={() => topup(500)}>
            +500 TMT（演示水龙头）
          </button>
        </div>
      </div>

      <div className="grid grid--4">
        <Stat value={data.wallet.coins.toLocaleString('zh-CN')} label="账面余额" />
        <Stat value={data.wallet.available.toLocaleString('zh-CN')} label="可动用" />
        <Stat value={data.wallet.escrow.toLocaleString('zh-CN')} label="委托托管中" />
        <Stat value={data.wallet.frozen.toLocaleString('zh-CN')} label="仲裁冻结" />
      </div>

      {data.wallet.frozen > 0 && (
        <div className="notice-banner" style={{ borderColor: 'var(--bad)', background: '#fdecea', color: '#8c2c1d' }}>
          你有 {tmt(data.wallet.frozen)} 处于仲裁冻结状态，这部分资金在裁决执行前不可动用。
        </div>
      )}

      <div className="card card--pad">
        <div className="eyebrow" style={{ marginBottom: 10 }}>
          流水
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>时间</th>
              <th>类型</th>
              <th>说明</th>
              <th style={{ textAlign: 'right' }}>金额</th>
            </tr>
          </thead>
          <tbody>
            {data.transactions.map((t) => (
              <tr key={t.id}>
                <td className="mono">{fmtTime(t.createdAt)}</td>
                <td>
                  <span className="chip">{KIND_LABEL[t.kind] || t.kind}</span>
                </td>
                <td>{t.memo}</td>
                <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', color: t.delta >= 0 ? 'var(--good)' : 'var(--bad)', fontWeight: 700 }}>
                  {t.delta > 0 ? '+' : ''}
                  {t.delta}
                </td>
              </tr>
            ))}
            {data.transactions.length === 0 && (
              <tr>
                <td colSpan={4} className="muted" style={{ textAlign: 'center', padding: 28 }}>
                  还没有任何流水。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
