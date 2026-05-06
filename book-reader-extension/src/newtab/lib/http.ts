/**
 * Shared HTTP helpers + auth-token owner.
 *
 * Extracted from `lib/api.ts` so the AI router/server-client and the
 * non-AI endpoint wrappers (auth, position sync, highlights, vocab) can
 * share one auth-token store and one fetch helper without forming a
 * circular import (`api.ts → router → server.ts → api.ts`).
 *
 * IMPORTANT: the `chrome.storage.local.set({ api_url: API_BASE })` side
 * effect MUST stay here — the background service worker reads this key to
 * locate the backend without hardcoding it.
 */

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3000";

// Share the API URL with the service worker so it doesn't need to hardcode it.
try {
  if (typeof chrome !== "undefined" && chrome.storage?.local) {
    void chrome.storage.local.set({ api_url: API_BASE });
  }
} catch {
  /* not in extension context (e.g. unit tests) */
}

let authToken: string | null = null;

export function setAuthToken(token: string | null): void {
  authToken = token;
}

export function getAuthToken(): string | null {
  return authToken;
}

export function isAuthenticated(): boolean {
  return authToken !== null;
}

export function isOnline(): boolean {
  return navigator.onLine;
}

export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  if (!isOnline()) {
    throw new Error("You are offline");
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string> | undefined) ?? {}),
  };

  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`API error ${response.status}: ${errorBody}`);
  }

  return response.json() as Promise<T>;
}
