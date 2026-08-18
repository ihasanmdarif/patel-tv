"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { setFocus } from "@noriginmedia/norigin-spatial-navigation";
import { FocusableButton } from "@/components/spatial/FocusableButton";
import { FocusableSection } from "@/components/spatial/FocusableSection";
import { isBackKey } from "@/lib/tv-keys";

const SEEK_SECONDS = 10;
const CONTROLS_HIDE_DELAY_MS = 4000;
const PLAY_PAUSE_FOCUS_KEY = "VIDEO_PLAYER_PLAY_PAUSE";

function IconPlay(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M8 5.5v13l11-6.5-11-6.5Z" />
    </svg>
  );
}

function IconPause(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M7 5h4v14H7zM13 5h4v14h-4z" />
    </svg>
  );
}

function IconSeekBack(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M11 6 5 12l6 6M19 6l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconSeekForward(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M13 6l6 6-6 6M5 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconMute(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M5 9v6h4l5 4V5L9 9H5Z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M17 9l4 6M21 9l-4 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconVolume(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M5 9v6h4l5 4V5L9 9H5Z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16.5 9a4 4 0 0 1 0 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconBack(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M19 12H5M11 6l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconExpand(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path
        d="M9 4H4v5M15 4h5v5M4 15v5h5M20 15v5h-5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconCollapse(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path
        d="M4 9h5V4M15 4v5h5M20 15h-5v5M9 20v-5H4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function VideoPlayer({
  src,
  kind,
  startAt,
  onProgress,
  onEnded,
  onBack,
}: {
  src: string;
  kind: "hls" | "ts";
  startAt?: number;
  onProgress?: (currentTime: number, duration: number) => void;
  onEnded?: () => void;
  /** Fires on remote/Escape "Back" and the on-screen Back button. */
  onBack?: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hideControlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(true);
  const [muted, setMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    setError(null);

    let hls: Hls | null = null;

    function seekToStart() {
      if (video && startAt && startAt > 0 && startAt < (video.duration || Infinity) * 0.95) {
        video.currentTime = startAt;
      }
    }

    function setup() {
      if (!video) return;

      // The API routes that resolve a stream always remux raw MPEG-TS to HLS
      // server-side before handing a URL to the browser (Safari's MediaSource can't
      // play raw TS), so this component only ever needs to speak HLS. A stray
      // "ts" kind at this point means something upstream didn't remux it.
      if (kind !== "hls") {
        setError("This stream type isn't supported for playback.");
        return;
      }

      // Chrome's canPlayType("application/vnd.apple.mpegurl") can return "maybe" even
      // though it can't actually demux HLS — only Safari has real native HLS support.
      // Prefer hls.js whenever it's available and only fall back to native <video> src
      // (Safari, or any browser lacking MSE) when it isn't.
      if (Hls.isSupported()) {
        hls = new Hls();
        hls.on(Hls.Events.ERROR, (_evt, data) => {
          if (data.fatal) setError(`Playback error: ${data.details}`);
        });
        hls.loadSource(src);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          seekToStart();
          video.play().catch(() => {});
        });
        return;
      }
      if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = src;
        video.addEventListener("loadedmetadata", seekToStart, { once: true });
        video.play().catch(() => {});
        return;
      }
      setError("HLS playback is not supported in this browser.");
    }

    setup();

    return () => {
      if (hls) {
        hls.destroy();
        hls = null;
      }
      if (video) {
        video.removeAttribute("src");
        video.load();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- startAt is only meant to apply on (re)load, not on every currentTime tick
  }, [src, kind]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      if (video.duration) {
        setDuration(video.duration);
        onProgress?.(video.currentTime, video.duration);
      }
    };
    const handlePlay = () => setPlaying(true);
    const handlePause = () => setPlaying(false);
    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("play", handlePlay);
    video.addEventListener("pause", handlePause);
    return () => {
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("pause", handlePause);
    };
  }, [onProgress]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !onEnded) return;
    video.addEventListener("ended", onEnded);
    return () => video.removeEventListener("ended", onEnded);
  }, [onEnded]);

  // Auto-focus the play/pause button on mount so the first D-pad press a user
  // makes when playback starts does something obvious.
  useEffect(() => {
    setFocus(PLAY_PAUSE_FOCUS_KEY);
  }, []);

  const scheduleControlsHide = useCallback(() => {
    if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
    hideControlsTimer.current = setTimeout(() => setControlsVisible(false), CONTROLS_HIDE_DELAY_MS);
  }, []);

  const showControlsTemporarily = useCallback(() => {
    setControlsVisible(true);
    scheduleControlsHide();
  }, [scheduleControlsHide]);

  useEffect(() => {
    // Controls start visible (initial state), so this effect only needs to arm the
    // hide countdown, not call setState itself.
    scheduleControlsHide();
    const container = containerRef.current;
    if (!container) return;
    // TV remotes only generate key events, never mousemove — the control bar must
    // reappear on any key press, not just on mouse activity.
    const handleActivity = () => showControlsTemporarily();
    const handleKeyDown = (e: KeyboardEvent) => {
      showControlsTemporarily();
      if (isBackKey(e)) {
        // First Back press backs out of fullscreen instead of navigating away —
        // matches what a remote's Back button should do mid-playback. A second
        // press (now out of fullscreen) falls through to onBack as normal.
        if (document.fullscreenElement) {
          e.preventDefault();
          document.exitFullscreen().catch(() => {});
          return;
        }
        onBack?.();
      }
    };
    const handleFullscreenChange = () => setFullscreen(document.fullscreenElement === container);
    container.addEventListener("mousemove", handleActivity);
    window.addEventListener("keydown", handleKeyDown);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      container.removeEventListener("mousemove", handleActivity);
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
    };
  }, [onBack, scheduleControlsHide, showControlsTemporarily]);

  function togglePlay() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) video.play().catch(() => {});
    else video.pause();
  }

  function seek(deltaSec: number) {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(0, Math.min(video.duration || Infinity, video.currentTime + deltaSec));
  }

  function toggleMute() {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setMuted(video.muted);
  }

  function toggleFullscreen() {
    const container = containerRef.current;
    if (!container) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      container.requestFullscreen().catch(() => {});
    }
  }

  return (
    <div
      ref={containerRef}
      className="relative flex w-full flex-col gap-2"
      onMouseMove={showControlsTemporarily}
    >
      <video ref={videoRef} autoPlay className="w-full rounded-lg bg-black" />
      <FocusableSection
        as="div"
        className={`absolute inset-x-0 bottom-0 flex items-center gap-3 rounded-b-lg bg-gradient-to-t from-black/80 to-transparent px-4 py-3 transition-opacity ${
          controlsVisible ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        {onBack && (
          <FocusableButton
            onActivate={onBack}
            aria-label="Back"
            scrollIntoViewOnFocus={false}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
          >
            <IconBack className="h-4 w-4" />
          </FocusableButton>
        )}
        <FocusableButton
          onActivate={() => seek(-SEEK_SECONDS)}
          aria-label={`Back ${SEEK_SECONDS} seconds`}
          scrollIntoViewOnFocus={false}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
        >
          <IconSeekBack className="h-4 w-4" />
        </FocusableButton>
        <FocusableButton
          focusKey={PLAY_PAUSE_FOCUS_KEY}
          onActivate={togglePlay}
          aria-label={playing ? "Pause" : "Play"}
          scrollIntoViewOnFocus={false}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/90 text-black transition hover:bg-white"
        >
          {playing ? <IconPause className="h-5 w-5" /> : <IconPlay className="h-5 w-5" />}
        </FocusableButton>
        <FocusableButton
          onActivate={() => seek(SEEK_SECONDS)}
          aria-label={`Forward ${SEEK_SECONDS} seconds`}
          scrollIntoViewOnFocus={false}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
        >
          <IconSeekForward className="h-4 w-4" />
        </FocusableButton>
        <FocusableButton
          onActivate={toggleMute}
          aria-label={muted ? "Unmute" : "Mute"}
          scrollIntoViewOnFocus={false}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
        >
          {muted ? <IconMute className="h-4 w-4" /> : <IconVolume className="h-4 w-4" />}
        </FocusableButton>
        <FocusableButton
          onActivate={toggleFullscreen}
          aria-label={fullscreen ? "Exit fullscreen" : "Fullscreen"}
          scrollIntoViewOnFocus={false}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
        >
          {fullscreen ? <IconCollapse className="h-4 w-4" /> : <IconExpand className="h-4 w-4" />}
        </FocusableButton>
        {duration > 0 && (
          <span className="ml-1 shrink-0 text-xs text-white/80">
            {formatDuration(currentTime)} / {formatDuration(duration)}
          </span>
        )}
      </FocusableSection>
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}
