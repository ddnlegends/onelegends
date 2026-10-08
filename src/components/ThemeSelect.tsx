"use client";

import { useSyncExternalStore } from "react";
import { THEME_STORAGE_KEY, themePreference, type ThemePreference } from "@/lib/theme";

const THEME_CHANGE = "onelegends-theme-change";
const THEMES: ThemePreference[] = ["system", "light", "dark"];

function ThemeIcon({ theme }: { theme: ThemePreference }) {
  if (theme === "system") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <rect x="3" y="4" width="18" height="14" rx="2" />
        <path d="M9 21h6m-3-3v3" />
      </svg>
    );
  }
  if (theme === "light") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="h-5 w-5">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" />
      </svg>
    );
  }
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <path d="M20.3 15.6A8.5 8.5 0 0 1 8.4 3.7 8.5 8.5 0 1 0 20.3 15.6Z" />
    </svg>
  );
}

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
    <div role="group" aria-label="Color theme" className="fixed right-3 top-2.5 z-50 flex gap-1 rounded-full border border-line bg-card p-1 shadow-md">
      {THEMES.map((theme) => (
        <button
          key={theme}
          type="button"
          aria-label={`${theme[0].toUpperCase()}${theme.slice(1)} theme`}
          aria-pressed={preference === theme}
          title={`${theme[0].toUpperCase()}${theme.slice(1)} theme`}
          onClick={() => setPreference(theme)}
          className="flex h-9 w-9 items-center justify-center rounded-full text-muted transition-colors hover:bg-blush hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent aria-pressed:bg-blush aria-pressed:text-accent"
        >
          <ThemeIcon theme={theme} />
        </button>
      ))}
    </div>
  );
}
