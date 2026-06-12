import assert from "node:assert/strict";
import { test } from "node:test";
import {
  QKIKI_CREDIT_PACK,
  QKIKI_PLAN_LIMITS,
  QKIKI_PRICING_PLANS,
} from "./billing-plans.ts";

test("starter plan is anchored below the $20 single-chatbot subscription line", () => {
  const starter = QKIKI_PRICING_PLANS.find((plan) => plan.key === "starter");

  assert.ok(starter);
  assert.equal(starter.monthlyPriceUsd, 11.3);
  assert.equal(starter.limits.monthlyCreditLimit, 700);
  assert.equal(starter.limits.dailyCreditLimit, 120);
  assert.equal(starter.limits.dailyLimit, 40);
  assert.ok(starter.monthlyPriceUsd < 20);
});

test("paid plan credit ladder increases with price", () => {
  const [starter, pro, team] = QKIKI_PRICING_PLANS;

  assert.equal(pro.monthlyPriceUsd, 29);
  assert.equal(team.monthlyPriceUsd, 89);
  assert.ok(starter.limits.monthlyCreditLimit < pro.limits.monthlyCreditLimit);
  assert.ok(pro.limits.monthlyCreditLimit < team.limits.monthlyCreditLimit);
  assert.equal(QKIKI_PLAN_LIMITS.pro.monthlyCreditLimit, pro.limits.monthlyCreditLimit);
  assert.equal(QKIKI_PLAN_LIMITS.team.dailyCreditLimit, team.limits.dailyCreditLimit);
});

test("credit pack stays pricier per credit than the main pro subscription", () => {
  const pro = QKIKI_PRICING_PLANS[1];
  const proUsdPerCredit = pro.monthlyPriceUsd / pro.limits.monthlyCreditLimit;
  const packUsdPerCredit = QKIKI_CREDIT_PACK.priceUsd / QKIKI_CREDIT_PACK.credits;

  assert.equal(QKIKI_CREDIT_PACK.priceUsd, 39);
  assert.equal(QKIKI_CREDIT_PACK.credits, 2500);
  assert.ok(packUsdPerCredit > proUsdPerCredit);
});
