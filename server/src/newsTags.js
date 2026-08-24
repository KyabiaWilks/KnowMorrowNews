export const NEWS_TAGS = [
  'Scandals, gossip & drama',
  'Weddings & memorials',
  'Festivals & advertisements',
  'Missing & mysteriously found',
  'Receipts & reenactments',
  'Oddities',
  'Satire & commentary',
  'Bee gifs',
  'Event Briefing',
  'Leadership Interview',
];

const canonical = new Map(NEWS_TAGS.map((tag) => [tag.toLowerCase(), tag]));
const legacy = new Map([
  ['advertisement', 'Festivals & advertisements'],
  ['community event', 'Festivals & advertisements'],
  ['satire', 'Satire & commentary'],
  ['conspiracy', 'Satire & commentary'],
  ['event guide', 'Event Briefing'],
  ['first issue', 'Event Briefing'],
  ['jontop classic', 'Event Briefing'],
]);
const defaults = new Map([
  ['news_placeholder', ['Event Briefing']],
  ['news_ministry_of_truth_logo', ['Satire & commentary']],
  ['news_jon_vs_top_ad', ['Festivals & advertisements']],
  ['news_kmn_website_guide', ['Event Briefing']],
  ['news_cold_island_great_heist', ['Scandals, gossip & drama']],
  ['news_lucentine_is_watching', ['Scandals, gossip & drama']],
  ['news_your_homeland_story', ['Event Briefing']],
  ['news_welcome_to_the_enlightened_age', ['Scandals, gossip & drama']],
]);

export function normalizeNewsTags(input, articleId = null) {
  const values = Array.isArray(input) ? input : [];
  const normalized = values.map((value) => {
    const key = String(value).trim().toLowerCase();
    return canonical.get(key) || legacy.get(key);
  }).filter(Boolean);
  return [...new Set([...(defaults.get(articleId) || []), ...normalized])].filter((tag) => NEWS_TAGS.includes(tag));
}
