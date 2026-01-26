'use client';

import { useState } from 'react';
import { Mic, Square, Loader2, Copy, Check, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react';
import { useRecorder } from '@/hooks/useRecorder';
import { transcribeAudio, saveNote } from '@/lib/api';

interface RecorderProps {
  token?: string | null;
  onNoteCreated?: () => void;
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

export function Recorder({ token, onNoteCreated }: RecorderProps) {
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
  const [copied, setCopied] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);

  const handleStartRecording = async () => {
    setError(null);
    setResult(null);
    try {
      await startRecording();
    } catch (err) {
      setError('Could not access microphone. Please allow microphone permissions.');
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
        setResult({
          original: response.data.originalText,
          processed: response.data.processedText,
        });

        if (token) {
          // Save to server if logged in
          await saveNote(token, {
            originalText: response.data.originalText,
            enhancedText: response.data.processedText,
            tone: response.data.tone,
            detectedIntent: response.data.detectedIntent,
          });
        } else {
          // Save to localStorage if not logged in
          saveLocalNote({
            id: crypto.randomUUID(),
            originalText: response.data.originalText,
            processedText: response.data.processedText,
            createdAt: new Date().toISOString(),
          });
        }

        onNoteCreated?.();
      } else {
        setError(response.error || 'Failed to process recording');
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
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-colors bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700"
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
      {/* Duration Display */}
      {isRecording && (
        <div className="text-4xl font-mono tabular-nums text-gray-900 dark:text-gray-100">
          {formatDuration(duration)}
        </div>
      )}

      {/* Main Button */}
      <div className="relative">
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
          <div className="w-24 h-24 rounded-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center justify-center">
            <Loader2 className="w-10 h-10 animate-spin text-amber-500" />
          </div>
        )}
      </div>

      {/* Status Text */}
      <p className="text-gray-500 dark:text-gray-400">
        {!isRecording && !isProcessing && 'Tap to record'}
        {isRecording && 'Tap to stop'}
        {isProcessing && 'Polishing...'}
      </p>

      {/* Error Display */}
      {error && (
        <div className="rounded-xl px-4 py-3 text-center max-w-sm bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm">
          {error}
        </div>
      )}
    </div>
  );
}
