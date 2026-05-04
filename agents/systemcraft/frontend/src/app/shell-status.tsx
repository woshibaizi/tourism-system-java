import {
  createContext,
  useContext,
  useMemo,
  useState,
  type Dispatch,
  type PropsWithChildren,
  type SetStateAction,
} from 'react';

export type ShellStatusTone = 'active' | 'paused' | 'success' | 'error' | 'idle';

export interface ShellStatus {
  label: string;
  detail: string;
  tone: ShellStatusTone;
  progress?: number;
  href?: string;
}

interface ShellStatusContextValue {
  status: ShellStatus | null;
  setStatus: Dispatch<SetStateAction<ShellStatus | null>>;
}

const ShellStatusContext = createContext<ShellStatusContextValue | null>(null);

export function ShellStatusProvider({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<ShellStatus | null>(null);

  const value = useMemo(
    () => ({
      status,
      setStatus,
    }),
    [status],
  );

  return (
    <ShellStatusContext.Provider value={value}>
      {children}
    </ShellStatusContext.Provider>
  );
}

export function useShellStatus() {
  const context = useContext(ShellStatusContext);

  if (!context) {
    throw new Error('useShellStatus must be used within ShellStatusProvider');
  }

  return context;
}
