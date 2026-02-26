import { test as base, type Page } from "@playwright/test";
import { generateUniqueEmail, testUsers } from "./test-data";

async function registerAndLogin(page: Page): Promise<Page> {
  const uniqueEmail = generateUniqueEmail();

  await page.goto("/register");
  await page.fill("input[name='name']", testUsers.newUser.name);
  await page.fill("input[type='email']", uniqueEmail);
  await page.fill("input[name='password']", testUsers.newUser.password);
  await page.fill("input[name='confirmPassword']", testUsers.newUser.password);
  await page.click("button[type='submit']");
  await page.waitForURL("/dashboard", { timeout: 15000 });

  return page;
}

export const test = base.extend<{ authedPage: Page }>({
  authedPage: async ({ page }, use) => {
    await registerAndLogin(page);
    await use(page);
  },
});

export { expect } from "@playwright/test";
