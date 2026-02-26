import { expect, test } from "@playwright/test";
import { generateUniqueEmail, testUsers } from "./fixtures/test-data";

test.describe("Protected Routes", () => {
  test.beforeEach(async ({ page }) => {
    const uniqueEmail = generateUniqueEmail();

    await page.goto("/register");
    await page.fill("input[name='name']", testUsers.newUser.name);
    await page.fill("input[type='email']", uniqueEmail);
    await page.fill("input[name='password']", testUsers.newUser.password);
    await page.fill(
      "input[name='confirmPassword']",
      testUsers.newUser.password,
    );
    await page.click("button[type='submit']");
    await page.waitForURL("/dashboard", { timeout: 15000 });
  });

  test("should display dashboard after authentication", async ({ page }) => {
    await expect(page.locator("text=Dashboard")).toBeVisible();
  });

  test("should display user name in header", async ({ page }) => {
    const firstName = testUsers.newUser.name.split(" ")[0];
    await expect(
      page.locator(`h1:has-text("Welcome back, ${firstName}")`),
    ).toBeVisible({ timeout: 10000 });
  });

  test("should sign out and redirect to login", async ({ page }) => {
    // Open user menu dropdown (avatar button in header)
    await page.locator("header button").last().click();

    // Click Sign Out in dropdown
    await page.getByRole("menuitem", { name: /Sign Out/ }).click();

    await expect(page).toHaveURL("/login", { timeout: 10000 });
  });

  test("should not access dashboard after sign out", async ({ page }) => {
    // Open user menu dropdown
    await page.locator("header button").last().click();

    // Click Sign Out in dropdown
    await page.getByRole("menuitem", { name: /Sign Out/ }).click();
    await page.waitForURL("/login", { timeout: 10000 });

    await page.goto("/dashboard");

    await expect(page).toHaveURL(/\/login/);
  });
});
