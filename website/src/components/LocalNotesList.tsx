'use client';

import { useState, useEffect, useRef } from 'react';
import { Trash2, Copy, Check, X, ChevronDown, ChevronUp, CheckSquare, Square, Loader2 } from 'lucide-react';
import { getLocalNotes, deleteLocalNote, updateLocalNote } from './Recorder';

interface LocalNote {
  id: string;
  originalText: string;
  processedText: string;
  createdAt: string;
}

interface LocalNotesListProps {
  refreshTrigger?: number;
  searchQuery?: string;
}

export function LocalNotesList({ refreshTrigger, searchQuery = '' }: LocalNotesListProps) {
  const [notes, setNotes] = useState<LocalNote[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedNote, setSelectedNote] = useState<LocalNote | null>(null);
  const [editedText, setEditedText] = useState('');
  const [showOriginal, setShowOriginal] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const selectionMode = selectedIds.size > 0;

  useEffect(() => {
    setNotes(getLocalNotes());
  }, [refreshTrigger]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [editedText]);

  const handleDelete = (noteId: string) => {
    deleteLocalNote(noteId);
    setNotes(notes.filter((n) => n.id !== noteId));
    if (selectedNote?.id === noteId) {
      setSelectedNote(null);
    }
    selectedIds.delete(noteId);
    setSelectedIds(new Set(selectedIds));
  };

  const toggleSelect = (noteId: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(noteId)) {
      newSelected.delete(noteId);
    } else {
      newSelected.add(noteId);
    }
    setSelectedIds(newSelected);
  };

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;
    setIsDeleting(true);
    try {
      Array.from(selectedIds).forEach((id) => deleteLocalNote(id));
      setNotes(notes.filter((n) => !selectedIds.has(n.id)));
      setSelectedIds(new Set());
    } finally {
      setIsDeleting(false);
    }
  };

  const selectAll = () => {
    setSelectedIds(new Set(filteredNotes.map((n) => n.id)));
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const handleCopy = (text: string, noteId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(noteId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleNoteClick = (note: LocalNote) => {
    setSelectedNote(note);
    setEditedText(note.processedText);
    setShowOriginal(false);
  };

  const handleCloseModal = () => {
    // Save if text has changed
    if (selectedNote && editedText !== selectedNote.processedText) {
      updateLocalNote(selectedNote.id, { processedText: editedText });
      setNotes(notes.map((n) => (n.id === selectedNote.id ? { ...n, processedText: editedText } : n)));
    }
    setSelectedNote(null);
    setEditedText('');
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleCloseModal();
    }
  };

  // Filter notes by search query
  const filteredNotes = notes.filter((note) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      note.processedText.toLowerCase().includes(query) ||
      note.originalText.toLowerCase().includes(query)
    );
  });

  if (filteredNotes.length === 0) {
    if (searchQuery) {
      return (
        <div className="text-center py-12">
          <p className="text-gray-500 dark:text-gray-400">No notes matching "{searchQuery}"</p>
        </div>
      );
    }
    return null;
  }

  return (
    <>
      <div className="columns-2 sm:columns-3 lg:columns-4 xl:columns-5 gap-3">
        {filteredNotes.map((note) => {
          const isHovered = hoveredId === note.id;
          const isSelected = selectedIds.has(note.id);

          return (
            <div
              key={note.id}
              className="break-inside-avoid mb-3"
              onMouseEnter={() => setHoveredId(note.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              <div
                onClick={(e) => {
                  if (e.ctrlKey || e.metaKey || selectionMode) {
                    toggleSelect(note.id);
                  } else {
                    handleNoteClick(note);
                  }
                }}
                className={`
                  rounded-lg border
                  bg-white dark:bg-[#28292c]
                  overflow-hidden transition-all cursor-pointer
                  ${isSelected ? 'border-amber-500 ring-2 ring-amber-500/20' : 'border-gray-200 dark:border-gray-600'}
                  ${isHovered && !isSelected ? 'shadow-lg border-gray-300 dark:border-gray-500' : ''}
                `}
              >
                {/* Note Content */}
                <div className="p-3 relative">
                  {/* Selection checkbox - show on hover or when selected */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleSelect(note.id);
                    }}
                    className={`
                      absolute top-2 right-2 p-1 rounded transition-opacity
                      ${isSelected || isHovered ? 'opacity-100' : 'opacity-0'}
                    `}
                  >
                    {isSelected ? (
                      <CheckSquare className="w-5 h-5 text-amber-500" />
                    ) : (
                      <Square className="w-5 h-5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" />
                    )}
                  </button>
                  <p className="text-gray-800 dark:text-gray-200 text-[13px] whitespace-pre-wrap leading-relaxed pr-6">
                    {note.processedText}
                  </p>
                </div>

                {/* Actions - show on hover when not in selection mode */}
                {!selectionMode && (
                  <div
                    className={`
                      flex items-center justify-start gap-0.5 px-1 py-1
                      transition-opacity duration-100
                      ${isHovered ? 'opacity-100' : 'opacity-0'}
                    `}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopy(note.processedText, note.id);
                      }}
                      className="p-2 rounded-full text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
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
                      className="p-2 rounded-full text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Selection Action Bar */}
      {selectionMode && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 px-4 py-3 bg-white dark:bg-[#28292c] rounded-xl shadow-lg border border-gray-200 dark:border-gray-600">
          <span className="text-sm text-gray-600 dark:text-gray-300">
            {selectedIds.size} selected
          </span>
          <button
            onClick={selectAll}
            className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            Select all
          </button>
          <button
            onClick={handleBulkDelete}
            disabled={isDeleting}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50"
          >
            {isDeleting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
            Delete
          </button>
          <button
            onClick={clearSelection}
            className="p-1.5 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Expanded Note Modal */}
      {selectedNote && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={handleBackdropClick}
        >
          <div className="bg-white dark:bg-[#28292c] rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2" />
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleCopy(editedText, selectedNote.id)}
                  className="p-2 rounded-full text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                  title="Copy"
                >
                  {copiedId === selectedNote.id ? (
                    <Check className="w-5 h-5 text-green-500" />
                  ) : (
                    <Copy className="w-5 h-5" />
                  )}
                </button>
                <button
                  onClick={() => handleDelete(selectedNote.id)}
                  className="p-2 rounded-full text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                  title="Delete"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
                <button
                  onClick={handleCloseModal}
                  className="p-2 rounded-full text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                  title="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-4">
              <textarea
                ref={textareaRef}
                value={editedText}
                onChange={(e) => setEditedText(e.target.value)}
                className="w-full bg-transparent border-none outline-none resize-none text-gray-800 dark:text-gray-200 text-base leading-relaxed min-h-[200px]"
                placeholder="Enter your note..."
              />

              {/* Original Transcription Toggle */}
              {selectedNote.originalText && selectedNote.originalText !== editedText && (
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <button
                    onClick={() => setShowOriginal(!showOriginal)}
                    className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                  >
                    {showOriginal ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                    View original transcription
                  </button>
                  {showOriginal && (
                    <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                      {selectedNote.originalText}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
