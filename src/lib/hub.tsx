import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { supabase, supabaseTablesReady } from "./supabase";
import { createSeedDb } from "./seed";
import { blobToDataUrl } from "./image";
import { uid, sha256Hex } from "./utils";
import { ADMIN_EMAILS, PAGE_SIZE } from "./constants";
import { chatAlive, chatExpiresAt, CHAT_AUDIO_MAX, CHAT_IMAGE_MAX } from "./chat";
import {
  assertWithinLimit,
  blankSocial,
  deactivateAccount,
  friendshipBetween,
  LIMITS,
  normalizeDb,
  readAccounts,
  rememberAccount,
  usageCount,
} from "./platform";
import type {
  Article,
  BackendMode,
  CampusEvent,
  Comment,
  DeviceAccount,
  FeedPost,
  Group,
  LocalDB,
  Message,
  Notification,
  Profile,
  Report,
  ReportStatus,
  ReportTarget,
  Role,
  RsvpStatus,
  SitePage,
  SiteSettings,
  UsageKind,
} from "./types";

const DB_KEY = "byspolyhub-db-v5";
const SESSION_KEY = "byspolyhub-session";

export type SignUpInput = {
  full_name: string;
  email: string;
  password: string;
  role: Role;
  department: string;
  level: string;
  student_id: string;
};

export type ChatMedia = {
  imageUrl?: string | null;
  audioUrl?: string | null;
  audioSeconds?: number | null;
};

function emptyDb(): LocalDB {
  return {
    profiles: [],
    posts: [],
    comments: [],
    likes: [],
    groups: [],
    groupMembers: [],
    events: [],
    rsvps: [],
    conversations: [],
    convMembers: [],
    messages: [],
    reports: [],
    notifications: [],
    passwords: {},
    ...blankSocial(),
  };
}

function pruneChats(db: LocalDB): LocalDB {
  return {
    ...db,
    messages: (db.messages ?? []).filter((m) => chatAlive(m)),
    groupMessages: (db.groupMessages ?? []).filter((m) => chatAlive(m)),
  };
}

function loadLocal(): LocalDB {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (!raw) return createSeedDb();
    const parsed = JSON.parse(raw) as LocalDB;
    if (!parsed.profiles?.length) return createSeedDb();
    return pruneChats(normalizeDb({ ...emptyDb(), ...parsed }));
  } catch {
    return createSeedDb();
  }
}

function saveLocal(db: LocalDB) {
  localStorage.setItem(DB_KEY, JSON.stringify(db));
}

function slugify(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 40) || "group";
}

function usernameFrom(email: string, profiles: Profile[]) {
  const base = email.split("@")[0]!.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 16) || "student";
  let name = base;
  let n = 1;
  while (profiles.some((p) => p.username === name)) name = `${base}${n++}`;
  return name;
}

function enrichPosts(db: LocalDB, meId: string | null, posts: LocalDB["posts"]): FeedPost[] {
  const profiles = new Map(db.profiles.map((p) => [p.id, p]));
  const out: FeedPost[] = [];
  for (const p of posts) {
    const author = profiles.get(p.author_id);
    if (!author) continue;
    out.push({
      ...p,
      author,
      like_count: db.likes.filter((l) => l.post_id === p.id).length,
      comment_count: db.comments.filter((c) => c.post_id === p.id).length,
      liked_by_me: !!meId && db.likes.some((l) => l.post_id === p.id && l.user_id === meId),
      saved_by_me: !!meId && (db.saves ?? []).some((s) => s.post_id === p.id && s.user_id === meId),
      my_reaction: meId ? (db.reactions ?? []).find((r) => r.post_id === p.id && r.user_id === meId)?.emoji ?? null : null,
    });
  }
  return out;
}

type HubContextValue = {
  ready: boolean;
  backend: BackendMode;
  me: Profile | null;
  db: LocalDB;
  onlineIds: string[];
  error: string | null;
  signIn: (email: string, password: string) => Promise<Record<string, never>>;
  signUp: (input: SignUpInput) => Promise<{ needsConfirm?: boolean }>;
  signOut: () => Promise<void>;
  requestReset: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  updateMe: (patch: Partial<Pick<Profile, "full_name" | "username" | "bio" | "department" | "level" | "student_id">>) => Promise<void>;
  setAvatar: (blob: Blob) => Promise<void>;
  feed: (opts?: { groupId?: string | null; page?: number }) => FeedPost[];
  createPost: (input: {
    content: string;
    image?: Blob | null;
    imageUrl?: string | null;
    files?: Blob[];
    groupId?: string | null;
    announcement?: boolean;
  }) => Promise<void>;
  deletePost: (id: string) => Promise<void>;
  toggleLike: (postId: string) => Promise<void>;
  addComment: (postId: string, content: string, parentId?: string | null) => Promise<void>;
  deleteComment: (id: string) => Promise<void>;
  commentsFor: (postId: string) => (Comment & { author: Profile })[];
  createGroup: (input: { name: string; description: string; category: string; cover?: Blob | null; avatar?: Blob | null }) => Promise<Group>;
  joinGroup: (groupId: string) => Promise<void>;
  leaveGroup: (groupId: string) => Promise<void>;
  updateGroup: (groupId: string, patch: { name?: string; description?: string; cover?: Blob | null; avatar?: Blob | null }) => Promise<void>;
  setGroupMemberRole: (groupId: string, userId: string, role: "admin" | "member") => Promise<void>;
  removeGroupMember: (groupId: string, userId: string) => Promise<void>;
  sendGroupMessage: (groupId: string, body: string, media?: ChatMedia | null) => Promise<void>;
  deleteGroupMessage: (id: string) => Promise<void>;
  reactToGroupMessage: (messageId: string, emoji: string) => Promise<void>;
  createEvent: (input: { title: string; description: string; location: string; starts_at: string; ends_at: string; image?: Blob | null }) => Promise<void>;
  updateEvent: (id: string, patch: { title?: string; description?: string; image?: Blob | null }) => Promise<void>;
  rsvp: (eventId: string, status: RsvpStatus) => Promise<void>;
  search: (q: string) => { people: Profile[]; posts: FeedPost[]; groups: Group[] };
  openConversation: (otherId: string) => Promise<string>;
  sendMessage: (conversationId: string, body: string, media?: ChatMedia | null) => Promise<void>;
  markConversationRead: (conversationId: string) => Promise<void>;
  reactToMessage: (messageId: string, emoji: string) => Promise<void>;
  recordPostStat: (postId: string, kind: "view" | "share") => Promise<void>;
  report: (targetType: ReportTarget, targetId: string, reason: string, details: string) => Promise<void>;
  markNotificationsRead: () => Promise<void>;
  banUser: (userId: string, banned: boolean, reason?: string) => Promise<void>;
  verifyUser: (userId: string, verified: boolean) => Promise<void>;
  strikeUser: (userId: string, reason?: string) => Promise<void>;
  muteUser: (userId: string, muted: boolean) => Promise<void>;
  setRole: (userId: string, role: Role) => Promise<void>;
  forceLogout: (userId: string) => Promise<void>;
  deleteEvent: (id: string) => Promise<void>;
  deleteGroup: (id: string) => Promise<void>;
  deleteMessage: (id: string) => Promise<void>;
  deleteStory: (id: string) => Promise<void>;
  updatePage: (slug: string, patch: Partial<Pick<SitePage, "title" | "body">>) => Promise<void>;
  updateSettings: (patch: Partial<SiteSettings> & { images?: Partial<SiteSettings["images"]> }) => Promise<void>;
  saveArticle: (input: Partial<Article> & { title: string; body: string }) => Promise<void>;
  deleteArticle: (id: string) => Promise<void>;
  follow: (userId: string) => Promise<void>;
  requestFriend: (userId: string) => Promise<void>;
  respondFriend: (id: string, status: "accepted" | "rejected") => Promise<void>;
  addStory: (input: { kind: "photo" | "video" | "text"; blob?: Blob | null; caption?: string }) => Promise<void>;
  viewStory: (storyId: string) => Promise<void>;
  toggleReaction: (postId: string, emoji: string) => Promise<void>;
  toggleSave: (postId: string) => Promise<void>;
  toggleCommentLike: (commentId: string) => Promise<void>;
  visibleStories: () => LocalDB["stories"];
  usageLeft: (kind: UsageKind) => number;
  deviceAccounts: DeviceAccount[];
  switchAccount: (userId: string) => { needsLogin: boolean; email: string } | null;
  resolveReport: (id: string, status: ReportStatus, resolution: string) => Promise<void>;
  profileById: (id: string) => Profile | undefined;
  isOnline: (id: string) => boolean;
  refresh: () => Promise<void>;
};

const HubContext = createContext<HubContextValue | null>(null);

async function storeBlob(backend: BackendMode, bucket: string, userId: string, blob: Blob) {
  if (backend === "local") return blobToDataUrl(blob);
  const type = blob.type || "image/jpeg";
  const ext = type.includes("png") ? "png" : type.includes("webm") ? "webm" : type.includes("mp4") ? "mp4" : "jpg";
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(path, blob, { contentType: type, upsert: false });
  if (error) throw error;
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

function guardMedia(media?: ChatMedia | null) {
  if (media?.imageUrl && media.imageUrl.length > CHAT_IMAGE_MAX * 2) throw new Error("That photo is too large for the free plan.");
  if (media?.audioUrl && media.audioUrl.length > CHAT_AUDIO_MAX * 2) throw new Error("That voice note is too large. Keep it under 20 seconds.");
}

export function HubProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [backend, setBackend] = useState<BackendMode>("local");
  const [db, setDb] = useState<LocalDB>(emptyDb);
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [onlineIds, setOnlineIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [deviceAccounts, setDeviceAccounts] = useState<DeviceAccount[]>([]);
  const backendRef = useRef<BackendMode>("local");
  const dbRef = useRef(db);
  dbRef.current = db;
  backendRef.current = backend;

  const persist = useCallback((next: LocalDB) => {
    const pruned = pruneChats(next);
    setDb(pruned);
    if (backendRef.current === "local") saveLocal(pruned);
  }, []);

  const me = db.profiles.find((p) => p.id === sessionUserId) ?? null;

  const hydrateRemote = useCallback(async (userId: string | null) => {
    const rows = async <T,>(query: PromiseLike<{ data: T[] | null; error: { message?: string } | null }>) => {
      const { data, error: err } = await query;
      if (err || !data) return [] as T[];
      return data;
    };
    const [profiles, posts, comments, likes, groups, groupMembers, groupMessages, groupMessageReactions, events, rsvps, conversations, convMembers, messages, reports, notifications, reactions, saves, commentLikes, follows, friendships, stories, storyViews, messageReactions, logs, pages, articles, usage] =
      await Promise.all([
        rows<Profile>(supabase.from("profiles").select("*")),
        rows<LocalDB["posts"][number]>(supabase.from("posts").select("*").order("created_at", { ascending: false }).limit(80)),
        rows<Comment>(supabase.from("post_comments").select("*")),
        rows<LocalDB["likes"][number]>(supabase.from("post_likes").select("*")),
        rows<Group>(supabase.from("groups").select("*")),
        rows<LocalDB["groupMembers"][number]>(supabase.from("group_members").select("*")),
        rows<LocalDB["groupMessages"][number]>(supabase.from("group_messages").select("*").order("created_at", { ascending: true }).limit(200)),
        rows<LocalDB["groupMessageReactions"][number]>(supabase.from("group_message_reactions").select("*")),
        rows<CampusEvent>(supabase.from("events").select("*").order("starts_at", { ascending: true })),
        rows<LocalDB["rsvps"][number]>(supabase.from("event_rsvps").select("*")),
        rows<LocalDB["conversations"][number]>(supabase.from("conversations").select("*")),
        rows<LocalDB["convMembers"][number]>(supabase.from("conversation_members").select("*")),
        rows<Message>(supabase.from("messages").select("*").order("created_at", { ascending: true }).limit(200)),
        rows<Report>(supabase.from("reports").select("*").order("created_at", { ascending: false })),
        userId
          ? rows<Notification>(supabase.from("notifications").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(40))
          : Promise.resolve([] as Notification[]),
        rows<LocalDB["reactions"][number]>(supabase.from("reactions").select("*")),
        rows<LocalDB["saves"][number]>(supabase.from("saves").select("*")),
        rows<LocalDB["commentLikes"][number]>(supabase.from("comment_likes").select("*")),
        rows<LocalDB["follows"][number]>(supabase.from("follows").select("*")),
        rows<LocalDB["friendships"][number]>(supabase.from("friendships").select("*")),
        rows<LocalDB["stories"][number]>(supabase.from("stories").select("*")),
        rows<LocalDB["storyViews"][number]>(supabase.from("story_views").select("*")),
        rows<LocalDB["messageReactions"][number]>(supabase.from("message_reactions").select("*")),
        rows<LocalDB["logs"][number]>(supabase.from("activity_logs").select("*").order("created_at", { ascending: false }).limit(80)),
        rows<SitePage>(supabase.from("site_pages").select("*")),
        rows<Article>(supabase.from("articles").select("*").order("created_at", { ascending: false })),
        rows<LocalDB["usage"][number]>(supabase.from("usage_events").select("user_id,kind,at")),
      ]);
    const settingsRes = await supabase.from("site_settings").select("*").eq("id", 1).maybeSingle();
    const base = emptyDb();
    const remoteImages = (settingsRes.data?.images ?? {}) as Partial<SiteSettings["images"]>;
    const settings: SiteSettings = {
      ...base.settings,
      maintenance: !!settingsRes.data?.maintenance,
      maintenance_message: settingsRes.data?.maintenance_message || base.settings.maintenance_message,
      images: { ...base.settings.images, ...remoteImages },
    };
    setDb(pruneChats({
      ...base,
      profiles,
      posts,
      comments,
      likes,
      groups,
      groupMembers,
      groupMessages,
      groupMessageReactions,
      events,
      rsvps,
      conversations,
      convMembers,
      messages,
      reports,
      notifications,
      reactions,
      saves,
      commentLikes,
      follows,
      friendships,
      stories,
      storyViews,
      messageReactions,
      logs,
      pages: pages.length ? pages : base.pages,
      articles,
      usage,
      settings,
      passwords: {},
    }));
  }, []);

  const refresh = useCallback(async () => {
    if (backendRef.current === "supabase") await hydrateRemote(sessionUserId);
  }, [hydrateRemote, sessionUserId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const live = await supabaseTablesReady();
      if (cancelled) return;
      if (live) {
        const { data } = await supabase.auth.getSession();
        setBackend("supabase");
        backendRef.current = "supabase";
        const id = data.session?.user.id ?? null;
        setSessionUserId(id);
        await hydrateRemote(id);
        void supabase.rpc("purge_expired_chats");
      } else {
        setBackend("local");
        backendRef.current = "local";
        const local = loadLocal();
        setDb(local);
        saveLocal(local);
        setSessionUserId(localStorage.getItem(SESSION_KEY));
        setDeviceAccounts(readAccounts());
      }
      setReady(true);
    })().catch((err) => {
      console.error(err);
      setBackend("local");
      backendRef.current = "local";
      const local = loadLocal();
      setDb(local);
      setSessionUserId(localStorage.getItem(SESSION_KEY));
      setDeviceAccounts(readAccounts());
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [hydrateRemote]);

  useEffect(() => {
    if (!ready || backend !== "supabase") return;
    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const id = session?.user.id ?? null;
      setSessionUserId(id);
      await hydrateRemote(id);
    });
    return () => sub.subscription.unsubscribe();
  }, [ready, backend, hydrateRemote]);

  useEffect(() => {
    if (!ready || !me?.revoked_at) return;
    deactivateAccount(me.id);
    setDeviceAccounts(readAccounts());
    localStorage.removeItem(SESSION_KEY);
    setSessionUserId(null);
  }, [ready, me?.id, me?.revoked_at]);

  useEffect(() => {
    if (!ready || !me || me.is_banned) return;
    const tick = () => {
      const ts = new Date().toISOString();
      const current = pruneChats(dbRef.current);
      persist({
        ...current,
        profiles: current.profiles.map((p) => (p.id === me.id ? { ...p, last_seen: ts } : p)),
      });
      if (backendRef.current === "supabase") void supabase.from("profiles").update({ last_seen: ts }).eq("id", me.id);
    };
    tick();
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, [ready, me?.id, me?.is_banned, persist]);

  useEffect(() => {
    const ids = db.profiles.filter((p) => Date.now() - new Date(p.last_seen).getTime() < 2 * 60_000).map((p) => p.id);
    setOnlineIds(ids);
  }, [db.profiles]);

  useEffect(() => {
    if (!ready || backend !== "supabase" || !me) return;
    const channel = supabase
      .channel("hub-live")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, () => {
        void hydrateRemote(me.id);
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "group_messages" }, () => {
        void hydrateRemote(me.id);
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [ready, backend, me?.id, hydrateRemote]);

  const assertActive = () => {
    if (!me) throw new Error("Sign in to continue.");
    if (me.is_banned) throw new Error("This account is restricted.");
    return me;
  };
  const assertSpeak = () => {
    const user = assertActive();
    if (user.is_muted) throw new Error("You are muted and cannot post, comment or message.");
    return user;
  };
  const requireAdmin = () => {
    const user = assertActive();
    if (user.role !== "admin") throw new Error("Administrators only.");
    return user;
  };
  const log = (base: LocalDB, actorId: string, action: string, detail: string): LocalDB => ({
    ...base,
    logs: [{ id: uid("log"), actor_id: actorId, action, detail, created_at: new Date().toISOString() }, ...(base.logs ?? [])].slice(0, 80),
  });
  const notify = (base: LocalDB, userId: string, type: string, message: string, actorId: string | null, entityId: string | null): LocalDB => {
    if (!userId || userId === actorId) return base;
    const row: Notification = { id: uid("n"), user_id: userId, type, actor_id: actorId, entity_id: entityId, message, read: false, created_at: new Date().toISOString() };
    return { ...base, notifications: [row, ...base.notifications].slice(0, 80) };
  };

  const signIn = async (email: string, password: string) => {
    setError(null);
    if (backend === "supabase") {
      const { data, error: err } = await supabase.auth.signInWithPassword({ email, password });
      if (err) throw err;
      setSessionUserId(data.user.id);
      await hydrateRemote(data.user.id);
      return {};
    }
    const user = db.profiles.find((p) => p.email.toLowerCase() === email.trim().toLowerCase());
    const hashed = await sha256Hex(password);
    if (!user || db.passwords[user.email] !== hashed) throw new Error("Wrong email or password.");
    if (user.revoked_at) {
      persist({ ...db, profiles: db.profiles.map((p) => (p.id === user.id ? { ...p, revoked_at: null } : p)) });
    }
    rememberAccount({ userId: user.id, email: user.email, full_name: user.full_name, avatar_url: user.avatar_url });
    setDeviceAccounts(readAccounts());
    localStorage.setItem(SESSION_KEY, user.id);
    setSessionUserId(user.id);
    return {};
  };

  const signUp = async (input: SignUpInput) => {
    const email = input.email.trim().toLowerCase();
    if (backend === "supabase") {
      const { data, error: err } = await supabase.auth.signUp({
        email,
        password: input.password,
        options: {
          data: {
            full_name: input.full_name.trim(),
            username: usernameFrom(email, db.profiles),
            role: input.role,
            department: input.department,
            level: input.level,
            student_id: input.student_id || null,
          },
        },
      });
      if (err) throw err;
      if (!data.session) return { needsConfirm: true };
      setSessionUserId(data.user?.id ?? null);
      await hydrateRemote(data.user?.id ?? null);
      return {};
    }
    if (db.profiles.some((p) => p.email.toLowerCase() === email)) throw new Error("That email is already registered.");
    const now = new Date().toISOString();
    const profile: Profile = {
      id: uid("u"),
      email,
      full_name: input.full_name.trim(),
      username: usernameFrom(email, db.profiles),
      student_id: input.student_id || null,
      department: input.department,
      level: input.level,
      role: (ADMIN_EMAILS as readonly string[]).includes(email) ? "admin" : input.role,
      bio: "",
      avatar_url: null,
      cover_url: null,
      is_verified: false,
      is_banned: false,
      ban_reason: null,
      last_seen: now,
      created_at: now,
    };
    const hashed = await sha256Hex(input.password);
    persist({ ...db, profiles: [...db.profiles, profile], passwords: { ...db.passwords, [email]: hashed } });
    rememberAccount({ userId: profile.id, email, full_name: profile.full_name, avatar_url: null });
    setDeviceAccounts(readAccounts());
    localStorage.setItem(SESSION_KEY, profile.id);
    setSessionUserId(profile.id);
    return {};
  };

  const signOut = async () => {
    if (backend === "supabase") await supabase.auth.signOut();
    if (me) deactivateAccount(me.id);
    setDeviceAccounts(readAccounts());
    localStorage.removeItem(SESSION_KEY);
    setSessionUserId(null);
  };

  const requestReset = async (email: string) => {
    if (backend === "supabase") {
      const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim());
      if (err) throw err;
    }
  };

  const updatePassword = async (password: string) => {
    const user = assertActive();
    if (password.length < 8) throw new Error("Use at least 8 characters.");
    if (backend === "supabase") {
      const { error: err } = await supabase.auth.updateUser({ password });
      if (err) throw err;
      return;
    }
    persist({ ...db, passwords: { ...db.passwords, [user.email]: await sha256Hex(password) } });
  };

  const bumpUsage = (base: LocalDB, userId: string, kind: UsageKind) => ({
    ...base,
    usage: [...(base.usage ?? []), { user_id: userId, kind, at: new Date().toISOString() }],
  });

  const updateMe = async (patch: Partial<Pick<Profile, "full_name" | "username" | "bio" | "department" | "level" | "student_id">>) => {
    const user = assertActive();
    const next = { ...user, ...patch, username: (patch.username || user.username).trim().toLowerCase() };
    if (next.username !== user.username) {
      assertWithinLimit(db.usage ?? [], user.id, "username");
      if (db.profiles.some((p) => p.id !== user.id && p.username === next.username)) throw new Error("That username is taken.");
    }
    if (next.full_name !== user.full_name) assertWithinLimit(db.usage ?? [], user.id, "full_name");
    if (next.bio !== user.bio) assertWithinLimit(db.usage ?? [], user.id, "bio");
    if (backend === "supabase") {
      const { error: err } = await supabase.from("profiles").update(patch).eq("id", user.id);
      if (err) throw err;
      await hydrateRemote(user.id);
      return;
    }
    let nextDb: LocalDB = { ...db, profiles: db.profiles.map((p) => (p.id === user.id ? next : p)) };
    if (next.username !== user.username) nextDb = bumpUsage(nextDb, user.id, "username");
    if (next.full_name !== user.full_name) nextDb = bumpUsage(nextDb, user.id, "full_name");
    if (next.bio !== user.bio) nextDb = bumpUsage(nextDb, user.id, "bio");
    persist(nextDb);
  };

  const setAvatar = async (blob: Blob) => {
    const user = assertActive();
    assertWithinLimit(db.usage ?? [], user.id, "avatar");
    const url = await storeBlob(backend, "avatars", user.id, blob);
    if (backend === "supabase") {
      await supabase.from("usage_events").insert({ user_id: user.id, kind: "avatar" });
      const { error: err } = await supabase.from("profiles").update({ avatar_url: url }).eq("id", user.id);
      if (err) throw err;
      await hydrateRemote(user.id);
      return;
    }
    persist(bumpUsage({ ...db, profiles: db.profiles.map((p) => (p.id === user.id ? { ...p, avatar_url: url } : p)) }, user.id, "avatar"));
  };

  const feed = (opts?: { groupId?: string | null; page?: number }) => {
    const page = opts?.page ?? 0;
    let posts = [...db.posts];
    posts = opts?.groupId ? posts.filter((p) => p.group_id === opts.groupId) : posts.filter((p) => !p.group_id);
    posts.sort((a, b) => (a.is_pinned !== b.is_pinned ? (a.is_pinned ? -1 : 1) : +new Date(b.created_at) - +new Date(a.created_at)));
    return enrichPosts(db, me?.id ?? null, posts.slice(0, (page + 1) * PAGE_SIZE));
  };

  const createPost = async (input: { content: string; files?: Blob[]; groupId?: string | null; announcement?: boolean }) => {
    const user = assertSpeak();
    if (input.announcement && user.role !== "admin") throw new Error("Only administrators can post official announcements.");
    const content = input.content.trim();
    const files = input.files ?? [];
    if (!content && !files.length) throw new Error("Write something or attach media.");
    if (files.length) assertWithinLimit(db.usage ?? [], user.id, "media");
    const media: { kind: "image" | "video" | "audio"; url: string }[] = [];
    for (const file of files) {
      const kind = file.type.startsWith("video") ? "video" : file.type.startsWith("audio") ? "audio" : "image";
      media.push({ kind, url: await blobToDataUrl(file) });
    }
    const image_url = media.find((m) => m.kind === "image")?.url ?? null;
    const now = new Date().toISOString();
    if (backend === "supabase") {
      const { error: err } = await supabase.from("posts").insert({
        author_id: user.id,
        content,
        image_url,
        media,
        is_announcement: !!input.announcement,
        is_pinned: !!input.announcement,
        group_id: input.groupId || null,
      });
      if (err) throw err;
      await hydrateRemote(user.id);
      return;
    }
    const post = {
      id: uid("p"),
      author_id: user.id,
      content,
      image_url,
      media,
      view_count: 0,
      share_count: 0,
      is_announcement: !!input.announcement,
      is_pinned: !!input.announcement,
      group_id: input.groupId || null,
      created_at: now,
    };
    persist(files.length ? bumpUsage({ ...db, posts: [post, ...db.posts] }, user.id, "media") : { ...db, posts: [post, ...db.posts] });
  };

  const deletePost = async (id: string) => {
    const user = assertActive();
    const post = db.posts.find((p) => p.id === id);
    if (!post) return;
    if (post.author_id !== user.id && user.role !== "admin") throw new Error("You cannot delete this post.");
    if (backend === "supabase") {
      const { error: err } = await supabase.from("posts").delete().eq("id", id);
      if (err) throw err;
      await hydrateRemote(user.id);
      return;
    }
    const next = { ...db, posts: db.posts.filter((p) => p.id !== id), comments: db.comments.filter((c) => c.post_id !== id), likes: db.likes.filter((l) => l.post_id !== id) };
    persist(user.role === "admin" ? log(next, user.id, "delete-post", id) : next);
  };

  const toggleLike = async (postId: string) => {
    const user = assertActive();
    const liked = db.likes.some((l) => l.post_id === postId && l.user_id === user.id);
    if (backend === "supabase") {
      const q = liked
        ? supabase.from("post_likes").delete().eq("post_id", postId).eq("user_id", user.id)
        : supabase.from("post_likes").insert({ post_id: postId, user_id: user.id });
      const { error: err } = await q;
      if (err) throw err;
      await hydrateRemote(user.id);
      return;
    }
    const likes = liked ? db.likes.filter((l) => !(l.post_id === postId && l.user_id === user.id)) : [...db.likes, { post_id: postId, user_id: user.id }];
    const post = db.posts.find((p) => p.id === postId);
    let next: LocalDB = { ...db, likes };
    if (!liked && post) next = notify(next, post.author_id, "like", `${user.full_name} liked your post.`, user.id, postId);
    persist(next);
  };

  const addComment = async (postId: string, content: string, parentId?: string | null) => {
    const user = assertSpeak();
    const text = content.trim();
    if (!text) return;
    if (backend === "supabase") {
      const { error: err } = await supabase.from("post_comments").insert({ post_id: postId, author_id: user.id, parent_id: parentId || null, content: text });
      if (err) throw err;
      await hydrateRemote(user.id);
      return;
    }
    const comment: Comment = { id: uid("c"), post_id: postId, author_id: user.id, parent_id: parentId || null, content: text, created_at: new Date().toISOString() };
    let next: LocalDB = { ...db, comments: [...db.comments, comment] };
    const post = db.posts.find((p) => p.id === postId);
    if (post) next = notify(next, post.author_id, "comment", `${user.full_name} commented on your post.`, user.id, postId);
    persist(next);
  };

  const deleteComment = async (id: string) => {
    const user = assertActive();
    const c = db.comments.find((x) => x.id === id);
    if (!c) return;
    if (c.author_id !== user.id && user.role !== "admin") throw new Error("You cannot delete this comment.");
    if (backend === "supabase") {
      const { error: err } = await supabase.from("post_comments").delete().eq("id", id);
      if (err) throw err;
      await hydrateRemote(user.id);
      return;
    }
    persist({ ...db, comments: db.comments.filter((x) => x.id !== id && x.parent_id !== id) });
  };

  const commentsFor = (postId: string) => {
    const profiles = new Map(db.profiles.map((p) => [p.id, p]));
    return db.comments
      .filter((c) => c.post_id === postId)
      .sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at))
      .map((c) => ({ ...c, author: profiles.get(c.author_id)! }))
      .filter((c) => c.author);
  };

  const createGroup = async (input: { name: string; description: string; category: string; cover?: Blob | null; avatar?: Blob | null }) => {
    const user = assertActive();
    const name = input.name.trim();
    if (name.length < 3) throw new Error("Give the group a longer name.");
    const cover_url = input.cover ? await blobToDataUrl(input.cover) : null;
    const avatar_url = input.avatar ? await blobToDataUrl(input.avatar) : null;
    const slug = `${slugify(name)}-${Math.random().toString(16).slice(2, 5)}`;
    if (backend === "supabase") {
      const { data, error: err } = await supabase.from("groups").insert({ name, slug, description: input.description.trim(), category: input.category, cover_url, avatar_url, created_by: user.id }).select("*").single();
      if (err) throw err;
      await supabase.from("group_members").insert({ group_id: data.id, user_id: user.id, role: "owner" });
      await hydrateRemote(user.id);
      return data as Group;
    }
    const group: Group = { id: uid("g"), name, slug, description: input.description.trim(), avatar_url, cover_url, category: input.category, created_by: user.id, created_at: new Date().toISOString() };
    persist({
      ...db,
      groups: [group, ...db.groups],
      groupMembers: [{ group_id: group.id, user_id: user.id, role: "owner", joined_at: group.created_at }, ...db.groupMembers],
    });
    return group;
  };

  const joinGroup = async (groupId: string) => {
    const user = assertActive();
    if (db.groupMembers.some((m) => m.group_id === groupId && m.user_id === user.id)) return;
    if (backend === "supabase") {
      const { error: err } = await supabase.from("group_members").insert({ group_id: groupId, user_id: user.id, role: "member" });
      if (err) throw err;
      await hydrateRemote(user.id);
      return;
    }
    persist({ ...db, groupMembers: [{ group_id: groupId, user_id: user.id, role: "member", joined_at: new Date().toISOString() }, ...db.groupMembers] });
  };

  const leaveGroup = async (groupId: string) => {
    const user = assertActive();
    if (backend === "supabase") {
      const { error: err } = await supabase.from("group_members").delete().eq("group_id", groupId).eq("user_id", user.id);
      if (err) throw err;
      await hydrateRemote(user.id);
      return;
    }
    persist({ ...db, groupMembers: db.groupMembers.filter((m) => !(m.group_id === groupId && m.user_id === user.id)) });
  };

  const groupRoleOf = (groupId: string, userId: string) => db.groupMembers.find((m) => m.group_id === groupId && m.user_id === userId)?.role;
  const assertGroupManager = (groupId: string) => {
    const user = assertActive();
    const role = groupRoleOf(groupId, user.id);
    if (user.role === "admin" || role === "owner" || role === "admin") return user;
    throw new Error("Only a group admin can do that.");
  };

  const updateGroup = async (groupId: string, patch: { name?: string; description?: string; cover?: Blob | null; avatar?: Blob | null }) => {
    const user = assertGroupManager(groupId);
    const current = db.groups.find((g) => g.id === groupId);
    if (!current) throw new Error("Group not found.");
    const name = patch.name?.trim() || current.name;
    const description = patch.description !== undefined ? patch.description.trim() : current.description;
    const cover_url = patch.cover ? await blobToDataUrl(patch.cover) : current.cover_url;
    const avatar_url = patch.avatar ? await blobToDataUrl(patch.avatar) : current.avatar_url ?? null;
    if (backend === "supabase") {
      const { error: err } = await supabase.from("groups").update({ name, description, cover_url, avatar_url }).eq("id", groupId);
      if (err) throw err;
      await hydrateRemote(user.id);
      return;
    }
    persist({ ...db, groups: db.groups.map((g) => (g.id === groupId ? { ...g, name, description, cover_url, avatar_url } : g)) });
  };

  const setGroupMemberRole = async (groupId: string, userId: string, role: "admin" | "member") => {
    const user = assertGroupManager(groupId);
    if (groupRoleOf(groupId, userId) === "owner") throw new Error("The owner cannot be changed.");
    if (backend === "supabase") {
      const { error: err } = await supabase.from("group_members").update({ role }).eq("group_id", groupId).eq("user_id", userId);
      if (err) throw err;
      await hydrateRemote(user.id);
      return;
    }
    persist({ ...db, groupMembers: db.groupMembers.map((m) => (m.group_id === groupId && m.user_id === userId ? { ...m, role } : m)) });
  };

  const removeGroupMember = async (groupId: string, userId: string) => {
    const user = assertGroupManager(groupId);
    if (groupRoleOf(groupId, userId) === "owner") throw new Error("The owner cannot be removed.");
    if (backend === "supabase") {
      const { error: err } = await supabase.from("group_members").delete().eq("group_id", groupId).eq("user_id", userId);
      if (err) throw err;
      await hydrateRemote(user.id);
      return;
    }
    persist({ ...db, groupMembers: db.groupMembers.filter((m) => !(m.group_id === groupId && m.user_id === userId)) });
  };

  const sendGroupMessage = async (groupId: string, body: string, media?: ChatMedia | null) => {
    const user = assertSpeak();
    if (!db.groupMembers.some((m) => m.group_id === groupId && m.user_id === user.id)) throw new Error("Join the group before sending a message.");
    const text = body.trim();
    guardMedia(media);
    if (!text && !media?.imageUrl && !media?.audioUrl) return;
    const expires_at = chatExpiresAt();
    const row = { group_id: groupId, sender_id: user.id, body: text, image_url: media?.imageUrl || null, audio_url: media?.audioUrl || null, audio_seconds: media?.audioSeconds || null, expires_at };
    if (backend === "supabase") {
      const { error: err } = await supabase.from("group_messages").insert(row);
      if (err) throw err;
      await hydrateRemote(user.id);
      return;
    }
    persist({
      ...db,
      groupMessages: [...(db.groupMessages ?? []), { ...row, id: uid("gm"), created_at: new Date().toISOString() }],
    });
  };

  const deleteGroupMessage = async (id: string) => {
    const user = assertActive();
    const msg = (db.groupMessages ?? []).find((m) => m.id === id);
    if (!msg) return;
    const role = groupRoleOf(msg.group_id, user.id);
    if (!(user.role === "admin" || role === "owner" || role === "admin" || msg.sender_id === user.id)) throw new Error("You cannot delete this message.");
    if (backend === "supabase") {
      const { error: err } = await supabase.from("group_messages").delete().eq("id", id);
      if (err) throw err;
      await hydrateRemote(user.id);
      return;
    }
    persist({
      ...db,
      groupMessages: (db.groupMessages ?? []).filter((m) => m.id !== id),
      groupMessageReactions: (db.groupMessageReactions ?? []).filter((r) => r.message_id !== id),
    });
  };

  const reactToGroupMessage = async (messageId: string, emoji: string) => {
    const user = assertActive();
    const current = (db.groupMessageReactions ?? []).find((r) => r.message_id === messageId && r.user_id === user.id);
    if (backend === "supabase") {
      if (current?.emoji === emoji) await supabase.from("group_message_reactions").delete().eq("message_id", messageId).eq("user_id", user.id);
      else if (current) await supabase.from("group_message_reactions").update({ emoji }).eq("message_id", messageId).eq("user_id", user.id);
      else await supabase.from("group_message_reactions").insert({ message_id: messageId, user_id: user.id, emoji });
      await hydrateRemote(user.id);
      return;
    }
    const groupMessageReactions = (db.groupMessageReactions ?? []).filter((r) => !(r.message_id === messageId && r.user_id === user.id));
    if (!current || current.emoji !== emoji) groupMessageReactions.push({ message_id: messageId, user_id: user.id, emoji });
    persist({ ...db, groupMessageReactions });
  };

  const createEvent = async (input: { title: string; description: string; location: string; starts_at: string; ends_at: string; image?: Blob | null }) => {
    const user = assertActive();
    const image_url = input.image ? await blobToDataUrl(input.image) : null;
    if (backend === "supabase") {
      const { error: err } = await supabase.from("events").insert({ title: input.title.trim(), description: input.description.trim(), location: input.location.trim(), starts_at: input.starts_at, ends_at: input.ends_at, image_url, created_by: user.id });
      if (err) throw err;
      await hydrateRemote(user.id);
      return;
    }
    const event: CampusEvent = { id: uid("e"), title: input.title.trim(), description: input.description.trim(), location: input.location.trim(), starts_at: input.starts_at, ends_at: input.ends_at, image_url, created_by: user.id, created_at: new Date().toISOString() };
    persist({ ...db, events: [...db.events, event] });
  };

  const updateEvent = async (id: string, patch: { title?: string; description?: string; image?: Blob | null }) => {
    const admin = requireAdmin();
    const current = db.events.find((e) => e.id === id);
    if (!current) return;
    const image_url = patch.image ? await blobToDataUrl(patch.image) : current.image_url;
    const next = { ...current, title: patch.title?.trim() || current.title, description: patch.description?.trim() ?? current.description, image_url };
    if (backend === "supabase") {
      const { error: err } = await supabase.from("events").update({ title: next.title, description: next.description, image_url }).eq("id", id);
      if (err) throw err;
      await hydrateRemote(admin.id);
      return;
    }
    persist(log({ ...db, events: db.events.map((e) => (e.id === id ? next : e)) }, admin.id, "edit-event", id));
  };

  const rsvp = async (eventId: string, status: RsvpStatus) => {
    const user = assertActive();
    if (backend === "supabase") {
      const { error: err } = await supabase.from("event_rsvps").upsert({ event_id: eventId, user_id: user.id, status });
      if (err) throw err;
      await hydrateRemote(user.id);
      return;
    }
    const rest = db.rsvps.filter((r) => !(r.event_id === eventId && r.user_id === user.id));
    persist({ ...db, rsvps: [...rest, { event_id: eventId, user_id: user.id, status }] });
  };

  const search = (q: string) => {
    const needle = q.trim().toLowerCase();
    if (!needle) return { people: [], posts: [], groups: [] };
    return {
      people: db.profiles.filter((p) => `${p.full_name} ${p.username} ${p.department ?? ""}`.toLowerCase().includes(needle)).slice(0, 20),
      posts: enrichPosts(db, me?.id ?? null, db.posts.filter((p) => p.content.toLowerCase().includes(needle)).slice(0, 20)),
      groups: db.groups.filter((g) => `${g.name} ${g.description}`.toLowerCase().includes(needle)).slice(0, 20),
    };
  };

  const openConversation = async (otherId: string) => {
    const user = assertActive();
    if (otherId === user.id) throw new Error("You cannot message yourself.");
    const friend = friendshipBetween(db.friendships ?? [], user.id, otherId);
    if (friend?.status !== "accepted" && user.role !== "admin") throw new Error("Add them as a friend before chatting.");
    const existing = db.conversations.find((c) => {
      const members = db.convMembers.filter((m) => m.conversation_id === c.id).map((m) => m.user_id);
      return members.length === 2 && members.includes(user.id) && members.includes(otherId);
    });
    if (existing) return existing.id;
    if (backend === "supabase") {
      const { data, error: err } = await supabase.from("conversations").insert({}).select("*").single();
      if (err) throw err;
      await supabase.from("conversation_members").insert([{ conversation_id: data.id, user_id: user.id }, { conversation_id: data.id, user_id: otherId }]);
      await hydrateRemote(user.id);
      return data.id as string;
    }
    const id = uid("cv");
    persist({
      ...db,
      conversations: [...db.conversations, { id, created_at: new Date().toISOString() }],
      convMembers: [...db.convMembers, { conversation_id: id, user_id: user.id }, { conversation_id: id, user_id: otherId }],
    });
    return id;
  };

  const sendMessage = async (conversationId: string, body: string, media?: ChatMedia | null) => {
    const user = assertSpeak();
    if (!db.convMembers.some((m) => m.conversation_id === conversationId && m.user_id === user.id)) throw new Error("You are not in this chat.");
    const text = body.trim();
    guardMedia(media);
    if (!text && !media?.imageUrl && !media?.audioUrl) return;
    const expires_at = chatExpiresAt();
    const row = { conversation_id: conversationId, sender_id: user.id, body: text, image_url: media?.imageUrl || null, audio_url: media?.audioUrl || null, audio_seconds: media?.audioSeconds || null, expires_at, read_at: null as string | null };
    if (backend === "supabase") {
      const { error: err } = await supabase.from("messages").insert({ ...row, read_at: null });
      if (err) throw err;
      await hydrateRemote(user.id);
      return;
    }
    const msg: Message = { ...row, id: uid("m"), created_at: new Date().toISOString() };
    const other = db.convMembers.find((m) => m.conversation_id === conversationId && m.user_id !== user.id);
    let next: LocalDB = { ...db, messages: [...db.messages, msg] };
    if (other) next = notify(next, other.user_id, "message", `${user.full_name} sent you a message.`, user.id, conversationId);
    persist(next);
  };

  const markConversationRead = async (conversationId: string) => {
    const user = me;
    if (!user) return;
    const now = new Date().toISOString();
    if (backend === "supabase") {
      await supabase.from("messages").update({ read_at: now }).eq("conversation_id", conversationId).neq("sender_id", user.id).is("read_at", null);
      return;
    }
    const changed = db.messages.some((m) => m.conversation_id === conversationId && m.sender_id !== user.id && !m.read_at);
    if (!changed) return;
    persist({
      ...db,
      messages: db.messages.map((m) => (m.conversation_id === conversationId && m.sender_id !== user.id && !m.read_at ? { ...m, read_at: now } : m)),
    });
  };

  const reactToMessage = async (messageId: string, emoji: string) => {
    const user = assertActive();
    const current = (db.messageReactions ?? []).find((r) => r.message_id === messageId && r.user_id === user.id);
    if (backend === "supabase") {
      if (current?.emoji === emoji) await supabase.from("message_reactions").delete().eq("message_id", messageId).eq("user_id", user.id);
      else if (current) await supabase.from("message_reactions").update({ emoji }).eq("message_id", messageId).eq("user_id", user.id);
      else await supabase.from("message_reactions").insert({ message_id: messageId, user_id: user.id, emoji });
      await hydrateRemote(user.id);
      return;
    }
    const messageReactions = (db.messageReactions ?? []).filter((r) => !(r.message_id === messageId && r.user_id === user.id));
    if (!current || current.emoji !== emoji) messageReactions.push({ message_id: messageId, user_id: user.id, emoji });
    persist({ ...db, messageReactions });
  };

  const recordPostStat = async (postId: string, kind: "view" | "share") => {
    const field = kind === "view" ? "view_count" : "share_count";
    const post = db.posts.find((p) => p.id === postId);
    if (!post) return;
    if (kind === "view" && me && post.author_id === me.id) return;
    const nextCount = ((post[field] as number | undefined) ?? 0) + 1;
    if (backend === "supabase") {
      await supabase.from("posts").update({ [field]: nextCount }).eq("id", postId);
      return;
    }
    persist({ ...db, posts: db.posts.map((p) => (p.id === postId ? { ...p, [field]: nextCount } : p)) });
  };

  const report = async (targetType: ReportTarget, targetId: string, reason: string, details: string) => {
    const user = assertActive();
    if (backend === "supabase") {
      const { error: err } = await supabase.from("reports").insert({ reporter_id: user.id, target_type: targetType, target_id: targetId, reason, details });
      if (err) throw err;
      await hydrateRemote(user.id);
      return;
    }
    const row: Report = { id: uid("r"), reporter_id: user.id, target_type: targetType, target_id: targetId, reason, details, status: "open", created_at: new Date().toISOString(), resolved_by: null, resolution: null };
    persist({ ...db, reports: [row, ...db.reports] });
  };

  const markNotificationsRead = async () => {
    if (!me) return;
    if (backend === "supabase") {
      await supabase.from("notifications").update({ read: true }).eq("user_id", me.id).eq("read", false);
      return;
    }
    persist({ ...db, notifications: db.notifications.map((n) => (n.user_id === me.id ? { ...n, read: true } : n)) });
  };

  const patchProfile = async (userId: string, patch: Partial<Profile>, action: string) => {
    const admin = requireAdmin();
    if (backend === "supabase") {
      const { error: err } = await supabase.from("profiles").update(patch).eq("id", userId);
      if (err) throw err;
      await hydrateRemote(admin.id);
      return;
    }
    persist(log({ ...db, profiles: db.profiles.map((p) => (p.id === userId ? { ...p, ...patch } : p)) }, admin.id, action, userId));
  };

  const banUser = (userId: string, banned: boolean, reason?: string) => patchProfile(userId, { is_banned: banned, ban_reason: banned ? reason || "Restricted" : null }, banned ? "ban" : "unban");
  const verifyUser = (userId: string, verified: boolean) => patchProfile(userId, { is_verified: verified }, verified ? "verify" : "unverify");
  const muteUser = (userId: string, muted: boolean) => patchProfile(userId, { is_muted: muted }, muted ? "mute" : "unmute");
  const setRole = (userId: string, role: Role) => patchProfile(userId, { role }, "role");
  const strikeUser = async (userId: string) => {
    const target = db.profiles.find((p) => p.id === userId);
    const strikes = (target?.strikes ?? 0) + 1;
    await patchProfile(userId, { strikes, is_banned: strikes >= 3, ban_reason: strikes >= 3 ? "Three strikes" : target?.ban_reason ?? null }, "strike");
  };
  const forceLogout = (userId: string) => patchProfile(userId, { revoked_at: new Date().toISOString() }, "revoke");

  const deleteEvent = async (id: string) => {
    const admin = requireAdmin();
    if (backend === "supabase") {
      const { error: err } = await supabase.from("events").delete().eq("id", id);
      if (err) throw err;
      await hydrateRemote(admin.id);
      return;
    }
    persist(log({ ...db, events: db.events.filter((e) => e.id !== id), rsvps: db.rsvps.filter((r) => r.event_id !== id) }, admin.id, "delete-event", id));
  };

  const deleteGroup = async (id: string) => {
    const user = assertGroupManager(id);
    if (backend === "supabase") {
      const { error: err } = await supabase.from("groups").delete().eq("id", id);
      if (err) throw err;
      await hydrateRemote(user.id);
      return;
    }
    const dropped = new Set((db.groupMessages ?? []).filter((m) => m.group_id === id).map((m) => m.id));
    persist(log({
      ...db,
      groups: db.groups.filter((g) => g.id !== id),
      groupMembers: db.groupMembers.filter((m) => m.group_id !== id),
      groupMessages: (db.groupMessages ?? []).filter((m) => m.group_id !== id),
      groupMessageReactions: (db.groupMessageReactions ?? []).filter((r) => !dropped.has(r.message_id)),
    }, user.id, "delete-group", id));
  };

  const deleteMessage = async (id: string) => {
    const admin = requireAdmin();
    if (backend === "supabase") {
      const { error: err } = await supabase.from("messages").delete().eq("id", id);
      if (err) throw err;
      await hydrateRemote(admin.id);
      return;
    }
    persist(log({ ...db, messages: db.messages.filter((m) => m.id !== id), messageReactions: (db.messageReactions ?? []).filter((r) => r.message_id !== id) }, admin.id, "delete-message", id));
  };

  const deleteStory = async (id: string) => {
    const user = assertActive();
    const story = (db.stories ?? []).find((s) => s.id === id);
    if (!story) return;
    if (story.author_id !== user.id && user.role !== "admin") throw new Error("You cannot delete this story.");
    if (backend === "supabase") {
      const { error: err } = await supabase.from("stories").delete().eq("id", id);
      if (err) throw err;
      await hydrateRemote(user.id);
      return;
    }
    persist({ ...db, stories: db.stories.filter((s) => s.id !== id), storyViews: (db.storyViews ?? []).filter((v) => v.story_id !== id) });
  };

  const updatePage = async (slug: string, patch: Partial<Pick<SitePage, "title" | "body">>) => {
    const admin = requireAdmin();
    if (backend === "supabase") {
      const { error: err } = await supabase.from("site_pages").update({ ...patch, updated_at: new Date().toISOString() }).eq("slug", slug);
      if (err) throw err;
      await hydrateRemote(admin.id);
      return;
    }
    persist(log({ ...db, pages: (db.pages ?? []).map((p) => (p.slug === slug ? { ...p, ...patch, updated_at: new Date().toISOString() } : p)) }, admin.id, "edit-page", slug));
  };

  const updateSettings = async (patch: Partial<SiteSettings> & { images?: Partial<SiteSettings["images"]> }) => {
    const admin = requireAdmin();
    const settings: SiteSettings = { ...db.settings, ...patch, images: { ...db.settings.images, ...(patch.images ?? {}) } };
    if (backend === "supabase") {
      const { error: err } = await supabase.from("site_settings").upsert({ id: 1, maintenance: settings.maintenance, maintenance_message: settings.maintenance_message, images: settings.images });
      if (err) throw err;
      await hydrateRemote(admin.id);
      return;
    }
    persist(log({ ...db, settings }, admin.id, "settings", "updated"));
  };

  const saveArticle = async (input: Partial<Article> & { title: string; body: string }) => {
    const admin = requireAdmin();
    const now = new Date().toISOString();
    const slug = (input.slug || input.title).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 60) || uid("article");
    if (backend === "supabase") {
      const payload = { title: input.title, body: input.body, excerpt: input.excerpt || input.body.slice(0, 140), cover_url: input.cover_url ?? null, published: input.published ?? true, slug, updated_at: now };
      const q = input.id ? supabase.from("articles").update(payload).eq("id", input.id) : supabase.from("articles").insert(payload);
      const { error: err } = await q;
      if (err) throw err;
      await hydrateRemote(admin.id);
      return;
    }
    const articles = input.id
      ? (db.articles ?? []).map((a) => (a.id === input.id ? { ...a, ...input, slug, updated_at: now } : a))
      : [{ id: uid("art"), slug, title: input.title, body: input.body, excerpt: input.excerpt || input.body.slice(0, 140), cover_url: input.cover_url ?? null, published: input.published ?? true, created_at: now, updated_at: now }, ...(db.articles ?? [])];
    persist(log({ ...db, articles }, admin.id, "article", slug));
  };

  const deleteArticle = async (id: string) => {
    const admin = requireAdmin();
    if (backend === "supabase") {
      const { error: err } = await supabase.from("articles").delete().eq("id", id);
      if (err) throw err;
      await hydrateRemote(admin.id);
      return;
    }
    persist(log({ ...db, articles: (db.articles ?? []).filter((a) => a.id !== id) }, admin.id, "delete-article", id));
  };

  const follow = async (userId: string) => {
    const user = assertActive();
    if (userId === user.id) return;
    const exists = (db.follows ?? []).some((f) => f.follower_id === user.id && f.following_id === userId);
    if (backend === "supabase") {
      const q = exists
        ? supabase.from("follows").delete().eq("follower_id", user.id).eq("following_id", userId)
        : supabase.from("follows").insert({ follower_id: user.id, following_id: userId });
      const { error: err } = await q;
      if (err) throw err;
      await hydrateRemote(user.id);
      return;
    }
    const follows = exists
      ? db.follows.filter((f) => !(f.follower_id === user.id && f.following_id === userId))
      : [...(db.follows ?? []), { follower_id: user.id, following_id: userId, created_at: new Date().toISOString() }];
    persist({ ...db, follows });
  };

  const requestFriend = async (userId: string) => {
    const user = assertActive();
    const existing = friendshipBetween(db.friendships ?? [], user.id, userId);
    if (existing?.status === "accepted") return;
    if (existing?.status === "pending" && existing.addressee_id === user.id) {
      await respondFriend(existing.id, "accepted");
      return;
    }
    if (existing) throw new Error("A request is already waiting.");
    if (backend === "supabase") {
      const { error: err } = await supabase.from("friendships").insert({ requester_id: user.id, addressee_id: userId, status: "pending" });
      if (err) throw err;
      await hydrateRemote(user.id);
      return;
    }
    const row = { id: uid("fr"), requester_id: user.id, addressee_id: userId, status: "pending" as const, created_at: new Date().toISOString() };
    persist(notify({ ...db, friendships: [...(db.friendships ?? []), row] }, userId, "friend", `${user.full_name} sent a friend request.`, user.id, row.id));
  };

  const respondFriend = async (id: string, status: "accepted" | "rejected") => {
    const user = assertActive();
    const row = (db.friendships ?? []).find((f) => f.id === id);
    if (!row || row.addressee_id !== user.id) throw new Error("That request is not yours.");
    if (backend === "supabase") {
      const { error: err } = await supabase.from("friendships").update({ status }).eq("id", id);
      if (err) throw err;
      await hydrateRemote(user.id);
      return;
    }
    let next: LocalDB = { ...db, friendships: db.friendships.map((f) => (f.id === id ? { ...f, status } : f)) };
    if (status === "accepted") next = notify(next, row.requester_id, "friend", `${user.full_name} accepted your friend request.`, user.id, id);
    persist(next);
  };

  const addStory = async (input: { kind: "photo" | "video" | "text"; blob?: Blob | null; caption?: string }) => {
    const user = assertSpeak();
    assertWithinLimit(db.usage ?? [], user.id, "story");
    const caption = (input.caption || "").slice(0, 140);
    if (input.kind === "text" && caption.length < 1) throw new Error("Write a short note.");
    const media_url = input.kind === "text" || !input.blob ? "" : await blobToDataUrl(input.blob);
    const now = new Date();
    const story = { id: uid("s"), author_id: user.id, media_url, kind: input.kind, caption, created_at: now.toISOString(), expires_at: new Date(now.getTime() + 24 * 3600_000).toISOString() };
    if (backend === "supabase") {
      const { error: err } = await supabase.from("stories").insert({ author_id: user.id, media_url, kind: input.kind, caption, expires_at: story.expires_at });
      if (err) throw err;
      await supabase.from("usage_events").insert({ user_id: user.id, kind: "story" });
      await hydrateRemote(user.id);
      return;
    }
    persist(bumpUsage({ ...db, stories: [...(db.stories ?? []), story] }, user.id, "story"));
  };

  const viewStory = async (storyId: string) => {
    const user = me;
    if (!user) return;
    if ((db.storyViews ?? []).some((v) => v.story_id === storyId && v.viewer_id === user.id)) return;
    const story = (db.stories ?? []).find((s) => s.id === storyId);
    if (!story || story.author_id === user.id) return;
    if (backend === "supabase") {
      await supabase.from("story_views").insert({ story_id: storyId, viewer_id: user.id });
      return;
    }
    persist({ ...db, storyViews: [...(db.storyViews ?? []), { story_id: storyId, viewer_id: user.id, viewed_at: new Date().toISOString() }] });
  };

  const toggleReaction = async (postId: string, emoji: string) => {
    const user = assertActive();
    const current = (db.reactions ?? []).find((r) => r.post_id === postId && r.user_id === user.id);
    if (backend === "supabase") {
      if (current?.emoji === emoji) await supabase.from("reactions").delete().eq("post_id", postId).eq("user_id", user.id);
      else if (current) await supabase.from("reactions").update({ emoji }).eq("post_id", postId).eq("user_id", user.id);
      else await supabase.from("reactions").insert({ post_id: postId, user_id: user.id, emoji });
      await hydrateRemote(user.id);
      return;
    }
    const reactions = (db.reactions ?? []).filter((r) => !(r.post_id === postId && r.user_id === user.id));
    if (!current || current.emoji !== emoji) reactions.push({ post_id: postId, user_id: user.id, emoji });
    persist({ ...db, reactions });
  };

  const toggleSave = async (postId: string) => {
    const user = assertActive();
    const saved = (db.saves ?? []).some((s) => s.post_id === postId && s.user_id === user.id);
    if (backend === "supabase") {
      const q = saved ? supabase.from("saves").delete().eq("post_id", postId).eq("user_id", user.id) : supabase.from("saves").insert({ post_id: postId, user_id: user.id });
      const { error: err } = await q;
      if (err) throw err;
      await hydrateRemote(user.id);
      return;
    }
    persist({ ...db, saves: saved ? db.saves.filter((s) => !(s.post_id === postId && s.user_id === user.id)) : [...(db.saves ?? []), { post_id: postId, user_id: user.id }] });
  };

  const toggleCommentLike = async (commentId: string) => {
    const user = assertActive();
    const liked = (db.commentLikes ?? []).some((c) => c.comment_id === commentId && c.user_id === user.id);
    if (backend === "supabase") {
      const q = liked
        ? supabase.from("comment_likes").delete().eq("comment_id", commentId).eq("user_id", user.id)
        : supabase.from("comment_likes").insert({ comment_id: commentId, user_id: user.id });
      const { error: err } = await q;
      if (err) throw err;
      await hydrateRemote(user.id);
      return;
    }
    persist({
      ...db,
      commentLikes: liked
        ? db.commentLikes.filter((c) => !(c.comment_id === commentId && c.user_id === user.id))
        : [...(db.commentLikes ?? []), { comment_id: commentId, user_id: user.id }],
    });
  };

  const visibleStories = () => {
    const now = Date.now();
    return (db.stories ?? []).filter((s) => {
      if (new Date(s.expires_at).getTime() <= now) return false;
      if (!me) return false;
      if (s.author_id === me.id || me.role === "admin") return true;
      return friendshipBetween(db.friendships ?? [], me.id, s.author_id)?.status === "accepted";
    });
  };

  const usageLeft = (kind: UsageKind) => (me ? Math.max(0, LIMITS[kind].max - usageCount(db.usage ?? [], me.id, kind)) : 0);

  const switchAccount = (userId: string) => {
    const account = readAccounts().find((a) => a.userId === userId);
    if (!account) return null;
    const profile = db.profiles.find((p) => p.id === userId);
    if (!account.active || (profile?.revoked_at && account.at < profile.revoked_at)) return { needsLogin: true, email: account.email };
    localStorage.setItem(SESSION_KEY, userId);
    setSessionUserId(userId);
    return { needsLogin: false, email: account.email };
  };

  const resolveReport = async (id: string, status: ReportStatus, resolution: string) => {
    const user = requireAdmin();
    if (backend === "supabase") {
      const { error: err } = await supabase.from("reports").update({ status, resolution, resolved_by: user.id }).eq("id", id);
      if (err) throw err;
      await hydrateRemote(user.id);
      return;
    }
    persist({ ...db, reports: db.reports.map((r) => (r.id === id ? { ...r, status, resolution, resolved_by: user.id } : r)) });
  };

  const profileById = (id: string) => db.profiles.find((p) => p.id === id);
  const isOnline = (id: string) => onlineIds.includes(id);

  const value = useMemo<HubContextValue>(
    () => ({
      ready, backend, me, db, onlineIds, error, signIn, signUp, signOut, requestReset, updatePassword, updateMe, setAvatar, feed, createPost, deletePost, toggleLike, addComment, deleteComment, commentsFor, createGroup, joinGroup, leaveGroup, updateGroup, setGroupMemberRole, removeGroupMember, sendGroupMessage, deleteGroupMessage, reactToGroupMessage, createEvent, updateEvent, rsvp, search, openConversation, sendMessage, markConversationRead, reactToMessage, recordPostStat, report, markNotificationsRead, banUser, verifyUser, strikeUser, muteUser, setRole, forceLogout, deleteEvent, deleteGroup, deleteMessage, deleteStory, updatePage, updateSettings, saveArticle, deleteArticle, follow, requestFriend, respondFriend, addStory, viewStory, toggleReaction, toggleSave, toggleCommentLike, visibleStories, usageLeft, deviceAccounts, switchAccount, resolveReport, profileById, isOnline, refresh,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ready, backend, me, db, onlineIds, error, refresh, deviceAccounts],
  );

  return <HubContext.Provider value={value}>{children}</HubContext.Provider>;
}

export function useHub() {
  const ctx = useContext(HubContext);
  if (!ctx) throw new Error("useHub must be used within HubProvider");
  return ctx;
}
