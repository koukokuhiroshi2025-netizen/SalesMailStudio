import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { BootstrapData } from "../shared/types";
import { api, ApiError, postJson } from "./api";

interface AppDataContextValue {
  data: BootstrapData | null;
  loading: boolean;
  authenticated: boolean;
  error: string | null;
  selectedContactIds: Set<string>;
  setSelectedContactIds: (ids: Set<string>) => void;
  refresh: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AppDataContext = createContext<AppDataContextValue | null>(null);

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<BootstrapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const next = await api<BootstrapData>("/api/bootstrap");
      setData(next);
      setAuthenticated(true);
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) {
        setAuthenticated(false);
        setData(null);
      } else {
        setError(cause instanceof Error ? cause.message : "データを読み込めませんでした");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    await postJson("/api/auth/login", { email, password });
    setAuthenticated(true);
    setLoading(true);
    await refresh();
  }, [refresh]);

  const logout = useCallback(async () => {
    await postJson("/api/auth/logout", {});
    setAuthenticated(false);
    setData(null);
  }, []);

  const value = useMemo(() => ({
    data,
    loading,
    authenticated,
    error,
    selectedContactIds,
    setSelectedContactIds,
    refresh,
    login,
    logout,
  }), [data, loading, authenticated, error, selectedContactIds, refresh, login, logout]);

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData() {
  const context = useContext(AppDataContext);
  if (!context) throw new Error("useAppData must be used inside AppDataProvider");
  return context;
}
