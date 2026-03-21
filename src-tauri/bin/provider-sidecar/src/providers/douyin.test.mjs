import test from "node:test";
import assert from "node:assert/strict";
import {
  __test_extractProfile,
  __test_normalizeInput,
  __test_parseCount,
} from "./douyin.mjs";

test("normalizeInput accepts public profile urls and raw ids", () => {
  assert.equal(
    __test_normalizeInput(
      "https://www.douyin.com/user/MS4wLjABAAAABlpgnNdp-0GFwqUNU3Vre3L4l6qKCNfV-OYzsuT4vHbtEG0ZldqB9NtQ0sdyhdAl?from_tab_name=main"
    ),
    "MS4wLjABAAAABlpgnNdp-0GFwqUNU3Vre3L4l6qKCNfV-OYzsuT4vHbtEG0ZldqB9NtQ0sdyhdAl"
  );
  assert.equal(
    __test_normalizeInput("MS4wLjABAAAABlpgnNdp-0GFwqUNU3Vre3L4l6qKCNfV-OYzsuT4vHbtEG0ZldqB9NtQ0sdyhdAl"),
    "MS4wLjABAAAABlpgnNdp-0GFwqUNU3Vre3L4l6qKCNfV-OYzsuT4vHbtEG0ZldqB9NtQ0sdyhdAl"
  );
});

test("parseCount supports plain, wan, and yi counts", () => {
  assert.equal(__test_parseCount("275"), 275);
  assert.equal(__test_parseCount("11.6万"), 116000);
  assert.equal(__test_parseCount("1.2亿"), 120000000);
});

test("extractProfile parses public douyin profile body", () => {
  const bodyText = `
    登录
    啊喂户外
    关注
    275
    粉丝
    11.6万
    获赞
    85.6万
    抖音号：AWEI8008820
    IP属地：山东
  `;

  const profile = __test_extractProfile(
    bodyText,
    "啊喂户外的抖音 - 抖音",
    "https://www.douyin.com/user/MS4wLjABAAAABlpgnNdp-0GFwqUNU3Vre3L4l6qKCNfV-OYzsuT4vHbtEG0ZldqB9NtQ0sdyhdAl?from_tab_name=main"
  );

  assert.deepEqual(profile, {
    displayName: "啊喂户外",
    username: "AWEI8008820",
    resolvedId:
      "MS4wLjABAAAABlpgnNdp-0GFwqUNU3Vre3L4l6qKCNfV-OYzsuT4vHbtEG0ZldqB9NtQ0sdyhdAl",
    followers: 116000,
    following: 275,
  });
});
