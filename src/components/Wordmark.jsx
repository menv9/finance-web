const SIZE_CLASSES = {
  sm: 'h-6 w-auto',
  md: 'h-9 w-auto',
  lg: 'h-12 w-auto',
};

export function Wordmark({ size = 'sm', className }) {
  const sizeClass = SIZE_CLASSES[size] ?? SIZE_CLASSES.sm;
  const id = `wordmark-grad-${size}`;
  return (
    <svg
      viewBox="50 55 540 140"
      role="img"
      xmlns="http://www.w3.org/2000/svg"
      className={className ?? sizeClass}
    >
      <title>FinGes</title>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="var(--accent)" />
          <stop offset="60%" stopColor="var(--accent-strong)" />
          <stop offset="100%" stopColor="var(--accent)" />
        </linearGradient>
      </defs>
      <text
        x="60"
        y="170"
        fontFamily="'Fraunces', Georgia, serif"
        fontSize="120"
        fontWeight="400"
        fill="var(--ink)"
        opacity="0.92"
        letterSpacing="-3"
      >
        Fin
      </text>
      <text
        x="240"
        y="170"
        fontFamily="'Fraunces', Georgia, serif"
        fontStyle="italic"
        fontSize="120"
        fontWeight="500"
        fill={`url(#${id})`}
        letterSpacing="-3"
      >
        Ges
      </text>
    </svg>
  );
}

export default Wordmark;
