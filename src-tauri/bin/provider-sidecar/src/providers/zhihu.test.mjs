import test from "node:test";
import assert from "node:assert/strict";
import {
  __test_extractProfile,
  __test_normalizeInput,
  __test_parsePlainCount,
} from "./zhihu.mjs";

test("normalizeInput accepts zhihu profile url and slug", () => {
  assert.equal(__test_normalizeInput("https://www.zhihu.com/people/zhou-yuan"), "zhou-yuan");
  assert.equal(__test_normalizeInput("zhou-yuan"), "zhou-yuan");
});

test("parsePlainCount parses integer strings", () => {
  assert.equal(__test_parsePlainCount("819"), 819);
  assert.equal(__test_parsePlainCount("1,024"), 1024);
});

test("extractProfile parses zhihu body text", () => {
  assert.deepEqual(
    __test_extractProfile({
      title: "周远 - 知乎",
      finalUrl: "https://www.zhihu.com/people/zhou-yuan",
      bodyText: "周远\n关注\n37\n关注者\n819\n关注的话题\n45",
      metaDescription: "arm c 回答数 0，获得 0 次赞同",
    }),
    {
      displayName: "周远",
      username: "zhou-yuan",
      resolvedId: "zhou-yuan",
      followers: 819,
    }
  );
});
