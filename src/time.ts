/** Everything is shown in Indian Standard Time, whatever the phone's own time zone is. */
const IST = 'Asia/Kolkata';

const dayFormat = new Intl.DateTimeFormat('en-IN', {
  timeZone: IST,
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});

const timeFormat = new Intl.DateTimeFormat('en-IN', {
  timeZone: IST,
  hour: 'numeric',
  minute: '2-digit',
});

/** "2026-09-27" (an IST date from the server) -> "Sun, 27 Sept" */
export const formatDay = (isoDay?: string) =>
  dayFormat.format(isoDay ? new Date(`${isoDay}T12:00:00+05:30`) : new Date());

export const formatTime = (ms: number) => timeFormat.format(new Date(ms));
