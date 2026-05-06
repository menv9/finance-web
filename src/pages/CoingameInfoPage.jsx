const TERM_GROUPS = [
  {
    title: 'Core Concepts',
    items: [
      ['FingesCoin (FC)', 'The virtual currency used inside Coingame. It is separate from your real finances.'],
      ['User coin', 'A personal market coin created for each Coingame user. Other users can trade it with FC.'],
      ['Minted', 'The amount of a user coin that currently exists. Buying creates more supply; selling removes supply.'],
      ['Market Cap', 'Current coin price multiplied by minted supply. It is an estimate, not guaranteed cash value.'],
      ['Holdings', 'User coins you own from other players, plus their current estimated FC value.'],
    ],
  },
  {
    title: 'Trading Terms',
    items: [
      ['Buy', 'Spend FC to receive a user coin. The cost is calculated from the bonding curve.'],
      ['Sell', 'Return a user coin to the curve and receive FC after fees. Selling reduces minted supply.'],
      ['Spot Price', 'The current price for one more unit at the coin supply shown right now.'],
      ['Volume', 'How much of a coin or FC moved during the selected time range.'],
      ['Fee', 'Trades include a fee. Buys use 1%; sells use 1%, or 5% if sold less than one hour after the last buy.'],
    ],
  },
  {
    title: 'Pages And Metrics',
    items: [
      ['Market', 'Browse user coins, open a coin page, or trade directly from quick actions.'],
      ['Rankings', 'Weekly leaderboard by gains, traded volume, or number of trades. It resets every Monday.'],
      ['History', 'Your Coingame rewards, starter grants, buys, and sells.'],
      ['Login Streak', 'Consecutive daily claims. It helps track reward activity.'],
      ['Prize Pool', 'Virtual FC collected for rewards and competitions.'],
    ],
  },
];

const PRICE_STEPS = [
  ['1. Base price', 'Every coin starts from its base price, usually around 1 FC.'],
  ['2. Supply matters', 'The formula looks at how much of the coin is minted right now.'],
  ['3. Price curve', 'Current price is base price plus a curve component: k * minted supply squared.'],
  ['4. Buying', 'A buy moves supply upward along the curve, so later units become more expensive.'],
  ['5. Selling', 'A sell moves supply downward along the same curve, so the spot price can fall.'],
  ['6. Fees', 'Fees are applied after the curve value is calculated. Half is burned and half goes to the pool.'],
];

const CURVE_TIERS = [
  ['0 - 99,999 minted', 'Steepest early curve: k = 0.00000002'],
  ['100,000 - 499,999 minted', 'Medium curve: k = 0.00000001'],
  ['500,000+ minted', 'Softer high-supply curve: k = 0.000000005'],
];

function InfoSection({ title, children }) {
  return (
    <section className="cg-info-section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function DefinitionList({ items }) {
  return (
    <div className="cg-info-definition-grid">
      {items.map(([term, description]) => (
        <div key={term} className="cg-info-definition">
          <h3>{term}</h3>
          <p>{description}</p>
        </div>
      ))}
    </div>
  );
}

export default function CoingameInfoPage() {
  return (
    <div className="cg-page cg-info-page">
      <div className="cg-info-hero">
        <span className="cg-coin-eyebrow">COINGAME GUIDE</span>
        <h1>How Coingame Works</h1>
        <p>
          A quick reference for the terms, pages, and price mechanics used by the virtual user-coin market.
        </p>
      </div>

      {TERM_GROUPS.map((group) => (
        <InfoSection key={group.title} title={group.title}>
          <DefinitionList items={group.items} />
        </InfoSection>
      ))}

      <InfoSection title="How Coin Prices Adjust">
        <div className="cg-info-explainer">
          <p>
            Coingame does not use a traditional order book. Each user coin is priced by a bonding curve:
            the more supply exists, the higher the next unit costs. When supply goes down, the spot price can
            move down too.
          </p>
          <div className="cg-info-formula">
            price = base price + k * minted supply^2
          </div>
          <p>
            Buying and selling use the area under that curve, not just the final spot price. That keeps large
            trades from being priced as if every unit had the same price.
          </p>
        </div>
        <DefinitionList items={PRICE_STEPS} />
      </InfoSection>

      <InfoSection title="Curve Tiers">
        <div className="cg-info-tier-list">
          {CURVE_TIERS.map(([range, description]) => (
            <div key={range}>
              <strong>{range}</strong>
              <span>{description}</span>
            </div>
          ))}
        </div>
      </InfoSection>

      <InfoSection title="Important Notes">
        <div className="cg-info-note-grid">
          <div>
            <h3>Virtual only</h3>
            <p>Coingame balances and trades are not connected to real money or your real finance records.</p>
          </div>
          <div>
            <h3>Your own coin</h3>
            <p>Other users can trade your coin, but buying your own coin is blocked.</p>
          </div>
          <div>
            <h3>Charts</h3>
            <p>Charts use real Coingame transactions when available and can be viewed as candles or a line.</p>
          </div>
        </div>
      </InfoSection>
    </div>
  );
}
