export function articleLayoutParagraphs(body) {
  const source = String(body || '').split(/\n\s*\n/).map((value) => value.trim()).filter(Boolean);
  return source.flatMap((paragraph) => {
    // Q&A blocks contain both speaker markers and the complete answer. Keep
    // those boundaries intact so sentence chunking cannot detach an answer
    // continuation from its avatar and speech bubble.
    if (/^Q\d+(?:\s+\[[^\]]+\])?:\s/.test(paragraph) || paragraph.length <= 680) return [paragraph];
    const sentences = paragraph.match(/[^.!?]+(?:[.!?]+["”']?|$)\s*/g)?.map((value) => value.trim()).filter(Boolean) || [paragraph];
    const chunks = [];
    let chunk = '';
    for (const sentence of sentences) {
      if (chunk && `${chunk} ${sentence}`.length > 520) {
        chunks.push(chunk);
        chunk = sentence;
      } else {
        chunk = `${chunk}${chunk ? ' ' : ''}${sentence}`;
      }
    }
    if (chunk) chunks.push(chunk);
    return chunks;
  });
}

export function balancedOpeningParagraphCount(body, title = '', summary = '') {
  const paragraphs = articleLayoutParagraphs(body);
  if (paragraphs.length < 2) return paragraphs.length;
  const total = paragraphs.reduce((sum, paragraph) => sum + paragraph.length, 0);
  const fixedTitleHeight = 520 + String(title).length * 4 + String(summary).length * 1.5;
  let prefix = 0;
  let bestCount = 1;
  let bestDifference = Number.POSITIVE_INFINITY;
  for (let count = 1; count < paragraphs.length; count += 1) {
    prefix += paragraphs[count - 1].length;
    const titleColumnHeight = fixedTitleHeight + prefix * 0.45;
    const storyColumnHeight = (total - prefix) * 0.86;
    const difference = Math.abs(titleColumnHeight - storyColumnHeight);
    if (difference < bestDifference) {
      bestDifference = difference;
      bestCount = count;
    }
  }
  return bestCount;
}

const THEGUNRAT_LAYOUT_OVERRIDES = {
  'on-everything-the-most-shocking-thing-went-down-at-lordeaux-': 3,
  'yo-uh-i-think-my-eyes-just-watched-the-most-horrifying-stuff': 1,
  'the-attack-on-fluixon-s-cafe-part-1': 2,
  'the-craziest-stuff-just-happened-to-me-in-the-event': 1,
  'the-leaders-of-vesi-and-k-nigsburg-and-lordeaux-were-found-j': 1,
  'fluixons-secret-kitten-bunker': 1,
  'the-battle-of-fluixons-cozy-cafe': 5,
  'the-war-of-fluixon-s-cozy-caf-part-3': 10,
};

export function theGunRatOpeningParagraphCount(article) {
  return THEGUNRAT_LAYOUT_OVERRIDES[article.slug]
    ?? balancedOpeningParagraphCount(article.body, article.title, article.summary);
}
