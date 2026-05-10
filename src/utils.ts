// Shared IST date utilities — imported by App.tsx, CementApp.tsx, OtherApp.tsx
// Kept separate to avoid circular imports.

export function getTodayIST(): string {
  const now = new Date();
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  return ist.toISOString().split('T')[0]; // "YYYY-MM-DD"
}

export function nowIST(): Date {
  return new Date(Date.now() + 5.5 * 60 * 60 * 1000);
}

export function formatISTDate(dateStr: string | null | undefined): string {
  if (!dateStr || typeof dateStr !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(dateStr)) return '—';
  try {
    const d = new Date(dateStr.substring(0, 10) + 'T00:00:00+05:30');
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata'
    });
  } catch { return '—'; }
}
