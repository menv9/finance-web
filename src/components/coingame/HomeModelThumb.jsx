import { useEffect, useRef, useState } from 'react';
import * as LucideIcons from 'lucide-react';
import { getHomeModelThumbnail } from '../../utils/coinroomHomePack';

// Lazy-rendered thumbnail. Renders on first visibility, caches forever.
export default function HomeModelThumb({ name, size = 64 }) {
  const ref = useRef(null);
  const [url, setUrl] = useState(null);
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    if (!ref.current || url || errored) return;
    let cancelled = false;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        io.disconnect();
        getHomeModelThumbnail(name)
          .then((u) => { if (!cancelled) setUrl(u); })
          .catch(() => { if (!cancelled) setErrored(true); });
      }
    }, { rootMargin: '120px' });
    io.observe(ref.current);
    return () => { cancelled = true; io.disconnect(); };
  }, [name, url, errored]);

  return (
    <div
      ref={ref}
      style={{
        width: size, height: size, borderRadius: 6,
        background: '#0a0a0a', border: '1px solid #1a2e1a',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden', flexShrink: 0,
      }}
    >
      {url
        ? <img src={url} alt={name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        : errored
          ? <LucideIcons.AlertCircle size={16} color="#7f1d1d" />
          : <LucideIcons.Box size={16} color="#374151" />}
    </div>
  );
}
