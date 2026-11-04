// Site settings in one place. Edit, commit and push; the site picks them up on the next load.

export const SITE = {
  // Shown in the footer. Match it to the GitHub release (v2.1, v3.0 …).
  version: '2.1',
  // Which data the site shows.
  dataSource: 'Supplemental Table 1, Hendricks et al. (2024)',
  // Public address (used for “Report a problem” messages and link previews in index.html).
  url: 'https://insulinindexresearch.com/insulinindexexplorer/',
  // Where “Report a problem with this entry” emails go. Empty = the link is hidden.
  reportEmail: '',
  // GoatCounter site code for anonymous visitor counts (dashboard: https://<code>.goatcounter.com).
  // Empty = no counting at all.
  goatcounter: 'jonathan1234',
  // Only count visits on these addresses, so testing on other copies of the site isn't counted.
  // Empty list = count everywhere.
  countOnlyOn: ['insulinindexresearch.com', 'www.insulinindexresearch.com'],
};
