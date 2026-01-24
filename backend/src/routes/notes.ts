import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import {
  createNote,
  getUserNotes,
  getNoteById,
  deleteNote,
  countUserNotes,
  DBNote,
  findUserById,
  createUser,
} from '../services/database';

const router = Router();

/**
 * POST /notes
 * Save a new note
 */
router.post('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { originalText, enhancedText, tone, detectedIntent } = req.body;

    if (!originalText) {
      res.status(400).json({ error: 'Original text is required' });
      return;
    }

    // Ensure user exists in database (auto-create if not)
    const existingUser = findUserById(req.userId!);
    if (!existingUser) {
      createUser({
        id: req.userId!,
        email: req.userEmail || 'unknown@example.com',
        displayName: req.userEmail?.split('@')[0],
      });
    }

    const note = createNote({
      id: uuidv4(),
      userId: req.userId!,
      originalText,
      enhancedText,
      tone,
      detectedIntent,
    });

    res.json({
      success: true,
      note: {
        id: note.id,
        originalText: note.original_text,
        enhancedText: note.enhanced_text,
        tone: note.tone,
        detectedIntent: note.detected_intent,
        createdAt: note.created_at,
      },
    });
  } catch (error) {
    console.error('Create note error:', error);
    res.status(500).json({ error: 'Failed to save note' });
  }
});

/**
 * GET /notes
 * Get user's notes with pagination
 */
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = parseInt(req.query.offset as string) || 0;

    const notes = getUserNotes(req.userId!, limit, offset);
    const total = countUserNotes(req.userId!);

    res.json({
      notes: notes.map((note: DBNote) => ({
        id: note.id,
        originalText: note.original_text,
        enhancedText: note.enhanced_text,
        tone: note.tone,
        detectedIntent: note.detected_intent,
        createdAt: note.created_at,
      })),
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error('Get notes error:', error);
    res.status(500).json({ error: 'Failed to get notes' });
  }
});

/**
 * GET /notes/:id
 * Get a specific note
 */
router.get('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const note = getNoteById(req.params.id, req.userId!);

    if (!note) {
      res.status(404).json({ error: 'Note not found' });
      return;
    }

    res.json({
      id: note.id,
      originalText: note.original_text,
      enhancedText: note.enhanced_text,
      tone: note.tone,
      detectedIntent: note.detected_intent,
      createdAt: note.created_at,
    });
  } catch (error) {
    console.error('Get note error:', error);
    res.status(500).json({ error: 'Failed to get note' });
  }
});

/**
 * DELETE /notes/:id
 * Delete a note
 */
router.delete('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const deleted = deleteNote(req.params.id, req.userId!);

    if (!deleted) {
      res.status(404).json({ error: 'Note not found' });
      return;
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Delete note error:', error);
    res.status(500).json({ error: 'Failed to delete note' });
  }
});

export default router;
