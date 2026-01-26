const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001').replace(/\/$/, '');

export interface Note {
  id: string;
  originalText: string;
  processedText: string;
  enhancedText?: string;
  tone: string;
  duration?: number;
  detectedIntent?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface Suggestion {
  type: 'improvement' | 'addition' | 'structure' | 'tip';
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
}

export type ContentIntent =
  | 'job_application'
  | 'college_essay'
  | 'scholarship_application'
  | 'competition_entry'
  | 'club_application'
  | 'cover_letter'
  | 'personal_statement'
  | 'project_description'
  | 'email_draft'
  | 'meeting_notes'
  | 'general';

export interface TranscribeResponse {
  success: boolean;
  data?: {
    originalText: string;
    processedText: string;
    tone: string;
    duration: number;
    detectedIntent?: ContentIntent;
    suggestions?: Suggestion[];
  };
  error?: string;
}

export async function transcribeAudio(
  audioBlob: Blob,
  token?: string | null
): Promise<TranscribeResponse> {
  const formData = new FormData();
  formData.append('audio', audioBlob, 'recording.webm');
  formData.append('tone', 'professional'); // AI auto-adapts based on content

  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    // Use /process endpoint for transcription + rephrasing
    const response = await fetch(`${API_URL}/transcribe/process`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        error: errorData.error || `Server error: ${response.status}`,
      };
    }

    const result = await response.json();

    // Transform response to match our interface
    if (result.success && result.data) {
      return {
        success: true,
        data: {
          originalText: result.data.transcription?.text || '',
          processedText: result.data.rephrasing?.rephrasedText || '',
          tone: result.data.rephrasing?.tone || 'professional',
          duration: result.data.transcription?.duration || 0,
          detectedIntent: result.data.rephrasing?.detectedIntent,
          suggestions: result.data.rephrasing?.suggestions || [],
        },
      };
    }

    return result;
  } catch (error) {
    return {
      success: false,
      error: 'Failed to connect to server. Please try again.',
    };
  }
}

export async function getNotes(token: string): Promise<Note[]> {
  const response = await fetch(`${API_URL}/notes`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  const data = await response.json();
  // Map backend response to frontend Note interface
  return (data.notes || []).map((note: { id: string; originalText: string; enhancedText?: string; tone: string; detectedIntent?: string; createdAt: string }) => ({
    ...note,
    processedText: note.enhancedText || note.originalText,
  }));
}

export async function saveNote(
  token: string,
  note: {
    originalText: string;
    enhancedText?: string;
    tone?: string;
    detectedIntent?: string;
  }
): Promise<Note | null> {
  try {
    const response = await fetch(`${API_URL}/notes`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(note),
    });

    if (!response.ok) {
      console.error('Failed to save note:', response.status);
      return null;
    }

    const data = await response.json();
    if (data.success && data.note) {
      return {
        ...data.note,
        processedText: data.note.enhancedText || data.note.originalText,
      };
    }
    return null;
  } catch (error) {
    console.error('Error saving note:', error);
    return null;
  }
}

export async function deleteNote(noteId: string, token: string): Promise<boolean> {
  const response = await fetch(`${API_URL}/notes/${noteId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  return response.ok;
}

export async function updateNote(
  noteId: string,
  token: string,
  updates: { enhancedText?: string; originalText?: string }
): Promise<Note | null> {
  try {
    const response = await fetch(`${API_URL}/notes/${noteId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      console.error('Failed to update note:', response.status);
      return null;
    }

    const data = await response.json();
    if (data.success && data.note) {
      return {
        ...data.note,
        processedText: data.note.enhancedText || data.note.originalText,
      };
    }
    return null;
  } catch (error) {
    console.error('Error updating note:', error);
    return null;
  }
}

export async function rephraseNote(
  noteId: string,
  tone: string,
  token: string
): Promise<{ processedText: string }> {
  const response = await fetch(`${API_URL}/notes/${noteId}/rephrase`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ tone }),
  });

  return response.json();
}

// Stripe subscription functions
export interface SubscriptionStatus {
  isSubscribed: boolean;
  plan?: 'monthly' | 'yearly';
  status?: string;
  currentPeriodEnd?: string;
}

export async function getSubscriptionStatus(token: string): Promise<SubscriptionStatus> {
  const response = await fetch(`${API_URL}/stripe/subscription-status`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  return response.json();
}

export async function createCheckoutSession(
  token: string,
  plan: 'monthly' | 'yearly'
): Promise<{ url: string }> {
  const response = await fetch(`${API_URL}/stripe/create-checkout-session`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ plan }),
  });

  return response.json();
}

export async function createPortalSession(token: string): Promise<{ url: string }> {
  const response = await fetch(`${API_URL}/stripe/create-portal-session`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  return response.json();
}
