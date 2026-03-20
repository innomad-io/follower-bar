import test from "node:test";
import assert from "node:assert/strict";
import {
  __test_extractProfile,
  __test_normalizeInput,
  __test_parseCount,
} from "./x.mjs";

test("normalizeInput accepts handle and profile url", () => {
  assert.equal(__test_normalizeInput("@innomad_io"), "innomad_io");
  assert.equal(__test_normalizeInput("https://x.com/innomad_io"), "innomad_io");
  assert.equal(__test_normalizeInput("https://twitter.com/innomad_io/"), "innomad_io");
});

test("parseCount supports comma-separated values", () => {
  assert.equal(__test_parseCount("6,568 Followers"), 6568);
  assert.equal(__test_parseCount("670 Following"), 670);
});

test("extractProfile parses english public profile copy", () => {
  const bodyText = `
    Innomad 一挪迈
    1,802 posts
    @innomad_io
    Joined September 2023
    670 Following
    6,568 Followers
  `;

  const profile = __test_extractProfile(bodyText, "https://x.com/innomad_io");

  assert.deepEqual(profile, {
    displayName: "Innomad 一挪迈",
    username: "@innomad_io",
    resolvedId: "innomad_io",
    followers: 6568,
    following: 670,
  });
});

test("extractProfile ignores public login promo copy before profile header", () => {
  const bodyText = `
    Don’t miss what’s happening
    People on X are the first to know.
    Log in
    Sign up
    Innomad 一挪迈
    1,802 posts
    See new posts
    Follow
    Innomad 一挪迈
    @innomad_io
    Joined September 2023
    670 Following
    6,568 Followers
  `;

  const profile = __test_extractProfile(bodyText, "https://x.com/innomad_io");

  assert.equal(profile?.displayName, "Innomad 一挪迈");
});

test("extractProfile parses chinese public profile copy", () => {
  const bodyText = `
    Innomad 一挪迈
    1,802 帖子
    @innomad_io
    2023年9月 加入
    670 正在关注
    6,568 关注者
  `;

  const profile = __test_extractProfile(bodyText, "https://x.com/innomad_io");

  assert.equal(profile?.followers, 6568);
  assert.equal(profile?.following, 670);
  assert.equal(profile?.resolvedId, "innomad_io");
});
