import test from "node:test";
import assert from "node:assert/strict";
import {
  __test_parseFollowers,
  __test_parseProfile,
  __test_shouldWaitForInteractiveResolution,
  toSerializableState,
} from "./xiaohongshu.mjs";

test("toSerializableState returns plain data for serializable input", () => {
  const value = {
    userPageData: {
      interactions: {
        fans: 6983,
      },
    },
  };

  assert.deepEqual(toSerializableState(value), value);
});

test("toSerializableState returns null for circular input", () => {
  const value = { user: {} };
  value.user.self = value;

  assert.equal(toSerializableState(value), null);
});

test("parseFollowers supports exact count before 粉丝", async () => {
  assert.equal(__test_parseFollowers("6983 粉丝"), 6983);
});

test("parseFollowers supports compact count before 粉丝", async () => {
  assert.equal(__test_parseFollowers("0.7万 粉丝"), 7000);
});

test("parseProfile prefers structured fans count over visible body text noise", () => {
  const html = `
    <meta name="description" content="Innomad一挪迈在「小红书」上有6983位粉丝，已关注157人">
    <meta name="keywords" content="Innomad一挪迈">
    <script>
      window.__INITIAL_STATE__ = null;
    </script>
    <div>{"nickname":"Innomad一挪迈","userId":"60383492000000000100a467","redId":"innomad"}</div>
    <div>{"type":"fans","name":"粉丝","count":"6983"}</div>
  `;
  const bodyText = "粉丝\n3.6万";

  const profile = __test_parseProfile(
    null,
    bodyText,
    html,
    "https://www.xiaohongshu.com/user/profile/60383492000000000100a467"
  );

  assert.equal(profile?.followers, 6983);
});

test("interactive verify waits when login prompt is visible", () => {
  assert.equal(
    __test_shouldWaitForInteractiveResolution({
      interactive: true,
      challengeRequired: false,
      profileEntryLinked: false,
      loginPromptVisible: true,
    }),
    true
  );
});

test("non-interactive fetch does not wait when login prompt is visible", () => {
  assert.equal(
    __test_shouldWaitForInteractiveResolution({
      interactive: false,
      challengeRequired: false,
      profileEntryLinked: false,
      loginPromptVisible: true,
    }),
    false
  );
});
