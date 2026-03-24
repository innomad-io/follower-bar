import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";

const {
  GITHUB_REPOSITORY,
  GITHUB_TOKEN,
  RELEASE_TAG,
  TAP_DIR = ".tap",
  HOMEBREW_CASK_NAME = "followerbar",
  PRODUCT_NAME = "FollowerBar",
} = process.env;

if (!GITHUB_REPOSITORY || !GITHUB_TOKEN || !RELEASE_TAG) {
  throw new Error("Missing required environment variables for Homebrew cask generation.");
}

const [owner, repo] = GITHUB_REPOSITORY.split("/");
const version = RELEASE_TAG.replace(/^v/, "");
const caskDir = join(TAP_DIR, "Casks");
const caskPath = join(caskDir, `${HOMEBREW_CASK_NAME}.rb`);

const headers = {
  Accept: "application/vnd.github+json",
  Authorization: `Bearer ${GITHUB_TOKEN}`,
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": `${repo}-release-bot`,
};

async function github(pathname) {
  const response = await fetch(`https://api.github.com${pathname}`, { headers });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GitHub API ${pathname} failed: ${response.status} ${body}`);
  }
  return response.json();
}

async function downloadAndSha256(asset) {
  const response = await fetch(asset.url, {
    redirect: "follow",
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: "application/octet-stream",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": `${repo}-release-bot`,
    },
  });
  if (!response.ok) {
    throw new Error(`Failed to download asset ${asset.name}: ${response.status}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const sha256 = createHash("sha256").update(buffer).digest("hex");
  return { sha256, filename: basename(asset.name) };
}

function pickAsset(assets, kind) {
  const patterns =
    kind === "arm"
      ? [/(aarch64|arm64)/i]
      : [/(x86_64|x64|amd64)/i, /(universal|universal2)/i];

  for (const pattern of patterns) {
    const match = assets.find((asset) => pattern.test(asset.name));
    if (match) {
      return match;
    }
  }

  return null;
}

function renderCask({ armAsset, intelAsset }) {
  return `cask "${HOMEBREW_CASK_NAME}" do
  version "${version}"

  if Hardware::CPU.arm?
    url "${armAsset.url}"
    sha256 "${armAsset.sha256}"
  else
    url "${intelAsset.url}"
    sha256 "${intelAsset.sha256}"
  end

  name "${PRODUCT_NAME}"
  desc "Menu bar follower tracker for creators"
  homepage "https://github.com/${owner}/${repo}"

  auto_updates true
  depends_on macos: ">= :ventura"

  app "${PRODUCT_NAME}.app"

  zap trash: [
    "~/Library/Application Support/io.innomad.followbar",
    "~/Library/Preferences/io.innomad.followbar.plist",
  ]
end
`;
}

const release = await github(`/repos/${owner}/${repo}/releases/tags/${RELEASE_TAG}`);
const dmgAssets = release.assets.filter((asset) => asset.name.endsWith(".dmg"));

if (dmgAssets.length < 2) {
  throw new Error(`Expected at least 2 DMG assets on release ${RELEASE_TAG}, found ${dmgAssets.length}.`);
}

const armReleaseAsset = pickAsset(dmgAssets, "arm");
const intelReleaseAsset = pickAsset(dmgAssets, "intel");

if (!armReleaseAsset || !intelReleaseAsset) {
  throw new Error(
    `Could not infer macOS arm/intel DMG assets from: ${dmgAssets.map((asset) => asset.name).join(", ")}`
  );
}

const armAsset = {
  url: armReleaseAsset.browser_download_url,
  ...(await downloadAndSha256(armReleaseAsset)),
};
const intelAsset = {
  url: intelReleaseAsset.browser_download_url,
  ...(await downloadAndSha256(intelReleaseAsset)),
};

await mkdir(caskDir, { recursive: true });
await writeFile(caskPath, renderCask({ armAsset, intelAsset }));

const written = await readFile(caskPath, "utf8");
process.stdout.write(written);
