import fs from "node:fs";
import readline from "node:readline";
import {
  healthCheck as xiaohongshuHealthCheck,
  connect,
  fetchProfile as fetchXiaohongshuProfile,
  verifyProfile,
} from "./providers/xiaohongshu.mjs";
import {
  healthCheck as xHealthCheck,
  fetchProfile as fetchXProfile,
} from "./providers/x.mjs";
import {
  healthCheck as douyinHealthCheck,
  fetchProfile as fetchDouyinProfile,
} from "./providers/douyin.mjs";
import {
  healthCheck as wechatHealthCheck,
  connect as connectWechat,
  fetchProfile as fetchWechatProfile,
} from "./providers/wechat.mjs";

async function readInput() {
  const filePath = process.argv[2];
  if (filePath) {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  }

  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function dispatch(payload) {
  const action = payload.action;
  const platform = payload.platform;

  let result;
  if (platform === "xiaohongshu") {
    if (action === "health_check") {
      result = await xiaohongshuHealthCheck(payload);
    } else if (action === "connect") {
      result = await connect(payload);
    } else if (action === "fetch_profile") {
      result = await fetchXiaohongshuProfile(payload);
    } else if (action === "verify_profile") {
      result = await verifyProfile(payload);
    } else {
      throw new Error(`Unsupported action for ${platform}: ${action}`);
    }
  } else if (platform === "x") {
    if (action === "health_check") {
      result = await xHealthCheck(payload);
    } else if (action === "fetch_profile") {
      result = await fetchXProfile(payload);
    } else {
      throw new Error(`Unsupported action for ${platform}: ${action}`);
    }
  } else if (platform === "douyin") {
    if (action === "health_check") {
      result = await douyinHealthCheck(payload);
    } else if (action === "fetch_profile") {
      result = await fetchDouyinProfile(payload);
    } else {
      throw new Error(`Unsupported action for ${platform}: ${action}`);
    }
  } else if (platform === "wechat") {
    if (action === "health_check") {
      result = await wechatHealthCheck(payload);
    } else if (action === "connect") {
      result = await connectWechat(payload);
    } else if (action === "fetch_profile") {
      result = await fetchWechatProfile(payload);
    } else {
      throw new Error(`Unsupported action for ${platform}: ${action}`);
    }
  } else {
    throw new Error(`Unsupported platform: ${platform}`);
  }

  return result;
}

async function runOnce() {
  const payload = await readInput();
  const result = await dispatch(payload);
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

async function runDaemon() {
  const rl = readline.createInterface({
    input: process.stdin,
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    if (!line.trim()) {
      continue;
    }

    try {
      const payload = JSON.parse(line);
      const result = await dispatch(payload);
      process.stdout.write(`${JSON.stringify(result)}\n`);
    } catch (error) {
      process.stdout.write(
        `${JSON.stringify({
          ok: false,
          code: "DAEMON_ERROR",
          message: error?.message ?? String(error),
        })}\n`
      );
    }
  }
}

const entry = process.argv.includes("--daemon") ? runDaemon : runOnce;

entry().catch((error) => {
  process.stderr.write(`${error?.stack ?? String(error)}\n`);
  process.exit(1);
});
