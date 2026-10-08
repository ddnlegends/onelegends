"use client";

import { useSyncExternalStore } from "react";
import { THEME_STORAGE_KEY, themePreference, type ThemePreference } from "@/lib/theme";

const THEME_CHANGE = "onelegends-theme-change";

function getPreference(): ThemePreference {
  return themePreference(document.documentElement.dataset.themePreference);
}

function getServerPreference(): ThemePreference {
  return "system";
}

function applyTheme(preference: ThemePreference) {
  const root = document.documentElement;
  root.dataset.themePreference = preference;
  root.dataset.theme = preference === "system"
    ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
    : preference;
}

function subscribe(onChange: () => void) {
  // Reconcile changes made before hydration, including a Strict Mode remount.
  let preference = getPreference();
  try {
    preference = themePreference(localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    // A blocked storage API must not prevent changing the current tab's theme.
  }
  applyTheme(preference);
  onChange();

  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const onSystemChange = () => applyTheme(getPreference());
  const onStorage = (event: StorageEvent) => {
    if (event.key === THEME_STORAGE_KEY || event.key === null) {
      applyTheme(themePreference(event.newValue));
      onChange();
    }
  };
  media.addEventListener("change", onSystemChange);
  window.addEventListener("storage", onStorage);
  window.addEventListener(THEME_CHANGE, onChange);
  return () => {
    media.removeEventListener("change", onSystemChange);
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(THEME_CHANGE, onChange);
  };
}

function setPreference(preference: ThemePreference) {
  applyTheme(preference);
  try {
    if (preference === "system") localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // The selection still works for this page when persistence is unavailable.
  }
  window.dispatchEvent(new Event(THEME_CHANGE));
}

export function ThemeSelect() {
  const preference = useSyncExternalStore(subscribe, getPreference, getServerPreference);

  return (
    <label className="inline-flex items-center gap-2 rounded-md border border-line bg-card px-2.5 py-1.5 text-xs font-semibold text-muted">
      Theme
      <select
        aria-label="Color theme"
        value={preference}
        onChange={(event) => setPreference(themePreference(event.target.value))}
        className="cursor-pointer rounded-sm bg-card py-0.5 text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <option value="system">System</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
    </label>
  );
}
