'use client';

import { useState, useEffect } from 'react';
import { Mic, LogOut, Sun, Moon, Search, X } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/contexts/ThemeContext';
import { Recorder } from '@/components/Recorder';
import { NotesList } from '@/components/NotesList';
import { LocalNotesList } from '@/components/LocalNotesList';
import { AuthModal } from '@/components/AuthModal';

export default function Home() {
  const { user, loading, signOut, getToken } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (user) {
      getToken().then(setToken);
    } else {
      setToken(null);
    }
  }, [user, getToken]);

  const handleNoteCreated = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-[#202124]">
        <div className="animate-pulse text-amber-600 dark:text-amber-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-[#202124] transition-colors">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white dark:bg-[#202124] border-b border-gray-200 dark:border-gray-700/50">
        <div className="flex items-center px-3 py-2 gap-2">
          {/* Logo */}
          <div className="flex items-center gap-2 px-3">
            <div className="w-10 h-10 rounded-full bg-amber-500 flex items-center justify-center">
              <Mic className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-normal text-gray-700 dark:text-gray-200 hidden sm:block">Rabona</h1>
          </div>

          {/* Search Bar */}
          <div className="flex-1 max-w-2xl">
            <div className="flex items-center bg-gray-100 dark:bg-[#525355] rounded-lg px-4 py-2.5 gap-3">
              <Search className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              <input
                type="text"
                placeholder="Search notes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Escape' && setSearchQuery('')}
                className="flex-1 bg-transparent border-none outline-none text-gray-700 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-400"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')}>
                  <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                </button>
              )}
            </div>
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-1">
            <button
              onClick={toggleTheme}
              className="p-3 rounded-full text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            </button>

            {user ? (
              <button
                onClick={signOut}
                className="p-3 rounded-full text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                title="Sign out"
              >
                <LogOut className="w-5 h-5" />
              </button>
            ) : (
              <button
                onClick={() => setShowAuthModal(true)}
                className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-medium text-gray-700 dark:text-gray-200 transition-colors"
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="px-4 sm:px-6 lg:px-10 py-6">
        {/* Recorder */}
        <div className="max-w-xl mx-auto mb-8">
          <div className="rounded-lg border border-gray-300 dark:border-gray-600 shadow-sm bg-white dark:bg-[#202124] overflow-hidden">
            <div className="p-4">
              <Recorder token={token} onNoteCreated={handleNoteCreated} />
            </div>
          </div>
        </div>

        {/* Sign in prompt for non-logged in users */}
        {!user && (
          <div className="text-center py-4 mb-6">
            <p className="text-gray-500 dark:text-gray-400 text-sm mb-3">
              Sign in to save your notes to the cloud
            </p>
            <button
              onClick={() => setShowAuthModal(true)}
              className="px-5 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-medium transition-colors"
            >
              Get Started
            </button>
          </div>
        )}

        {/* Notes Grid */}
        <div className="mt-4">
          {user && token ? (
            <NotesList token={token} refreshTrigger={refreshTrigger} searchQuery={searchQuery} />
          ) : (
            <LocalNotesList refreshTrigger={refreshTrigger} searchQuery={searchQuery} />
          )}
        </div>
      </main>

      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
    </div>
  );
}
