export const REPORTER_BEATS = ['Writer', 'Illustrator', 'Layout', 'Website', 'Head Editor'];

const ALIASES = new Map([
  ['writer', 'Writer'], ['writing', 'Writer'], ['news', 'Writer'], ['civ news', 'Writer'], ['politics', 'Writer'],
  ['illustrator', 'Illustrator'], ['illustration', 'Illustrator'], ['art', 'Illustrator'], ['art collaboration', 'Illustrator'], ['creation', 'Illustrator'],
  ['layout', 'Layout'], ['website', 'Website'], ['website development', 'Website'], ['head editor', 'Head Editor'],
]);

const DEFAULTS = new Map([
  ['jnl_daffodiljunior', ['Writer']],
  ['jnl_enigma', ['Writer', 'Head Editor']],
  ['jnl_lunarian', ['Writer']],
]);

export function normalizeReporterBeats(input, journalistId = null) {
  const values = Array.isArray(input) ? input : String(input || '').split(',');
  const normalized = values.map((value) => ALIASES.get(String(value).trim().toLowerCase())).filter(Boolean);
  return [...new Set([...normalized, ...(DEFAULTS.get(journalistId) || [])])].filter((value) => REPORTER_BEATS.includes(value));
}
