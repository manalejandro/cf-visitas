/** Helpers to read the Cloudflare request metadata (`request.cf`). */

export interface RequestGeo {
  ip: string;
  country: string | null;
  region: string | null;
  city: string | null;
  org: string | null;
  latitude: number | null;
  longitude: number | null;
}

type CfProperties = IncomingRequestCfProperties<unknown>;

export function getClientIp(request: Request): string {
  return (
    request.headers.get("cf-connecting-ip") ||
    (request.headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim() ||
    ""
  );
}

export function getRequestGeo(request: Request): RequestGeo {
  const cf = (request as Request<unknown, CfProperties>).cf;
  const ip = getClientIp(request);

  if (!cf) {
    return { ip, country: null, region: null, city: null, org: null, latitude: null, longitude: null };
  }

  const latitude = Number.parseFloat(String(cf.latitude ?? ""));
  const longitude = Number.parseFloat(String(cf.longitude ?? ""));

  return {
    ip,
    country: (cf.country as string | undefined) ?? null,
    region: (cf.region as string | undefined) ?? null,
    city: (cf.city as string | undefined) ?? null,
    org: (cf.asOrganization as string | undefined) ?? null,
    latitude: Number.isFinite(latitude) ? latitude : null,
    longitude: Number.isFinite(longitude) ? longitude : null,
  };
}

export function getRequestMeta(request: Request): Record<string, unknown> {
  const cf = (request as Request<unknown, CfProperties>).cf;
  const meta: Record<string, unknown> = {
    userAgent: request.headers.get("user-agent") ?? "",
    acceptLanguage: request.headers.get("accept-language") ?? "",
  };
  if (cf) {
    meta.colo = cf.colo ?? null;
    meta.continent = cf.continent ?? null;
    meta.asn = cf.asn ?? null;
    meta.timezone = cf.timezone ?? null;
    meta.httpProtocol = cf.httpProtocol ?? null;
    meta.tlsVersion = cf.tlsVersion ?? null;
    meta.clientTcpRtt = cf.clientTcpRtt ?? null;
  }
  return meta;
}
