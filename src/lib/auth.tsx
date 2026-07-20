import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { loginRequest, setAuthAccessors, type LoginCredentials } from "./api";

type Session = { accessToken: string; expiresAt: number };
type AuthContextValue = {
  session: Session | null;
  login: (credentials: LoginCredentials, remember: boolean) => Promise<void>;
  logout: () => void;
};

const STORAGE_KEY = "command-center.session.v1";
const AuthContext = createContext<AuthContextValue | null>(null);

function restoreSession(): Session | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<Session>;
    if (
      typeof value.accessToken === "string" &&
      typeof value.expiresAt === "number" &&
      value.expiresAt > Date.now()
    )
      return value as Session;
  } catch {
    /* Ignore invalid or unavailable storage. */
  }
  localStorage.removeItem(STORAGE_KEY);
  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(() => restoreSession());
  const sessionRef = useRef(session);
  const logout = useCallback(() => {
    sessionRef.current = null;
    localStorage.removeItem(STORAGE_KEY);
    setSession(null);
  }, []);

  useLayoutEffect(() => {
    setAuthAccessors(() => sessionRef.current?.accessToken ?? null, logout);
  }, [logout]);

  useEffect(() => {
    if (!session) return;
    const remaining = session.expiresAt - Date.now();
    if (remaining <= 0) return logout();
    const timer = window.setTimeout(logout, Math.min(remaining, 2_147_483_647));
    return () => window.clearTimeout(timer);
  }, [session, logout]);

  const login = useCallback(async (credentials: LoginCredentials, remember: boolean) => {
    const next = await loginRequest(credentials);
    sessionRef.current = next;
    setSession(next);
    if (remember) localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    else localStorage.removeItem(STORAGE_KEY);
  }, []);

  const value = useMemo(() => ({ session, login, logout }), [session, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
