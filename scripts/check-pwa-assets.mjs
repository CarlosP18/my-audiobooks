#!/usr/bin/env node
// Dependency-free installability gate for My Audiobooks (Phase 1, Task 3).
//
// Everything Phase 1 ships is metadata that is either exactly right or
// silently broken, and the failure mode is only visible on a physical
// iPhone. This script makes it mechanically checkable from the CLI against
// any base URL, so plan 01-02 can run the identical gate against the
// deployed HTTPS origin and later phases can prove they did not regress
// installability.
//
// Usage: node scripts/check-pwa-assets.mjs <baseUrl>
//
// Uses only node: builtins and the global fetch — no dependency is added
// to package.json. Adding one more assertion is a two-line change: push a
// new `run(...)` call in main() and reference its boolean result.

const TIMEOUT_MS = 20_000;

/** @type {{ name: string, pass: boolean, detail: string }[]} */
const results = [];

function record(name, pass, detail = "") {
  results.push({ name, pass, detail });
  const status = pass ? "PASS" : "FAIL";
  console.log(`[${status}] ${name}${detail ? ` — ${detail}` : ""}`);
  return pass;
}

async function fetchWithTimeout(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function extractLinkHref(html, relValue) {
  // Match a <link ... rel="X" ... href="Y" ...> or href before rel, in
  // either attribute order, since Next may emit attributes in any order.
  const linkTagRe = /<link\b[^>]*>/gi;
  const tags = html.match(linkTagRe) ?? [];
  for (const tag of tags) {
    const relMatch = tag.match(/\brel=["']([^"']+)["']/i);
    if (!relMatch || relMatch[1].toLowerCase() !== relValue) continue;
    const hrefMatch = tag.match(/\bhref=["']([^"']+)["']/i);
    if (hrefMatch) return hrefMatch[1];
  }
  return null;
}

function resolveUrl(href, base) {
  return new URL(href, base).toString();
}

/** Reads a PNG's IHDR width/height. Returns null if not a valid PNG. */
function readPngDimensions(buf) {
  const PNG_SIGNATURE = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ]);
  if (buf.length < 24 || !buf.subarray(0, 8).equals(PNG_SIGNATURE)) {
    return null;
  }
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  return { width, height };
}

async function main() {
  const baseUrl = process.argv[2];
  if (!baseUrl) {
    console.error("Usage: node scripts/check-pwa-assets.mjs <baseUrl>");
    process.exit(1);
  }

  let html = "";
  let indexResponse;
  try {
    indexResponse = await fetchWithTimeout(baseUrl);
  } catch (err) {
    record("GET / reachable", false, String(err));
    printSummaryAndExit();
    return;
  }

  const contentType = indexResponse.headers.get("content-type") ?? "";
  const indexOk = record(
    "GET / returns 200 with HTML content type",
    indexResponse.ok && contentType.includes("text/html"),
    `status=${indexResponse.status} content-type=${contentType}`,
  );

  if (indexOk) {
    html = await indexResponse.text();
  } else {
    // Still try to read the body — a non-200/non-HTML response can't drive
    // the rest of the checks, but read it defensively rather than throw.
    try {
      html = await indexResponse.text();
    } catch {
      html = "";
    }
  }

  // --- Copywriting Contract ---
  record(
    "HTML contains 'My Library'",
    html.includes("My Library"),
  );
  record(
    "HTML contains 'No audiobooks yet'",
    html.includes("No audiobooks yet"),
  );
  record(
    "HTML contains 'Import an audiobook to start listening.'",
    html.includes("Import an audiobook to start listening."),
  );

  // --- iOS standalone meta tags ---
  record(
    "HTML declares apple-mobile-web-app-capable=yes",
    /name=["']apple-mobile-web-app-capable["']\s+content=["']yes["']/i.test(
      html,
    ),
  );
  record(
    "HTML declares apple-mobile-web-app-status-bar-style=black-translucent",
    /name=["']apple-mobile-web-app-status-bar-style["']\s+content=["']black-translucent["']/i.test(
      html,
    ),
  );
  record(
    "HTML declares theme-color #0A0A0A",
    /name=["']theme-color["']\s+content=["']#0a0a0a["']/i.test(html),
  );
  record(
    "HTML viewport meta contains viewport-fit=cover",
    /name=["']viewport["']\s+content=["'][^"']*viewport-fit=cover[^"']*["']/i.test(
      html,
    ),
  );

  // --- apple-touch-icon: the single most important assertion (Pitfall 1) ---
  const appleTouchIconHref = extractLinkHref(html, "apple-touch-icon");
  const hasAppleTouchIconLink = record(
    "HTML declares rel=apple-touch-icon link",
    Boolean(appleTouchIconHref),
    appleTouchIconHref ?? "no link found",
  );

  if (hasAppleTouchIconLink) {
    const iconUrl = resolveUrl(appleTouchIconHref, baseUrl);
    try {
      const iconResponse = await fetchWithTimeout(iconUrl);
      const iconContentType = iconResponse.headers.get("content-type") ?? "";
      const iconFetchOk = record(
        "apple-touch-icon fetch returns 200 image/png",
        iconResponse.ok && iconContentType.includes("image/png"),
        `status=${iconResponse.status} content-type=${iconContentType}`,
      );
      if (iconFetchOk) {
        const buf = Buffer.from(await iconResponse.arrayBuffer());
        const dims = readPngDimensions(buf);
        record(
          "apple-touch-icon is a valid PNG",
          dims !== null,
          dims ? `${dims.width}x${dims.height}` : "invalid PNG signature",
        );
        if (dims) {
          record(
            "apple-touch-icon is exactly 180x180",
            dims.width === 180 && dims.height === 180,
            `${dims.width}x${dims.height}`,
          );
        }
      }
    } catch (err) {
      record("apple-touch-icon fetch returns 200 image/png", false, String(err));
    }
  }

  // --- manifest ---
  const manifestHref = extractLinkHref(html, "manifest");
  const hasManifestLink = record(
    "HTML declares rel=manifest link",
    Boolean(manifestHref),
    manifestHref ?? "no link found",
  );

  let manifestJson = null;
  if (hasManifestLink) {
    const manifestUrl = resolveUrl(manifestHref, baseUrl);
    try {
      const manifestResponse = await fetchWithTimeout(manifestUrl);
      const manifestFetchOk = record(
        "manifest fetch returns 200",
        manifestResponse.ok,
        `status=${manifestResponse.status}`,
      );
      if (manifestFetchOk) {
        const text = await manifestResponse.text();
        try {
          manifestJson = JSON.parse(text);
          record("manifest is valid JSON", true);
        } catch (err) {
          record("manifest is valid JSON", false, String(err));
        }
      }
    } catch (err) {
      record("manifest fetch returns 200", false, String(err));
    }
  }

  if (manifestJson) {
    record(
      "manifest name is 'My Audiobooks'",
      manifestJson.name === "My Audiobooks",
      `name=${JSON.stringify(manifestJson.name)}`,
    );
    record(
      "manifest display is 'standalone'",
      manifestJson.display === "standalone",
      `display=${JSON.stringify(manifestJson.display)}`,
    );
    record(
      "manifest background_color is '#0A0A0A'",
      manifestJson.background_color === "#0A0A0A",
      `background_color=${JSON.stringify(manifestJson.background_color)}`,
    );
    record(
      "manifest theme_color is '#0A0A0A'",
      manifestJson.theme_color === "#0A0A0A",
      `theme_color=${JSON.stringify(manifestJson.theme_color)}`,
    );

    const icons = Array.isArray(manifestJson.icons) ? manifestJson.icons : [];
    const has192 = icons.some((i) => i.sizes === "192x192");
    const has512 = icons.some((i) => i.sizes === "512x512");
    record("manifest icons include a 192x192 entry", has192);
    record("manifest icons include a 512x512 entry", has512);

    for (const icon of icons) {
      if (!icon.src) continue;
      const iconUrl = resolveUrl(icon.src, manifestHref ? resolveUrl(manifestHref, baseUrl) : baseUrl);
      try {
        const resp = await fetchWithTimeout(iconUrl);
        const ct = resp.headers.get("content-type") ?? "";
        record(
          `manifest icon ${icon.sizes ?? icon.src} fetch returns 200 image/png`,
          resp.ok && ct.includes("image/png"),
          `status=${resp.status} content-type=${ct}`,
        );
      } catch (err) {
        record(
          `manifest icon ${icon.sizes ?? icon.src} fetch returns 200 image/png`,
          false,
          String(err),
        );
      }
    }
  }

  // --- service worker (plan 01-02): the app shell must survive airplane
  // mode, so /sw.js must exist, be served as JavaScript, and carry a
  // non-empty precache manifest. An empty manifest is a passing-looking
  // build that white-screens offline. ---
  const swUrl = resolveUrl("/sw.js", baseUrl);
  try {
    const swResponse = await fetchWithTimeout(swUrl);
    const swContentType = swResponse.headers.get("content-type") ?? "";
    const swFetchOk = record(
      "GET /sw.js returns 200 with a JavaScript content type",
      swResponse.ok && /javascript/i.test(swContentType),
      `status=${swResponse.status} content-type=${swContentType}`,
    );
    if (swFetchOk) {
      const swBody = await swResponse.text();
      record(
        "sw.js body is non-trivially sized (>1000 bytes)",
        swBody.length > 1000,
        `length=${swBody.length}`,
      );
      record(
        "sw.js contains a non-empty precache entry list",
        /precacheEntries:\[\{/.test(swBody) ||
          /precacheEntries["']?\s*:\s*\[\s*\{/.test(swBody),
      );
    }
  } catch (err) {
    record(
      "GET /sw.js returns 200 with a JavaScript content type",
      false,
      String(err),
    );
  }

  printSummaryAndExit();
}

function printSummaryAndExit() {
  const failed = results.filter((r) => !r.pass);
  const total = results.length;
  console.log("");
  console.log(`Summary: ${total - failed.length}/${total} assertions passed.`);
  if (failed.length > 0) {
    console.log("Failed assertions:");
    for (const f of failed) {
      console.log(`  - ${f.name}${f.detail ? ` (${f.detail})` : ""}`);
    }
    process.exit(1);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error("Unexpected error running installability gate:", err);
  process.exit(1);
});
