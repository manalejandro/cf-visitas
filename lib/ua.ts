/**
 * Compact user-agent parser used to promote the raw UA string into queryable
 * columns. It combines the Client Hints (`navigator.userAgentData`) sent by the
 * tracker with classic UA sniffing.
 */

export interface ClientHints {
  brands?: Array<{ brand: string; version: string }>;
  mobile?: boolean;
  platform?: string;
}

export interface ParsedUserAgent {
  browser: string;
  browserVersion: string;
  os: string;
  osVersion: string;
  device: string;
  deviceType: string;
  deviceVendor: string;
  engine: string;
  engineVersion: string;
}

const UNKNOWN = "Unknown";

function firstMatch(ua: string, pattern: RegExp): string {
  const match = pattern.exec(ua);
  return match?.[1] ?? "";
}

function major(version: string): string {
  return version.split(".")[0] ?? version;
}

function parseBrowser(ua: string, hints?: ClientHints | null): { browser: string; version: string } {
  const hintBrands = hints?.brands ?? [];
  const hint = (name: string) => hintBrands.find((brand) => brand.brand === name);

  if (hint("Microsoft Edge") || /Edg(?:e|A|iOS)?\//.test(ua)) {
    return { browser: "Edge", version: major(hint("Microsoft Edge")?.version || firstMatch(ua, /Edg(?:e|A|iOS)?\/([\d.]+)/)) };
  }
  if (hint("Opera") || /OPR\/|Opera[ /]/.test(ua)) {
    return { browser: "Opera", version: major(hint("Opera")?.version || firstMatch(ua, /OPR\/([\d.]+)|Opera[ /]([\d.]+)/)) };
  }
  if (hint("Vivaldi") || /Vivaldi\//.test(ua)) {
    return { browser: "Vivaldi", version: major(hint("Vivaldi")?.version || firstMatch(ua, /Vivaldi\/([\d.]+)/)) };
  }
  if (hint("Samsung Internet") || /SamsungBrowser\//.test(ua)) {
    return {
      browser: "Samsung Internet",
      version: major(hint("Samsung Internet")?.version || firstMatch(ua, /SamsungBrowser\/([\d.]+)/)),
    };
  }
  if (hint("Brave")) {
    return { browser: "Brave", version: major(hint("Brave")?.version ?? "") };
  }
  if (hint("Google Chrome") || /(?:Chrome|CriOS)\//.test(ua)) {
    return { browser: "Chrome", version: major(hint("Google Chrome")?.version || firstMatch(ua, /(?:Chrome|CriOS)\/([\d.]+)/)) };
  }
  if (hint("Firefox") || /(?:Firefox|FxiOS)\//.test(ua)) {
    return { browser: "Firefox", version: major(hint("Firefox")?.version || firstMatch(ua, /(?:Firefox|FxiOS)\/([\d.]+)/)) };
  }
  if (/Version\/[\d.]+.*Safari/.test(ua)) {
    return { browser: "Safari", version: major(firstMatch(ua, /Version\/([\d.]+)/)) };
  }
  if (/MSIE |Trident\//.test(ua)) {
    return { browser: "Internet Explorer", version: major(firstMatch(ua, /MSIE ([\d.]+)|rv:([\d.]+)/)) };
  }
  return { browser: UNKNOWN, version: "" };
}

function parseOs(ua: string): { os: string; version: string } {
  const windows = firstMatch(ua, /Windows NT ([\d.]+)/);
  if (windows) {
    const map: Record<string, string> = { "10.0": "10/11", "6.3": "8.1", "6.2": "8", "6.1": "7", "6.0": "Vista", "5.1": "XP" };
    return { os: "Windows", version: map[windows] ?? windows };
  }
  const android = firstMatch(ua, /Android ([\d.]+)/);
  if (android) return { os: "Android", version: android };

  const ios = firstMatch(ua, /(?:iPhone|iPad|iPod).*?OS ([\d_]+)/);
  if (ios) return { os: "iOS", version: ios.replace(/_/g, ".") };

  const mac = firstMatch(ua, /Mac OS X ([\d_.]+)/);
  if (mac) return { os: "macOS", version: mac.replace(/_/g, ".") };

  const chromeOs = firstMatch(ua, /CrOS \S+ ([\d.]+)/);
  if (chromeOs) return { os: "ChromeOS", version: chromeOs };

  if (/Linux/.test(ua)) return { os: "Linux", version: "" };
  return { os: UNKNOWN, version: "" };
}

const BOT_PATTERN = /bot|crawler|spider|crawling|slurp|bingpreview|headless|lighthouse|pingdom|gtmetrix|facebookexternalhit|whatsapp|telegram/i;

function parseDevice(ua: string, hints?: ClientHints | null): { device: string; type: string; vendor: string } {
  if (BOT_PATTERN.test(ua)) return { device: "Bot", type: "Bot", vendor: UNKNOWN };

  const isIpad = /iPad/.test(ua) || (hints?.platform === "macOS" && hints?.mobile);
  const isIphone = /iPhone|iPod/.test(ua);
  const isAndroid = /Android/.test(ua);
  const isTablet = isIpad || /Tablet/.test(ua) || (isAndroid && !/Mobile/.test(ua));
  const isMobile = hints?.mobile === true || /Mobi|Windows Phone/.test(ua) || isIphone || (isAndroid && !isTablet);

  let model = "";
  if (isIphone) model = "iPhone";
  else if (isIpad) model = "iPad";
  else if (isAndroid) {
    const candidate = firstMatch(ua, /Android [\d.]+;\s*([^;)]+?)(?:\s+Build[/)]|\))/);
    if (candidate && !/^[a-z]{2}(-[a-z]{2})?$/i.test(candidate.trim())) model = candidate.trim();
  }

  let vendor = UNKNOWN;
  if (/iPhone|iPad|iPod|Macintosh/.test(ua)) vendor = "Apple";
  else if (/Samsung|SM-|SAMSUNG/i.test(ua)) vendor = "Samsung";
  else if (/Pixel|Nexus/i.test(ua)) vendor = "Google";
  else if (/HUAWEI|ANE-LX|Honor|HONOR/i.test(ua)) vendor = "Huawei";
  else if (/Xiaomi|Redmi|POCO|Mi \d|M2101/i.test(ua)) vendor = "Xiaomi";
  else if (/OnePlus|ONEPLUS/i.test(ua)) vendor = "OnePlus";
  else if (/OPPO|CPH\d{4}/i.test(ua)) vendor = "OPPO";
  else if (/vivo|V\d{4}A/i.test(ua)) vendor = "Vivo";
  else if (/motorola|moto /i.test(ua)) vendor = "Motorola";
  else if (/realme|RMX\d{4}/i.test(ua)) vendor = "Realme";
  else if (/Sony|Xperia/i.test(ua)) vendor = "Sony";
  else if (/Nokia/i.test(ua)) vendor = "Nokia";
  else if (/Windows/.test(ua)) vendor = "Microsoft";

  const platform = hints?.platform;
  const type = isTablet ? "Tablet" : isMobile ? "Mobile" : "Desktop";
  const fallbackDevice = platform && platform !== "" ? platform : UNKNOWN;

  return { device: model || fallbackDevice, type, vendor };
}

function parseEngine(browser: string, browserVersion: string): { engine: string; version: string } {
  switch (browser) {
    case "Firefox":
      return { engine: "Gecko", version: browserVersion };
    case "Safari":
      return { engine: "WebKit", version: browserVersion };
    case "Internet Explorer":
      return { engine: "Trident", version: browserVersion };
    case UNKNOWN:
      return { engine: UNKNOWN, version: "" };
    default:
      return { engine: "Blink", version: browserVersion };
  }
}

export function parseUserAgent(userAgent: string, hints?: ClientHints | null): ParsedUserAgent {
  const ua = userAgent || "";
  const { browser, version } = parseBrowser(ua, hints);
  const { os, version: osVersion } = parseOs(ua);
  const { device, type, vendor } = parseDevice(ua, hints);
  const { engine, version: engineVersion } = parseEngine(browser, version);

  return {
    browser,
    browserVersion: version,
    os,
    osVersion,
    device,
    deviceType: type,
    deviceVendor: vendor,
    engine,
    engineVersion,
  };
}
