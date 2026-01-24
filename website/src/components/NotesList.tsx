'use client';

import { useState, useEffect } from 'react';
import { Trash2, Copy, Check, Clock, Loader2 } from 'lucide-react';
import { Note, getNotes, deleteNote } from '@/lib/api';

interface NotesListProps {
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

export function NotesList({ token, refreshTrigger }: NotesListProps) {
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
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 text-amber-500 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-500 dark:text-red-400 mb-3 text-sm">{error}</p>
        <button
          onClick={loadNotes}
          className="px-4 py-2 bg-amber-500 hover:bg-amber-600 rounded-lg text-white text-sm font-medium transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (notes.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500 dark:text-gray-400 text-sm">No notes yet. Record something!</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 px-1">Your Notes</h2>

      {notes.map((note) => {
        const isExpanded = expandedId === note.id;

        return (
          <div
            key={note.id}
            className="bg-white dark:bg-gray-900 rounded-xl border border-amber-200 dark:border-gray-800 overflow-hidden transition-colors"
          >
            {/* Note Header */}
            <div
              className="p-4 cursor-pointer hover:bg-amber-50 dark:hover:bg-gray-800/50 transition-colors"
              onClick={() => setExpandedId(isExpanded ? null : note.id)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-gray-900 dark:text-gray-100 text-sm line-clamp-2">
                    {note.processedText.slice(0, 150)}
                    {note.processedText.length > 150 && '...'}
                  </p>
                  <div className="flex items-center gap-2 mt-2 text-xs text-gray-500 dark:text-gray-400">
                    <span className="flex items-center">
                      <Clock className="w-3 h-3 mr-1" />
                      {formatDate(note.createdAt)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCopy(note.processedText, note.id);
                    }}
                    className="p-1.5 text-gray-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
                    title="Copy"
                  >
                    {copiedId === note.id ? (
                      <Check className="w-4 h-4 text-green-500" />
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
                    className="p-1.5 text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50"
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
              <div className="px-4 pb-4 space-y-3 border-t border-amber-100 dark:border-gray-800">
                <div className="pt-3">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Original</p>
                  <p className="text-sm text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                    {note.originalText}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-amber-600 dark:text-amber-400 mb-1">Polished</p>
                  <p className="text-sm text-gray-900 dark:text-gray-100 bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3 border border-amber-200 dark:border-amber-800">
                    {note.processedText}
                  </p>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
