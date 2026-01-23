import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Note } from '../types';

interface NotesStore {
  notes: Note[];
  isLoading: boolean;
  selectedFolder: string | null;
  searchQuery: string;

  // Actions
  setNotes: (notes: Note[]) => void;
  addNote: (note: Note) => void;
  updateNote: (noteId: string, updates: Partial<Note>) => void;
  deleteNote: (noteId: string) => void;
  setLoading: (loading: boolean) => void;
  setSelectedFolder: (folder: string | null) => void;
  setSearchQuery: (query: string) => void;
  toggleStar: (noteId: string) => void;
}

export const useNotesStore = create<NotesStore>()(
  persist(
    (set, get) => ({
      notes: [],
      isLoading: false,
      selectedFolder: null,
      searchQuery: '',

      setNotes: (notes) => set({ notes }),

      addNote: (note) => set((state) => ({
        notes: [note, ...state.notes],
      })),

      updateNote: (noteId, updates) => set((state) => ({
        notes: state.notes.map((note) =>
          note.id === noteId ? { ...note, ...updates, updatedAt: new Date() } : note
        ),
      })),

      deleteNote: (noteId) => set((state) => ({
        notes: state.notes.filter((note) => note.id !== noteId),
      })),

      setLoading: (isLoading) => set({ isLoading }),

      setSelectedFolder: (selectedFolder) => set({ selectedFolder }),

      setSearchQuery: (searchQuery) => set({ searchQuery }),

      toggleStar: (noteId) => set((state) => ({
        notes: state.notes.map((note) =>
          note.id === noteId ? { ...note, isStarred: !note.isStarred } : note
        ),
      })),
    }),
    {
      name: 'voicenote-notes-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ notes: state.notes }), // Only persist notes
    }
  )
);

// Selectors
export const useFilteredNotes = () => {
  const { notes, selectedFolder, searchQuery } = useNotesStore();

  return notes.filter((note) => {
    // Filter by folder
    if (selectedFolder && note.folder !== selectedFolder) {
      return false;
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesTitle = note.title?.toLowerCase().includes(query);
      const matchesText = note.originalText.toLowerCase().includes(query);
      const matchesRephrased = note.rephrasedText?.toLowerCase().includes(query);
      return matchesTitle || matchesText || matchesRephrased;
    }

    return true;
  });
};
