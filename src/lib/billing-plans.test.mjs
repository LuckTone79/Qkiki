import assert from "node:assert/strict";
import { test } from "node:test";
import {
  QKIKI_CREDIT_PACK,
  QKIKI_PLAN_LIMITS,
  QKIKI_PRICING_PLANS,
} from "./billing-plans.ts";

test("daily credit allowances match the unified credit policy", () => {
  // Signed-in free users get 70/day; signed-out visitors get 30/day.
  assert.equal(QKIKI_PLAN_LIMITS.free.dailyCreditLimit, 70);
  assert.equal(QKIKI_PLAN_LIMITS.anon.dailyCreditLimit, 30);
});

test("plan limits are credit-only (no per-request count fields)", () => {
  for (const limits of Object.values(QKIKI_PLAN_LIMITS)) {
    assert.ok(!("dailyLimit" in limits));
    assert.ok(!("advancedReasoningDailyLimit" in limits));
    assert.ok(!("shareDailyLimit" in limits));
    assert.ok(!("resultSaveLimit" in limits));
  }
});

test("starter plan is anchored at the new $7.30 entry price", () => {
  const starter = QKIKI_PRICING_PLANS.find((plan) => plan.key === "starter");

  assert.ok(starter);
  assert.equal(starter.monthlyPriceUsd, 7.3);
  assert.equal(starter.limits.monthlyCreditLimit, 800);
  assert.equal(starter.limits.dailyCreditLimit, 150);
  assert.ok(starter.monthlyPriceUsd < 20);
});

test("paid plan credit ladder increases with price", () => {
  const [starter, pro, team] = QKIKI_PRICING_PLANS;

  assert.equal(pro.monthlyPriceUsd, 19);
  assert.equal(team.monthlyPriceUsd, 59);
  assert.ok(starter.limits.monthlyCreditLimit < pro.limits.monthlyCreditLimit);
  assert.ok(pro.limits.monthlyCreditLimit < team.limits.monthlyCreditLimit);
  assert.equal(QKIKI_PLAN_LIMITS.pro.monthlyCreditLimit, pro.limits.monthlyCreditLimit);
  assert.equal(QKIKI_PLAN_LIMITS.team.dailyCreditLimit, team.limits.dailyCreditLimit);
});

test("credit pack stays pricier per credit than the main pro subscription", () => {
  const pro = QKIKI_PRICING_PLANS[1];
  const proUsdPerCredit = pro.monthlyPriceUsd / pro.limits.monthlyCreditLimit;
  const packUsdPerCredit = QKIKI_CREDIT_PACK.priceUsd / QKIKI_CREDIT_PACK.credits;

  assert.equal(QKIKI_CREDIT_PACK.priceUsd, 25);
  assert.equal(QKIKI_CREDIT_PACK.credits, 1500);
  assert.ok(packUsdPerCredit > proUsdPerCredit);
});
