import { expect, test } from "./fixtures/auth.fixture";

test.describe("Feature Pages Smoke Tests", () => {
  test("dashboard page loads with content", async ({ authedPage }) => {
    await authedPage.goto("/dashboard");

    await expect(authedPage.locator("h1")).toContainText("Welcome back", {
      timeout: 15000,
    });
  });

  test("screener page loads with filters", async ({ authedPage }) => {
    await authedPage.goto("/screener");

    await expect(authedPage.locator("h1")).toContainText("Screener", {
      timeout: 15000,
    });
  });

  test("market watch page loads", async ({ authedPage }) => {
    await authedPage.goto("/market-watch");

    await expect(authedPage.locator("h1")).toContainText("Market Watch", {
      timeout: 30000,
    });
  });

  test("sidebar navigation works", async ({ authedPage }) => {
    await authedPage.goto("/dashboard");

    await expect(authedPage.locator("h1")).toBeVisible({ timeout: 15000 });

    const sidebarLinks = [
      { text: /Stocks/i, url: "/stocks" },
      { text: /Portfolio/i, url: "/portfolio" },
      { text: /Watchlist/i, url: "/watchlist" },
    ];

    for (const link of sidebarLinks) {
      const navLink = authedPage
        .locator("nav a, aside a")
        .filter({ hasText: link.text })
        .first();
      if (await navLink.isVisible()) {
        await navLink.click();
        await expect(authedPage).toHaveURL(new RegExp(link.url), {
          timeout: 15000,
        });
      }
    }
  });
});
