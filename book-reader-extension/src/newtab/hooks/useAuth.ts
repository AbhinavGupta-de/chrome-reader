import { useState, useCallback, useEffect } from "react";
import { authenticateWithGoogle, setAuthToken } from "../lib/api";

interface User {
  id: string;
  email: string;
  name: string;
}

interface AuthData {
  token: string;
  user: User;
}

const AUTH_STORAGE_KEY = "auth_data";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const result = await chrome.storage.local.get(AUTH_STORAGE_KEY);
        const data = result[AUTH_STORAGE_KEY] as AuthData | undefined;
        if (data?.token && data?.user) {
          setAuthToken(data.token);
          setUser(data.user);
        }
      } catch {
        // No stored auth
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const signIn = useCallback(async () => {
    setError(null);
    setLoading(true);

    try {
      const result = await chrome.identity.getAuthToken({ interactive: true });
      const idToken = result.token;
      if (!idToken) throw new Error("No token received");

      const response = await authenticateWithGoogle(idToken);
      setAuthToken(response.token);
      setUser(response.user);

      await chrome.storage.local.set({
        [AUTH_STORAGE_KEY]: {
          token: response.token,
          user: response.user,
        },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign in failed");
    } finally {
      setLoading(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    setAuthToken(null);
    setUser(null);
    await chrome.storage.local.remove(AUTH_STORAGE_KEY);
    chrome.identity.clearAllCachedAuthTokens(() => {});
  }, []);

  return { user, loading, error, signIn, signOut };
}
