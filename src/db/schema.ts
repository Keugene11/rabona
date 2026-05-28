import {
  pgTable,
  uuid,
  text,
  boolean,
  smallint,
  timestamp,
  primaryKey,
  uniqueIndex,
  index,
  integer,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

// ── Auth.js core tables (required by @auth/drizzle-adapter) ─────────────────

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name'),
  email: text('email').notNull().unique(),
  emailVerified: timestamp('emailVerified', { withTimezone: true, mode: 'date' }),
  image: text('image'),
})

export const accounts = pgTable(
  'accounts',
  {
    userId: uuid('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    provider: text('provider').notNull(),
    providerAccountId: text('providerAccountId').notNull(),
    refresh_token: text('refresh_token'),
    access_token: text('access_token'),
    expires_at: integer('expires_at'),
    token_type: text('token_type'),
    scope: text('scope'),
    id_token: text('id_token'),
    session_state: text('session_state'),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.provider, t.providerAccountId] }),
  }),
)

export const sessions = pgTable('sessions', {
  sessionToken: text('sessionToken').primaryKey(),
  userId: uuid('userId').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expires: timestamp('expires', { withTimezone: true, mode: 'date' }).notNull(),
})

export const verificationTokens = pgTable(
  'verificationToken',
  {
    identifier: text('identifier').notNull(),
    token: text('token').notNull(),
    expires: timestamp('expires', { withTimezone: true, mode: 'date' }).notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.identifier, t.token] }),
  }),
)

// ── Rabona application tables ────────────────────────────────────────────────

export const profiles = pgTable(
  'profiles',
  {
    id: uuid('id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    full_name: text('full_name').notNull().default(''),
    avatar_url: text('avatar_url'),
    username: text('username').notNull(),
    username_changed_at: timestamp('username_changed_at', { withTimezone: true }),
    class_year: smallint('class_year'),
    major: text('major').default(''),
    second_major: text('second_major').default(''),
    minor: text('minor').default(''),
    residence_hall: text('residence_hall').default(''),
    courses: text('courses').default(''),
    gender: text('gender').default(''),
    relationship_status: text('relationship_status').default(''),
    interests: text('interests').default(''),
    about_me: text('about_me').default(''),
    political_views: text('political_views').default(''),
    favorite_quotes: text('favorite_quotes').default(''),
    looking_for: text('looking_for').default(''),
    interested_in: text('interested_in').default(''),
    favorite_music: text('favorite_music').default(''),
    favorite_movies: text('favorite_movies').default(''),
    phone: text('phone').default(''),
    hometown: text('hometown').default(''),
    high_school: text('high_school').default(''),
    websites: text('websites').default(''),
    birthday: text('birthday').default(''),
    private_fields: text('private_fields').default(''),
    fraternity_sorority: text('fraternity_sorority').default(''),
    clubs: text('clubs').default(''),
    university: text('university').default('stonybrook'),
    onboarding_complete: boolean('onboarding_complete').default(false),
    hidden_from_directory: boolean('hidden_from_directory').notNull().default(false),
    wall_posts_from: text('wall_posts_from').notNull().default('everyone'),
    messages_from: text('messages_from').default('everyone'),
    notif_friend_requests: boolean('notif_friend_requests').default(true),
    notif_pokes: boolean('notif_pokes').default(true),
    notif_wall_posts: boolean('notif_wall_posts').default(true),
    notif_likes: boolean('notif_likes').default(true),
    notif_comments: boolean('notif_comments').default(true),
    last_seen: timestamp('last_seen', { withTimezone: true }).defaultNow(),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    universityIdx: index('idx_profiles_university').on(t.university),
    residenceIdx: index('idx_profiles_residence_hall').on(t.residence_hall),
    majorIdx: index('idx_profiles_major').on(t.major),
    classYearIdx: index('idx_profiles_class_year').on(t.class_year),
    genderIdx: index('idx_profiles_gender').on(t.gender),
    usernameUnique: uniqueIndex('profiles_username_unique').on(t.username),
  }),
)

export const wall_posts = pgTable(
  'wall_posts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    author_id: uuid('author_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
    wall_owner_id: uuid('wall_owner_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
    content: text('content').notNull(),
    media_url: text('media_url'),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    wallOwnerIdx: index('idx_wall_posts_wall_owner').on(t.wall_owner_id, t.created_at),
    authorIdx: index('idx_wall_posts_author').on(t.author_id, t.created_at),
  }),
)

export const comments = pgTable(
  'comments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    post_type: text('post_type').notNull(),
    post_id: uuid('post_id').notNull(),
    parent_id: uuid('parent_id'),
    author_id: uuid('author_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
    content: text('content').notNull(),
    media_url: text('media_url'),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    parentIdx: index('idx_comments_parent').on(t.parent_id),
    postIdx: index('idx_comments_post').on(t.post_type, t.post_id, t.created_at),
  }),
)

export const post_likes = pgTable(
  'post_likes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    post_type: text('post_type').notNull(),
    post_id: uuid('post_id').notNull(),
    user_id: uuid('user_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    unique: uniqueIndex('post_likes_post_user_key').on(t.post_type, t.post_id, t.user_id),
    postIdx: index('idx_post_likes_post').on(t.post_type, t.post_id),
  }),
)

export const comment_likes = pgTable(
  'comment_likes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    comment_id: uuid('comment_id').notNull().references(() => comments.id, { onDelete: 'cascade' }),
    user_id: uuid('user_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    unique: uniqueIndex('comment_likes_comment_user_key').on(t.comment_id, t.user_id),
  }),
)

export const post_impressions = pgTable(
  'post_impressions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    post_type: text('post_type').notNull(),
    post_id: uuid('post_id').notNull(),
    user_id: uuid('user_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    unique: uniqueIndex('post_impressions_post_user_key').on(t.post_type, t.post_id, t.user_id),
    postIdx: index('idx_post_impressions_post').on(t.post_type, t.post_id),
  }),
)

export const friendships = pgTable(
  'friendships',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    requester_id: uuid('requester_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
    addressee_id: uuid('addressee_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
    status: text('status').notNull().default('pending'),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    unique: uniqueIndex('friendships_requester_addressee_key').on(t.requester_id, t.addressee_id),
    statusIdx: index('idx_friendships_status').on(t.status),
  }),
)

export const blocks = pgTable(
  'blocks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    blocker_id: uuid('blocker_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
    blocked_id: uuid('blocked_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    unique: uniqueIndex('blocks_blocker_blocked_key').on(t.blocker_id, t.blocked_id),
  }),
)

export const pokes = pgTable(
  'pokes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    poker_id: uuid('poker_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
    poked_id: uuid('poked_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
    seen: boolean('seen').default(false),
  },
  (t) => ({
    unique: uniqueIndex('pokes_poker_poked_key').on(t.poker_id, t.poked_id),
  }),
)

export const conversations = pgTable(
  'conversations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    user1_id: uuid('user1_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
    user2_id: uuid('user2_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
    last_message_at: timestamp('last_message_at', { withTimezone: true }).defaultNow(),
    last_message_content: text('last_message_content'),
    last_message_sender_id: uuid('last_message_sender_id').references(() => profiles.id, { onDelete: 'set null' }),
    user1_read_at: timestamp('user1_read_at', { withTimezone: true }).defaultNow(),
    user2_read_at: timestamp('user2_read_at', { withTimezone: true }).defaultNow(),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    unique: uniqueIndex('conversations_user1_user2_key').on(t.user1_id, t.user2_id),
  }),
)

export const messages = pgTable(
  'messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    conversation_id: uuid('conversation_id').notNull().references(() => conversations.id, { onDelete: 'cascade' }),
    sender_id: uuid('sender_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
    content: text('content').notNull(),
    media_url: text('media_url'),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    convIdx: index('idx_messages_conversation').on(t.conversation_id, t.created_at),
  }),
)

export const message_likes = pgTable(
  'message_likes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    message_id: uuid('message_id').notNull().references(() => messages.id, { onDelete: 'cascade' }),
    user_id: uuid('user_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    unique: uniqueIndex('message_likes_message_user_key').on(t.message_id, t.user_id),
  }),
)

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    user_id: uuid('user_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
    actor_id: uuid('actor_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    post_type: text('post_type'),
    post_id: uuid('post_id'),
    comment_id: uuid('comment_id').references(() => comments.id, { onDelete: 'set null' }),
    content: text('content'),
    seen: boolean('seen').default(false),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    userIdx: index('idx_notifications_user').on(t.user_id, t.seen, t.created_at),
  }),
)

export const groups = pgTable(
  'groups',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    description: text('description').default(''),
    image_url: text('image_url'),
    group_type: text('group_type').notNull().default('open'),
    created_by: uuid('created_by').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
    university: text('university').default('stonybrook'),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    nameIdx: index('idx_groups_name').on(t.name),
    uniIdx: index('idx_groups_university').on(t.university),
  }),
)

export const group_members = pgTable(
  'group_members',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    group_id: uuid('group_id').notNull().references(() => groups.id, { onDelete: 'cascade' }),
    user_id: uuid('user_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
    role: text('role').notNull().default('member'),
    joined_at: timestamp('joined_at', { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    unique: uniqueIndex('group_members_group_user_key').on(t.group_id, t.user_id),
    groupIdx: index('idx_group_members_group').on(t.group_id),
    userIdx: index('idx_group_members_user').on(t.user_id),
  }),
)

export const group_posts = pgTable(
  'group_posts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    group_id: uuid('group_id').notNull().references(() => groups.id, { onDelete: 'cascade' }),
    author_id: uuid('author_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
    content: text('content').notNull(),
    media_url: text('media_url'),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    groupIdx: index('idx_group_posts_group').on(t.group_id, t.created_at),
  }),
)

export const profile_views = pgTable(
  'profile_views',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    profile_id: uuid('profile_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
    viewer_id: uuid('viewer_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
    created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    unique: uniqueIndex('profile_views_profile_viewer_key').on(t.profile_id, t.viewer_id),
    profileIdx: index('idx_profile_views_profile').on(t.profile_id, t.created_at),
  }),
)

export const reports = pgTable('reports', {
  id: uuid('id').primaryKey().defaultRandom(),
  reporter_id: uuid('reporter_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  reported_id: uuid('reported_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  reason: text('reason').notNull(),
  details: text('details').default(''),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

export const auth_email_allowed_domains = pgTable('auth_email_allowed_domains', {
  domain: text('domain').primaryKey(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

export const auth_email_allowlist = pgTable('auth_email_allowlist', {
  email: text('email').primaryKey(),
  note: text('note'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
})

export const protected_owner_emails = pgTable('protected_owner_emails', {
  email: text('email').primaryKey(),
  reason: text('reason'),
  created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// Suppress unused-import warning for `sql` so future raw fragments are cheap.
export const _sql = sql
