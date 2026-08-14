export function buildWatchUrl(params: {
  cmd: string;
  type: "itv" | "vod";
  contentType?: "MOVIE" | "EPISODE";
  contentId?: string;
  title: string;
  seriesId?: string | null;
  seriesTitle?: string | null;
  logo?: string | null;
}): string {
  const qs = new URLSearchParams();
  qs.set("cmd", params.cmd);
  qs.set("type", params.type);
  qs.set("title", params.title);
  if (params.contentType) qs.set("contentType", params.contentType);
  if (params.contentId) qs.set("contentId", params.contentId);
  if (params.seriesId) qs.set("seriesId", params.seriesId);
  if (params.seriesTitle) qs.set("seriesTitle", params.seriesTitle);
  if (params.logo) qs.set("logo", params.logo);
  return `/watch?${qs.toString()}`;
}
