const SYNC_ALARM = "position-sync";
const SYNC_INTERVAL_MINUTES = 0.5;

interface AuthData {
  token: string;
  user: { id: string; email: string; name: string };
}

interface StoredPosition {
  bookHash: string;
  chapterIndex: number;
  scrollOffset: number;
  percentage: number;
  updatedAt: number;
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create(SYNC_ALARM, {
    periodInMinutes: SYNC_INTERVAL_MINUTES,
  });
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== SYNC_ALARM) return;

  // Skip sync entirely if not authenticated — the app works fine offline
  try {
    const authResult = await chrome.storage.local.get("auth_data");
    const authData = authResult["auth_data"] as AuthData | undefined;
    if (!authData?.token) return;

    const apiUrl = "http://localhost:3000";
    const allItems = await chrome.storage.local.get(null);

    const positionEntries = Object.entries(allItems).filter(([key]) =>
      key.startsWith("pos_")
    );

    for (const [_key, pos] of positionEntries) {
      const position = pos as StoredPosition;

      try {
        await fetch(`${apiUrl}/position/${position.bookHash}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authData.token}`,
          },
          body: JSON.stringify({
            bookTitle: "",
            chapterIndex: position.chapterIndex,
            scrollOffset: position.scrollOffset,
            percentage: position.percentage,
          }),
        });
      } catch {
        // Offline or server unreachable — positions are safe locally, retry next cycle
      }
    }
  } catch {
    // Not authenticated or storage unavailable — nothing to sync
  }
});
