import { fileURLToPath } from 'node:url';
import { db, replaceAll, isEmpty } from './db.js';
import { hashPassword } from './auth.js';
import { CONTRIBUTOR_CATALOG } from './contributors.js';
import { KMN_WEBSITE_ARTICLE } from './kmnWebsiteArticle.js';
import { LUCENTINE_WATCHING_ARTICLE } from './lucentineWatchingArticle.js';
import { HOMELAND_STORY_ARTICLE } from './homelandStoryArticle.js';
import { ENLIGHTENED_AGE_ARTICLE } from './enlightenedAgeArticle.js';

const now = () => new Date().toISOString();

const SYSTEM_EVIDENCE_TAGS = [
  {
    id: 'tag_evidence_detailed',
    label: 'Detailed evidence',
    kind: 'system',
    color: '#b56a3c',
    description: 'The listing includes detailed supporting evidence.',
    createdBy: null,
    archived: false,
    createdAt: now(),
  },
  {
    id: 'tag_evidence_none',
    label: 'No detailed evidence',
    kind: 'system',
    color: '#8a7568',
    description: 'The listing does not include detailed supporting evidence.',
    createdBy: null,
    archived: false,
    createdAt: now(),
  },
];

const TEST_ACCOUNTS = [
  {
    id: 'tavern_user',
    username: 'tavern_user',
    displayName: 'Tavern User',
    password: 'MorrowUser!2026',
    siteRole: 'user',
  },
  {
    id: 'tavern_reporter',
    username: 'tavern_reporter',
    displayName: 'Tavern Reporter',
    password: 'MorrowReporter!2026',
    siteRole: 'journalist',
  },
  {
    id: 'tavern_admin',
    username: 'tavern_admin',
    displayName: 'Tavern Administrator',
    password: 'MorrowAdmin!2026',
    siteRole: 'admin',
  },
  {
    id: 'tavern_readonly',
    username: 'tavern_readonly',
    displayName: 'Tavern Read-only Administrator',
    password: 'MorrowReadOnly!2026',
    siteRole: 'read_only_admin',
  },
];

function makeUser(account) {
  return {
    id: account.id,
    username: account.username,
    displayName: account.displayName,
    password: hashPassword(account.password),
    role: account.siteRole === 'admin' ? 'admin' : 'user',
    siteRole: account.siteRole,
    coins: 1000,
    escrow: 0,
    frozenFunds: 0,
    banned: false,
    banReason: null,
    noticeAckedAt: null,
    minecraftId: null,
    minecraftUuid: null,
    discordId: null,
    discordUsername: null,
    discordAvatar: null,
    createdAt: now(),
  };
}

export async function seedDatabase() {
  const users = TEST_ACCOUNTS.map(makeUser);
  const news = [{
    id: 'news_placeholder',
    slug: 'jontop-classic-event-guide',
    title: 'Know Morrow News Launches Ahead of the Jontop Classic Civilization Event',
    summary: 'Everything you need to know about the 750-player event, from the Purge results and isolated starting islands to custom recipes and the official August schedule.',
    body: `The event is fast approaching, and with it, Know Morrow News officially launches its first issue, bringing you everything you need to know about the upcoming Jontop Classic Civilization event.

Congratulations to the Purge survivors!
Out of 1,583 applicants, only 750 were selected to participate, despite the initial player cap being set at 600. The administration team worked tirelessly to select only the most worthy candidates because, let's be honest, we're playing in THE Jontop event, not some low-scale SMP.

What is this event about?
This is a 750-player classical vanilla civilization event. As classical as it gets, participants are divided into two groups, each starting on a separate island. According to the staff, Temperate Island has 371 players, while Cold Island has 378. These two islands will remain completely isolated until 1 hour into Day 4, when the border drops and both civilizations, along with their nations and factions, finally meet—for trade, diplomacy, or... war.

Custom Recipes
Although this is a classic vanilla event, Jontop has introduced custom crafting recipes to make certain blocks more accessible. Please keep in mind that the staff will not provide any building materials—not even on Build Day. You'll have to earn everything yourself.

Event Calendar — August 2026
All times are shown in EST. To convert them to your local time zone, please check the Information channel on the Jontop event server.

Friday, August 7 — DAY 1 · 5:30–7:30 EST
Saturday, August 8 — DAY 2 · 5:30–7:30 EST
Sunday, August 9 — DAY 3 · 5:30–7:30 EST
Wednesday, August 12 — BUILD DAY 1 · 5:00–8:00 EST
Friday, August 14 — DAY 4 · 5:30–7:30 EST
Saturday, August 15 — DAY 5 · 5:30–7:30 EST
Sunday, August 16 — DAY 6 · 5:30–7:30 EST
Wednesday, August 19 — BUILD DAY 2 · 5:00–8:00 EST
Friday, August 21 — DAY 7 · 5:30–7:30 EST
Saturday, August 22 — DAY 8 · 5:30–7:30 EST
Sunday, August 23 — CHAOS DAY · 5:30–7:30 EST

Got a story worth publishing?
Tell our tomatoes to ketchup on the latest scoop!

Simply visit https://knowmorrownews.icu/ and discover a whole new world of articles, gossip, and top-secret information, some of which can be purchased with TMT.

Stay tuned to Know Morrow News for daily updates, silly whimsies, and all the drama from the front lines.`,
    section: 'Event Briefing',
    tags: ['Jontop Classic', 'Event Guide', 'First Issue'],
    cover: '/news/jontop-custom-recipes.webp',
    dateline: 'Know Morrow Event Desk',
    authorIds: ['jnl_lunarian'],
    illustratorIds: ['jnl_lunarian'],
    visualCredit: 'Cover image by lunarian.',
    status: 'published',
    featured: true,
    readingMinutes: 6,
    views: 0,
    tomatoTips: 0,
    publishedAt: '2026-08-07T12:00:00.000Z',
  }, {
    id: 'news_ministry_of_truth_logo',
    slug: 'shocking-discovery-kmn-logo-ministry-of-truth',
    title: 'SHOCKING DISCOVERY: KMN LOGO A HOMAGE TO THE NOTORIOUS MINISTRY OF TRUTH?!',
    summary: 'An eye-opening investigation asks whether KMN’s logo is merely a coincidence—or evidence of a vast Lordeaux-approved propaganda operation.',
    body: `LORDEAUX — A horrifying discovery has rocked the journalistic world today after investigators (one sleep-deprived journalist with too much free time) uncovered what may be the greatest scandal in modern media history.

The logo of Know Morrow Newspaper (KMN) is an eye. The logo of the infamous Ministry of Truth, Imperia's agency dedicated to rewriting history and manufacturing official narratives during the S2.7 Purge, is also... an eye.

But can this really be a coincidence？Experts are divided, mostly because nobody asked any actual experts.

The Ministry of Truth was responsible for shaping public opinion throughout Imperia. Citizens were constantly reassured that everything was perfectly fine, even when everything was very much not perfectly fine. Know Morrow Newspaper, meanwhile, insists it is simply a humble entertainment newspaper headquartered in peaceful Lordeaux.

"This cannot be ignored," explained renowned conspiracy analyst NoisyMoon0207. "Historically speaking, organizations that use eyes in their logos include the Ministry of Truth, several secret societies, and at least hundred of ophthalmology clinic"

The implications are staggering, could KMN secretly be preparing to rewrite history? Could every headline simply be Lordeaux-approved propaganda? Has the weather in Lordeaux actually been terrible this whole time?

Most disturbingly... Can we trust Know Morrow News?

Seeking answers, our journalists confronted KMN's Head Editor, Enigma, outside the KMN headquarters.

"Head Editor Enigma, what do you say to allegations that your newspaper is inspired by the Ministry of Truth?"

Enigma reportedly stared at our journalists for several seconds before responding:

“What the f**k are you talking about? Go back to your work and finish your articles."

Notice how she never denied the allegations! Following the interview, several journalists were allegedly seen returning to work instead of participating in our extremely important investigation. Some even claimed they had "deadlines," a suspiciously convenient excuse frequently used by newspaper employees.

As public concern spreads across the continent, citizens have begun asking difficult questions. If today's KMN reports that tomatoes are selling well, are tomatoes actually selling well? If tomorrow's edition declares a party victorious, was the election ever counted in the first place? Or has reality itself already been edited to generate more clicks?

Residents of Lordeaux have denied all allegations that their city is becoming "the next Imperia," although sceptics point out that this is exactly what someone from the next Imperia would say. As of press time, KMN continued publishing satirical articles instead of engaging in large-scale historical revisionism, though investigators note these two activities have yet to be conclusively proven mutually exclusive.

This investigation was, regrettably, published by KMN. Readers are therefore advised to treat every word with the appropriate level of suspicion. The investigation remains ongoing.`,
    section: 'Satire & commentary',
    tags: ['Satire', 'Conspiracy', 'KMN', 'Ministry of Truth'],
    cover: '/news/ministry-truth-cover.webp',
    media: [
      { src: '/news/cannot-be-ignored.webp', alt: 'A conspiracy analyst compares the KMN and Ministry of Truth eye logos', caption: 'A side-by-side comparison of the two logos · Art by Reiiiiii.', afterParagraph: 1 },
      { src: '/news/wtf-are-you-talking.webp', alt: 'Head Editor Enigma responds to the Ministry of Truth allegation', caption: 'KMN Head Editor Enigma responds to investigators · Art by Reiiiiii.', afterParagraph: 10 },
    ],
    dateline: 'Lordeaux',
    authorIds: ['jnl_enigma'],
    illustratorIds: ['jnl_dd3182', 'jnl_chocolate_uvu'],
    visualCredit: 'Cover image by chocolate uvu.',
    status: 'published',
    featured: false,
    readingMinutes: 5,
    views: 0,
    tomatoTips: 0,
    publishedAt: '2026-08-08T00:00:00.000Z',
  }, {
    id: 'news_jon_vs_top_ad',
    slug: 'jon-vs-top-advertisement',
    title: 'Jon vs Top Advertisement',
    summary: 'Choose Team JON or Team TOP, complete daily quests, climb the leaderboard, and compete for weekly custom chibi artwork.',
    body: `⚔️ JON vs TOP ⚔️
Two teams, One winner

Choose your side: 🔴 Team JON led by Sams or 🔵 Team TOP led by Alzakz.

Complete FUN daily quests, earn points, and track your team on leaderboards.

Weekly rewards include custom chibi artwork!

Join here: https://discord.gg/VTXta6R2a`,
    section: 'Festivals & advertisements',
    tags: ['Advertisement', 'Jon vs Top', 'Community Event'],
    cover: '/news/jon-vs-top.webp',
    media: [{ src: '/news/jon-vs-top.webp', alt: 'Red Team JON faces Blue Team TOP', caption: 'Which side are you on? JON vs TOP.', afterParagraph: 0 }],
    dateline: 'Community Desk',
    authorIds: ['jnl_lunarian'],
    visualCredit: 'Image provided by the commissioning group.',
    status: 'published',
    featured: false,
    readingMinutes: 1,
    views: 0,
    tomatoTips: 0,
    publishedAt: '2026-08-08T01:00:00.000Z',
  }, KMN_WEBSITE_ARTICLE, LUCENTINE_WATCHING_ARTICLE, HOMELAND_STORY_ARTICLE, ENLIGHTENED_AGE_ARTICLE];
  const transactions = users.map((user) => ({
    id: `tx_opening_${user.id}`,
    userId: user.id,
    profileId: null,
    delta: user.coins,
    kind: 'grant',
    memo: 'Opening Tavern allocation',
    refType: null,
    refId: null,
    createdAt: now(),
  }));
  const journalists = [{
    id: 'jnl_tavern_reporter',
    userId: 'tavern_reporter',
    name: 'Tavern Reporter',
    title: 'Staff Reporter',
    avatar: null,
    portraitTone: '#9e532d',
    tagline: 'Every whisper has a witness.',
    bio: 'A test reporter profile for validating Know Morrow publishing tools.',
    beats: ['General Assignment'],
    awards: [],
    milestones: [{ year: new Date().getFullYear(), text: 'Joined the Know Morrow press corps' }],
    signatureWorks: [],
    contact: null,
    featured: false,
    hidden: false,
    joinedAt: now(),
  }, {
    id: 'jnl_daffodiljunior',
    userId: null,
    discordUsername: 'daffodiljunior',
    name: 'DaffodilJunior',
    title: 'Journalist',
    ign: 'DaffodilJunior',
    pronouns: 'she',
    aliases: ['Daff', 'Dafi', 'DFJ'],
    affiliations: [
      'Sage Company of Amazing Miracle Medicine Integrated Near Groups',
      'Loredeaux',
      'Loredeaux Labor League',
    ],
    funFact: 'i can draw a cartoon fishbone in 7 seconds',
    avatar: '/journalists/dfj.webp',
    imageCredit: 'Art by NoisyMoon.',
    portraitTone: '#b9473f',
    tagline: 'Mostly known for my typos and my terrible spending habits regarding the Crest.',
    bio: `Greetings. I'm DFJ, mostly known for my typos and my terrible spending habits regarding the Crest; my colleagues here prolly know me as the one always struggling with basic mathematics. I part-timed with Nightfix in 2.7, and ran the Nightingale News with Zerotaxa in Leone s4.

More than honored to be able to play with such a wonderful team of master artisans this time too.

(I'll edit this later to add some other stuff — just posting this to set a formatting template.)`,
    beats: [],
    awards: [],
    milestones: [],
    signatureWorks: [],
    contact: null,
    featured: false,
    hidden: false,
    joinedAt: now(),
  }, {
    id: 'jnl_enigma',
    userId: null,
    name: 'Enigma',
    title: 'Journalist',
    ign: 'StillanEnigma',
    pronouns: 'she/her',
    aliases: ['Enni', 'in fact u can call me whatever u like'],
    affiliations: ['Lordeaux'],
    funFact: 'I literally started this newspaper just for the crossword puzzles and Sudoku',
    avatar: '/journalists/enigma.webp',
    imageCredit: null,
    portraitTone: '#27302a',
    tagline: 'A lore nerd, probably working on something, bothering friends, or throwing tomatoes at someone.',
    bio: `Hi, I’m Enigma! I’m a lore nerd, and I'm 100% sure I will far more likely to be remembered for all the wrong reasons than to make it into the event history books. I have severe trialphobia.

If you see me in the event, feel free to say hi! I’m probably either working on something, bothering my friends, or throwing tomatoes at someone.`,
    beats: [],
    awards: [],
    milestones: [],
    signatureWorks: [],
    contact: null,
    featured: false,
    hidden: false,
    joinedAt: now(),
  }, {
    id: 'jnl_chocolate_uvu',
    userId: null,
    name: 'chocolate uvu',
    title: 'Artist',
    ign: 'chocolate_UVU',
    pronouns: 'they/them',
    aliases: ['chocolate', 'chuvu'],
    affiliations: [],
    funFact: null,
    avatar: '/journalists/chocolate-uvu.webp',
    imageCredit: null,
    portraitTone: '#294db5',
    tagline: 'just an artist',
    bio: 'just an artist',
    beats: ['Art'],
    awards: [],
    milestones: [],
    signatureWorks: [],
    contact: null,
    featured: false,
    hidden: false,
    joinedAt: now(),
  }, {
    id: 'jnl_scarhebs',
    userId: null,
    name: 'scarhebs',
    title: 'Journalist',
    ign: 'Scarhebs',
    pronouns: 'People usually use she/her but sometimes people use other ones',
    aliases: ['Scarhebs', 'Scar'],
    affiliations: [
      "Lucentine (honestly I'm only there because my friends are also there)",
      "Lucentine's Death and Wine (the business my aforementioned friends made)",
    ],
    funFact: "I'm doing both this event and progeny at the same time I don't why I thought this would be a good idea help me",
    avatar: '/journalists/scarhebs.png',
    imageCredit: null,
    portraitTone: '#163968',
    tagline: 'I can very much lock in when it comes to actually writing down news!',
    bio: `Hellow! I'm Scarhebs and I am mostly known for usually doing nothing but building in events but trust me I am trying to branch out! I have done news before and both times I was very proud of the work I did, technically I did more the first time but the second time was my magnum opus in roleplay and therefore it is my favorite.

I am an incredibly deeply anxious person and not the best when talking to people but I always try my best and I can very much lock in when it comes to actually writing down news!`,
    beats: ['Building', 'News'],
    awards: [],
    milestones: [],
    signatureWorks: [],
    contact: null,
    featured: false,
    hidden: false,
    joinedAt: now(),
  }, {
    id: 'jnl_dd3182',
    userId: null,
    name: 'Reiiiiii',
    title: 'Artist',
    ign: 'DD3182',
    pronouns: 'they/them',
    aliases: ['Rei', 'anything recognizable as my IGN'],
    affiliations: ['Lordeaux'],
    funFact: null,
    avatar: '/journalists/dd3182.webp',
    imageCredit: 'Design & art by chuvu.',
    portraitTone: '#7d3b27',
    tagline: 'part-time artist, full-time dumbass.',
    bio: `part-time artist, full-time dumbass. civ event newbie. struggling w my skin rn, will add it here once it's done.`,
    beats: ['Art'],
    awards: [],
    milestones: [],
    signatureWorks: [],
    contact: null,
    featured: false,
    hidden: false,
    joinedAt: now(),
  }, {
    id: 'jnl_pumpkin',
    userId: null,
    name: 'Pumpkin',
    title: 'Writer & Artist',
    ign: 'Pumpkinpaii6183',
    pronouns: 'Any pronouns; currently prefers masculine pronouns over feminine',
    aliases: ['Pumpkin'],
    affiliations: ['wherever the wind takes me!!'],
    funFact: 'I draw good but write better and love good improv.',
    avatar: '/journalists/pumpkin.webp',
    imageCredit: null,
    gallery: [{ src: '/journalists/pumpkin-skin.webp', alt: "Pumpkin's Minecraft skin", credit: null }],
    portraitTone: '#8a3d21',
    tagline: 'I draw good but write better and love good improv.',
    bio: `I use any pronouns, but right around now I prefer masculine pronouns over feminine!!! Call me Pumpkin ;) My affiliations is uh... wherever the wind takes me!! I did choose random for my island so lowkey :scared: I draw good but write better and love good improv.`,
    beats: ['Writing', 'Art', 'Improv'],
    awards: [],
    milestones: [],
    signatureWorks: [],
    contact: null,
    featured: false,
    hidden: false,
    joinedAt: now(),
  }, {
    id: 'jnl_yanyegg',
    userId: null,
    name: 'YanYEgg',
    title: 'Artist / Builder / A Terrible Tomato!',
    ign: 'Yan_YEgg',
    pronouns: 'they/them',
    aliases: ['Yan', "Yegg (Please don't call me Egg! I might not be able to recognize it as a call to me.)"],
    affiliations: ['Lordeaux'],
    funFact: null,
    avatar: '/journalists/yanyegg.webp',
    imageCredit: null,
    gallery: [],
    portraitTone: '#5b8d94',
    tagline: 'My job content leans more towards entertainment. 🍅',
    bio: `To be honest, I joined KMN with the hope of talk incoherently in the newspaper.. I'm not good at writing serious political news, but I really enjoy collecting gossip and rumors. My job content leans more towards entertainment.🍅

You can learn about me through the following tags:
▲Creation
▲Unstable（maybe）
▲Tire
▲Fun First
▲Tomato`,
    beats: ['Creation', 'Unstable（maybe）', 'Tire', 'Fun First', 'Tomato'],
    awards: [],
    milestones: [],
    signatureWorks: [],
    contact: null,
    featured: false,
    hidden: false,
    joinedAt: now(),
  }, {
    id: 'jnl_noisymoon',
    userId: null,
    name: 'NoisyMoon',
    title: 'Artist',
    ign: 'NoisyMoon0207',
    pronouns: 'she/her',
    aliases: ['Noisy', 'Moon (prefer Noisy; I might ignore Moon because there are so many people named “moon” in this world)'],
    affiliations: ['TBD'],
    funFact: null,
    avatar: '/journalists/noisymoon.webp',
    imageCredit: null,
    gallery: [],
    portraitTone: '#8da4c8',
    tagline: 'I love drawing, I do artwork.',
    bio: `(I copied Daff's self-introduction)

Just an society-anxious person, and my English is really sucks. I love drawing, I do artwork`,
    beats: ['Art'],
    awards: [],
    milestones: [],
    signatureWorks: [],
    contact: null,
    featured: false,
    hidden: false,
    joinedAt: now(),
  }, {
    id: 'jnl_alpha',
    userId: null,
    discordUsername: 'alphatier',
    name: 'Alpha',
    title: 'Journalist',
    ign: 'AgentAlphakill',
    pronouns: 'that/guy (he/him)',
    aliases: ['Alpha', 'Super Cool Awesome Guy'],
    affiliations: [],
    funFact: null,
    avatar: '/journalists/alpha.webp',
    imageCredit: null,
    gallery: [],
    portraitTone: '#8a7a79',
    tagline: "I'm here to sow my own political biases into the paper.",
    bio: `Hi, I'm Alpha, I'm here to sow my own political biases into the paper.`,
    beats: ['Politics'],
    awards: [],
    milestones: [],
    signatureWorks: [],
    contact: null,
    featured: false,
    hidden: false,
    joinedAt: now(),
  }, {
    id: 'jnl_kyabia',
    userId: null,
    name: 'Kyabia',
    title: 'Website Developer & Illustrator',
    ign: 'Kyabia162',
    pronouns: 'they / she — both are okay',
    aliases: ['Kabi', 'kyb', 'Caviar'],
    affiliations: ['Loredeaux', 'Loredeaux Vanguard Party'],
    funFact: '“Kyabia” is the English spelling of the Japanese word for “caviar”; feel free to pronounce it however you like.',
    avatar: '/journalists/kyabia.jpg',
    imageCredit: null,
    gallery: [],
    portraitTone: '#172e57',
    tagline: "I'm good at website development and illustration, and I'm mainly responsible for these two things at this event.",
    bio: `Hello! I'm Kyabia! I'm good at website development and illustration, and I'm mainly responsible for these two things at this event.

You can find most of my work on the ish's state server. I used to independently cover news from the desert island (Kyabia's TNT Daily) in the granite wall. This is my second civ event, so I have relatively little experience, but I'll try my best!

I'm a little shy, but I'm really happy to play with everyone!

P.S. If you find “Kyabia” difficult to pronounce, feel free to pronounce it however you like! It’s the English spelling of the Japanese word for "caviar", so if you want to call me “Caviar,” I guess that works too...`,
    beats: ['Website Development', 'Illustration', 'News'],
    awards: [],
    milestones: [],
    signatureWorks: [],
    contact: null,
    featured: false,
    hidden: false,
    joinedAt: now(),
  }, {
    id: 'jnl_undipin',
    userId: null,
    name: 'undipin',
    title: 'Veteran Civ News Writer',
    ign: 'undipin',
    pronouns: 'He/Him',
    aliases: ['Pin'],
    affiliations: ['Me, Myself and I'],
    funFact: 'I have NO artistic talent and am notorious for being jobless when it comes to civ news and pumping out a large number of articles that no one asked for.',
    avatar: '/journalists/undipin.webp',
    imageCredit: 'Art by ME (surprisingly I made this mostly myself).',
    gallery: [],
    portraitTone: '#303030',
    tagline: 'Pumping out a large number of articles that no one asked for.',
    bio: `I've done a LOT of civ news in the past, most notably being when I ran IDP News in Skipolo or Ventura in Crestconomy. I have NO artistic talent and am notorious for being jobless when it comes to civ news and pumping out a large number of articles that no one asked for.`,
    beats: ['Civ News'],
    awards: [],
    milestones: [],
    signatureWorks: [],
    contact: null,
    featured: false,
    hidden: false,
    joinedAt: now(),
  }, {
    id: 'jnl_lunarian',
    userId: null,
    name: 'lunarian | KMN',
    title: 'Journalist',
    ign: 'luna_rian',
    pronouns: 'she/her',
    aliases: ['lunarian', 'luna'],
    affiliations: ['Lordeaux'],
    funFact: 'i have never beaten an enderdragon',
    avatar: '/journalists/lunarian.webp',
    imageCredit: null,
    gallery: [],
    portraitTone: '#6c485a',
    tagline: 'Feel free to reach out in game!',
    bio: `hii im lunarian, my wifi and english suck so i probably will be that one quiet kid, but feel free to reach out in game!`,
    beats: [],
    awards: [],
    milestones: [],
    signatureWorks: [],
    contact: null,
    featured: false,
    hidden: false,
    joinedAt: now(),
  }, {
    id: 'jnl_raysong',
    userId: null,
    name: '𝑹𝒂𝒚𝑺𝒐𝒏𝒈',
    title: 'Traveling Artist & KMN Illustrator',
    ign: 'Rayne_Song',
    pronouns: 'Any pronouns',
    aliases: ['Ray', 'Rayne'],
    affiliations: [
      'Doctor of Sage Company of Amazing Miracle Medicine Integrated Near Groups',
      'Friendly/Collaborating with multiple groups and factions for art purposes',
    ],
    funFact: 'This is my first civ event.',
    avatar: '/journalists/raysong-shop.webp',
    imageCredit: null,
    gallery: [{ src: '/journalists/raysong-catalog.webp', alt: "RaySong's general art catalog", credit: null }],
    portraitTone: '#9c3547',
    tagline: 'An individual traveling artist and a collaborating illustrator for KMN.',
    bio: `Hihi! I'm RaySong

I larp as an individual traveling artist and serve as a collaborating illustrator for KMN.

I have my own page in Event Recruit, so check that out if you'd like. Attached is my general catalog and a fun shop page I did.

This is my first civ event so hope we all have fun.`,
    beats: ['Illustration', 'Art Collaboration'],
    awards: [],
    milestones: [],
    signatureWorks: [],
    contact: null,
    featured: false,
    hidden: false,
    joinedAt: now(),
  }];

  await replaceAll({
    meta: { version: 2, seededAt: now() },
    users,
    profiles: [],
    news,
    journalists,
    contributors: structuredClone(CONTRIBUTOR_CATALOG),
    tags: structuredClone(SYSTEM_EVIDENCE_TAGS),
    offers: [],
    requests: [],
    purchases: [],
    submissions: [],
    evidence: [],
    reports: [],
    arbitrations: [],
    tomatoes: [],
    transactions,
    auditLog: [],
    notifications: [],
  });

  console.log(`[Know Morrow] Reset complete: ${users.length} test accounts, ${news.length} example story, empty Tavern.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const force = process.argv.includes('--force');
  if (!isEmpty() && !force) {
    console.log('[Know Morrow] Database contains data. Add --force to replace it.');
  } else {
    await seedDatabase();
  }
}
