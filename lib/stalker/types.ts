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
