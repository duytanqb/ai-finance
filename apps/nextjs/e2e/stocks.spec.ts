import { expect, test } from "./fixtures/auth.fixture";

test.describe("Stocks", () => {
  test("stocks list page loads with search input", async ({ authedPage }) => {
    await authedPage.goto("/stocks");

    await expect(authedPage.locator("h1")).toContainText("Stocks");
    await expect(
      authedPage
        .locator("input[placeholder*='Search']")
        .or(
          authedPage
            .locator("input[placeholder*='search']")
            .or(authedPage.locator("input[type='text']").first()),
        ),
    ).toBeVisible();
  });

  test("stock detail page loads with price and metrics", async ({
    authedPage,
  }) => {
    await authedPage.goto("/stocks/VCB");

    await expect(authedPage.locator("h1")).toContainText("VCB", {
      timeout: 10000,
    });

    await expect(authedPage.locator("text=P/E").first()).toBeVisible({
      timeout: 15000,
    });
    await expect(authedPage.locator("text=ROE").first()).toBeVisible();
    await expect(authedPage.locator("text=EPS").first()).toBeVisible();
    await expect(authedPage.locator("text=P/B").first()).toBeVisible();
  });

  test("stock detail shows price in VND format (> 1000)", async ({
    authedPage,
  }) => {
    await authedPage.goto("/stocks/VCB");

    await authedPage.waitForTimeout(3000);

    const priceText = await authedPage
      .locator(".font-mono.text-2xl, span.text-2xl.font-bold.font-mono")
      .first()
      .textContent();

    if (priceText && priceText !== "-") {
      const numericValue = Number(priceText.replace(/[.,\s]/g, ""));
      expect(numericValue).toBeGreaterThan(1000);
    }
  });

  test("stock detail has action buttons", async ({ authedPage }) => {
    await authedPage.goto("/stocks/VCB");

    await expect(
      authedPage.locator("button").filter({ hasText: /Analyze|Re-analyze/ }),
    ).toBeVisible({ timeout: 10000 });
    await expect(
      authedPage
        .locator("button")
        .filter({ hasText: /Deep Research|Re-research/ }),
    ).toBeVisible();
    await expect(
      authedPage.locator("button").filter({ hasText: /Watchlist/ }),
    ).toBeVisible();
  });

  test("stock detail has price chart", async ({ authedPage }) => {
    await authedPage.goto("/stocks/VCB");

    const chart = authedPage
      .locator("canvas, img[src*='chart'], [class*='chart']")
      .first();
    await expect(chart).toBeVisible({ timeout: 15000 });
  });
});
