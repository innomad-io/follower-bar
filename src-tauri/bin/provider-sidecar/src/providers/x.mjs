import { chromium } from "playwright";

const PUBLIC_X_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36";

export async function healthCheck() {
  return {
    ok: true,
    platform: "x",
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
      message: "Invalid X handle",
    };
  }

  const browser = await chromium.launch({
    headless: true,
  });

  try {
    const page = await browser.newPage({
      userAgent: PUBLIC_X_USER_AGENT,
    });

    const targetUrl = `https://x.com/${username}`;
    await page.goto(targetUrl, {
      waitUntil: "domcontentloaded",
      timeout: 45000,
    });
    await page.waitForTimeout(5000);

    const bodyText = await page.evaluate(() => document.body.innerText || "");
    const profile = extractProfile(bodyText, targetUrl);
    if (!profile) {
      return {
        ok: false,
        code: "DATA_EXTRACTION_FAILED",
        message: "X sidecar could not parse the public profile page.",
      };
    }

    return {
      ok: true,
      platform: "x",
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

  if (trimmed.startsWith("@")) {
    return trimmed.slice(1) || null;
  }

  for (const prefix of [
    "https://x.com/",
    "http://x.com/",
    "https://twitter.com/",
    "http://twitter.com/",
  ]) {
    if (trimmed.startsWith(prefix)) {
      const value = trimmed.slice(prefix.length).split("/")[0];
      return value || null;
    }
  }

  return trimmed;
}

function parseCount(text) {
  const match = String(text ?? "").match(/([0-9][0-9,\.]*)/);
  if (!match) {
    return null;
  }

  return Number(match[1].replaceAll(",", ""));
}

function extractProfile(bodyText, url) {
  const source = String(bodyText ?? "");
  const lines = source
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  const username =
    lines.find((line) => /^@[A-Za-z0-9_]{1,15}$/.test(line)) ??
    `@${normalizeInput(url)}`;
  const resolvedId = username.startsWith("@") ? username.slice(1) : username;
  const usernameIndex = lines.findIndex((line) => line === username);

  const followersLine = lines.find(
    (line) => /\bFollowers\b/.test(line) || /关注者/.test(line)
  );
  const followingLine = lines.find(
    (line) => /\bFollowing\b/.test(line) || /正在关注/.test(line)
  );
  const followers = parseCount(followersLine);
  const following = parseCount(followingLine);

  const isDisplayNameCandidate = (line) =>
    line &&
    line !== username &&
    !/\bposts\b/i.test(line) &&
    !/帖子/.test(line) &&
    !/\bFollowers\b/i.test(line) &&
    !/关注者/.test(line) &&
    !/\bFollowing\b/i.test(line) &&
    !/正在关注/.test(line) &&
    !/Joined /i.test(line) &&
    !/加入/.test(line) &&
    line !== "Log in" &&
    line !== "Sign up" &&
    line !== "See new posts" &&
    line !== "Follow" &&
    line !== "Don’t miss what’s happening" &&
    line !== "People on X are the first to know.";

  const displayNameBeforeUsername =
    usernameIndex > 0
      ? lines.slice(0, usernameIndex).reverse().find(isDisplayNameCandidate) ?? null
      : null;
  const displayName =
    displayNameBeforeUsername ??
    lines.find(isDisplayNameCandidate);

  if (!displayName || !resolvedId || followers === null) {
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

export function __test_extractProfile(bodyText, url) {
  return extractProfile(bodyText, url);
}
