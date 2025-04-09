// hooks/useAutoSave.ts
import { useCallback, useEffect, useRef } from 'react';

interface AutoSaveConfig {
  onSave: () => Promise<void>;
  dependencies?: any[];
  debounceTime?: number;
  onSaveStart?: () => void;
  onSaveComplete?: () => void;
  onSaveError?: (error: any) => void;
  maxRetries?: number;
}

export function useAutoSave({
  onSave,
  dependencies = [],
  debounceTime = 2000,
  onSaveStart,
  onSaveComplete,
  onSaveError,
  maxRetries = 3
}: AutoSaveConfig) {
  const timeoutRef = useRef<NodeJS.Timeout>();
  const retryCountRef = useRef(0);

  const saveNow = useCallback(async () => {
    if (retryCountRef.current >= maxRetries) {
      retryCountRef.current = 0;
      onSaveError?.('Auto-save failed after multiple attempts');
      return { success: false, error: 'Max retries exceeded' };
    }

    try {
      onSaveStart?.();
      await onSave();
      retryCountRef.current = 0;
      onSaveComplete?.();
      return { success: true };
    } catch (error) {
      retryCountRef.current++;
      if (retryCountRef.current < maxRetries) {
        // Exponential backoff for retries
        const delay = debounceTime * Math.pow(2, retryCountRef.current);
        timeoutRef.current = setTimeout(saveNow, delay);
      }
      onSaveError?.(error);
      return { success: false, error };
    }
  }, [onSave, debounceTime, maxRetries, onSaveStart, onSaveComplete, onSaveError]);

  const debouncedSave = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(saveNow, debounceTime);
  }, [saveNow, debounceTime]);

  useEffect(() => {
    if (dependencies.length > 0) {
      debouncedSave();
    }
  }, [...dependencies]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    saveNow,
    debouncedSave
  };
}