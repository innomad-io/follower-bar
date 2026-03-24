import test from "node:test";
import assert from "node:assert/strict";
import {
  __test_extractWechatProfile,
  __test_normalizeWechatAdminUrl,
  __test_isTransientNavigationError,
  __test_connectSuccessHoldMs,
} from "./wechat.mjs";

test("normalize wechat admin url keeps explicit admin url", () => {
  assert.equal(
    __test_normalizeWechatAdminUrl("https://mp.weixin.qq.com/cgi-bin/home?t=home/index&lang=zh_CN"),
    "https://mp.weixin.qq.com/cgi-bin/home?t=home/index&lang=zh_CN"
  );
});

test("extracts total followers from admin body text", () => {
  const profile = __test_extractWechatProfile({
    bodyText: "公众号助手\nInnomad一挪迈\n总用户数\n6,983\n昨日新增\n12\n",
    nickname: "",
  });

  assert.deepEqual(profile, {
    displayName: "Innomad一挪迈",
    username: "Innomad一挪迈",
    resolvedId: "Innomad一挪迈",
    followers: 6983,
  });
});

test("extracts total followers from alternate label", () => {
  const profile = __test_extractWechatProfile({
    bodyText: "用户分析\n累计用户数 10234\n净增人数 5",
    nickname: "Innomad一挪迈",
  });

  assert.equal(profile?.followers, 10234);
  assert.equal(profile?.displayName, "Innomad一挪迈");
});

test("treats execution context destroyed as transient navigation error", () => {
  assert.equal(
    __test_isTransientNavigationError(
      new Error("page.evaluate: Execution context was destroyed, most likely because of a navigation")
    ),
    true
  );
  assert.equal(__test_isTransientNavigationError(new Error("other error")), false);
});

test("wechat connect does not keep browser open for minutes after success", () => {
  assert.equal(__test_connectSuccessHoldMs, 1500);
});
