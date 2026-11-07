// Builds a calendar file for upcoming bills. Runs on the device: nothing is sent anywhere.

const escapeText = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const compact = (date: string) => date.replace(/-/g, '');

function nextDay(date: string) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** Lines over 75 bytes must be folded in iCalendar. Folding by characters, well under the limit, stays safe for £. */
function fold(line: string) {
  const parts: string[] = [];
  for (let i = 0; i < line.length; i += 60) parts.push(line.slice(i, i + 60));
  return parts.join('\r\n ');
}

/** All-day events with a reminder the day before. `stamp` is a UTC time such as 20261107T090000Z. */
export function billsToIcs(bills: { date: string; label: string; amount: number }[], stamp: string): string {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Tomorrow//Upcoming bills//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
  bills.forEach((b, i) => {
    const amount = `£${Math.abs(b.amount).toFixed(2)}`;
    lines.push(
      'BEGIN:VEVENT',
      `UID:tomorrow-${compact(b.date)}-${i}@tomorrow.local`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${compact(b.date)}`,
      `DTEND;VALUE=DATE:${compact(nextDay(b.date))}`,
      `SUMMARY:${escapeText(`${b.label}: ${amount}`)}`,
      `DESCRIPTION:${escapeText('Expected bill from Tomorrow. The date and amount are a forecast from your past payments, so check them.')}`,
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      'TRIGGER:-P1D',
      `DESCRIPTION:${escapeText(`${b.label} is due tomorrow`)}`,
      'END:VALARM',
      'END:VEVENT',
    );
  });
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}

export function downloadIcs(content: string, filename: string) {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/calendar;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
