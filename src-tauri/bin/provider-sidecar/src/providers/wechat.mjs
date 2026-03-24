import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const HOME_URL = "https://mp.weixin.qq.com/";
const WECHAT_APP_ARGS = [
  "--disable-notifications",
  "--deny-permission-prompts",
  "--disable-infobars",
  "--no-default-browser-check",
  "--no-first-run",
  "--disable-default-apps",
  "--disable-features=Translate,OptimizationHints,MediaRouter,AutofillServerCommunication,NotificationTriggers",
  "--disable-popup-blocking",
];
export const __test_connectSuccessHoldMs = 1500;

export async function healthCheck() {
  return {
    ok: true,
    platform: "wechat",
    browser: "chromium",
    message: "Sidecar is available.",
  };
}

export async function connect(payload) {
  const profileDir = payload.profileDir;
  fs.mkdirSync(profileDir, { recursive: true });
  appendConnectLog(profileDir, "connect start");

  const context = await launchWechatContext(profileDir, {
    headless: false,
    appModeUrl: HOME_URL,
  });

  const page = context.pages()[0] ?? (await context.newPage());
  await page.goto(HOME_URL, { waitUntil: "domcontentloaded" });

  for (let attempt = 0; attempt < 180; attempt += 1) {
    await page.waitForTimeout(2000);
    let signals;
    try {
      signals = await getWechatSignals(page);
    } catch (error) {
      if (__test_isTransientNavigationError(error)) {
        appendConnectLog(profileDir, `connect transient navigation error=${error.message}`);
        continue;
      }
      throw error;
    }
    appendConnectLog(
      profileDir,
      `connect poll url=${signals.url} title=${signals.title} login=${signals.loginPromptVisible} home=${signals.homeVisible} body=${signals.bodySnippet}`
    );

    if (signals.homeVisible && !signals.loginPromptVisible) {
      fs.writeFileSync(path.join(profileDir, ".connected"), "ok");
      appendConnectLog(profileDir, "connect detected logged-in session");
      await page.waitForTimeout(__test_connectSuccessHoldMs);
      await context.close();
      return { ok: true, code: "CONNECTED", message: "WeChat admin session connected." };
    }
  }

  appendConnectLog(profileDir, "connect timed out");
  await context.close();
  return { ok: false, code: "LOGIN_TIMEOUT", message: "WeChat login timed out." };
}

export async function fetchProfile(payload) {
  const profileDir = payload.profileDir;
  if (!fs.existsSync(path.join(profileDir, ".connected"))) {
    return {
      ok: false,
      code: "LOGIN_REQUIRED",
      message: "WeChat browser session is missing or expired.",
    };
  }

  const context = await launchWechatContext(profileDir, { headless: true });

  try {
    const page = context.pages()[0] ?? (await context.newPage());
    await page.goto(__test_normalizeWechatAdminUrl(payload.account?.input), {
      waitUntil: "domcontentloaded",
      timeout: 45000,
    });
    await page.waitForTimeout(3000);

    const signals = await getWechatSignals(page);
    if (!signals.homeVisible && signals.loginPromptVisible) {
      return {
        ok: false,
        code: "LOGIN_REQUIRED",
        message: "WeChat browser session is missing or expired.",
      };
    }

    const extracted = await page.evaluate(() => {
      const bodyText = document.body?.innerText ?? "";
      const nickname =
        document.querySelector(".acount_box-nickname")?.textContent?.trim() ||
        document.querySelector(".weui-desktop_name")?.textContent?.trim() ||
        "";

      return {
        bodyText,
        nickname,
      };
    });

    const profile = __test_extractWechatProfile(extracted);
    if (!profile) {
      return {
        ok: false,
        code: "DATA_EXTRACTION_FAILED",
        message: "WeChat admin page parse failed",
      };
    }

    return {
      ok: true,
      platform: "wechat",
      display_name: profile.displayName,
      username: profile.username,
      resolved_id: profile.resolvedId,
      followers: profile.followers,
    };
  } finally {
    await context.close();
  }
}

async function launchWechatContext(profileDir, options) {
  const args = [...WECHAT_APP_ARGS];
  if (options.appModeUrl) {
    args.push(`--app=${options.appModeUrl}`);
  }

  return chromium.launchPersistentContext(profileDir, {
    headless: options.headless,
    args,
  });
}

async function getWechatSignals(page) {
  return page.evaluate(() => {
    const title = document.title ?? "";
    const url = window.location.href ?? "";
    const bodyText = document.body?.innerText ?? "";
    const bodySnippet = bodyText.replace(/\s+/g, " ").slice(0, 240);
    const loginPromptVisible =
      bodyText.includes("扫码登录") ||
      bodyText.includes("微信号登录") ||
      bodyText.includes("使用微信扫描二维码登录");
    const homeVisible =
      bodyText.includes("总用户数") ||
      bodyText.includes("累计用户数") ||
      bodyText.includes("用户分析") ||
      bodyText.includes("新消息");

    return {
      title,
      url,
      loginPromptVisible,
      homeVisible,
      bodySnippet,
    };
  });
}

export function __test_isTransientNavigationError(error) {
  const message = error?.message ?? String(error ?? "");
  return (
    message.includes("Execution context was destroyed") ||
    message.includes("Most likely the page has been closed") ||
    message.includes("Target page, context or browser has been closed")
  );
}

function appendConnectLog(profileDir, line) {
  fs.mkdirSync(profileDir, { recursive: true });
  fs.appendFileSync(
    path.join(profileDir, "connect.log"),
    `[${new Date().toISOString()}] ${line}\n`
  );
}

function parseFollowers(raw) {
  if (!raw) return null;
  const cleaned = raw.replace(/,/g, "").trim();
  const value = Number.parseInt(cleaned, 10);
  return Number.isFinite(value) ? value : null;
}

export function __test_normalizeWechatAdminUrl(input) {
  const value = String(input ?? "").trim();
  if (value.startsWith("http://") || value.startsWith("https://")) {
    return value;
  }
  return HOME_URL;
}

function extractNicknameFromText(bodyText) {
  const lines = bodyText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const totalIndex = lines.findIndex((line) =>
    line.includes("总用户数") || line.includes("累计用户数") || line.includes("累计关注人数")
  );
  if (totalIndex > 0) {
    const candidate = lines[totalIndex - 1];
    if (
      candidate &&
      !candidate.includes("公众号") &&
      !candidate.includes("首页") &&
      !candidate.includes("内容管理") &&
      !candidate.includes("互动管理")
    ) {
      return candidate;
    }
  }
  return null;
}

export function __test_extractWechatProfile(input) {
  const bodyText =
    typeof input === "string" ? input : String(input?.bodyText ?? "");
  const explicitNickname =
    typeof input === "object" && input !== null
      ? String(input.nickname ?? "").trim()
      : "";
  const patterns = [
    /总用户数\s*([0-9,]+)/,
    /累计用户数\s*([0-9,]+)/,
    /累计关注人数\s*([0-9,]+)/,
  ];

  for (const pattern of patterns) {
    const match = bodyText.match(pattern);
    const followers = parseFollowers(match?.[1] ?? "");
    if (followers !== null) {
      const displayName =
        explicitNickname || extractNicknameFromText(bodyText) || "微信公众号";
      return {
        displayName,
        username: displayName,
        resolvedId: displayName,
        followers,
      };
    }
  }

  return null;
}
