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
  // Only count visits on these addresses (local previews are never counted).
  // The GitHub test address is included for now so counting can be checked; remove it at launch
  // if test visits shouldn't mix with public ones. Empty list = count everywhere.
  // Admin · Visitors starts counting from this date (YYYY-MM-DD), e.g. the public launch day, so
  // test visits don't show. Nothing is deleted on GoatCounter. Empty = all time.
  countFrom: '',
  countOnlyOn: ['insulinindexresearch.com', 'www.insulinindexresearch.com', 'thesamuraidrag.github.io'],
};
