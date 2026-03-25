import test from "node:test";
import assert from "node:assert/strict";
import {
  __test_extractProfile,
  __test_fetchProfileViaPublicApi,
  __test_normalizeInput,
  __test_parseCompactCount,
} from "./instagram.mjs";

test("normalizeInput accepts handle and profile url", () => {
  assert.equal(__test_normalizeInput("@instagram"), "instagram");
  assert.equal(__test_normalizeInput("https://www.instagram.com/instagram/"), "instagram");
});

test("parseCompactCount supports comma and suffix forms", () => {
  assert.equal(__test_parseCompactCount("701M"), 701000000);
  assert.equal(__test_parseCompactCount("8,378"), 8378);
});

test("extractProfile parses instagram meta description", () => {
  assert.deepEqual(
    __test_extractProfile({
      title: "Instagram (@instagram) • Instagram photos and videos",
      finalUrl: "https://www.instagram.com/instagram/",
      bodyText: "instagram\nInstagram\n700,868,855 followers\n226 following",
      metaDescription:
        "701M Followers, 226 Following, 8,378 Posts - See Instagram photos and videos from Instagram (@instagram)",
    }),
    {
      displayName: "Instagram",
      username: "@instagram",
      resolvedId: "instagram",
      followers: 700868855,
    }
  );
});

test("extractProfile rejects login redirect pages", () => {
  assert.equal(
    __test_extractProfile({
      title: "Login • Instagram",
      finalUrl: "https://www.instagram.com/accounts/login/",
      bodyText: "",
      metaDescription: null,
    }),
    null
  );
});

test("public api returns exact follower count for instagram", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({
      data: {
        user: {
          username: "instagram",
          full_name: "Instagram",
          edge_followed_by: { count: 700868855 },
        },
      },
    }),
  });

  try {
    const profile = await __test_fetchProfileViaPublicApi("instagram");
    assert.ok(profile);
    assert.equal(profile.displayName, "Instagram");
    assert.equal(profile.username, "@instagram");
    assert.equal(profile.resolvedId, "instagram");
    assert.equal(profile.followers, 700868855);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
