"use client";

import { useEffect, useRef, useState } from "react";

/** Keep Drive's file-opening control hidden even while viewing full screen. */
export function AnonymousDriveFrame({ src, label }: { src: string; label: string }) {
  const container = useRef<HTMLDivElement>(null);
  const [fullScreen, setFullScreen] = useState(false);

  useEffect(() => {
    const update = () => setFullScreen(document.fullscreenElement === container.current);
    document.addEventListener("fullscreenchange", update);
    return () => document.removeEventListener("fullscreenchange", update);
  }, []);

  async function toggleFullScreen() {
    if (!container.current?.requestFullscreen) return;
    try {
      if (document.fullscreenElement === container.current) {
        await document.exitFullscreen();
      } else {
        await container.current.requestFullscreen();
      }
    } catch {
      // Some browsers do not support full screen for arbitrary elements.
    }
  }

  return (
    <div ref={container} className="anonymous-drive-frame relative aspect-video w-full overflow-hidden rounded-xl border border-line bg-black">
      <iframe
        title={label}
        src={src}
        className="absolute inset-0 h-full w-full"
        allow="autoplay"
        // Drive playback works, but popups, top navigation, and the iframe's
        // own full-screen mode are blocked so its file title cannot surface.
        sandbox="allow-scripts allow-same-origin allow-forms"
      />
      {/* Drive owns the embedded UI. Mask its whole header so neither its
          open control nor a hover-revealed file title reaches the shared screen. */}
      <div
        aria-hidden="true"
        data-testid="anonymous-drive-cover"
        className="absolute inset-x-0 top-0 z-10 h-20 bg-black"
      />
      <button
        type="button"
        onClick={() => { void toggleFullScreen(); }}
        className="absolute left-3 top-5 z-20 rounded-md border border-white/30 bg-black px-3 py-1.5 text-xs font-semibold text-white"
      >
        {fullScreen ? "Exit full screen" : "Full screen"}
      </button>
      <span className="absolute right-3 top-7 z-20 text-xs font-semibold uppercase tracking-wide text-white/80">
        Anonymous viewing
      </span>
    </div>
  );
}
