import { ToneType, Note, User, ApiResponse, TranscriptionResponse, RephrasingResponse } from '../types';

// Configure base URL
const API_BASE_URL = __DEV__
  ? 'http://192.168.1.158:3000'  // Local dev server
  : 'https://voicenote-pro.onrender.com';  // Production server

class ApiService {
  private token: string | null = null;

  setToken(token: string | null) {
    this.token = token;
  }

  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    return headers;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers: {
          ...this.getHeaders(),
          ...options.headers,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error || 'Request failed',
        };
      }

      return {
        success: true,
        data: data.data || data,
      };
    } catch (error) {
      console.error('API request error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error',
      };
    }
  }

  // Auth endpoints
  async sendOtp(email: string): Promise<ApiResponse<{ message: string; devOtp?: string }>> {
    return this.request('/auth/send-otp', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  async verifyOtp(email: string, otp: string): Promise<ApiResponse<{ user: User; token: string }>> {
    return this.request('/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ email, otp }),
    });
  }

  async getCurrentUser(): Promise<ApiResponse<{ user: User }>> {
    return this.request('/auth/me');
  }

  // Notes endpoints
  async getNotes(): Promise<ApiResponse<Note[]>> {
    return this.request('/notes');
  }

  async getNote(noteId: string): Promise<ApiResponse<Note>> {
    return this.request(`/notes/${noteId}`);
  }

  async createNote(noteData: Partial<Note>): Promise<ApiResponse<Note>> {
    return this.request('/notes', {
      method: 'POST',
      body: JSON.stringify(noteData),
    });
  }

  async updateNote(noteId: string, updates: Partial<Note>): Promise<ApiResponse<Note>> {
    return this.request(`/notes/${noteId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteNote(noteId: string): Promise<ApiResponse<{ message: string }>> {
    return this.request(`/notes/${noteId}`, {
      method: 'DELETE',
    });
  }

  async toggleNoteStar(noteId: string): Promise<ApiResponse<{ isStarred: boolean }>> {
    return this.request(`/notes/${noteId}/star`, {
      method: 'POST',
    });
  }

  // Transcription endpoint - sends audio as base64 using fetch with blob
  async processAudio(
    audioUri: string,
    tone: ToneType
  ): Promise<ApiResponse<{
    transcription: TranscriptionResponse;
    rephrasing: RephrasingResponse;
  }>> {
    try {
      console.log('Reading audio file:', audioUri);

      // Fetch the file and convert to base64
      const fileResponse = await fetch(audioUri);
      const blob = await fileResponse.blob();

      // Convert blob to base64
      const base64Audio = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          // Remove the data URL prefix (e.g., "data:audio/m4a;base64,")
          const base64 = result.split(',')[1] || result;
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      console.log('Audio file size (base64):', base64Audio.length);
      console.log('Sending to:', `${API_BASE_URL}/transcribe/process-base64`);

      const response = await fetch(`${API_BASE_URL}/transcribe/process-base64`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.token ? { 'Authorization': `Bearer ${this.token}` } : {}),
        },
        body: JSON.stringify({
          audio: base64Audio,
          tone: tone,
          filename: 'recording.m4a',
        }),
      });

      const data = await response.json();
      console.log('Response:', data);

      if (!response.ok) {
        return {
          success: false,
          error: data.error || 'Failed to process audio',
        };
      }

      return {
        success: true,
        data: data.data,
      };
    } catch (error) {
      console.error('Process audio error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Processing failed',
      };
    }
  }

  async rephraseText(text: string, tone: ToneType): Promise<ApiResponse<RephrasingResponse>> {
    return this.request('/transcribe/rephrase', {
      method: 'POST',
      body: JSON.stringify({ text, tone }),
    });
  }
}

export const apiService = new ApiService();
export default apiService;
