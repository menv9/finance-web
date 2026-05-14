import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFinanceStore } from '../store/useFinanceStore';

export default function CoingameOwnRoomPage() {
  const ownCoin = useFinanceStore((s) => s.coingameOwnCoin);
  const needsCoinSetup = useFinanceStore((s) => s.coingameNeedsCoinSetup);
  const navigate = useNavigate();

  useEffect(() => {
    if (ownCoin?.coin_id) {
      navigate(`/coingame/coin/${ownCoin.coin_id}/room`, { replace: true });
    }
  }, [ownCoin, navigate]);

  if (needsCoinSetup) {
    return (
      <div className="cg-page" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, minHeight: 300 }}>
        <div className="cg-admin-muted">You need a coin before you have a room.</div>
      </div>
    );
  }

  return (
    <div className="cg-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
      <div className="cg-admin-muted">Loading your room...</div>
    </div>
  );
}
