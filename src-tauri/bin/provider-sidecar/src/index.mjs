import fs from "node:fs";
import { healthCheck, connect, fetchProfile, verifyProfile } from "./providers/xiaohongshu.mjs";

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

async function main() {
  const payload = await readInput();
  const action = payload.action;
  const platform = payload.platform;

  if (platform !== "xiaohongshu") {
    throw new Error(`Unsupported platform: ${platform}`);
  }

  let result;
  if (action === "health_check") {
    result = await healthCheck(payload);
  } else if (action === "connect") {
    result = await connect(payload);
  } else if (action === "fetch_profile") {
    result = await fetchProfile(payload);
  } else if (action === "verify_profile") {
    result = await verifyProfile(payload);
  } else {
    throw new Error(`Unsupported action: ${action}`);
  }

  process.stdout.write(`${JSON.stringify(result)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error?.stack ?? String(error)}\n`);
  process.exit(1);
});
