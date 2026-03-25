import test from "node:test";
import assert from "node:assert/strict";
import {
  __test_extractProfile,
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
      bodyText: "instagram\nInstagram\n700M followers\n226 following",
      metaDescription:
        "701M Followers, 226 Following, 8,378 Posts - See Instagram photos and videos from Instagram (@instagram)",
    }),
    {
      displayName: "Instagram",
      username: "@instagram",
      resolvedId: "instagram",
      followers: 701000000,
    }
  );
});
