const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export interface Note {
  id: string;
  originalText: string;
  processedText: string;
  tone: string;
  duration: number;
  createdAt: string;
  updatedAt: string;
}

export interface TranscribeResponse {
  success: boolean;
  data?: {
    originalText: string;
    processedText: string;
    tone: string;
    duration: number;
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
    const response = await fetch(`${API_URL}/api/transcribe/process`, {
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
  const response = await fetch(`${API_URL}/api/notes`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  const data = await response.json();
  return data.notes || [];
}

export async function deleteNote(noteId: string, token: string): Promise<boolean> {
  const response = await fetch(`${API_URL}/api/notes/${noteId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  return response.ok;
}

export async function rephraseNote(
  noteId: string,
  tone: string,
  token: string
): Promise<{ processedText: string }> {
  const response = await fetch(`${API_URL}/api/notes/${noteId}/rephrase`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ tone }),
  });

  return response.json();
}
