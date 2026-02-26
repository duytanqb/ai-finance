import { expect, test } from "./fixtures/auth.fixture";

test.describe("Watchlist", () => {
  test("watchlist page loads", async ({ authedPage }) => {
    await authedPage.goto("/watchlist");

    await expect(authedPage.locator("h1")).toContainText("Watchlist", {
      timeout: 15000,
    });
  });

  test("can add stock to watchlist from detail page", async ({
    authedPage,
  }) => {
    await authedPage.goto("/stocks/VCB");

    const watchlistBtn = authedPage
      .locator("button")
      .filter({ hasText: /Watchlist/ });
    await expect(watchlistBtn).toBeVisible({ timeout: 15000 });
    await watchlistBtn.click();

    await expect(
      authedPage
        .locator("text=Added to watchlist")
        .or(authedPage.locator("button").filter({ hasText: /Added/ })),
    ).toBeVisible({ timeout: 10000 });
  });

  test("watchlist shows added stock", async ({ authedPage }) => {
    await authedPage.goto("/stocks/FPT");

    await expect(
      authedPage.locator("button").filter({ hasText: /Watchlist/ }),
    ).toBeVisible({ timeout: 15000 });

    await authedPage
      .locator("button")
      .filter({ hasText: /Watchlist/ })
      .click();
    await authedPage.waitForTimeout(2000);

    await authedPage.goto("/watchlist");

    await expect(authedPage.locator("text=FPT")).toBeVisible({
      timeout: 15000,
    });
  });

  test("can remove stock from watchlist", async ({ authedPage }) => {
    await authedPage.goto("/stocks/TCB");

    await expect(
      authedPage.locator("button").filter({ hasText: /Watchlist/ }),
    ).toBeVisible({ timeout: 15000 });

    await authedPage
      .locator("button")
      .filter({ hasText: /Watchlist/ })
      .click();
    await authedPage.waitForTimeout(2000);

    await authedPage.goto("/watchlist");
    await expect(authedPage.locator("text=TCB")).toBeVisible({
      timeout: 15000,
    });

    authedPage.on("dialog", (dialog) => dialog.accept());

    await authedPage
      .locator("tr, [class*='card'], div")
      .filter({ hasText: "TCB" })
      .first()
      .locator("button")
      .last()
      .click();

    await expect(
      authedPage.locator("td").filter({ hasText: "TCB" }),
    ).not.toBeVisible({
      timeout: 5000,
    });
  });
});
