'use client';

import { useState, useRef, useCallback } from 'react';

interface UseRecorderReturn {
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  audioBlob: Blob | null;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<Blob | null>;
  pauseRecording: () => void;
  resumeRecording: () => void;
  resetRecording: () => void;
}

export function useRecorder(): UseRecorderReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startTimer = useCallback(() => {
    timerRef.current = setInterval(() => {
      setDuration((prev) => prev + 1);
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startRecording = useCallback(async () => {
    try {
      // Request audio - disable echo cancellation to avoid issues with background music
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false, // Disabled - was filtering out voice when music plays
          noiseSuppression: false, // Disabled - can interfere with speech detection
          autoGainControl: true,   // Keep this for volume normalization
        },
      });
      streamRef.current = stream;

      // Log stream info for debugging
      const audioTrack = stream.getAudioTracks()[0];
      console.log('Audio track settings:', audioTrack.getSettings());

      // Try different MIME types in order of preference for Whisper compatibility
      const mimeTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/ogg;codecs=opus',
      ];

      let selectedMimeType = '';
      for (const mimeType of mimeTypes) {
        if (MediaRecorder.isTypeSupported(mimeType)) {
          selectedMimeType = mimeType;
          break;
        }
      }

      console.log('Selected mimeType:', selectedMimeType || 'default');

      const mediaRecorder = selectedMimeType
        ? new MediaRecorder(stream, { mimeType: selectedMimeType })
        : new MediaRecorder(stream);
      console.log('MediaRecorder mimeType:', mediaRecorder.mimeType);

      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        console.log('Data available, size:', event.data.size);
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event);
      };

      // Collect data every 250ms for more granular capture
      mediaRecorder.start(250);
      setIsRecording(true);
      setIsPaused(false);
      setDuration(0);
      startTimer();
    } catch (error) {
      console.error('Error starting recording:', error);
      throw error;
    }
  }, [startTimer]);

  const stopRecording = useCallback(async (): Promise<Blob | null> => {
    return new Promise((resolve) => {
      if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') {
        resolve(null);
        return;
      }

      const recorder = mediaRecorderRef.current;

      // Request any remaining data before stopping
      if (recorder.state === 'recording') {
        recorder.requestData();
      }

      recorder.onstop = () => {
        console.log('Recording stopped, chunks collected:', chunksRef.current.length);
        console.log('Chunk sizes:', chunksRef.current.map(c => c.size));

        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || 'audio/webm',
        });
        console.log('Final blob size:', blob.size, 'type:', blob.type);

        setAudioBlob(blob);

        // Stop all tracks
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }

        resolve(blob);
      };

      recorder.stop();
      stopTimer();
      setIsRecording(false);
      setIsPaused(false);
    });
  }, [stopTimer]);

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      stopTimer();
    }
  }, [stopTimer]);

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      startTimer();
    }
  }, [startTimer]);

  const resetRecording = useCallback(() => {
    setAudioBlob(null);
    setDuration(0);
    chunksRef.current = [];
  }, []);

  return {
    isRecording,
    isPaused,
    duration,
    audioBlob,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    resetRecording,
  };
}
