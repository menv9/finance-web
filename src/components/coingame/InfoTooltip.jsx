import { Info } from 'lucide-react';

export default function InfoTooltip({ text, className = '' }) {
  return (
    <span className={`cg-info-tooltip${className ? ` ${className}` : ''}`} tabIndex={0} aria-label={text}>
      <Info size={13} strokeWidth={2.4} aria-hidden="true" />
      <span className="cg-info-tooltip-bubble" role="tooltip">{text}</span>
    </span>
  );
}
