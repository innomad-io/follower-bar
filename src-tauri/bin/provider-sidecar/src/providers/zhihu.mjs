import { chromium } from "playwright";

const PUBLIC_ZHIHU_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36";

export async function healthCheck() {
  return {
    ok: true,
    platform: "zhihu",
    browser: "chromium",
    message: "Sidecar is available.",
  };
}

export async function fetchProfile(payload) {
  const resolvedId =
    normalizeInput(payload.account?.input) ??
    normalizeInput(payload.username) ??
    null;
  if (!resolvedId) {
    return {
      ok: false,
      code: "INVALID_INPUT",
      message: "Invalid Zhihu profile URL or identifier",
    };
  }

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ userAgent: PUBLIC_ZHIHU_USER_AGENT });
    const targetUrl = `https://www.zhihu.com/people/${resolvedId}`;
    await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(5000);

    const title = await page.title();
    const finalUrl = page.url();
    const bodyText = await page.evaluate(() => document.body.innerText || "");
    const metaDescription = await page
      .locator('meta[name="description"], meta[property="og:description"]')
      .first()
      .getAttribute("content")
      .catch(() => null);

    const profile = extractProfile({ title, finalUrl, bodyText, metaDescription });
    if (!profile) {
      return {
        ok: false,
        code: "DATA_EXTRACTION_FAILED",
        message: "Zhihu public page parse failed",
      };
    }

    return {
      ok: true,
      platform: "zhihu",
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

  for (const prefix of [
    "https://www.zhihu.com/people/",
    "http://www.zhihu.com/people/",
    "https://zhihu.com/people/",
    "http://zhihu.com/people/",
  ]) {
    if (trimmed.startsWith(prefix)) {
      const value = trimmed.slice(prefix.length).split(/[/?#]/)[0];
      return value || null;
    }
  }

  return trimmed;
}

function parsePlainCount(input) {
  const match = String(input ?? "").replaceAll(",", "").match(/([0-9]+)/);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

function extractProfile({ title, finalUrl, bodyText, metaDescription }) {
  const resolvedId = normalizeInput(finalUrl);
  const displayName = String(title ?? "").replace(/\s*-\s*知乎\s*$/, "").trim() || null;
  const username = resolvedId;

  let followers = null;
  const bodySource = String(bodyText ?? "");
  const bodyMatch = bodySource.match(/关注者\s*([0-9,]+)/);
  if (bodyMatch) {
    followers = parsePlainCount(bodyMatch[1]);
  }
  if (followers === null) {
    const altMatch = bodySource.match(/([0-9,]+)\s*\n?关注者/);
    if (altMatch) {
      followers = parsePlainCount(altMatch[1]);
    }
  }

  if (followers === null) {
    const descriptionCounts = String(metaDescription ?? "").match(/回答数\s*([0-9,]+)/);
    if (descriptionCounts) {
      followers = 0;
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

export function __test_parsePlainCount(input) {
  return parsePlainCount(input);
}

export function __test_extractProfile(input) {
  return extractProfile(input);
}
