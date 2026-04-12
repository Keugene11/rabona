# Rabona

A social network for you and your friends. Think early Facebook — profiles, wall posts, friends, pokes, and messaging.

## Features

- **Google OAuth** — Sign in with your Google account
- **Profiles** — Class year, major, courses, residence hall, interests, favorites, and more
- **Wall Posts** — Post on friends' walls with likes and comments
- **Friends** — Send/accept friend requests, browse your network
- **Pokes** — Poke your friends
- **Messaging** — Direct conversations between users
- **Directory** — Search and discover other people
- **Privacy Controls** — Choose which profile fields are visible to others

## Tech Stack

- **Framework**: Next.js (App Router)
- **Database**: Supabase (PostgreSQL + Auth + Storage)
- **Auth**: Google OAuth 2.0
- **Styling**: Tailwind CSS
- **Icons**: lucide-react

## Getting Started

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

## Environment Variables

Create a `.env.local` file with:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
GOOGLE_CLIENT_SECRET=
```
