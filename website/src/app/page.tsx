'use client';

import { useState, useEffect } from 'react';
import { Mic, FileText, Sparkles, LogOut, User } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Recorder } from '@/components/Recorder';
import { Dashboard } from '@/components/Dashboard';
import { AuthModal } from '@/components/AuthModal';

export default function Home() {
  const { user, loading, signOut, getToken } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);
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
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="animate-pulse text-purple-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center">
              <Mic className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">VoiceNote Pro</h1>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {user ? (
              <>
                <button
                  onClick={() => setShowDashboard(!showDashboard)}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-colors ${
                    showDashboard
                      ? 'bg-purple-600 text-white'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800'
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  <span className="hidden sm:inline">My Notes</span>
                </button>
                <button
                  onClick={signOut}
                  className="p-2 text-gray-400 hover:text-white transition-colors"
                  title="Sign Out"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </>
            ) : (
              <button
                onClick={() => setShowAuthModal(true)}
                className="flex items-center space-x-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-white transition-colors"
              >
                <User className="w-4 h-4" />
                <span>Sign In</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        {/* Dashboard View */}
        {showDashboard && user && token ? (
          <div className="space-y-6">
            <button
              onClick={() => setShowDashboard(false)}
              className="text-purple-400 hover:text-purple-300 text-sm flex items-center gap-2"
            >
              ← Back to recording
            </button>
            <Dashboard token={token} refreshTrigger={refreshTrigger} />
          </div>
        ) : (
          /* Main Recording View */
          <div className="space-y-8">
            {/* Hero Text */}
            <div className="text-center space-y-3 pt-8">
              <h2 className="text-3xl md:text-4xl font-bold text-white">
                Transform Your Voice Into
                <span className="block bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                  Brilliant Text
                </span>
              </h2>
              <p className="text-gray-400 max-w-md mx-auto">
                Record your thoughts. Our AI enhances them into polished, professional content.
              </p>
            </div>

            {/* Recorder - Always visible */}
            <div className="bg-gray-900/30 rounded-2xl border border-gray-800 p-6">
              <Recorder token={token} onNoteCreated={handleNoteCreated} />
            </div>

            {/* Sign in prompt for non-authenticated users */}
            {!user && (
              <div className="text-center space-y-4 pt-4">
                <p className="text-gray-500 text-sm">
                  Sign in to save your notes and access them anywhere
                </p>
                <button
                  onClick={() => setShowAuthModal(true)}
                  className="px-6 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-white font-medium transition-colors"
                >
                  Sign In to Save Notes
                </button>
              </div>
            )}

            {/* Features - Compact */}
            <div className="grid grid-cols-3 gap-4 pt-8">
              <div className="text-center">
                <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center mx-auto mb-2">
                  <Mic className="w-5 h-5 text-purple-400" />
                </div>
                <p className="text-sm text-gray-400">Voice Recording</p>
              </div>
              <div className="text-center">
                <div className="w-10 h-10 rounded-xl bg-pink-500/20 flex items-center justify-center mx-auto mb-2">
                  <Sparkles className="w-5 h-5 text-pink-400" />
                </div>
                <p className="text-sm text-gray-400">AI Enhancement</p>
              </div>
              <div className="text-center">
                <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center mx-auto mb-2">
                  <FileText className="w-5 h-5 text-blue-400" />
                </div>
                <p className="text-sm text-gray-400">Smart Formatting</p>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-800 py-6 mt-16">
        <div className="max-w-3xl mx-auto px-4 text-center text-gray-600 text-sm">
          <p>VoiceNote Pro</p>
        </div>
      </footer>

      {/* Auth Modal */}
      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
    </div>
  );
}
