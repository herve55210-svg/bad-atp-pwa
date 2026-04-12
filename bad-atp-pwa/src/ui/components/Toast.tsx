import React, { createContext, useCallback, useContext, useState } from 'react';

interface ToastCtx { show: (msg: string) => void; }
const Ctx = createContext<ToastCtx>({ show: () => {} });

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null);
  const timerRef = React.useRef<ReturnType<typeof setTimeout>>();

  const show = useCallback((m: string) => {
    setMsg(m);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setMsg(null), 2200);
  }, []);

  return (
    <Ctx.Provider value={{ show }}>
      {children}
      {msg && <div className="toast">{msg}</div>}
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
