import test from "node:test";
import assert from "node:assert/strict";
import {
  getEnabledWebPrimaryLoginProviders,
  getProviderStatus,
  isEnabledWebSocialLoginProvider,
} from "./wideget-login-registry.ts";

test("Yapp sign-in and sign-up share the configured web provider registry", () => {
  assert.deepEqual(
    getEnabledWebPrimaryLoginProviders().map((provider) => provider.id),
    ["email_password", "google", "kakao"],
  );
  assert.equal(isEnabledWebSocialLoginProvider("google"), true);
  assert.equal(isEnabledWebSocialLoginProvider("kakao"), true);
  assert.equal(isEnabledWebSocialLoginProvider("facebook"), false);
});

test("non-login channels and unverified providers stay out of the public picker", () => {
  assert.equal(getProviderStatus("whatsapp_otp"), "planned");
  assert.equal(getProviderStatus("facebook"), "planned");
  assert.equal(isEnabledWebSocialLoginProvider("whatsapp_otp"), false);
});
