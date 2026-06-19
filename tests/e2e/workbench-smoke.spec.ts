import { expect, test } from "@playwright/test";

test.skip(
  !process.env.DATABASE_URL,
  "DATABASE_URL is required for trial login smoke coverage.",
);

test("trial user can navigate core workbench routes", async ({ page }, testInfo) => {
  const trial = await page.context().request.post("/api/trial/start", {
    headers: {
      "x-forwarded-for": `127.0.0.${testInfo.workerIndex + 10}`,
    },
  });
  expect(trial.ok()).toBe(true);

  const body = (await trial.json()) as { redirectUrl?: string };
  await page.goto(body.redirectUrl || "/app/workbench?trial=true");
  await expect(page).toHaveURL(/\/app\/workbench/);
  await expect(page.locator("main")).toBeVisible();
  await expect(page.locator("textarea").first()).toBeVisible();

  for (const route of ["/app/sessions", "/app/projects", "/app/presets"]) {
    await page.goto(route);
    await expect(page).toHaveURL(new RegExp(`${route.replace("/", "\\/")}$`));
    await expect(page.locator("main")).toBeVisible();
  }

  await page.goto("/app/workbench?trial=true");
  await expect(page).toHaveURL(/\/app\/workbench/);
  await expect(page.locator("textarea").first()).toBeVisible();
});
