export interface Profile {
  id: string
  email: string
  full_name: string
  username: string
  avatar_url: string | null
  about_me: string
  onboarding_complete: boolean
  hidden_from_directory: boolean
  last_seen: string | null
  notif_friend_requests: boolean
  notif_pokes: boolean
  notif_wall_posts: boolean
  notif_likes: boolean
  notif_comments: boolean
  messages_from: string
  wall_posts_from: string
  created_at: string
  updated_at: string
}

export interface Friendship {
  id: string
  requester_id: string
  addressee_id: string
  status: string
  created_at: string
  updated_at: string
  requester?: Profile
  addressee?: Profile
}

export interface WallPost {
  id: string
  author_id: string
  wall_owner_id: string
  content: string
  media_url: string | null
  created_at: string
  author?: Profile
  wall_owner?: Profile
}

export interface Poke {
  id: string
  poker_id: string
  poked_id: string
  created_at: string
  seen: boolean
  poker?: Profile
  poked?: Profile
}

export interface Conversation {
  id: string
  user1_id: string
  user2_id: string
  last_message_at: string
  last_message_content: string | null
  last_message_sender_id: string | null
  user1_read_at: string | null
  user2_read_at: string | null
  created_at: string
  user1?: Profile
  user2?: Profile
  last_message?: Message
}

export interface Message {
  id: string
  conversation_id: string
  sender_id: string
  content: string
  media_url?: string | null
  created_at: string
  sender?: Profile
}

export interface Comment {
  id: string
  post_type: 'wall_post' | 'group_post'
  post_id: string
  parent_id: string | null
  author_id: string
  content: string
  media_url: string | null
  created_at: string
  author?: Profile
  replies?: Comment[]
}
