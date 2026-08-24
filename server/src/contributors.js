export const CONTRIBUTOR_CATALOG = [
  {
    id: 'contributor_cheezit_wizard',
    username: 'cheezit_wizard',
    name: 'cheezit_wizard',
    title: 'Testing Contributor',
    contribution: 'Provided extensive help during testing and suggested improvements to website functionality.',
    avatar: null,
    initialTmt: 10,
  },
  {
    id: 'contributor_nozzz',
    username: 'nozzz_',
    name: 'nozzz_',
    title: 'Policy & Privacy Contributor',
    contribution: 'Advised on the website’s Terms of Service, Privacy Policy, and cookie-management experience.',
    avatar: null,
    initialTmt: 0,
  },
  {
    id: 'contributor_thegunrat',
    username: 'thegunrat',
    name: 'thegunrat',
    title: 'Writing Contributor',
    contribution: 'Has written a substantial collection of excellent articles across multiple servers.',
    avatar: '/contributors/thegunrat.jpg',
    initialTmt: 0,
  },
];

export function syncContributorCatalog(state) {
  const previous = Array.isArray(state.contributors) ? state.contributors : [];
  state.contributors = CONTRIBUTOR_CATALOG.map((entry) => ({
    ...previous.find((item) => item.id === entry.id),
    ...entry,
  }));

  let changed = JSON.stringify(previous) !== JSON.stringify(state.contributors);
  for (const contributor of state.contributors) {
    if (!contributor.username || contributor.initialTmt <= 0) continue;
    const user = state.users.find((item) => item.username?.toLowerCase() === contributor.username.toLowerCase());
    const transactionId = `tx_${contributor.id}_initial_tmt`;
    if (!user || state.transactions.some((transaction) => transaction.id === transactionId)) continue;
    user.coins = Math.round(((user.coins ?? 0) + contributor.initialTmt) * 100) / 100;
    state.transactions.unshift({
      id: transactionId,
      userId: user.id,
      profileId: null,
      delta: contributor.initialTmt,
      kind: 'contributor_grant',
      memo: 'Initial TMT award for contributions to Know Morrow News',
      refType: 'contributor',
      refId: contributor.id,
      createdAt: new Date().toISOString(),
    });
    changed = true;
  }
  return changed;
}
