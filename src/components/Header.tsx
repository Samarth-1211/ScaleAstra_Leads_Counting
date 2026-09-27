import { useQuery } from '@tanstack/react-query';
import { statsQuery } from '../api';
import { formatDay } from '../time';

export function Header() {
  // Uses the server's IST date once loaded, so it flips at midnight with the counts.
  const { data } = useQuery(statsQuery);

  return (
    <header className="header">
      <div className="header-inner">
        <a className="brand" href="/">
          <img src="/scalehour.png" alt="" width={32} height={32} />
          <span>ScaleHour</span>
        </a>
        <span className="header-date">{formatDay(data?.today)}</span>
      </div>
    </header>
  );
}
