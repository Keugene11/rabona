'use client';

import { useState, useEffect } from 'react';
import { Trash2, Copy, Check, Clock, FileText, Loader2, RefreshCw } from 'lucide-react';
import { Note, getNotes, deleteNote } from '@/lib/api';

interface DashboardProps {
  token: string;
  refreshTrigger?: number;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s`;
}

const TONE_LABELS: Record<string, { label: string; emoji: string }> = {
  professional: { label: 'Professional', emoji: '💼' },
  casual: { label: 'Casual', emoji: '😎' },
  concise: { label: 'Concise', emoji: '📝' },
  email: { label: 'Email', emoji: '📧' },
  meeting_notes: { label: 'Meeting Notes', emoji: '📋' },
  original: { label: 'Original', emoji: '🎤' },
};

export function Dashboard({ token, refreshTrigger }: DashboardProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadNotes = async () => {
    try {
      setLoading(true);
      const fetchedNotes = await getNotes(token);
      setNotes(fetchedNotes);
      setError(null);
    } catch (err) {
      setError('Failed to load notes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotes();
  }, [token, refreshTrigger]);

  const handleDelete = async (noteId: string) => {
    setDeletingId(noteId);
    try {
      await deleteNote(noteId, token);
      setNotes(notes.filter((n) => n.id !== noteId));
    } catch (err) {
      setError('Failed to delete note');
    } finally {
      setDeletingId(null);
    }
  };

  const handleCopy = (text: string, noteId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(noteId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-400 mb-4">{error}</p>
        <button
          onClick={loadNotes}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-white font-medium transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (notes.length === 0) {
    return (
      <div className="text-center py-12">
        <FileText className="w-16 h-16 text-gray-600 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-gray-400 mb-2">No notes yet</h3>
        <p className="text-gray-500">Start recording to create your first note!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white">Your Notes</h2>
        <button
          onClick={loadNotes}
          className="p-2 text-gray-400 hover:text-white transition-colors"
          title="Refresh"
        >
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      <div className="space-y-3">
        {notes.map((note) => {
          const toneInfo = TONE_LABELS[note.tone] || { label: note.tone, emoji: '📝' };
          const isExpanded = expandedId === note.id;

          return (
            <div
              key={note.id}
              className="bg-gray-800/50 rounded-xl border border-gray-700/50 overflow-hidden hover:border-purple-500/30 transition-colors"
            >
              {/* Header */}
              <div
                className="p-4 cursor-pointer"
                onClick={() => setExpandedId(isExpanded ? null : note.id)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-white line-clamp-2">
                      {note.processedText.slice(0, 150)}
                      {note.processedText.length > 150 && '...'}
                    </p>
                    <div className="flex items-center space-x-3 mt-2 text-sm text-gray-400">
                      <span className="flex items-center">
                        <Clock className="w-3.5 h-3.5 mr-1" />
                        {formatDate(note.createdAt)}
                      </span>
                      {note.duration && <span>{formatDuration(note.duration)}</span>}
                      <span className="px-2 py-0.5 bg-gray-700 rounded text-xs">
                        {toneInfo.emoji} {toneInfo.label}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 ml-4">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopy(note.processedText, note.id);
                      }}
                      className="p-2 text-gray-400 hover:text-white transition-colors"
                      title="Copy"
                    >
                      {copiedId === note.id ? (
                        <Check className="w-4 h-4 text-green-400" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(note.id);
                      }}
                      disabled={deletingId === note.id}
                      className="p-2 text-gray-400 hover:text-red-400 transition-colors disabled:opacity-50"
                      title="Delete"
                    >
                      {deletingId === note.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Expanded Content */}
              {isExpanded && (
                <div className="px-4 pb-4 space-y-4 border-t border-gray-700/50">
                  <div className="pt-4">
                    <h4 className="text-sm font-medium text-gray-400 mb-2">Original Transcription</h4>
                    <p className="text-gray-300 text-sm bg-gray-900/50 rounded-lg p-3">
                      {note.originalText}
                    </p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-purple-400 mb-2">
                      ✨ Enhanced Version
                    </h4>
                    <p className="text-white bg-purple-900/20 rounded-lg p-3 border border-purple-500/20">
                      {note.processedText}
                    </p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
