export type StalkerProfileConfig = {
  id: string;
  portalUrl: string;
  macAddress: string;
  serialNumber?: string | null;
  stbType?: string | null;
  clientType?: string | null;
  deviceId?: string | null;
  deviceId2?: string | null;
  signature?: string | null;
  hwVersion?: string | null;
  hwVersion2?: string | null;
  prehash?: string | null;
  imageVersion?: string | null;
  apiSignature?: string | null;
  timezone?: string | null;
};

export type Genre = {
  id: string;
  title: string;
};

export type Channel = {
  id: string;
  name: string;
  number: string | null;
  cmd: string;
  logo: string | null;
  genreId: string | null;
};

export type ResolvedStream = {
  url: string;
  kind: "hls" | "ts";
};

export type VodCategory = {
  id: string;
  title: string;
};

export type VodItem = {
  id: string;
  name: string;
  cmd: string;
  logo: string | null;
  categoryId: string | null;
  isSeries: boolean;
  year: string | null;
  description: string | null;
};

export type SeriesEpisode = {
  id: string;
  title: string;
  cmd: string;
  seasonId: string;
};

export type SeriesSeason = {
  id: string;
  title: string;
  episodes: SeriesEpisode[];
};

export type EpgProgram = {
  id: string;
  channelId: string;
  title: string;
  description: string | null;
  startTimestamp: number;
  stopTimestamp: number;
};
