import type { CustomThemeDef } from "./types";

export const CUSTOM_THEMES_STORAGE_KEY = "custom_themes";

async function readStoredThemes(): Promise<CustomThemeDef[]> {
  const raw = await chrome.storage.local.get(CUSTOM_THEMES_STORAGE_KEY);
  const stored = raw[CUSTOM_THEMES_STORAGE_KEY];
  if (!Array.isArray(stored)) return [];
  return stored as CustomThemeDef[];
}

async function writeStoredThemes(themes: CustomThemeDef[]): Promise<void> {
  await chrome.storage.local.set({ [CUSTOM_THEMES_STORAGE_KEY]: themes });
}

export async function loadCustomThemes(): Promise<CustomThemeDef[]> {
  return readStoredThemes();
}

export async function saveCustomTheme(theme: CustomThemeDef): Promise<void> {
  const existing = await readStoredThemes();
  const withoutDuplicate = existing.filter((candidate) => candidate.id !== theme.id);
  await writeStoredThemes([...withoutDuplicate, theme]);
}

export async function deleteCustomTheme(themeId: string): Promise<void> {
  const existing = await readStoredThemes();
  await writeStoredThemes(existing.filter((candidate) => candidate.id !== themeId));
}
