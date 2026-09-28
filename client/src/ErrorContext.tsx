import { createContext, useContext, useState, type ReactNode } from 'react';

interface ErrorContextValue {
  error: string;
  setError: (message: string) => void;
  clearError: () => void;
}

const ErrorContext = createContext<ErrorContextValue | null>(null);

export function ErrorProvider({ children }: { children: ReactNode }) {
  const [error, setErrorState] = useState('');

  const setError = (message: string) => setErrorState(message);
  const clearError = () => setErrorState('');

  return (
    <ErrorContext.Provider value={{ error, setError, clearError }}>
      {children}
    </ErrorContext.Provider>
  );
}

export function useError(): ErrorContextValue {
  const ctx = useContext(ErrorContext);
  if (!ctx) throw new Error('useError must be used inside <ErrorProvider>');
  return ctx;
}
