import { chromium } from "playwright";

const PUBLIC_INSTAGRAM_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36";

export async function healthCheck() {
  return {
    ok: true,
    platform: "instagram",
    browser: "chromium",
    message: "Sidecar is available.",
  };
}

export async function fetchProfile(payload) {
  const username =
    normalizeInput(payload.account?.input) ??
    normalizeInput(payload.username) ??
    null;
  if (!username) {
    return {
      ok: false,
      code: "INVALID_INPUT",
      message: "Invalid Instagram handle",
    };
  }

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ userAgent: PUBLIC_INSTAGRAM_USER_AGENT });
    const targetUrl = `https://www.instagram.com/${username}/`;
    await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(5000);

    const title = await page.title();
    const finalUrl = page.url();
    const bodyText = await page.evaluate(() => document.body.innerText || "");
    const metaDescription = await page
      .locator('meta[property="og:description"], meta[name="description"]')
      .first()
      .getAttribute("content")
      .catch(() => null);

    const profile = extractProfile({ title, finalUrl, bodyText, metaDescription });
    if (!profile) {
      return {
        ok: false,
        code: "DATA_EXTRACTION_FAILED",
        message: "Instagram public page parse failed",
      };
    }

    return {
      ok: true,
      platform: "instagram",
      display_name: profile.displayName,
      username: profile.username,
      resolved_id: profile.resolvedId,
      followers: profile.followers,
    };
  } finally {
    await browser.close();
  }
}

function normalizeInput(input) {
  const trimmed = String(input ?? "").trim().replace(/\/+$/, "");
  if (!trimmed) return null;
  if (trimmed.startsWith("@")) return trimmed.slice(1) || null;

  for (const prefix of [
    "https://www.instagram.com/",
    "http://www.instagram.com/",
    "https://instagram.com/",
    "http://instagram.com/",
  ]) {
    if (trimmed.startsWith(prefix)) {
      const value = trimmed.slice(prefix.length).split(/[/?#]/)[0];
      return value || null;
    }
  }

  return trimmed;
}

function parseCompactCount(input) {
  const raw = String(input ?? "").replaceAll(",", "").trim();
  const match = raw.match(/([0-9]+(?:\.[0-9]+)?)([KMB])?/i);
  if (!match) return null;
  const value = Number(match[1]);
  if (!Number.isFinite(value)) return null;
  const suffix = match[2]?.toUpperCase();
  if (suffix === "K") return Math.round(value * 1_000);
  if (suffix === "M") return Math.round(value * 1_000_000);
  if (suffix === "B") return Math.round(value * 1_000_000_000);
  return Math.round(value);
}

function extractProfile({ title, finalUrl, bodyText, metaDescription }) {
  const resolvedId = normalizeInput(finalUrl);
  const titleMatch = String(title ?? "").match(/^(.*?)\s+\(@([A-Za-z0-9._]+)\)\s+•\s+Instagram/i);
  const displayName = titleMatch?.[1]?.trim() || null;
  const username = titleMatch?.[2] ? `@${titleMatch[2]}` : resolvedId ? `@${resolvedId}` : null;

  let followers = null;
  const metaMatch = String(metaDescription ?? "").match(/([0-9][0-9,\.]*[KMB]?)\s+Followers/i);
  if (metaMatch) {
    followers = parseCompactCount(metaMatch[1]);
  }
  if (followers === null) {
    const bodyMatch = String(bodyText ?? "").match(/([0-9][0-9,\.]*[KMB]?)\s+followers/i);
    if (bodyMatch) {
      followers = parseCompactCount(bodyMatch[1]);
    }
  }

  if (!displayName || !username || !resolvedId || followers === null) {
    return null;
  }

  return { displayName, username, resolvedId, followers };
}

export function __test_normalizeInput(input) {
  return normalizeInput(input);
}

export function __test_parseCompactCount(input) {
  return parseCompactCount(input);
}

export function __test_extractProfile(input) {
  return extractProfile(input);
}
