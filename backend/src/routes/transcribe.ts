import { Router, Response } from 'express';
import multer, { FileFilterCallback } from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import {
  transcribeAudio,
  rephraseText,
  processAudio,
  ToneType,
} from '../services/groq';
import { authenticateToken, optionalAuth, AuthRequest } from '../middleware/auth';

const router = Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb: (error: Error | null, destination: string) => void) => {
    const uploadDir = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb: (error: Error | null, filename: string) => void) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB max
  },
  fileFilter: (req, file, cb: FileFilterCallback) => {
    const allowedTypes = [
      'audio/mpeg',
      'audio/mp3',
      'audio/mp4',
      'audio/m4a',
      'audio/wav',
      'audio/webm',
      'audio/ogg',
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only audio files are allowed.'));
    }
  },
});

/**
 * POST /transcribe
 * Transcribe audio file to text
 */
router.post(
  '/',
  optionalAuth,
  upload.single('audio'),
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: 'Audio file required' });
        return;
      }

      const result = await transcribeAudio(req.file.path);

      // Clean up uploaded file
      fs.unlink(req.file.path, (err) => {
        if (err) console.error('Failed to delete temp file:', err);
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error('Transcription error:', error);

      // Clean up file on error
      if (req.file) {
        fs.unlink(req.file.path, () => {});
      }

      res.status(500).json({ error: 'Failed to transcribe audio' });
    }
  }
);

/**
 * POST /transcribe/rephrase
 * Rephrase text using AI
 */
router.post('/rephrase', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { text, tone = 'professional' } = req.body;

    if (!text || typeof text !== 'string') {
      res.status(400).json({ error: 'Text is required' });
      return;
    }

    if (text.length > 10000) {
      res.status(400).json({ error: 'Text too long. Maximum 10000 characters.' });
      return;
    }

    const validTones: ToneType[] = [
      'professional',
      'casual',
      'concise',
      'email',
      'meeting_notes',
      'original',
    ];

    if (!validTones.includes(tone)) {
      res.status(400).json({
        error: `Invalid tone. Must be one of: ${validTones.join(', ')}`,
      });
      return;
    }

    const result = await rephraseText(text, tone as ToneType);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Rephrasing error:', error);
    res.status(500).json({ error: 'Failed to rephrase text' });
  }
});

/**
 * POST /transcribe/process
 * Full pipeline: transcribe audio and rephrase in one call
 */
router.post(
  '/process',
  optionalAuth,
  upload.single('audio'),
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: 'Audio file required' });
        return;
      }

      const tone = (req.body.tone as ToneType) || 'professional';

      const result = await processAudio(req.file.path, tone);

      // Clean up uploaded file
      fs.unlink(req.file.path, (err) => {
        if (err) console.error('Failed to delete temp file:', err);
      });

      res.json({
        success: true,
        data: {
          transcription: result.transcription,
          rephrasing: result.rephrasing,
        },
      });
    } catch (error) {
      console.error('Process error:', error);

      // Clean up file on error
      if (req.file) {
        fs.unlink(req.file.path, () => {});
      }

      res.status(500).json({ error: 'Failed to process audio' });
    }
  }
);

/**
 * POST /transcribe/process-base64
 * Full pipeline with base64 audio input (for React Native)
 */
router.post('/process-base64', optionalAuth, async (req: AuthRequest, res: Response) => {
  let tempFilePath: string | null = null;

  try {
    const { audio, tone = 'professional', filename = 'recording.m4a' } = req.body;

    if (!audio || typeof audio !== 'string') {
      res.status(400).json({ error: 'Base64 audio data required' });
      return;
    }

    console.log('Received base64 audio, length:', audio.length);

    // Create temp file from base64
    const uploadDir = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const uniqueName = `${uuidv4()}${path.extname(filename) || '.m4a'}`;
    tempFilePath = path.join(uploadDir, uniqueName);

    // Decode base64 and write to file
    const audioBuffer = Buffer.from(audio, 'base64');
    fs.writeFileSync(tempFilePath, audioBuffer);

    console.log('Wrote temp file:', tempFilePath, 'size:', audioBuffer.length);

    const validTones: ToneType[] = [
      'professional',
      'casual',
      'concise',
      'email',
      'meeting_notes',
      'original',
    ];

    const selectedTone = validTones.includes(tone as ToneType) ? tone as ToneType : 'professional';

    const result = await processAudio(tempFilePath, selectedTone);

    // Clean up temp file
    fs.unlink(tempFilePath, (err) => {
      if (err) console.error('Failed to delete temp file:', err);
    });

    res.json({
      success: true,
      data: {
        transcription: result.transcription,
        rephrasing: result.rephrasing,
      },
    });
  } catch (error: any) {
    console.error('Process base64 error:', error);

    // Clean up temp file on error
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      fs.unlink(tempFilePath, () => {});
    }

    const errorMessage = error?.message || 'Failed to process audio';
    res.status(500).json({ error: errorMessage });
  }
});

export default router;
