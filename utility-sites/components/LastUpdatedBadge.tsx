interface Props {
  taxYear: number;
  isoDate: string; // YYYY-MM-DD
}

export function LastUpdatedBadge({ taxYear, isoDate }: Props) {
  const formatted = new Date(`${isoDate}T00:00:00Z`).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
  return (
    <p className="text-xs text-gray-500 dark:text-gray-400">
      Tax year {taxYear} · Last updated {formatted}
    </p>
  );
}
