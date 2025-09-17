import { createContext, useContext, useState, ReactNode, useCallback } from 'react';

export interface QuotaError {
  message: string;
  quotaType: string;
  resetTime?: string;
  timestamp: Date;
}

interface QuotaNotificationState {
  isQuotaExceeded: boolean;
  quotaError: QuotaError | null;
  dismissedUntil: Date | null; // Allow temporary dismissal
}

interface QuotaNotificationContextType {
  state: QuotaNotificationState;
  setQuotaError: (error: QuotaError) => void;
  clearQuotaError: () => void;
  dismissTemporarily: (minutes: number) => void; // Dismiss for X minutes
  isCurrentlyVisible: () => boolean;
}

const initialState: QuotaNotificationState = {
  isQuotaExceeded: false,
  quotaError: null,
  dismissedUntil: null,
};

const QuotaNotificationContext = createContext<QuotaNotificationContextType | undefined>(undefined);

export function QuotaNotificationProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<QuotaNotificationState>(initialState);

  const setQuotaError = useCallback((error: QuotaError) => {
    setState(prev => ({
      ...prev,
      isQuotaExceeded: true,
      quotaError: error,
      // Clear any previous dismissal when a new quota error occurs
      dismissedUntil: null,
    }));
  }, []);

  const clearQuotaError = useCallback(() => {
    setState(initialState);
  }, []);

  const dismissTemporarily = useCallback((minutes: number) => {
    const dismissUntil = new Date();
    dismissUntil.setMinutes(dismissUntil.getMinutes() + minutes);
    
    setState(prev => ({
      ...prev,
      dismissedUntil: dismissUntil,
    }));
  }, []);

  const isCurrentlyVisible = useCallback(() => {
    if (!state.isQuotaExceeded || !state.quotaError) {
      return false;
    }
    
    // Check if currently dismissed
    if (state.dismissedUntil && new Date() < state.dismissedUntil) {
      return false;
    }
    
    return true;
  }, [state.isQuotaExceeded, state.quotaError, state.dismissedUntil]);

  return (
    <QuotaNotificationContext.Provider value={{
      state,
      setQuotaError,
      clearQuotaError,
      dismissTemporarily,
      isCurrentlyVisible,
    }}>
      {children}
    </QuotaNotificationContext.Provider>
  );
}

export function useQuotaNotification() {
  const context = useContext(QuotaNotificationContext);
  if (context === undefined) {
    throw new Error('useQuotaNotification must be used within a QuotaNotificationProvider');
  }
  return context;
}