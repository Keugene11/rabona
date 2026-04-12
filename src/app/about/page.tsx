import { Users, MessageCircle, Search, Hand, Shield, Share2, Camera, Bell } from 'lucide-react'
import Link from 'next/link'

export default function AboutPage() {
  return (
    <div className="max-w-2xl mx-auto px-5 pt-16 pb-20">
      <div className="text-center mb-12">
        <h1 className="text-[32px] font-extrabold tracking-tight">[ Rabona ]</h1>
        <p className="text-[16px] text-text-muted mt-2">A social network for you and your friends</p>
      </div>

      <section className="mb-10">
        <h2 className="text-[20px] font-bold mb-3">What is Rabona?</h2>
        <p className="text-[15px] text-text-muted leading-relaxed">
          Rabona is a social network for you and your friends. Write short updates and posts for your friends to read and like, connect with people you know, join and make groups, and message your friends. Sign in with your Google account to get started.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="text-[20px] font-bold mb-4">Features</h2>
        <div className="grid gap-4">
          <div className="bg-bg-card border border-border rounded-2xl p-4 flex gap-4">
            <Search size={20} className="text-accent flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-[15px] font-semibold mb-1">Directory</h3>
              <p className="text-[13px] text-text-muted leading-relaxed">Browse everyone on Rabona. Filter by interests and more to find people you know or want to meet.</p>
            </div>
          </div>

          <div className="bg-bg-card border border-border rounded-2xl p-4 flex gap-4">
            <Users size={20} className="text-accent flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-[15px] font-semibold mb-1">Friends</h3>
              <p className="text-[13px] text-text-muted leading-relaxed">Send friend requests, build your network, and see your connections. Once you&apos;re friends with someone, you can write on their wall and see their full profile.</p>
            </div>
          </div>

          <div className="bg-bg-card border border-border rounded-2xl p-4 flex gap-4">
            <MessageCircle size={20} className="text-accent flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-[15px] font-semibold mb-1">The Wall</h3>
              <p className="text-[13px] text-text-muted leading-relaxed">Every profile has a wall where friends can write posts, share photos and videos, and leave comments. Like posts with the heart button.</p>
            </div>
          </div>

          <div className="bg-bg-card border border-border rounded-2xl p-4 flex gap-4">
            <Camera size={20} className="text-accent flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-[15px] font-semibold mb-1">Photos & Videos</h3>
              <p className="text-[13px] text-text-muted leading-relaxed">Upload photos and videos to your wall posts and group posts. Images up to 5 MB and videos up to 20 MB.</p>
            </div>
          </div>

          <div className="bg-bg-card border border-border rounded-2xl p-4 flex gap-4">
            <Users size={20} className="text-accent flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-[15px] font-semibold mb-1">Groups</h3>
              <p className="text-[13px] text-text-muted leading-relaxed">Join or create groups for anything. Groups have their own walls where members can post and discuss.</p>
            </div>
          </div>

          <div className="bg-bg-card border border-border rounded-2xl p-4 flex gap-4">
            <MessageCircle size={20} className="text-accent flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-[15px] font-semibold mb-1">Direct Messages</h3>
              <p className="text-[13px] text-text-muted leading-relaxed">Send private messages to anyone. Start a conversation from their profile page.</p>
            </div>
          </div>

          <div className="bg-bg-card border border-border rounded-2xl p-4 flex gap-4">
            <Hand size={20} className="text-accent flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-[15px] font-semibold mb-1">Pokes</h3>
              <p className="text-[13px] text-text-muted leading-relaxed">Poke someone to get their attention. They&apos;ll get a notification and can poke you back. It&apos;s a fun, low-pressure way to say hi.</p>
            </div>
          </div>

          <div className="bg-bg-card border border-border rounded-2xl p-4 flex gap-4">
            <Bell size={20} className="text-accent flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-[15px] font-semibold mb-1">Notifications</h3>
              <p className="text-[13px] text-text-muted leading-relaxed">Get notified when someone likes your post, comments on your wall, replies to your comment, sends a friend request, or pokes you.</p>
            </div>
          </div>

          <div className="bg-bg-card border border-border rounded-2xl p-4 flex gap-4">
            <Share2 size={20} className="text-accent flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-[15px] font-semibold mb-1">Friend Network</h3>
              <p className="text-[13px] text-text-muted leading-relaxed">Visualize your friend network as an interactive graph. See how you&apos;re connected and explore your social circle.</p>
            </div>
          </div>

          <div className="bg-bg-card border border-border rounded-2xl p-4 flex gap-4">
            <Shield size={20} className="text-accent flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-[15px] font-semibold mb-1">Privacy & Safety</h3>
              <p className="text-[13px] text-text-muted leading-relaxed">Control exactly which profile fields are visible to others. Block and report users who violate community standards.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-[20px] font-bold mb-3">How to get started</h2>
        <ol className="space-y-3">
          <li className="flex gap-3">
            <span className="bg-accent text-white w-6 h-6 rounded-full flex items-center justify-center text-[13px] font-bold flex-shrink-0">1</span>
            <p className="text-[14px] text-text-muted leading-relaxed"><span className="text-text font-medium">Sign in</span> with your Google account.</p>
          </li>
          <li className="flex gap-3">
            <span className="bg-accent text-white w-6 h-6 rounded-full flex items-center justify-center text-[13px] font-bold flex-shrink-0">2</span>
            <p className="text-[14px] text-text-muted leading-relaxed"><span className="text-text font-medium">Set up your profile</span> — add your name, interests, and a profile picture.</p>
          </li>
          <li className="flex gap-3">
            <span className="bg-accent text-white w-6 h-6 rounded-full flex items-center justify-center text-[13px] font-bold flex-shrink-0">3</span>
            <p className="text-[14px] text-text-muted leading-relaxed"><span className="text-text font-medium">Find people</span> — use the directory to find your friends.</p>
          </li>
          <li className="flex gap-3">
            <span className="bg-accent text-white w-6 h-6 rounded-full flex items-center justify-center text-[13px] font-bold flex-shrink-0">4</span>
            <p className="text-[14px] text-text-muted leading-relaxed"><span className="text-text font-medium">Add friends</span> — send friend requests and start writing on each other&apos;s walls.</p>
          </li>
          <li className="flex gap-3">
            <span className="bg-accent text-white w-6 h-6 rounded-full flex items-center justify-center text-[13px] font-bold flex-shrink-0">5</span>
            <p className="text-[14px] text-text-muted leading-relaxed"><span className="text-text font-medium">Join groups</span> — find groups or create your own.</p>
          </li>
        </ol>
      </section>

      <section className="mb-10">
        <h2 className="text-[20px] font-bold mb-3">Questions?</h2>
        <p className="text-[14px] text-text-muted leading-relaxed">
          Reach out to <a href="mailto:keugenelee11@gmail.com" className="text-accent">keugenelee11@gmail.com</a> for support, feedback, or bug reports.
        </p>
      </section>

      <div className="text-center pt-4 border-t border-border">
        <Link href="/login" className="text-accent text-[14px] font-semibold press">
          Join Rabona
        </Link>
      </div>
    </div>
  )
}
