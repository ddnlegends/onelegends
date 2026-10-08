export const THEME_STORAGE_KEY = "onelegends-theme";

export type ThemePreference = "system" | "light" | "dark";

export function themePreference(value: string | null | undefined): ThemePreference {
  return value === "light" || value === "dark" ? value : "system";
}

// Runs in the document head before paint. Keep this in sync with ThemeSelect;
// only this fixed source (never user content) is inserted as an inline script.
export const THEME_INIT_SCRIPT = `(() => {
  let preference = "system";
  try {
    const saved = localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
    if (saved === "light" || saved === "dark") preference = saved;
  } catch {}
  const root = document.documentElement;
  root.dataset.themePreference = preference;
  root.dataset.theme = preference === "system"
    ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
    : preference;
})();`;
