"use client";

import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";

type MpegtsPlayer = {
  on: (event: string, listener: (...args: unknown[]) => void) => void;
  attachMediaElement: (el: HTMLMediaElement) => void;
  load: () => void;
  play: () => void | Promise<void>;
  destroy: () => void;
};

export default function VideoPlayer({
  src,
  kind,
}: {
  src: string;
  kind: "hls" | "ts";
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    setError(null);

    let hls: Hls | null = null;
    let mpegtsPlayer: MpegtsPlayer | null = null;
    let cancelled = false;

    async function setup() {
      if (!video) return;

      if (kind === "hls") {
        if (video.canPlayType("application/vnd.apple.mpegurl")) {
          video.src = src;
          video.play().catch(() => {});
          return;
        }
        if (Hls.isSupported()) {
          hls = new Hls();
          hls.on(Hls.Events.ERROR, (_evt, data) => {
            if (data.fatal) setError(`Playback error: ${data.details}`);
          });
          hls.loadSource(src);
          hls.attachMedia(video);
          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            video.play().catch(() => {});
          });
          return;
        }
        setError("HLS playback is not supported in this browser.");
        return;
      }

      // Raw MPEG-TS: play via mpegts.js over Media Source Extensions.
      const mpegts = (await import("mpegts.js")).default;
      if (cancelled) return;
      if (!mpegts.isSupported()) {
        setError("MPEG-TS playback is not supported in this browser.");
        return;
      }
      mpegtsPlayer = mpegts.createPlayer({ type: "mpegts", isLive: true, url: src });
      mpegtsPlayer.on(mpegts.Events.ERROR, (_type: unknown, detail: unknown) => {
        setError(`Playback error: ${String(detail)}`);
      });
      mpegtsPlayer.attachMediaElement(video);
      mpegtsPlayer.load();
      Promise.resolve(mpegtsPlayer.play()).catch(() => {});
    }

    setup();

    return () => {
      cancelled = true;
      if (hls) {
        hls.destroy();
        hls = null;
      }
      if (mpegtsPlayer) {
        mpegtsPlayer.destroy();
        mpegtsPlayer = null;
      }
      if (video) {
        video.removeAttribute("src");
        video.load();
      }
    };
  }, [src, kind]);

  return (
    <div className="flex w-full flex-col gap-2">
      <video ref={videoRef} controls autoPlay className="w-full rounded-lg bg-black" />
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}
