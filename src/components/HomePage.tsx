import { useCallback, useState } from 'react';
import { randomQuote } from '../quotes';
import { Header } from './Header';
import { Leaderboard } from './Leaderboard';
import { LeadForm } from './LeadForm';
import { QuoteSplash } from './QuoteSplash';

export function HomePage() {
  // One random quote per app open: shown full-screen first, then in the banner.
  const [quote] = useState(randomQuote);
  const [showSplash, setShowSplash] = useState(true);
  const closeSplash = useCallback(() => setShowSplash(false), []);

  return (
    <>
      {showSplash && <QuoteSplash quote={quote} onContinue={closeSplash} />}

      {/* Rendered behind the quote so the leaderboard is already loading. */}
      <div className="shell" inert={showSplash}>
        <Header />
        <p className="quote-banner">
          <span>“{quote.text}”</span>
          {quote.author && <span className="quote-banner-author"> — {quote.author}</span>}
        </p>
        <main className="layout">
          <Leaderboard />
          <LeadForm />
        </main>
      </div>
    </>
  );
}
