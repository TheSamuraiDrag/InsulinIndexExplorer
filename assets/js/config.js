// Site settings in one place. Edit, commit and push; the site picks them up on the next load.

export const SITE = {
  // Shown in the footer. Match it to the GitHub release (v2.1, v3.0 …).
  version: '3.0',
  // Which data the site shows.
  dataSource: 'Supplemental Table 1, Hendricks et al. (2024)',
  // Public address (used for “Report a problem” messages and link previews in index.html).
  url: 'https://insulinindexresearch.com/insulinindexexplorer/',
  // Where “Report a problem with this entry” emails go. Empty = the link is hidden.
  reportEmail: 'abcjlke@gmail.com',
  // GoatCounter site code for anonymous visitor counts (dashboard: https://<code>.goatcounter.com).
  // Empty = no counting at all.
  goatcounter: 'jonathan1234',
  // Admin · Visitors counts from this date (YYYY-MM-DD), so test visits before it don't show.
  // Nothing is deleted on GoatCounter. Empty = all time.
  countFrom: '2026-11-05',
  // Only count visits on these addresses (local previews are never counted). The GitHub test
  // address was removed, so only the public site counts. Empty list = count everywhere.
  countOnlyOn: ['insulinindexresearch.com', 'www.insulinindexresearch.com'],
};
