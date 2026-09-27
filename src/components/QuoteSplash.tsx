import { useEffect } from 'react';
import { CONFIG } from '../config';
import type { Quote } from '../quotes';

type Props = { quote: Quote; onContinue: () => void };

export function QuoteSplash({ quote, onContinue }: Props) {
  useEffect(() => {
    const timer = setTimeout(onContinue, CONFIG.QUOTE_SECONDS * 1000);
    document.body.style.overflow = 'hidden';
    return () => {
      clearTimeout(timer);
      document.body.style.overflow = '';
    };
  }, [onContinue]);

  return (
    <div className="splash" role="dialog" aria-modal="true" aria-labelledby="splash-quote">
      <div className="splash-inner">
        <img className="splash-logo" src="/scalehour.png" alt="ScaleHour" width={64} height={64} />
        <blockquote id="splash-quote" className="splash-quote">
          “{quote.text}”
        </blockquote>
        {quote.author && <p className="splash-author">— {quote.author}</p>}
        <button type="button" className="btn btn-primary splash-btn" onClick={onContinue} autoFocus>
          Let's go
        </button>
        <div className="splash-timer" aria-hidden="true">
          <span style={{ animationDuration: `${CONFIG.QUOTE_SECONDS}s` }} />
        </div>
      </div>
    </div>
  );
}
