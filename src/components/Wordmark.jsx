const SIZE_CLASSES = {
  sm: 'h-6 w-6',
  md: 'h-9 w-9',
  lg: 'h-12 w-12',
};

export function Wordmark({ size = 'sm', className }) {
  const sizeClass = SIZE_CLASSES[size] ?? SIZE_CLASSES.sm;
  return (
    <svg
      viewBox="90 90 500 500"
      role="img"
      xmlns="http://www.w3.org/2000/svg"
      className={className ?? sizeClass}
    >
      <title>FinGes</title>
      <text
        x="332"
        y="265"
        fontFamily="'Fraunces', Georgia, serif"
        fontSize="240"
        fontWeight="500"
        fill="none"
        stroke="var(--accent)"
        strokeWidth="8"
        paintOrder="stroke"
      >
        G
      </text>
      <text
        x="175"
        y="495"
        fontFamily="'Fraunces', Georgia, serif"
        fontSize="470"
        fontWeight="500"
        fill="currentColor"
      >
        F
      </text>
    </svg>
  );
}

export default Wordmark;
