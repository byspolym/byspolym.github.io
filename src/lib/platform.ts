import type {
  DeviceAccount,
  LocalDB,
  SitePage,
  SiteSettings,
  UsageEvent,
  UsageKind,
} from "./types";

export type { DeviceAccount };

export const REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🔥"] as const;

export const LIMITS: Record<UsageKind, { max: number; windowMs: number; label: string }> = {
  avatar: { max: 3, windowMs: 30 * 864e5, label: "profile photo changes this month" },
  username: { max: 2, windowMs: 30 * 864e5, label: "username edits this month" },
  full_name: { max: 1, windowMs: 30 * 864e5, label: "name changes this month" },
  bio: { max: 5, windowMs: 30 * 864e5, label: "bio edits this month" },
  story: { max: 8, windowMs: 864e5, label: "stories today" },
  media: { max: 12, windowMs: 864e5, label: "media posts today" },
};

const ACCOUNTS_KEY = "byspolyhub-device-accounts";

export function defaultSettings(): SiteSettings {
  return {
    maintenance: false,
    maintenance_message: "Byspolyhub is briefly down for maintenance. Please check back soon.",
    images: {
      hero: "/campus/hero.jpg",
      rector: "/leadership/rector.jpg",
      registrar: "/leadership/registrar.jpg",
      deputyAcademics: "/leadership/deputy-academics.jpg",
      deputyAdmin: "/leadership/deputy-admin.jpg",
      librarian: "/leadership/librarian.jpg",
      bursar: "/leadership/bursar.jpg",
      workshop: "/campus/workshop.jpg",
      library: "/campus/library.jpg",
      sports: "/campus/sports.jpg",
      auditorium: "/campus/auditorium.jpg",
    },
  };
}

export function defaultPages(now = new Date().toISOString()): SitePage[] {
  return [
    {
      slug: "about",
      title: "About Byspolyhub",
      body: "Byspolyhub is the official social hub for Bayelsa State Polytechnic, Aleibiri. Students, staff and alumni use it for notices, clubs, events and campus conversation. The polytechnic’s motto is Light, Skill & Self-Reliance.",
      updated_at: now,
    },
    {
      slug: "privacy",
      title: "Privacy Policy",
      body: "Byspolyhub stores the account details you provide (name, email, department, optional student ID, profile photo and posts) so the campus hub can function. Direct messages are visible to the people in that conversation and to site administrators when a report requires review. We do not sell personal information. You may ask an administrator to correct or remove your account. Media uploads are limited to protect storage.",
      updated_at: now,
    },
    {
      slug: "guidelines",
      title: "Community Guidelines",
      body: "Be respectful. No harassment, hate, impersonation, sexual content, or academic misconduct. Do not share another person’s private messages. Official announcements come from verified administrators. Three strikes lead to an automatic restriction. Reports are reviewed by administrators.",
      updated_at: now,
    },
  ];
}

export function blankSocial(now = new Date().toISOString()): Pick<
  LocalDB,
  | "reactions"
  | "saves"
  | "commentLikes"
  | "follows"
  | "friendships"
  | "stories"
  | "storyViews"
  | "messageReactions"
  | "groupMessages"
  | "groupMessageReactions"
  | "logs"
  | "pages"
  | "articles"
  | "settings"
  | "usage"
> {
  return {
    reactions: [],
    saves: [],
    commentLikes: [],
    follows: [],
    friendships: [],
    stories: [],
    storyViews: [],
    messageReactions: [],
    groupMessages: [],
    groupMessageReactions: [],
    logs: [],
    pages: defaultPages(now),
    articles: [],
    settings: defaultSettings(),
    usage: [],
  };
}

export function normalizeDb(db: LocalDB): LocalDB {
  const blank = blankSocial();
  const settings = db.settings ?? blank.settings;
  return {
    ...blank,
    ...db,
    reactions: db.reactions ?? [],
    saves: db.saves ?? [],
    commentLikes: db.commentLikes ?? [],
    follows: db.follows ?? [],
    friendships: db.friendships ?? [],
    stories: db.stories ?? [],
    storyViews: db.storyViews ?? [],
    messageReactions: db.messageReactions ?? [],
    groupMessages: db.groupMessages ?? [],
    groupMessageReactions: db.groupMessageReactions ?? [],
    logs: db.logs ?? [],
    pages: db.pages?.length ? db.pages : blank.pages,
    articles: db.articles ?? [],
    usage: db.usage ?? [],
    settings: {
      ...blank.settings,
      ...settings,
      images: { ...blank.settings.images, ...(settings.images ?? {}) },
    },
  };
}

export function usageCount(events: UsageEvent[], userId: string, kind: UsageKind, now = Date.now()) {
  const windowMs = LIMITS[kind].windowMs;
  return events.filter(
    (e) => e.user_id === userId && e.kind === kind && now - new Date(e.at).getTime() < windowMs,
  ).length;
}

export function assertWithinLimit(events: UsageEvent[], userId: string, kind: UsageKind) {
  const rule = LIMITS[kind];
  if (usageCount(events, userId, kind) >= rule.max) {
    throw new Error(`Limit reached: ${rule.max} ${rule.label}.`);
  }
}

export function readAccounts(): DeviceAccount[] {
  try {
    const raw = JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || "[]") as DeviceAccount[];
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

export function writeAccounts(list: DeviceAccount[]) {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(list.slice(0, 8)));
}

export function rememberAccount(account: Omit<DeviceAccount, "active" | "at">) {
  const prev = readAccounts().filter((a) => a.userId !== account.userId);
  const actives = prev.filter((a) => a.active).sort((a, b) => a.at.localeCompare(b.at));
  const drop = actives.length >= 2 ? actives[0]!.userId : null;
  writeAccounts([
    { ...account, active: true, at: new Date().toISOString() },
    ...prev.map((a) => (a.userId === drop ? { ...a, active: false } : a)),
  ]);
}

export function deactivateAccount(userId: string) {
  writeAccounts(readAccounts().map((a) => (a.userId === userId ? { ...a, active: false } : a)));
}

export function friendshipBetween(rows: LocalDB["friendships"], a: string, b: string) {
  return rows.find(
    (f) =>
      (f.requester_id === a && f.addressee_id === b) || (f.requester_id === b && f.addressee_id === a),
  );
}
