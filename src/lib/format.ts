// Fixed locale + timezone so a timestamp formats identically on the server and
// in the browser — otherwise server-rendered dates disagree with the client and
// trigger hydration mismatches.
const DATE = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const DATE_TIME = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "UTC",
});

export function formatDate(value: string | Date): string {
  return DATE.format(new Date(value));
}

export function formatDateTime(value: string | Date): string {
  return `${DATE_TIME.format(new Date(value))} UTC`;
}
