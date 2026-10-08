/*
 * Visitas tracker — readable source. NOT served: `scripts/build-tracker.mjs`
 * bundles it (with @noble/post-quantum) and obfuscates the result into
 * `tracker.dist.js`. The Worker prepends the per-request config as
 * `window.__vx` before returning it from GET /tracker.js.
 */
import { ml_kem1024 } from "@noble/post-quantum/ml-kem.js";

(function () {
  "use strict";

  var CONFIG = window.__vx;

  if (!CONFIG || !CONFIG.endpoint || !CONFIG.publicKey) return;
  if (window.__visitasTrackerLoaded) return;
  window.__visitasTrackerLoaded = true;

  var cryptoObject = window.crypto;
  var hasSubtle = !!(cryptoObject && cryptoObject.subtle);
  var textEncoder = window.TextEncoder ? new TextEncoder() : null;
  if (!hasSubtle || !textEncoder) return;

  var KEM_INFO = "visitas/ml-kem-1024/aes-256-gcm/v1";

  function safe(fn, fallback) {
    try {
      var value = fn();
      return value === undefined ? fallback : value;
    } catch (error) {
      return fallback;
    }
  }

  function bytesToBase64Url(bytes) {
    var view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    var binary = "";
    for (var i = 0; i < view.length; i++) binary += String.fromCharCode(view[i]);
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  function fromBase64Url(value) {
    var normalized = String(value).replace(/-/g, "+").replace(/_/g, "/");
    while (normalized.length % 4) normalized += "=";
    var binary = atob(normalized);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  function sha256Hex(value) {
    return cryptoObject.subtle.digest("SHA-256", textEncoder.encode(value)).then(function (buffer) {
      var bytes = new Uint8Array(buffer);
      var hex = "";
      for (var i = 0; i < bytes.length; i++) hex += (bytes[i] + 256).toString(16).slice(1);
      return hex;
    });
  }

  function matchesMedia(query) {
    return safe(function () {
      return window.matchMedia(query).matches;
    }, false);
  }

  // ── signal collection ──────────────────────────────────────────────────────

  function getCanvasHash() {
    return safe(function () {
      var canvas = document.createElement("canvas");
      canvas.width = 280;
      canvas.height = 60;
      var context = canvas.getContext("2d");
      if (!context) return Promise.resolve(null);

      var gradient = context.createLinearGradient(0, 0, 280, 60);
      gradient.addColorStop(0, "#6366f1");
      gradient.addColorStop(1, "#22d3ee");
      context.fillStyle = gradient;
      context.fillRect(0, 0, 280, 60);
      context.font = "16px Arial";
      context.fillStyle = "rgba(255,255,255,0.72)";
      context.fillText("Visitas \u2691", 12, 24);
      context.font = "12px 'Times New Roman'";
      context.fillStyle = "#0b1020";
      context.fillText("Cwm fjord veg balks 0123456789", 12, 46);
      context.beginPath();
      context.arc(232, 30, 18, 0, Math.PI * 2);
      context.fillStyle = "rgba(255,255,255,0.35)";
      context.fill();

      return sha256Hex(canvas.toDataURL());
    }, Promise.resolve(null));
  }

  function getAudioHash() {
    return safe(function () {
      var OfflineContext = window.OfflineAudioContext || window.webkitOfflineAudioContext;
      if (!OfflineContext) return Promise.resolve(null);
      var context = new OfflineContext(1, 44100, 44100);
      var oscillator = context.createOscillator();
      oscillator.type = "triangle";
      oscillator.frequency.value = 10000;
      var compressor = context.createDynamicsCompressor();
      safe(function () {
        compressor.threshold.value = -50;
        compressor.knee.value = 40;
        compressor.ratio.value = 12;
        compressor.attack.value = 0;
        compressor.release.value = 0.25;
      });
      oscillator.connect(compressor);
      compressor.connect(context.destination);
      oscillator.start(0);
      return context
        .startRendering()
        .then(function (buffer) {
          var data = buffer.getChannelData(0);
          var sum = 0;
          for (var i = 4500; i < 5000 && i < data.length; i++) sum += Math.abs(data[i]);
          return sum.toString();
        })
        .catch(function () {
          return null;
        });
    }, Promise.resolve(null));
  }

  function getWebgl() {
    return safe(function () {
      var canvas = document.createElement("canvas");
      var gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
      if (!gl) return null;
      var debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
      var vendor = debugInfo ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR);
      var renderer = debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
      var version = gl.getParameter(gl.VERSION);
      var maxTexture = gl.getParameter(gl.MAX_TEXTURE_SIZE);
      return {
        vendor: vendor ? String(vendor).slice(0, 160) : null,
        renderer: renderer ? String(renderer).slice(0, 160) : null,
        version: version ? String(version).slice(0, 80) : null,
        maxTextureSize: typeof maxTexture === "number" ? maxTexture : null
      };
    }, null);
  }

  function getFonts() {
    return safe(function () {
      var baseFonts = ["monospace", "sans-serif", "serif"];
      var testFonts = [
        "Arial", "Calibri", "Cambria", "Comic Sans MS", "Consolas", "Courier New", "DejaVu Sans",
        "Georgia", "Helvetica Neue", "Impact", "Menlo", "Monaco", "Noto Sans", "Roboto", "Segoe UI",
        "Tahoma", "Times New Roman", "Trebuchet MS", "Ubuntu", "Verdana"
      ];
      var probe = document.createElement("span");
      probe.style.position = "absolute";
      probe.style.left = "-9999px";
      probe.style.top = "-9999px";
      probe.style.fontSize = "72px";
      probe.style.visibility = "hidden";
      probe.textContent = "mmmmmmmmmmlli";
      (document.body || document.documentElement).appendChild(probe);

      var baseSizes = {};
      var i;
      for (i = 0; i < baseFonts.length; i++) {
        probe.style.fontFamily = baseFonts[i];
        baseSizes[baseFonts[i]] = probe.offsetWidth + "x" + probe.offsetHeight;
      }

      var detected = [];
      for (i = 0; i < testFonts.length; i++) {
        var found = false;
        for (var b = 0; b < baseFonts.length; b++) {
          probe.style.fontFamily = "'" + testFonts[i] + "'," + baseFonts[b];
          if (probe.offsetWidth + "x" + probe.offsetHeight !== baseSizes[baseFonts[b]]) {
            found = true;
            break;
          }
        }
        if (found) detected.push(testFonts[i]);
      }

      if (probe.parentNode) probe.parentNode.removeChild(probe);
      return detected;
    }, []);
  }

  function getBattery() {
    return safe(function () {
      if (!navigator.getBattery) return Promise.resolve(null);
      return navigator
        .getBattery()
        .then(function (battery) {
          return {
            level: typeof battery.level === "number" ? Math.round(battery.level * 100) / 100 : null,
            charging: !!battery.charging
          };
        })
        .catch(function () {
          return null;
        });
    }, Promise.resolve(null));
  }

  function getMediaDevices() {
    return safe(function () {
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return Promise.resolve(null);
      return navigator.mediaDevices
        .enumerateDevices()
        .then(function (devices) {
          var summary = { audioinput: 0, audiooutput: 0, videoinput: 0 };
          for (var i = 0; i < devices.length; i++) {
            if (summary[devices[i].kind] !== undefined) summary[devices[i].kind] += 1;
          }
          return summary;
        })
        .catch(function () {
          return null;
        });
    }, Promise.resolve(null));
  }

  function getPlugins() {
    return safe(function () {
      var names = [];
      if (navigator.plugins) {
        for (var i = 0; i < navigator.plugins.length && i < 24; i++) names.push(navigator.plugins[i].name);
      }
      return names;
    }, []);
  }

  function getClientHints() {
    return safe(function () {
      var data = navigator.userAgentData;
      if (!data) return null;
      return {
        brands: data.brands
          ? data.brands.slice(0, 8).map(function (brand) {
              return { brand: brand.brand, version: brand.version };
            })
          : [],
        mobile: !!data.mobile,
        platform: data.platform || null
      };
    }, null);
  }

  function getHardware() {
    var connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection || null;
    return {
      concurrency: safe(function () { return navigator.hardwareConcurrency || null; }, null),
      memory: safe(function () { return navigator.deviceMemory || null; }, null),
      platform: safe(function () { return navigator.platform || null; }, null),
      vendor: safe(function () { return navigator.vendor || null; }, null),
      maxTouchPoints: safe(function () { return navigator.maxTouchPoints || 0; }, 0),
      touch: "ontouchstart" in window,
      pointer: "onpointerdown" in window,
      doNotTrack: safe(function () { return navigator.doNotTrack || window.doNotTrack || null; }, null),
      cookiesEnabled: safe(function () { return !!navigator.cookieEnabled; }, false),
      online: safe(function () { return navigator.onLine; }, null),
      colorScheme: matchesMedia("(prefers-color-scheme: dark)") ? "dark" : "light",
      reducedMotion: matchesMedia("(prefers-reduced-motion: reduce)"),
      highContrast: matchesMedia("(forced-colors: active)") || matchesMedia("(prefers-contrast: high)"),
      connection: connection
        ? {
            effectiveType: connection.effectiveType || null,
            downlink: typeof connection.downlink === "number" ? connection.downlink : null,
            rtt: typeof connection.rtt === "number" ? connection.rtt : null,
            saveData: !!connection.saveData
          }
        : null
    };
  }

  function getScreen() {
    return {
      width: screen.width,
      height: screen.height,
      availWidth: screen.availWidth,
      availHeight: screen.availHeight,
      colorDepth: screen.colorDepth,
      pixelRatio: window.devicePixelRatio || 1,
      orientation: safe(function () { return screen.orientation ? screen.orientation.type : null; }, null)
    };
  }

  function getViewport() {
    return {
      width: window.innerWidth,
      height: window.innerHeight
    };
  }

  function getPerformance() {
    return safe(function () {
      var timing = window.performance && window.performance.timing;
      if (!timing) return null;
      return {
        navigationStart: timing.navigationStart,
        domContentLoaded: timing.domContentLoadedEventEnd ? timing.domContentLoadedEventEnd - timing.navigationStart : null,
        loadEvent: timing.loadEventEnd ? timing.loadEventEnd - timing.navigationStart : null
      };
    }, null);
  }

  function hasStorage(kind) {
    return safe(function () {
      var storage = window[kind];
      if (!storage) return false;
      storage.setItem("__visitas_probe__", "1");
      storage.removeItem("__visitas_probe__");
      return true;
    }, false);
  }

  // ── blocked screen ─────────────────────────────────────────────────────────

  function clearClientState() {
    try {
      window.localStorage.clear();
    } catch (e) {}
    try {
      window.sessionStorage.clear();
    } catch (e) {}
    try {
      if (window.caches && window.caches.keys) {
        window.caches
          .keys()
          .then(function (keys) {
            for (var i = 0; i < keys.length; i++) window.caches.delete(keys[i]);
          })
          .catch(function () {});
      }
    } catch (e) {}
  }

  function buildBlockScreen() {
    var root = document.documentElement;
    var overlay = document.createElement("div");
    overlay.setAttribute("data-visitas", "blocked");
    var style = overlay.style;
    style.position = "fixed";
    style.top = "0";
    style.right = "0";
    style.bottom = "0";
    style.left = "0";
    style.zIndex = "2147483647";
    style.display = "flex";
    style.flexDirection = "column";
    style.alignItems = "center";
    style.justifyContent = "center";
    style.gap = "18px";
    style.background = "#05070d";
    style.color = "#e6eaf2";
    style.textAlign = "center";
    style.padding = "32px";
    style.fontFamily = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
    overlay.innerHTML =
      '<svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="#8b95a9" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M12 2 4 5.5v6c0 4.8 3.4 9.2 8 10.5 4.6-1.3 8-5.7 8-10.5v-6L12 2Z"/>' +
      '<path d="m9 12 2 2 4-4"/>' +
      "</svg>";

    var title = document.createElement("div");
    title.textContent = "Access blocked";
    title.style.fontSize = "22px";
    title.style.fontWeight = "650";
    title.style.letterSpacing = "-0.01em";

    var message = document.createElement("div");
    message.textContent = "This browser has been blocked from viewing this site.";
    message.style.fontSize = "14px";
    message.style.color = "#8b95a9";
    message.style.maxWidth = "420px";
    message.style.lineHeight = "1.6";

    overlay.appendChild(title);
    overlay.appendChild(message);
    root.appendChild(overlay);
    document.title = "Access blocked";
    root.style.overflow = "hidden";
    if (document.body) document.body.style.overflow = "hidden";
  }

  // Replaces the whole document (the original DOM is discarded, so no cached or
  // parsed content remains visible) and renders the blocked screen in it.
  function renderBlockDocument() {
    var replaced = false;
    try {
      document.open();
      document.write(
        '<!doctype html><html lang="en"><head><meta charset="utf-8">' +
          '<meta name="viewport" content="width=device-width, initial-scale=1">' +
          '<meta http-equiv="cache-control" content="no-store, no-cache, must-revalidate">' +
          '<meta http-equiv="expires" content="0">' +
          "<title>Access blocked</title></head><body></body></html>"
      );
      document.close();
      replaced = true;
    } catch (e) {}

    safe(buildBlockScreen);

    if (!replaced) {
      // document.open() was unavailable: reveal the original page behind the
      // overlay so the blocked screen is at least visible.
      safe(function () {
        document.documentElement.style.visibility = "";
      });
    }
  }

  function blockPage(fingerprint) {
    try {
      window.stop();
    } catch (e) {}
    clearClientState();
    renderBlockDocument();
    var beacon = baseEnvelope({ blocked: true });
    beacon["fingerprint"] = fingerprint;
    post(beacon).catch(function () {});
  }

  // ── payload + encryption ───────────────────────────────────────────────────

  function buildVisit(asyncData) {
    var webgl = getWebgl();
    var hardware = getHardware();
    var screenData = getScreen();
    var fonts = getFonts();
    var hints = getClientHints();
    var timezone = safe(function () {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    }, null);
    var webglHashInput = webgl ? [webgl.vendor, webgl.renderer, webgl.version].join("~") : "";

    var fingerprintInput = [
      navigator.userAgent,
      hardware.platform,
      safe(function () { return (navigator.languages || []).join(","); }, ""),
      timezone,
      screenData.width + "x" + screenData.height + "x" + screenData.colorDepth + "x" + screenData.pixelRatio,
      screenData.availWidth + "x" + screenData.availHeight,
      hardware.concurrency,
      hardware.memory,
      hardware.maxTouchPoints,
      hardware.touch ? 1 : 0,
      asyncData.canvasHash || "",
      webglHashInput,
      asyncData.audioHash || "",
      fonts.join(",")
    ].join("|");

    return sha256Hex(fingerprintInput).then(function (fingerprint) {
      var payload = {
        id: fingerprint,
        url: String(location.href).slice(0, 2048),
        referrer: String(document.referrer || "").slice(0, 2048),
        title: String(document.title || "").slice(0, 300),
        language: navigator.language || null,
        languages: safe(function () { return Array.prototype.slice.call(navigator.languages || [], 0, 8); }, null),
        timezone: timezone,
        timezoneOffset: new Date().getTimezoneOffset(),
        screen: screenData,
        viewport: getViewport(),
        properties: {
          webgl: webgl,
          canvasHash: asyncData.canvasHash,
          audioHash: asyncData.audioHash,
          fonts: fonts,
          plugins: getPlugins(),
          devices: asyncData.devices,
          uaData: hints,
          storage: {
            localStorage: hasStorage("localStorage"),
            sessionStorage: hasStorage("sessionStorage")
          }
        },
        hardware: {
          concurrency: hardware.concurrency,
          memory: hardware.memory,
          platform: hardware.platform,
          vendor: hardware.vendor,
          maxTouchPoints: hardware.maxTouchPoints,
          touch: hardware.touch,
          pointer: hardware.pointer,
          doNotTrack: hardware.doNotTrack,
          cookiesEnabled: hardware.cookiesEnabled,
          online: hardware.online,
          colorScheme: hardware.colorScheme,
          reducedMotion: hardware.reducedMotion,
          highContrast: hardware.highContrast,
          connection: hardware.connection,
          battery: asyncData.battery,
          performance: getPerformance()
        }
      };
      return [fingerprint, payload];
    });
  }

  // Hybrid post-quantum encryption: ML-KEM-1024 encapsulates a shared secret
  // that HKDF-SHA256 stretches into the AES-256-GCM key for the payload.
  function encryptPayload(payload) {
    var encapsulated = ml_kem1024.encapsulate(fromBase64Url(CONFIG.publicKey));
    var iv = cryptoObject.getRandomValues(new Uint8Array(12));
    var encoded = textEncoder.encode(JSON.stringify(payload));

    return cryptoObject.subtle
      .importKey("raw", encapsulated.sharedSecret, "HKDF", false, ["deriveKey"])
      .then(function (baseKey) {
        return cryptoObject.subtle.deriveKey(
          {
            name: "HKDF",
            hash: "SHA-256",
            salt: new Uint8Array(0),
            info: textEncoder.encode(KEM_INFO)
          },
          baseKey,
          { name: "AES-GCM", length: 256 },
          false,
          ["encrypt"]
        );
      })
      .then(function (aesKey) {
        return cryptoObject.subtle.encrypt({ name: "AES-GCM", iv: iv }, aesKey, encoded);
      })
      .then(function (ciphertext) {
        return {
          kem: bytesToBase64Url(encapsulated.cipherText),
          iv: bytesToBase64Url(iv),
          data: bytesToBase64Url(ciphertext)
        };
      });
  }

  function baseEnvelope(extra) {
    var envelope = {
      version: 1,
      kid: CONFIG.kid,
      signature: CONFIG.signature,
      issuedAt: CONFIG.issuedAt,
      expiresAt: CONFIG.expiresAt,
      blocklistHash: CONFIG.blocklistHash
    };
    for (var key in extra) {
      if (Object.prototype.hasOwnProperty.call(extra, key)) envelope[key] = extra[key];
    }
    return envelope;
  }

  function post(body) {
    return fetch(CONFIG.endpoint, {
      method: "POST",
      mode: "cors",
      credentials: "omit",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      keepalive: true
    });
  }

  // ── main ───────────────────────────────────────────────────────────────────

  function start() {
    var blockedHashes = CONFIG.blocked || [];
    var hiddenForCheck = false;
    var revealGuard = null;

    function reveal() {
      if (!hiddenForCheck) return;
      hiddenForCheck = false;
      safe(function () {
        document.documentElement.style.visibility = "";
      });
    }

    // When a blocklist exists, hide the page until the fingerprint has been
    // checked so blocked browsers never see the content.
    if (blockedHashes.length > 0) {
      safe(function () {
        document.documentElement.style.visibility = "hidden";
        hiddenForCheck = true;
      });
      revealGuard = setTimeout(reveal, 2500);
    }

    var collections = Promise.all([getCanvasHash(), getAudioHash(), getBattery(), getMediaDevices()]).then(
      function (values) {
        return { canvasHash: values[0], audioHash: values[1], battery: values[2], devices: values[3] };
      }
    );

    collections
      .then(buildVisit)
      .then(function (result) {
        var fingerprint = result[0];
        if (blockedHashes.indexOf(fingerprint) !== -1) {
          if (revealGuard) clearTimeout(revealGuard);
          blockPage(fingerprint);
          return null;
        }

        reveal();
        if (revealGuard) clearTimeout(revealGuard);
        return encryptPayload(result[1]).then(function (encrypted) {
          return post(baseEnvelope({ blocked: false, encrypted: encrypted }));
        });
      })
      .catch(function () {
        reveal();
        if (revealGuard) clearTimeout(revealGuard);
      });
  }

  // Run immediately: the script is meant to be placed in <head>, before the
  // page body is parsed, so a blocked browser can be stopped as early as
  // possible. Nothing here depends on the DOM being complete.
  start();
})();
