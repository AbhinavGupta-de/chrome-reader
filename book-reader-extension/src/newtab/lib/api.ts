const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3000";

// Share the API URL with the service worker so it doesn't need to hardcode it
try {
  if (typeof chrome !== "undefined" && chrome.storage?.local) {
    chrome.storage.local.set({ api_url: API_BASE });
  }
} catch { /* not in extension context */ }

let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

export function isAuthenticated(): boolean {
  return authToken !== null;
}

export function isOnline(): boolean {
  return navigator.onLine;
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  if (!navigator.onLine) {
    throw new Error("You are offline");
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (authToken) {
    headers["Authorization"] = `Bearer ${authToken}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`API error ${res.status}: ${error}`);
  }

  return res.json();
}

// Auth
export async function authenticateWithGoogle(
  idToken: string
): Promise<{ token: string; user: { id: string; email: string; name: string } }> {
  return request("/auth/google", {
    method: "POST",
    body: JSON.stringify({ idToken }),
  });
}

// Position sync
export interface RemotePosition {
  bookHash: string;
  bookTitle: string;
  chapterIndex: number;
  scrollOffset: number;
  percentage: number;
  updatedAt: string;
}

export async function syncPosition(
  bookHash: string,
  bookTitle: string,
  chapterIndex: number,
  scrollOffset: number,
  percentage: number
): Promise<RemotePosition> {
  return request(`/position/${bookHash}`, {
    method: "PUT",
    body: JSON.stringify({ bookTitle, chapterIndex, scrollOffset, percentage }),
  });
}

export async function getRemotePosition(
  bookHash: string
): Promise<RemotePosition | null> {
  try {
    return await request(`/position/${bookHash}`);
  } catch {
    return null;
  }
}

// AI features
export async function aiSummarize(
  bookHash: string,
  chapterText: string
): Promise<{ summary: string }> {
  return request("/ai/summarize", {
    method: "POST",
    body: JSON.stringify({ bookHash, text: chapterText }),
  });
}

export async function aiAsk(
  bookHash: string,
  question: string,
  context: string
): Promise<{ answer: string }> {
  return request("/ai/ask", {
    method: "POST",
    body: JSON.stringify({ bookHash, question, context }),
  });
}

export async function aiHighlights(
  bookHash: string,
  chapterText: string
): Promise<{ highlights: string[] }> {
  return request("/ai/highlights", {
    method: "POST",
    body: JSON.stringify({ bookHash, text: chapterText }),
  });
}

export async function aiExplain(
  bookHash: string,
  selection: string,
  context: string
): Promise<{ explanation: string }> {
  return request("/ai/explain", {
    method: "POST",
    body: JSON.stringify({ bookHash, selection, context }),
  });
}

export async function aiTranslate(
  bookHash: string,
  text: string,
  targetLang: string
): Promise<{ translation: string; detectedLang?: string }> {
  return request("/ai/translate", {
    method: "POST",
    body: JSON.stringify({ bookHash, text, targetLang }),
  });
}

export interface RemoteHighlight {
  id: string;
  clientId: string;
  bookHash: string;
  chapterIndex: number;
  startOffset: number;
  length: number;
  contextBefore: string;
  contextAfter: string;
  text: string;
  color: string;
  note: string | null;
  updatedAt: string;
  deletedAt: string | null;
}

export async function listRemoteHighlights(bookHash: string): Promise<RemoteHighlight[]> {
  const r = await request<{ highlights: RemoteHighlight[] }>(`/highlights/${bookHash}`);
  return r.highlights;
}

export async function putRemoteHighlight(
  bookHash: string,
  clientId: string,
  body: {
    chapterIndex: number;
    startOffset: number;
    length: number;
    contextBefore: string;
    contextAfter: string;
    text: string;
    color: string;
    note?: string | null;
  }
): Promise<{ id: string; clientId: string }> {
  return request(`/highlights/${bookHash}/${clientId}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export async function deleteRemoteHighlight(bookHash: string, clientId: string): Promise<void> {
  await request(`/highlights/${bookHash}/${clientId}`, { method: "DELETE" });
}
