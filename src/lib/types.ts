export type Role = "student" | "staff" | "alumni" | "admin";
export type RsvpStatus = "going" | "maybe" | "declined";
export type ReportTarget = "user" | "post" | "comment";
export type ReportStatus = "open" | "resolved" | "dismissed";
export type GroupMemberRole = "owner" | "admin" | "member";
export type FriendStatus = "pending" | "accepted" | "rejected";
export type UsageKind = "avatar" | "username" | "full_name" | "bio" | "story" | "media";
export type MediaKind = "image" | "video" | "audio";

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  username: string;
  student_id: string | null;
  department: string | null;
  level: string | null;
  role: Role;
  bio: string;
  avatar_url: string | null;
  cover_url: string | null;
  is_verified: boolean;
  is_banned: boolean;
  ban_reason: string | null;
  strikes?: number;
  is_muted?: boolean;
  revoked_at?: string | null;
  last_seen: string;
  created_at: string;
}

export interface MediaItem {
  kind: MediaKind;
  url: string;
}

export interface Post {
  id: string;
  author_id: string;
  content: string;
  image_url: string | null;
  media?: MediaItem[];
  view_count?: number;
  share_count?: number;
  is_announcement: boolean;
  is_pinned: boolean;
  group_id: string | null;
  created_at: string;
}

export interface Comment {
  id: string;
  post_id: string;
  author_id: string;
  parent_id?: string | null;
  content: string;
  created_at: string;
}

export interface Like {
  post_id: string;
  user_id: string;
}

export interface Reaction {
  post_id: string;
  user_id: string;
  emoji: string;
}

export interface Save {
  post_id: string;
  user_id: string;
}

export interface CommentLike {
  comment_id: string;
  user_id: string;
}

export interface Follow {
  follower_id: string;
  following_id: string;
  created_at: string;
}

export interface Friendship {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: FriendStatus;
  created_at: string;
}

export type StoryKind = "photo" | "video" | "text";

export interface Story {
  id: string;
  author_id: string;
  media_url: string;
  kind?: StoryKind;
  caption?: string;
  created_at: string;
  expires_at: string;
}

export interface StoryView {
  story_id: string;
  viewer_id: string;
  viewed_at: string;
}

export interface MessageReaction {
  message_id: string;
  user_id: string;
  emoji: string;
}

export interface ActivityLog {
  id: string;
  actor_id: string;
  action: string;
  detail: string;
  created_at: string;
}

export interface SitePage {
  slug: string;
  title: string;
  body: string;
  updated_at: string;
}

export interface Article {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  cover_url: string | null;
  published: boolean;
  created_at: string;
  updated_at: string;
}

export interface SiteSettings {
  maintenance: boolean;
  maintenance_message: string;
  images: {
    hero: string;
    rector: string;
    registrar: string;
    deputyAcademics: string;
    deputyAdmin: string;
    librarian: string;
    bursar: string;
    workshop: string;
    library: string;
    sports: string;
    auditorium: string;
  };
}

export interface UsageEvent {
  user_id: string;
  kind: UsageKind;
  at: string;
}

export interface Group {
  id: string;
  name: string;
  slug: string;
  description: string;
  avatar_url?: string | null;
  cover_url: string | null;
  category: string;
  created_by: string;
  created_at: string;
}

export interface GroupMember {
  group_id: string;
  user_id: string;
  role: GroupMemberRole;
  joined_at: string;
}

export interface GroupMessage {
  id: string;
  group_id: string;
  sender_id: string;
  body: string;
  image_url: string | null;
  audio_url?: string | null;
  audio_seconds?: number | null;
  expires_at?: string | null;
  created_at: string;
}

export interface GroupMessageReaction {
  message_id: string;
  user_id: string;
  emoji: string;
}

export interface CampusEvent {
  id: string;
  title: string;
  description: string;
  location: string;
  starts_at: string;
  ends_at: string;
  image_url: string | null;
  created_by: string;
  created_at: string;
}

export interface Rsvp {
  event_id: string;
  user_id: string;
  status: RsvpStatus;
}

export interface Conversation {
  id: string;
  created_at: string;
}

export interface ConversationMember {
  conversation_id: string;
  user_id: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  image_url?: string | null;
  audio_url?: string | null;
  audio_seconds?: number | null;
  expires_at?: string | null;
  created_at: string;
  read_at: string | null;
}

export interface Report {
  id: string;
  reporter_id: string;
  target_type: ReportTarget;
  target_id: string;
  reason: string;
  details: string;
  status: ReportStatus;
  created_at: string;
  resolved_by: string | null;
  resolution: string | null;
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  actor_id: string | null;
  entity_id: string | null;
  message: string;
  read: boolean;
  created_at: string;
}

export interface LocalDB {
  profiles: Profile[];
  posts: Post[];
  comments: Comment[];
  likes: Like[];
  reactions: Reaction[];
  saves: Save[];
  commentLikes: CommentLike[];
  follows: Follow[];
  friendships: Friendship[];
  stories: Story[];
  storyViews: StoryView[];
  messageReactions: MessageReaction[];
  logs: ActivityLog[];
  pages: SitePage[];
  articles: Article[];
  settings: SiteSettings;
  usage: UsageEvent[];
  groups: Group[];
  groupMembers: GroupMember[];
  groupMessages: GroupMessage[];
  groupMessageReactions: GroupMessageReaction[];
  events: CampusEvent[];
  rsvps: Rsvp[];
  conversations: Conversation[];
  convMembers: ConversationMember[];
  messages: Message[];
  reports: Report[];
  notifications: Notification[];
  passwords: Record<string, string>;
}

export interface FeedPost extends Post {
  author: Profile;
  like_count: number;
  comment_count: number;
  liked_by_me: boolean;
  saved_by_me?: boolean;
  my_reaction?: string | null;
}

export type BackendMode = "local" | "supabase";

export interface DeviceAccount {
  userId: string;
  email: string;
  full_name: string;
  avatar_url: string | null;
  active: boolean;
  at: string;
}
