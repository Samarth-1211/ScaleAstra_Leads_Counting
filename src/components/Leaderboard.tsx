import { useQuery } from '@tanstack/react-query';
import { statsQuery } from '../api';
import { CONFIG, isConfigured } from '../config';
import { formatTime } from '../time';

type Person = { name: string; order: number; today: number; allTime: number };

export function Leaderboard() {
  const { data, error, isFetching, dataUpdatedAt, refetch } = useQuery(statsQuery);
  const target = CONFIG.DAILY_TARGET;

  const people: Person[] = CONFIG.TEAM.map((name, order) => ({
    name,
    order,
    today: data?.todayByPerson[name] ?? 0,
    allTime: data?.allTimeByPerson[name] ?? 0,
  })).sort((a, b) => b.today - a.today || a.order - b.order);

  // Ties share a rank: 1 + how many people are strictly ahead.
  const rankOf = (p: Person) => 1 + people.filter((o) => o.today > p.today).length;

  let status: string;
  if (!isConfigured()) status = 'Not connected to the Google Sheet yet.';
  else if (error && data) status = `Couldn't refresh. Showing counts from ${formatTime(dataUpdatedAt)}.`;
  else if (error) status = `Couldn't load the leaderboard. ${error.message}`;
  else if (!data) status = 'Loading…';
  else status = `Updated ${formatTime(dataUpdatedAt)} · refreshes every ${CONFIG.REFRESH_SECONDS}s`;

  return (
    <section className="panel" aria-labelledby="lb-title">
      <div className="panel-head">
        <h2 id="lb-title">Today's leaderboard</h2>
        <button
          type="button"
          className="icon-btn"
          onClick={() => refetch()}
          disabled={!isConfigured() || isFetching}
          aria-label="Refresh leaderboard"
        >
          <svg className={isFetching ? 'spin' : ''} viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path
              d="M20 12a8 8 0 1 1-2.34-5.66M20 4v5h-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      <div className="team-total">
        <span>Team total today</span>
        <span>
          <strong>{data ? data.todayTotal : '–'}</strong>
          <span className="muted"> / {target * CONFIG.TEAM.length}</span>
        </span>
      </div>

      <ol className="cards">
        {people.map((p) => (
          <PersonCard key={p.name} person={p} rank={rankOf(p)} loaded={!!data} />
        ))}
      </ol>

      <p className={`status ${error ? 'status-error' : ''}`} role="status">
        {status}
      </p>
    </section>
  );
}

function PersonCard({ person, rank, loaded }: { person: Person; rank: number; loaded: boolean }) {
  const target = CONFIG.DAILY_TARGET;
  const { name, today, allTime } = person;
  const done = today >= target;
  const leading = rank === 1 && today > 0;
  const percent = Math.min(100, (today / target) * 100);

  let remaining: string;
  if (!done) remaining = `${target - today} to go`;
  else if (today > target) remaining = `${today - target} over target`;
  else remaining = 'Target reached';

  return (
    <li className={`card${done ? ' is-done' : ''}${leading ? ' is-leader' : ''}`}>
      <div className="card-top">
        <span className="rank">#{rank}</span>
        <span className="name">{name}</span>
        {done && (
          <span className="badge-done">
            <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
              <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Target hit
          </span>
        )}
      </div>

      <p className="count">
        <strong>{loaded ? today : '–'}</strong>
        <span> / {target}</span>
      </p>

      <div
        className="bar"
        role="progressbar"
        aria-label={`${name}'s progress to today's target`}
        aria-valuemin={0}
        aria-valuemax={target}
        aria-valuenow={today}
      >
        <span style={{ width: `${percent}%` }} />
      </div>

      <div className="card-foot">
        <span>{loaded ? remaining : '–'}</span>
        <span>
          All-time <strong>{loaded ? allTime : '–'}</strong>
        </span>
      </div>
    </li>
  );
}
