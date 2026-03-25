import test from "node:test";
import assert from "node:assert/strict";
import {
  __test_extractProfile,
  __test_normalizeInput,
  __test_parseCompactCount,
} from "./threads.mjs";

test("normalizeInput accepts handle and profile url", () => {
  assert.equal(__test_normalizeInput("@zuck"), "zuck");
  assert.equal(__test_normalizeInput("https://www.threads.net/@zuck"), "zuck");
  assert.equal(__test_normalizeInput("https://www.threads.com/@zuck/"), "zuck");
});

test("parseCompactCount supports compact suffixes", () => {
  assert.equal(__test_parseCompactCount("5.5M"), 5500000);
  assert.equal(__test_parseCompactCount("11K"), 11000);
});

test("extractProfile parses title and meta description", () => {
  assert.deepEqual(
    __test_extractProfile({
      title: "Mark Zuckerberg (@zuck) • Threads, Say more",
      finalUrl: "https://www.threads.com/@zuck",
      bodyText: "zuck\nMark Zuckerberg\n5.4M followers\nFollow",
      metaDescription:
        "5.5M Followers • 142 Threads • Mostly superintelligence and MMA takes. See the latest conversations with @zuck.",
    }),
    {
      displayName: "Mark Zuckerberg",
      username: "@zuck",
      resolvedId: "zuck",
      followers: 5500000,
    }
  );
});
