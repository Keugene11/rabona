'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Mic, Square, Loader2, Copy, Check, RotateCcw, ChevronDown, ChevronUp, Sparkles, X, Type } from 'lucide-react';
import { useRecorder } from '@/hooks/useRecorder';
import { transcribeAudio, enhanceText, saveNote } from '@/lib/api';
import { useSubscription } from '@/hooks/useSubscription';

interface RecorderProps {
  token?: string | null;
  isLoggedIn?: boolean;
  onNoteCreated?: () => void;
  refreshTrigger?: number;
}

interface LocalNote {
  id: string;
  originalText: string;
  processedText: string;
  createdAt: string;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function saveLocalNote(note: LocalNote) {
  const existing = localStorage.getItem('rabona_local_notes');
  const notes: LocalNote[] = existing ? JSON.parse(existing) : [];
  notes.unshift(note);
  localStorage.setItem('rabona_local_notes', JSON.stringify(notes.slice(0, 50))); // Keep max 50 notes
}

export function getLocalNotes(): LocalNote[] {
  if (typeof window === 'undefined') return [];
  const existing = localStorage.getItem('rabona_local_notes');
  return existing ? JSON.parse(existing) : [];
}

export function deleteLocalNote(id: string) {
  const notes = getLocalNotes().filter(n => n.id !== id);
  localStorage.setItem('rabona_local_notes', JSON.stringify(notes));
}

export function updateLocalNote(id: string, updates: { processedText?: string }) {
  const notes = getLocalNotes().map(n =>
    n.id === id ? { ...n, ...updates } : n
  );
  localStorage.setItem('rabona_local_notes', JSON.stringify(notes));
}

const PENDING_RESULT_KEY = 'rabona_pending_result';

function savePendingResult(result: { original: string; processed: string }) {
  localStorage.setItem(PENDING_RESULT_KEY, JSON.stringify(result));
}

function getPendingResult(): { original: string; processed: string } | null {
  try {
    const saved = localStorage.getItem(PENDING_RESULT_KEY);
    if (saved) {
      localStorage.removeItem(PENDING_RESULT_KEY);
      return JSON.parse(saved);
    }
  } catch {}
  return null;
}

export function Recorder({ token, isLoggedIn, onNoteCreated }: RecorderProps) {
  const router = useRouter();
  const {
    isRecording,
    duration,
    startRecording,
    stopRecording,
    resetRecording,
  } = useRecorder();

  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<{ original: string; processed: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Check for pending result after sign-in
  useEffect(() => {
    if (isLoggedIn) {
      const pending = getPendingResult();
      if (pending) {
        setResult(pending);
        // Save to server now that user is logged in
        if (token) {
          saveNote(token, {
            originalText: pending.original,
            enhancedText: pending.processed,
          }).then(() => {
            onNoteCreated?.();
          });
        }
      }
    }
  }, [isLoggedIn, token, onNoteCreated]);
  const [copied, setCopied] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [mode, setMode] = useState<'voice' | 'text'>('voice');
  const [textInput, setTextInput] = useState('');
  const { openCheckout } = useSubscription();

  const handleStartRecording = async () => {
    setError(null);
    setResult(null);
    try {
      await startRecording();
    } catch (err) {
      setError('Could not access microphone. Please allow microphone permissions.');
    }
  };

  const handleTextEnhance = async () => {
    if (!textInput.trim()) return;

    setIsProcessing(true);
    setError(null);

    try {
      const response = await enhanceText(textInput, token);
      if (response.success && response.data) {
        const resultData = {
          original: response.data.originalText,
          processed: response.data.processedText,
        };

        // If not logged in, save result and redirect to auth
        if (!isLoggedIn) {
          savePendingResult(resultData);
          router.push('/auth');
          return;
        }

        setResult(resultData);

        if (token) {
          await saveNote(token, {
            originalText: response.data.originalText,
            enhancedText: response.data.processedText,
            tone: response.data.tone,
            detectedIntent: response.data.detectedIntent,
          });
        }

        onNoteCreated?.();
        setTextInput('');
      } else {
        if (response.code === 'LIMIT_REACHED') {
          setShowUpgradeModal(true);
        } else {
          setError(response.error || 'Failed to enhance text');
        }
      }
    } catch (err) {
      setError('Failed to connect to server. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleStopRecording = async () => {
    const blob = await stopRecording();
    if (!blob) return;

    setIsProcessing(true);
    setError(null);

    try {
      const response = await transcribeAudio(blob, token);
      if (response.success && response.data) {
        const resultData = {
          original: response.data.originalText,
          processed: response.data.processedText,
        };

        // If not logged in, save result and redirect to auth
        if (!isLoggedIn) {
          savePendingResult(resultData);
          router.push('/auth');
          return;
        }

        setResult(resultData);

        if (token) {
          // Save to server if logged in
          await saveNote(token, {
            originalText: response.data.originalText,
            enhancedText: response.data.processedText,
            tone: response.data.tone,
            detectedIntent: response.data.detectedIntent,
          });
        }

        onNoteCreated?.();
      } else {
        // Check if it's a limit error
        if (response.code === 'LIMIT_REACHED') {
          setShowUpgradeModal(true);
        } else {
          setError(response.error || 'Failed to process recording');
        }
      }
    } catch (err) {
      setError('Failed to connect to server. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleNewRecording = () => {
    setResult(null);
    setError(null);
    setCopied(false);
    setShowOriginal(false);
    resetRecording();
  };

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Show result view
  if (result) {
    return (
      <div className="space-y-4">
        {/* Polished Result */}
        <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-amber-700 dark:text-amber-300">Polished</span>
            <button
              onClick={() => copyToClipboard(result.processed)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-amber-500 hover:bg-amber-600 text-white transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <p className="text-gray-900 dark:text-gray-100 leading-relaxed whitespace-pre-wrap">
            {result.processed}
          </p>

          {/* Original Transcription Toggle */}
          {result.original && result.original !== result.processed && (
            <div className="mt-3 pt-3 border-t border-amber-200 dark:border-amber-700">
              <button
                onClick={() => setShowOriginal(!showOriginal)}
                className="flex items-center gap-1.5 text-sm text-amber-700 dark:text-amber-300 hover:text-amber-800 dark:hover:text-amber-200 transition-colors"
              >
                {showOriginal ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
                View original transcription
              </button>
              {showOriginal && (
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 bg-white/50 dark:bg-black/20 rounded-lg p-3">
                  {result.original}
                </p>
              )}
            </div>
          )}
        </div>

        {/* New Recording Button */}
        <button
          onClick={handleNewRecording}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-colors bg-[#FFF8F0] dark:bg-gray-800 hover:bg-[#F5EDE3] dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 border border-[#EDE4D9] dark:border-gray-700"
        >
          <RotateCcw className="w-4 h-4" />
          Record Another
        </button>
      </div>
    );
  }

  // Recording view
  return (
    <div className="flex flex-col items-center space-y-6 py-6">
      {/* Mode Toggle */}
      {!isRecording && !isProcessing && (
        <div className="flex items-center gap-1 p-1 bg-[#EFEAE3] dark:bg-[#3a3b3d] rounded-lg">
          <button
            onClick={() => setMode('voice')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              mode === 'voice'
                ? 'bg-white dark:bg-[#28292c] text-gray-900 dark:text-gray-100 shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
            }`}
          >
            <Mic className="w-4 h-4" />
            Voice
          </button>
          <button
            onClick={() => setMode('text')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              mode === 'text'
                ? 'bg-white dark:bg-[#28292c] text-gray-900 dark:text-gray-100 shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
            }`}
          >
            <Type className="w-4 h-4" />
            Text
          </button>
        </div>
      )}

      {/* Voice Mode */}
      {mode === 'voice' && (
        <>
          {/* Duration Display */}
          {isRecording && (
            <div className="text-4xl font-mono tabular-nums text-gray-900 dark:text-gray-100">
              {formatDuration(duration)}
            </div>
          )}

          {/* Main Button */}
          <div className="relative">
            {/* Recording button - always available */}
            {!isRecording && !isProcessing && (
              <button
                onClick={handleStartRecording}
                className="w-24 h-24 rounded-full bg-amber-500 hover:bg-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/30 transition-all hover:scale-105 active:scale-95"
              >
                <Mic className="w-10 h-10 text-white" />
              </button>
            )}

            {isRecording && (
              <button
                onClick={handleStopRecording}
                className="w-24 h-24 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center shadow-lg shadow-red-500/30 transition-all hover:scale-105 active:scale-95 animate-pulse"
              >
                <Square className="w-10 h-10 text-white" />
              </button>
            )}

            {isProcessing && (
              <div className="w-24 h-24 rounded-full bg-[#FFF8F0] dark:bg-gray-800 border border-[#EDE4D9] dark:border-gray-700 flex items-center justify-center">
                <Loader2 className="w-10 h-10 animate-spin text-amber-500" />
              </div>
            )}
          </div>

          {/* Status Text */}
          <p className="text-gray-500 dark:text-gray-400 font-serif italic">
            {!isRecording && !isProcessing && 'Tap to record'}
            {isRecording && 'Tap to stop'}
            {isProcessing && 'Polishing...'}
          </p>
        </>
      )}

      {/* Text Mode */}
      {mode === 'text' && !isProcessing && (
        <div className="w-full max-w-md space-y-4">
          <textarea
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder="Type or paste your text here..."
            className="w-full h-32 p-4 rounded-xl bg-white dark:bg-[#2D2E30] border border-[#EDE4D9] dark:border-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
          />
          <button
            onClick={handleTextEnhance}
            disabled={!textInput.trim()}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white font-medium transition-colors disabled:cursor-not-allowed"
          >
            <Sparkles className="w-5 h-5" />
            Enhance Text
          </button>
        </div>
      )}

      {/* Processing state for text mode */}
      {mode === 'text' && isProcessing && (
        <div className="flex flex-col items-center gap-4">
          <div className="w-24 h-24 rounded-full bg-[#FFF8F0] dark:bg-gray-800 border border-[#EDE4D9] dark:border-gray-700 flex items-center justify-center">
            <Loader2 className="w-10 h-10 animate-spin text-amber-500" />
          </div>
          <p className="text-gray-500 dark:text-gray-400 font-serif italic">Enhancing...</p>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="rounded-xl px-4 py-3 text-center max-w-sm bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Upgrade Modal */}
      {showUpgradeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-[#FFF8F0] dark:bg-[#28292c] rounded-2xl shadow-2xl w-full max-w-md p-6 relative">
            <button
              onClick={() => setShowUpgradeModal(false)}
              className="absolute top-4 right-4 p-1 rounded-full text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <Sparkles className="w-8 h-8 text-amber-500" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                Recording Limit Reached
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                You have used all 5 free recordings this month. Upgrade to Pro for unlimited recordings.
              </p>

              <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 mb-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-gray-900 dark:text-gray-100">Rabona Pro</span>
                  <span className="text-amber-600 dark:text-amber-400 font-semibold">$4/month</span>
                </div>
                <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1 text-left">
                  <li>• Unlimited recordings</li>
                  <li>• Priority processing</li>
                  <li>• Cancel anytime</li>
                </ul>
              </div>

              <button
                onClick={() => openCheckout('monthly')}
                className="w-full py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-medium transition-colors"
              >
                Upgrade to Pro
              </button>
              <button
                onClick={() => setShowUpgradeModal(false)}
                className="w-full mt-3 py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              >
                Maybe later
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
