import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const HOME_URL = "https://www.xiaohongshu.com/";
const LOGIN_TEXT = new Set(["登录", "手机号登录", "获取验证码", "微信扫码", "马上登录即可"]);
const CHROMIUM_QUIET_ARGS = [
  "--disable-notifications",
  "--deny-permission-prompts",
  "--disable-infobars",
  "--no-default-browser-check",
  "--no-first-run",
  "--disable-default-apps",
  "--disable-features=Translate,OptimizationHints,MediaRouter,AutofillServerCommunication,NotificationTriggers",
  "--disable-popup-blocking",
  "--disable-save-password-bubble",
  "--disable-search-engine-choice-screen",
];

export async function healthCheck() {
  return {
    ok: true,
    platform: "xiaohongshu",
    browser: "chromium",
    message: "Sidecar is available.",
  };
}

export async function connect(payload) {
  const profileDir = payload.profileDir;
  fs.mkdirSync(profileDir, { recursive: true });
  appendConnectLog(profileDir, "connect start");

  const context = await launchXiaohongshuContext(profileDir, {
    headless: false,
    appModeUrl: HOME_URL,
  });

  const page = context.pages()[0] ?? (await context.newPage());
  await page.goto(HOME_URL, { waitUntil: "domcontentloaded" });

  for (let attempt = 0; attempt < 120; attempt += 1) {
    await page.waitForTimeout(2000);
    const signals = await getPageSignals(page);
    appendConnectLog(
      profileDir,
      `connect poll url=${signals.url} title=${signals.title} challenge=${signals.challengeRequired} login=${signals.loginPromptVisible} profileLink=${signals.profileEntryLinked} profileHref=${signals.profileHref ?? ""} me=${signals.profileEntryVisible} bodyLogin=${signals.bodyHasLoginText} bodyMe=${signals.bodyHasMeText} items=${signals.navItems.join("|")} snippet=${signals.bodySnippet}`
    );

    if (signals.profileEntryLinked && !signals.challengeRequired) {
      fs.writeFileSync(path.join(profileDir, ".connected"), "ok");
      appendConnectLog(profileDir, "connect detected logged-in session");
      await page.waitForTimeout(300000);
      await context.close();
      return { ok: true, code: "CONNECTED", message: "Xiaohongshu session connected." };
    }
  }

  appendConnectLog(profileDir, "connect timed out");
  await context.close();
  return { ok: false, code: "LOGIN_TIMEOUT", message: "Xiaohongshu login timed out." };
}

export async function fetchProfile(payload) {
  return fetchProfileInternal(payload, { interactive: false });
}

export async function verifyProfile(payload) {
  return fetchProfileInternal(payload, { interactive: true });
}

export function toSerializableState(value) {
  if (value === null || value === undefined) {
    return null;
  }

  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return null;
  }
}

function shouldWaitForInteractiveResolution({ interactive, challengeRequired, profileEntryLinked, loginPromptVisible }) {
  return Boolean(
    interactive &&
      (challengeRequired || (!profileEntryLinked && loginPromptVisible))
  );
}

async function fetchProfileInternal(payload, options) {
  const profileDir = payload.profileDir;
  if (!fs.existsSync(path.join(profileDir, ".connected"))) {
    return {
      ok: false,
      code: "LOGIN_REQUIRED",
      message: "Xiaohongshu browser session is missing or expired.",
    };
  }

  const targetUrl = normalizeProfileUrl(payload.account?.input);
  const context = await launchXiaohongshuContext(profileDir, {
    headless: !options.interactive,
    appModeUrl: options.interactive ? targetUrl : undefined,
  });

  try {
    const page = context.pages()[0] ?? (await context.newPage());
    await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
    const attempts = options.interactive ? 150 : 1;

    for (let attempt = 0; attempt < attempts; attempt += 1) {
      await page.waitForTimeout(options.interactive ? 2000 : 3000);
      const signals = await getPageSignals(page);

      if (signals.challengeRequired) {
        if (shouldWaitForInteractiveResolution({ interactive: options.interactive, ...signals })) {
          continue;
        }

        return {
          ok: false,
          code: "CHALLENGE_REQUIRED",
          message: "Xiaohongshu showed a security restriction page while loading the profile.",
        };
      }

      if (!signals.profileEntryLinked && signals.loginPromptVisible) {
        if (shouldWaitForInteractiveResolution({ interactive: options.interactive, ...signals })) {
          continue;
        }

        return {
          ok: false,
          code: "LOGIN_REQUIRED",
          message: "Xiaohongshu browser session is missing or expired.",
        };
      }

      const extracted = await page.evaluate(() => {
        const state = window.__INITIAL_STATE__ ?? null;
        const bodyText = document.body.innerText ?? "";
        const html = document.documentElement.outerHTML ?? "";
        return {
          state: (() => {
            if (state === null || state === undefined) {
              return null;
            }

            try {
              return JSON.parse(JSON.stringify(state));
            } catch {
              return null;
            }
          })(),
          bodyText,
          html,
          title: document.title ?? "",
        };
      });

      const profile = parseProfile(extracted.state, extracted.bodyText, extracted.html, targetUrl);
      if (profile) {
        return {
          ok: true,
          platform: "xiaohongshu",
          display_name: profile.displayName,
          username: profile.username,
          resolved_id: profile.resolvedId,
          followers: profile.followers,
        };
      }

      if (!options.interactive) {
        break;
      }
    }

    return {
      ok: false,
      code: options.interactive ? "VERIFY_TIMEOUT" : "DATA_EXTRACTION_FAILED",
      message: options.interactive
        ? "Xiaohongshu verification did not complete before timeout."
        : "Xiaohongshu public page parse failed",
    };
  } finally {
    await context.close();
  }
}

function normalizeProfileUrl(input) {
  const value = String(input ?? "").trim();
  if (value.startsWith("http://") || value.startsWith("https://")) {
    return value;
  }
  return `https://www.xiaohongshu.com/user/profile/${value}`;
}

function appendConnectLog(profileDir, line) {
  fs.mkdirSync(profileDir, { recursive: true });
  fs.appendFileSync(
    path.join(profileDir, "connect.log"),
    `[${new Date().toISOString()}] ${line}\n`
  );
}

async function launchXiaohongshuContext(profileDir, options) {
  const args = [...CHROMIUM_QUIET_ARGS];
  if (options.appModeUrl) {
    args.push(`--app=${options.appModeUrl}`);
  }

  const context = await chromium.launchPersistentContext(profileDir, {
    headless: options.headless,
    args,
  });

  await context.addInitScript(() => {
    const denied = "denied";
    const patchNotification = () => {
      if (!("Notification" in window)) {
        return;
      }

      try {
        Object.defineProperty(window.Notification, "permission", {
          configurable: true,
          get: () => denied,
        });
      } catch {}

      try {
        window.Notification.requestPermission = async () => denied;
      } catch {}
    };

    patchNotification();
  });

  return context;
}

async function getPageSignals(page) {
  return page.evaluate((loginText) => {
    const title = document.title ?? "";
    const url = window.location.href ?? "";
    const bodyText = document.body?.innerText ?? "";
    const navItems = Array.from(document.querySelectorAll("aside a, aside button, nav a, nav button"))
      .map((node) => node.textContent?.trim() ?? "")
      .filter(Boolean);
    const profileEntryVisible = navItems.some((item) => item === "我");
    const profileEntryNode = Array.from(document.querySelectorAll("a, button, [role='link'], [role='button']"))
      .find((node) => node.textContent?.trim() === "我");
    const profileHref =
      profileEntryNode?.closest("a")?.getAttribute("href") ??
      profileEntryNode?.getAttribute("href") ??
      profileEntryNode?.getAttribute("data-href") ??
      null;
    const profileEntryLinked = typeof profileHref === "string" && /\/user\/profile\//.test(profileHref);
    const bodyHasLoginText = Array.from(loginText).some((item) => bodyText.includes(item));
    const bodyHasMeText = bodyText.includes("\n我\n") || bodyText.startsWith("我\n") || bodyText.endsWith("\n我");
    const loginPromptVisible =
      navItems.some((item) => item === "登录") ||
      bodyHasLoginText;
    const challengeRequired =
      title.includes("安全") ||
      title.includes("Security Verification") ||
      url.includes("/website-login/captcha") ||
      bodyText.includes("安全限制") ||
      bodyText.includes("300012") ||
      bodyText.includes("请求太频繁，请稍后再试");
    const bodySnippet = bodyText.replace(/\s+/g, " ").slice(0, 240);

    return {
      url,
      title,
      navItems,
      profileEntryVisible,
      profileHref,
      profileEntryLinked,
      loginPromptVisible,
      challengeRequired,
      bodyHasLoginText,
      bodyHasMeText,
      bodySnippet,
    };
  }, Array.from(LOGIN_TEXT));
}

function parseProfile(state, bodyText, html, targetUrl) {
  const profileState = digProfileState(state);
  const displayName =
    profileState?.displayName ??
    firstCapture(bodyText, /(?:昵称|用户名)[：:\s]*([^\n]+)/) ??
    firstCapture(html, /"nickname":"([^"]+)"/);
  const resolvedId =
    profileState?.resolvedId ??
    firstCapture(targetUrl, /\/user\/profile\/([^/?]+)/) ??
    firstCapture(html, /"userId":"([^"]+)"/);
  const username =
    profileState?.username ??
    firstCapture(html, /"redId":"([^"]+)"/) ??
    resolvedId;
  const followers =
    parseStructuredFollowers(html) ??
    parseMetaFollowers(html) ??
    parseFollowers(bodyText) ??
    parseFollowers(html) ??
    profileState?.followers;

  if (!displayName || !resolvedId || followers === null) {
    return null;
  }

  return { displayName, resolvedId, username, followers };
}

function digProfileState(state) {
  if (!state || typeof state !== "object") {
    return null;
  }

  const buckets = [
    state?.user?.basicInfo,
    state?.user?.interactions,
    state?.profile?.user,
    state?.profile?.counts,
    state?.userPageData?.basicInfo,
    state?.userPageData?.interactions,
  ];

  const displayName = buckets.find((item) => item?.nickname)?.nickname ?? null;
  const resolvedId =
    buckets.find((item) => item?.userId)?.userId ??
    buckets.find((item) => item?.id)?.id ??
    null;
  const username = buckets.find((item) => item?.redId)?.redId ?? null;
  const followers =
    state?.userPageData?.interactions?.fans ??
    state?.userPageData?.interactions?.fansCount ??
    state?.user?.interactions?.fans ??
    state?.user?.interactions?.fansCount ??
    state?.profile?.counts?.fans ??
    state?.profile?.counts?.fansCount ??
    null;

  return { displayName, resolvedId, username, followers };
}

function parseFollowers(source) {
  const compactAfter = firstCapture(source, /粉丝[：:\s]*([0-9]+(?:\.[0-9]+)?)\s*万/);
  if (compactAfter) {
    return Math.round(Number(compactAfter) * 10000);
  }

  const compactBefore = firstCapture(source, /([0-9]+(?:\.[0-9]+)?)\s*万\s*粉丝/);
  if (compactBefore) {
    return Math.round(Number(compactBefore) * 10000);
  }

  const exactAfter = firstCapture(source, /粉丝[：:\s]*([0-9][0-9,]*)/);
  if (exactAfter) {
    return Number(exactAfter.replaceAll(",", ""));
  }

  const exactBefore = firstCapture(source, /([0-9][0-9,]*)\s*粉丝/);
  if (exactBefore) {
    return Number(exactBefore.replaceAll(",", ""));
  }

  const jsonLike = firstCapture(source, /"fans(?:Count)?":([0-9]+)/);
  if (jsonLike) {
    return Number(jsonLike);
  }

  return null;
}

function parseStructuredFollowers(source) {
  const byType = firstCapture(
    source,
    /"type":"fans","name":"粉丝","count":"([0-9]+)"/
  );
  if (byType) {
    return Number(byType);
  }

  const byName = firstCapture(
    source,
    /"name":"粉丝","count":"([0-9]+)"/
  );
  if (byName) {
    return Number(byName);
  }

  return null;
}

function parseMetaFollowers(source) {
  const exact = firstCapture(source, /有([0-9][0-9,]*)位粉丝/);
  if (exact) {
    return Number(exact.replaceAll(",", ""));
  }

  const compact = firstCapture(source, /有([0-9]+(?:\.[0-9]+)?)万位粉丝/);
  if (compact) {
    return Math.round(Number(compact) * 10000);
  }

  return null;
}

export function __test_parseFollowers(source) {
  return parseFollowers(source);
}

export function __test_parseProfile(state, bodyText, html, targetUrl) {
  return parseProfile(state, bodyText, html, targetUrl);
}

export function __test_shouldWaitForInteractiveResolution(input) {
  return shouldWaitForInteractiveResolution(input);
}

function firstCapture(source, regex) {
  const match = String(source ?? "").match(regex);
  return match?.[1] ?? null;
}
