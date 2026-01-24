'use client';

import { useState, useEffect } from 'react';
import { Mic, Sparkles, LogOut, User, Sun, Moon } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/contexts/ThemeContext';
import { Recorder } from '@/components/Recorder';
import { NotesList } from '@/components/NotesList';
import { AuthModal } from '@/components/AuthModal';

export default function Home() {
  const { user, loading, signOut, getToken } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

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
      <div className="min-h-screen flex items-center justify-center bg-amber-50 dark:bg-gray-950">
        <div className="animate-pulse text-amber-600 dark:text-amber-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-amber-50 dark:bg-gray-950 transition-colors">
      {/* Header */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-amber-50/80 dark:bg-gray-950/80 border-b border-amber-200 dark:border-gray-800">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center">
              <Mic className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Rabona</h1>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-amber-100 dark:hover:bg-gray-800 transition-colors"
            >
              {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            </button>

            {user ? (
              <button
                onClick={signOut}
                className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-amber-100 dark:hover:bg-gray-800 transition-colors"
              >
                <LogOut className="w-5 h-5" />
              </button>
            ) : (
              <button
                onClick={() => setShowAuthModal(true)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium transition-colors"
              >
                <User className="w-4 h-4" />
                Sign In
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Recorder Section */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 border border-amber-200 dark:border-gray-800 shadow-sm">
          <Recorder token={token} onNoteCreated={handleNoteCreated} />
        </div>

        {/* Sign in prompt for non-logged in users */}
        {!user && (
          <div className="text-center py-4">
            <p className="text-gray-500 dark:text-gray-500 text-sm mb-2">
              Sign in to save your notes
            </p>
            <button
              onClick={() => setShowAuthModal(true)}
              className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium transition-colors"
            >
              Sign In
            </button>
          </div>
        )}

        {/* Notes List for logged in users */}
        {user && token && (
          <NotesList token={token} refreshTrigger={refreshTrigger} />
        )}

        {/* Features - only show when not logged in */}
        {!user && (
          <div className="grid grid-cols-3 gap-3 pt-4">
            <div className="text-center p-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mx-auto mb-2">
                <Mic className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <p className="text-xs font-medium text-gray-700 dark:text-gray-300">Record</p>
            </div>
            <div className="text-center p-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mx-auto mb-2">
                <Sparkles className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <p className="text-xs font-medium text-gray-700 dark:text-gray-300">Polish</p>
            </div>
            <div className="text-center p-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mx-auto mb-2">
                <Sparkles className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <p className="text-xs font-medium text-gray-700 dark:text-gray-300">Copy</p>
            </div>
          </div>
        )}
      </main>

      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
    </div>
  );
}
