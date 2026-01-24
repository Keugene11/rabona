import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';

import authRoutes from './routes/auth';
import notesRoutes from './routes/notes';
import transcribeRoutes from './routes/transcribe';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Increased for base64 audio
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: { error: 'Too many requests, please try again later.' },
});
app.use(limiter);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Rabona API',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: '/health',
      auth: '/auth',
      notes: '/notes',
      transcribe: '/transcribe',
    },
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Account deletion request page
app.get('/delete-account', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Delete Account - Rabona Pro</title>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; background: #0F172A; color: #F1F5F9; }
        h1 { color: #00BFA6; }
        form { background: #1E293B; padding: 20px; border-radius: 12px; }
        label { display: block; margin: 15px 0 5px; color: #94A3B8; }
        input, textarea { width: 100%; padding: 12px; border: 1px solid #334155; border-radius: 8px; background: #0F172A; color: #F1F5F9; box-sizing: border-box; }
        button { background: #00BFA6; color: #0F172A; padding: 12px 24px; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; margin-top: 20px; width: 100%; }
        button:hover { background: #00A896; }
        .note { color: #64748B; font-size: 14px; margin-top: 20px; }
      </style>
    </head>
    <body>
      <h1>Request Account Deletion</h1>
      <p>To delete your Rabona Pro account and all associated data, please fill out this form.</p>
      <form action="https://formspree.io/f/your-form-id" method="POST">
        <label>Email address associated with your account</label>
        <input type="email" name="email" required placeholder="your@email.com">
        <label>Reason for deletion (optional)</label>
        <textarea name="reason" rows="3" placeholder="Let us know why you're leaving..."></textarea>
        <input type="hidden" name="_subject" value="Account Deletion Request - Rabona Pro">
        <button type="submit">Request Deletion</button>
      </form>
      <p class="note">Your request will be processed within 30 days. All your data including voice recordings, transcriptions, and account information will be permanently deleted.</p>
    </body>
    </html>
  `);
});

// Routes
app.use('/auth', authRoutes);
app.use('/notes', notesRoutes);
app.use('/transcribe', transcribeRoutes);

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

export default app;
