import { chromium } from "playwright";

const PUBLIC_DOUYIN_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36";

export async function healthCheck() {
  return {
    ok: true,
    platform: "douyin",
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
      message: "Invalid Douyin profile URL or user id",
    };
  }

  const browser = await chromium.launch({
    headless: true,
  });

  try {
    const page = await browser.newPage({
      userAgent: PUBLIC_DOUYIN_USER_AGENT,
    });

    const targetUrl = `https://www.douyin.com/user/${resolvedId}`;
    await page.goto(targetUrl, {
      waitUntil: "domcontentloaded",
      timeout: 45000,
    });
    await page.waitForTimeout(8000);

    const title = await page.title();
    const bodyText = await page.evaluate(() => document.body.innerText || "");
    const profile = extractProfile(bodyText, title, targetUrl);
    if (!profile) {
      return {
        ok: false,
        code: "DATA_EXTRACTION_FAILED",
        message: "Douyin public page parse failed",
      };
    }

    return {
      ok: true,
      platform: "douyin",
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
  if (!trimmed) {
    return null;
  }

  for (const prefix of [
    "https://www.douyin.com/user/",
    "http://www.douyin.com/user/",
    "https://douyin.com/user/",
    "http://douyin.com/user/",
  ]) {
    if (trimmed.startsWith(prefix)) {
      const value = trimmed
        .slice(prefix.length)
        .split(/[/?#]/)[0]
        .trim();
      return value || null;
    }
  }

  return trimmed;
}

function parseCount(text) {
  const match = String(text ?? "").trim().match(/([0-9]+(?:\.[0-9]+)?)(万|亿)?/);
  if (!match) {
    return null;
  }

  const value = Number(match[1]);
  if (!Number.isFinite(value)) {
    return null;
  }

  if (match[2] === "万") {
    return Math.round(value * 10_000);
  }

  if (match[2] === "亿") {
    return Math.round(value * 100_000_000);
  }

  return Math.round(value);
}

function extractMetricFromWindow(windowText, label) {
  const forward = windowText.match(
    new RegExp(`${label}\\s*([0-9]+(?:\\.[0-9]+)?(?:万|亿)?)`)
  );
  if (forward) {
    return parseCount(forward[1]);
  }

  const backward = windowText.match(
    new RegExp(`([0-9]+(?:\\.[0-9]+)?(?:万|亿)?)\\s*${label}`)
  );
  if (backward) {
    return parseCount(backward[1]);
  }

  return null;
}

function titleToDisplayName(title) {
  const value = String(title ?? "").trim();
  if (!value) {
    return null;
  }

  const match = value.match(/^(.*?)的抖音(?:\s*-\s*抖音)?$/);
  if (match?.[1]) {
    return match[1].trim();
  }

  return null;
}

function extractDouyinId(lines) {
  const line = lines.find((entry) => entry.startsWith("抖音号："));
  if (!line) {
    return null;
  }

  return line.replace(/^抖音号：/, "").trim() || null;
}

function extractProfile(bodyText, title, url) {
  const source = String(bodyText ?? "");
  const lines = source
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  const resolvedId = normalizeInput(url);
  const displayName = titleToDisplayName(title);
  if (!displayName || !resolvedId) {
    return null;
  }

  const headerIndex = lines.findIndex((line, index) => {
    if (line !== displayName) {
      return false;
    }

    const nearby = lines.slice(index, index + 12);
    return nearby.includes("粉丝");
  });

  const headerWindow = headerIndex >= 0 ? lines.slice(headerIndex, headerIndex + 16) : lines;
  const headerText = headerWindow.join("\n");
  const followers = extractMetricFromWindow(headerText, "粉丝");
  const following = extractMetricFromWindow(headerText, "关注");
  const username = extractDouyinId(lines) ?? resolvedId;

  if (followers === null) {
    return null;
  }

  return {
    displayName,
    username,
    resolvedId,
    followers,
    following,
  };
}

export function __test_normalizeInput(input) {
  return normalizeInput(input);
}

export function __test_parseCount(input) {
  return parseCount(input);
}

export function __test_extractProfile(bodyText, title, url) {
  return extractProfile(bodyText, title, url);
}
