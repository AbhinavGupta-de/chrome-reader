import { useCallback, useEffect, useState } from "react";
import { applyTheme } from "../lib/themes/apply";
import {
  THEME_PRESETS,
  getPresetById,
  isKnownPresetId,
} from "../lib/themes/presets";
import {
  loadCustomThemes,
  saveCustomTheme as persistCustomTheme,
  deleteCustomTheme as removeCustomTheme,
} from "../lib/themes/storage";
import type {
  BuiltInThemeDef,
  CustomThemeDef,
  ThemeDef,
} from "../lib/themes/types";

export interface UseThemeResult {
  activeThemeId: string;
  presets: ReadonlyArray<BuiltInThemeDef>;
  customThemes: ReadonlyArray<CustomThemeDef>;
  setThemeId: (themeId: string) => void;
  saveCustomTheme: (theme: CustomThemeDef) => Promise<void>;
  deleteCustomTheme: (themeId: string) => Promise<void>;
  resolveTheme: (themeId: string) => ThemeDef | undefined;
}

export function useTheme(initialThemeId: string): UseThemeResult {
  const [activeThemeId, setActiveThemeId] = useState(initialThemeId);
  const [customThemes, setCustomThemes] = useState<CustomThemeDef[]>([]);

  useEffect(() => {
    loadCustomThemes().then(setCustomThemes);
  }, []);

  useEffect(() => {
    applyTheme(activeThemeId, customThemes);
  }, [activeThemeId, customThemes]);

  const resolveTheme = useCallback(
    (themeId: string): ThemeDef | undefined => {
      if (isKnownPresetId(themeId)) return getPresetById(themeId);
      return customThemes.find((customTheme) => customTheme.id === themeId);
    },
    [customThemes],
  );

  const setThemeId = useCallback((themeId: string): void => {
    setActiveThemeId(themeId);
  }, []);

  const saveCustomTheme = useCallback(async (theme: CustomThemeDef): Promise<void> => {
    await persistCustomTheme(theme);
    setCustomThemes(await loadCustomThemes());
  }, []);

  const deleteCustomTheme = useCallback(
    async (themeId: string): Promise<void> => {
      // Capture pre-delete state so we can detect the active-theme case AFTER
      // the custom theme list has been refreshed from storage.
      const themeBeingDeleted = customThemes.find(
        (candidate) => candidate.id === themeId,
      );
      const wasActiveTheme = themeId === activeThemeId;

      await removeCustomTheme(themeId);
      setCustomThemes(await loadCustomThemes());

      // If the deleted theme was the active one, settings.themeId still points
      // at it. Switch to its preset parent so the next applyTheme renders
      // valid CSS and the existing App.tsx effect persists the new themeId.
      if (wasActiveTheme && themeBeingDeleted) {
        setActiveThemeId(themeBeingDeleted.baseId);
      }
    },
    [activeThemeId, customThemes],
  );

  return {
    activeThemeId,
    presets: THEME_PRESETS,
    customThemes,
    setThemeId,
    saveCustomTheme,
    deleteCustomTheme,
    resolveTheme,
  };
}
