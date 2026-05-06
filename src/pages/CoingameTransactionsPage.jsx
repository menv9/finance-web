import { useEffect } from 'react';
import InfoTooltip from '../components/coingame/InfoTooltip';
import { useFinanceStore } from '../store/useFinanceStore';

const TX_META = {
  buy:           { icon: '^', label: 'Buy',           color: 'var(--cg-danger)',   sign: '-' },
  sell:          { icon: 'v', label: 'Sell',          color: 'var(--cg-positive)', sign: '+' },
  reward:        { icon: '*', label: 'Reward',        color: 'var(--cg-accent)',   sign: '+' },
  starter_grant: { icon: 'o', label: 'Starter Grant', color: 'var(--cg-accent)',   sign: '+' },
  gamble_bet:    { icon: '$', label: 'Casino Bet',    color: 'var(--cg-danger)',   sign: '-' },
  gamble_win:    { icon: '+', label: 'Casino Win',    color: 'var(--cg-positive)', sign: '+' },
  gamble_loss:   { icon: 'x', label: 'Casino Loss',   color: 'var(--cg-danger)',   sign: '' },
};

function formatDate(iso) {
  const d = new Date(iso);
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${yy}-${mm}-${dd} ${hh}:${min}`;
}

function TxRow({ tx }) {
  const meta = TX_META[tx.tx_type] ?? TX_META.reward;
  const coin = tx.coingame_coins;
  const profile = coin?.profiles;
  const amount = Number(tx.fc_amount ?? 0);
  const gameLabel = tx.metadata?.game ? String(tx.metadata.game).toUpperCase() : '';

  return (
    <div className="cg-row">
      <div className="cg-tx-icon" style={{ color: meta.color }}>
        {meta.icon}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>
          {meta.label}
          {coin && (
            <span style={{ color: 'var(--cg-text-3)', fontWeight: 400, marginLeft: '0.4rem' }}>
              - {coin.coin_name || `@${profile?.username}`}
            </span>
          )}
          {!coin && gameLabel && (
            <span style={{ color: 'var(--cg-text-3)', fontWeight: 400, marginLeft: '0.4rem' }}>
              - {gameLabel}
            </span>
          )}
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--cg-text-3)', fontFamily: 'var(--cg-font-mono)', marginTop: '0.1rem' }}>
          {formatDate(tx.created_at)}
        </div>
      </div>

      <div className="cg-tx-amount" style={{ color: meta.color }}>
        {meta.sign}{amount.toLocaleString(undefined, { maximumFractionDigits: 4 })}
        <span style={{ marginLeft: '0.25em', fontSize: '0.75em', color: 'var(--cg-text-3)' }}>FC</span>
      </div>
    </div>
  );
}

export default function CoingameTransactionsPage() {
  const loadCoingameTransactions = useFinanceStore((s) => s.loadCoingameTransactions);
  const transactions = useFinanceStore((s) => s.coingameTransactions);
  const status = useFinanceStore((s) => s.coingameStatus);

  useEffect(() => { loadCoingameTransactions(); }, [loadCoingameTransactions]);

  const loading = status === 'loading' && transactions.length === 0;

  return (
    <div className="cg-page">
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 className="cg-heading-with-info" style={{ fontFamily: 'var(--cg-font-display)', fontWeight: 800, fontSize: '1.75rem', letterSpacing: '-0.02em' }}>
          History
          <InfoTooltip text="A record of your Coingame rewards, trades, casino bets, and casino results." />
        </h1>
        <p style={{ color: 'var(--cg-text-3)', fontSize: '0.875rem', marginTop: '0.3rem' }}>
          All your FC transactions
        </p>
      </div>

      <div className="cg-table">
        <div className="cg-table-header">
          <span className="cg-table-title">
            Transactions
            <InfoTooltip text="Each record shows the FC amount, transaction type, coin or game, and time." />
          </span>
          {transactions.length > 0 && (
            <span style={{ fontSize: '0.78rem', color: 'var(--cg-text-3)', fontFamily: 'var(--cg-font-mono)' }}>
              {transactions.length} records
            </span>
          )}
        </div>

        {loading ? (
          <div style={{ padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="cg-skeleton" style={{ height: 52 }} />
            ))}
          </div>
        ) : transactions.length === 0 ? (
          <div className="cg-empty">
            <div className="cg-empty-icon">CG</div>
            <div className="cg-empty-title">No transactions yet</div>
            <div className="cg-empty-desc">Buys, sells, casino bets and rewards will appear here</div>
          </div>
        ) : (
          transactions.map((tx) => <TxRow key={tx.id} tx={tx} />)
        )}
      </div>
    </div>
  );
}
