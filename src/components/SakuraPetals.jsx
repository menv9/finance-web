import './SakuraPetals.css';

const PETALS = [
  { size: 9,  left: '5%',  delay: 0,    dur: 12,   drift: 45,  rot: 0  },
  { size: 7,  left: '14%', delay: 3.5,  dur: 15,   drift: -35, rot: 45 },
  { size: 11, left: '24%', delay: 7,    dur: 11,   drift: 55,  rot: 20 },
  { size: 8,  left: '36%', delay: 1.5,  dur: 14,   drift: -25, rot: 70 },
  { size: 10, left: '47%', delay: 5,    dur: 13,   drift: 40,  rot: 10 },
  { size: 8,  left: '57%', delay: 9,    dur: 12.5, drift: -45, rot: 55 },
  { size: 12, left: '67%', delay: 2,    dur: 16,   drift: 30,  rot: 35 },
  { size: 7,  left: '76%', delay: 6,    dur: 11.5, drift: -30, rot: 80 },
  { size: 9,  left: '85%', delay: 11,   dur: 14.5, drift: 25,  rot: 15 },
  { size: 10, left: '92%', delay: 4,    dur: 13,   drift: -20, rot: 60 },
];

const COLORS = ['#FFB7C5', '#FFC8D4', '#FFADC0', '#FFD0DF', '#F9A8C0'];

export default function SakuraPetals() {
  return (
    <div className="sakura-layer" aria-hidden="true">
      {PETALS.map((p, i) => (
        <div
          key={i}
          className="sakura-petal"
          style={{
            width: p.size,
            height: Math.round(p.size * 1.35),
            left: p.left,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.dur}s`,
            '--drift': `${p.drift}px`,
            '--rot-start': `${p.rot}deg`,
            background: COLORS[i % COLORS.length],
          }}
        />
      ))}
    </div>
  );
}
