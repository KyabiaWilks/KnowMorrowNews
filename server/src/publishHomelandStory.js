import { db, save } from './db.js';

const slug = 'your-homeland-story';
const body = `Is your homeland burning in the fires of war? Has it been torn apart? Is it feared by others—or simply forgotten?

The choices of powerful nations shape everyone’s future. Yet most of us are simply ordinary people, no different from you or me. Perhaps we are all trembling in the same dark night. Perhaps we are searching for friendship but do not know where to begin.

Know Morrow News has decided to turn its attention to the hundreds of ordinary people who make up our world.

Starting after Building Day 1, we will accept submissions about your homeland. Tell us about your home and its people through your own eyes or the eyes of someone close to you. Share your love for your homeland and your hopes for its future.

We will select outstanding submissions for publication in our newspaper. You may submit anonymously, use a pen name, or publish under your own name. The earlier you submit, the earlier your story may be published.

Submissions will remain open until Building Day 2. We will then select the three most popular articles based on the number of Tomato tips they receive on our website and award the following prizes:

[[PRIZES]]
First Prize|||A custom four-panel comic about your homeland, or illustrations requiring a similar amount of work, created by Kyabia or another willing Tomato.
Second Prize|||40 TMT, equal to eight gold ingots.
Third Prize|||20 TMT, equal to four gold ingots.`;

const existing = db.news.find((article) => article.slug === slug);
if (!existing) {
  db.news.unshift({
    id: 'news_your_homeland_story',
    slug,
    title: 'Your Homeland Story',
    summary: 'Tell Know Morrow News about your homeland and compete for publication, Tomato prizes, and a custom illustrated comic.',
    body,
    section: 'News',
    tags: ['Festivals & advertisements'],
    cover: null,
    media: [],
    dateline: 'Know Morrow Community Desk',
    authorIds: ['jnl_kyabia'],
    illustratorIds: [],
    proofreaderIds: [],
    visualCredit: null,
    status: 'published',
    featured: false,
    readingMinutes: Math.max(1, Math.round(body.length / 400)),
    views: 0,
    tomatoTips: 0,
    publishedAt: new Date().toISOString(),
  });
  await save(true);
  console.log('Published Your Homeland Story.');
} else {
  console.log(`Already published as ${existing.id}.`);
}
process.exit(0);
