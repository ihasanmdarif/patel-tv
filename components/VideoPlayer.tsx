"use client";

import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";

export default function VideoPlayer({
  src,
  kind,
  startAt,
  onProgress,
  onEnded,
}: {
  src: string;
  kind: "hls" | "ts";
  startAt?: number;
  onProgress?: (currentTime: number, duration: number) => void;
  onEnded?: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

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
    if (!video || !onProgress) return;
    const handle = () => {
      if (video.duration) onProgress(video.currentTime, video.duration);
    };
    video.addEventListener("timeupdate", handle);
    return () => video.removeEventListener("timeupdate", handle);
  }, [onProgress]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !onEnded) return;
    video.addEventListener("ended", onEnded);
    return () => video.removeEventListener("ended", onEnded);
  }, [onEnded]);

  return (
    <div className="flex w-full flex-col gap-2">
      <video ref={videoRef} controls autoPlay className="w-full rounded-lg bg-black" />
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}
