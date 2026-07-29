export type Wallet = { coins: number; escrow: number; frozen: number; available: number };

export type User = {
  id: string;
  username: string;
  displayName: string;
  role: 'user' | 'admin';
  banned: boolean;
  noticeAckedAt: string | null;
  createdAt: string;
  wallet: Wallet;
  profileCount: number;
  siteRole: 'user' | 'read_only_user' | 'journalist' | 'admin' | 'read_only_admin';
  readOnly: boolean;
  minecraftId: string | null;
  minecraftUuid: string | null;
  avatar: string | null;
  discordId: string | null;
  departedAt: string | null;
};

export type Mask = {
  id: string;
  alias: string;
  sigil: string;
  bio?: string;
  mark: string;
  reputation: number;
  dealsClosed: number;
  createdAt?: string;
  retired?: boolean;
  offers?: number;
  requests?: number;
  earnings?: number;
};

export type NewsItem = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  section: string;
  tags: string[];
  cover: string | null;
  authors: string[];
  authorIds: string[];
  publishedAt: string;
  readingMinutes: number;
  views: number;
  tomatoTips: number;
  featured: boolean;
};

export type Article = NewsItem & {
  body: string;
  dateline: string;
  authorCards: { id: string; name: string; title: string; beats: string[] }[];
};

export type JournalistCard = {
  id: string;
  name: string;
  title: string;
  portraitTone: string;
  beats: string[];
  tagline: string;
  joinedAt: string;
  awards: number;
  storyCount: number;
  featured: boolean;
};

export type Journalist = JournalistCard & {
  bio: string;
  awards2?: never;
  contact: string | null;
  stats: { stories: number; totalViews: number; awards: number };
  milestones: { year: number; text: string }[];
  signatureWorks: { newsId: string; note: string; article: { id: string; title: string } | null }[];
};

export type Tier = {
  id: string;
  name: string;
  detail: string;
  price: number;
  unlocked: boolean;
  content: string | null;
  evidence: EvidenceFile[];
  evidenceCount: number;
  buyers: number;
};

export type EvidenceFile = {
  id: string;
  name: string;
  url: string;
  mime: string;
  size: number;
  sourceUrl?: string | null;
  videoProvider?: 'youtube' | null;
  videoId?: string | null;
  externalProvider?: 'youtube' | 'google_drive' | null;
};

export type Offer = {
  id: string;
  title: string;
  summary: string;
  tags: string[];
  seller: Mask;
  tiers: Tier[];
  status: string;
  exclusive: boolean;
  exclusivePrice: number | null;
  views: number;
  createdAt: string;
  isOwner: boolean;
  minPrice: number;
  reportCount: number;
  notificationSettings: { muted: boolean; tierIds: string[] } | null;
};

export type RequestTier = { id: string; name: string; detail: string; price: number };

export type Submission = {
  id: string;
  tierId: string;
  supplier: Mask;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string;
  title: string | null;
  content: string | null;
  evidence: EvidenceFile[];
  evidenceCount: number;
  paymentSource: 'escrow' | 'wallet' | null;
};

export type BountyRequest = {
  id: string;
  title: string;
  brief: string;
  tags: string[];
  buyer: Mask;
  deposit: number;
  depositRemaining?: number;
  tiers: RequestTier[];
  deadline: string | null;
  status: string;
  createdAt: string;
  isOwner: boolean;
  submissionCount: number;
  maxPrice: number;
  submissions: Submission[];
};

export type Tag = { id: string; label: string; kind: 'system' | 'custom'; color: string; description?: string; archived?: boolean; usage?: number };

export type Tomato = {
  id: string;
  page: string;
  x: number;
  y: number;
  rot: number;
  scale: number;
  splat: string;
  note: string;
  alias: string;
  createdAt: string;
  mine: boolean;
};

export type Transaction = { id: string; delta: number; kind: string; memo: string; createdAt: string };

export type Notification = {
  id: string;
  type: string;
  title: string;
  message: string;
  href: string | null;
  readAt: string | null;
  createdAt: string;
};
