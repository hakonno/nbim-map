// NBIM reports its unlisted real-estate holdings as of 31 December each year.
// Before that date the latest expected release is the previous calendar year;
// on/after 31 December a release for the current year may be available.
export function expectedLatestReleaseYear(now: Date): number {
  const currentYear = now.getFullYear();
  const hasPassedReleaseDate = now.getMonth() === 11 && now.getDate() >= 31;
  return hasPassedReleaseDate ? currentYear : currentYear - 1;
}

export function isDatasetStale(datasetYear: string, now: Date): boolean {
  const year = parseInt(datasetYear, 10);
  return Number.isFinite(year) && year < expectedLatestReleaseYear(now);
}
