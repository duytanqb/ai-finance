import { expect, test } from "./fixtures/auth.fixture";

test.describe("Portfolio", () => {
  test("portfolio page loads with empty state", async ({ authedPage }) => {
    await authedPage.goto("/portfolio");

    await expect(authedPage.locator("h1")).toContainText("Portfolio", {
      timeout: 30000,
    });
    await expect(
      authedPage
        .locator("text=Your portfolio is empty")
        .or(authedPage.locator("text=portfolio is empty")),
    ).toBeVisible({ timeout: 10000 });
  });

  test("can open add holding form", async ({ authedPage }) => {
    await authedPage.goto("/portfolio");

    await expect(authedPage.locator("h1")).toContainText("Portfolio", {
      timeout: 30000,
    });

    await authedPage
      .locator("button")
      .filter({ hasText: /Add Holding/ })
      .click();

    await expect(authedPage.locator("input[placeholder='VCB']")).toBeVisible({
      timeout: 5000,
    });
  });

  test("can add a holding to portfolio", async ({ authedPage }) => {
    await authedPage.goto("/portfolio");

    await expect(authedPage.locator("h1")).toContainText("Portfolio", {
      timeout: 30000,
    });

    await authedPage
      .locator("button")
      .filter({ hasText: /Add Holding/ })
      .click();

    await authedPage.locator("input[placeholder='VCB']").fill("VCB");
    await authedPage.locator("input[placeholder='100']").fill("200");
    await authedPage.locator("input[placeholder='85000']").fill("85000");

    await authedPage
      .locator("button[type='submit']")
      .filter({ hasText: /Add/ })
      .click();

    await expect(
      authedPage.locator("td").filter({ hasText: "VCB" }),
    ).toBeVisible({
      timeout: 15000,
    });

    await expect(
      authedPage.locator("text=85,000").or(authedPage.locator("text=85.000")),
    ).toBeVisible();
  });

  test("portfolio summary shows after adding holding", async ({
    authedPage,
  }) => {
    await authedPage.goto("/portfolio");

    await expect(authedPage.locator("h1")).toContainText("Portfolio", {
      timeout: 30000,
    });

    await authedPage
      .locator("button")
      .filter({ hasText: /Add Holding/ })
      .click();

    await authedPage.locator("input[placeholder='VCB']").fill("FPT");
    await authedPage.locator("input[placeholder='100']").fill("100");
    await authedPage.locator("input[placeholder='85000']").fill("120000");
    await authedPage
      .locator("button[type='submit']")
      .filter({ hasText: /Add/ })
      .click();

    await expect(
      authedPage.locator("td").filter({ hasText: "FPT" }),
    ).toBeVisible({
      timeout: 15000,
    });

    await expect(authedPage.locator("text=Total Value")).toBeVisible();
    await expect(
      authedPage.getByText("Holdings", { exact: true }),
    ).toBeVisible();
  });

  test("can delete a holding from portfolio", async ({ authedPage }) => {
    await authedPage.goto("/portfolio");

    await expect(authedPage.locator("h1")).toContainText("Portfolio", {
      timeout: 30000,
    });

    await authedPage
      .locator("button")
      .filter({ hasText: /Add Holding/ })
      .click();
    await authedPage.locator("input[placeholder='VCB']").fill("TCB");
    await authedPage.locator("input[placeholder='100']").fill("50");
    await authedPage.locator("input[placeholder='85000']").fill("30000");
    await authedPage
      .locator("button[type='submit']")
      .filter({ hasText: /Add/ })
      .click();

    await expect(
      authedPage.locator("td").filter({ hasText: "TCB" }),
    ).toBeVisible({
      timeout: 15000,
    });

    authedPage.on("dialog", (dialog) => dialog.accept());

    await authedPage
      .locator("tr")
      .filter({ hasText: "TCB" })
      .locator("button")
      .last()
      .click();

    await expect(
      authedPage.locator("td").filter({ hasText: "TCB" }),
    ).not.toBeVisible({
      timeout: 5000,
    });
  });

  test("adding duplicate symbol shows error", async ({ authedPage }) => {
    await authedPage.goto("/portfolio");

    await expect(authedPage.locator("h1")).toContainText("Portfolio", {
      timeout: 30000,
    });

    for (let i = 0; i < 2; i++) {
      await authedPage
        .locator("button")
        .filter({ hasText: /Add Holding/ })
        .click();
      await authedPage.locator("input[placeholder='VCB']").fill("HPG");
      await authedPage.locator("input[placeholder='100']").fill("100");
      await authedPage.locator("input[placeholder='85000']").fill("25000");
      await authedPage
        .locator("button[type='submit']")
        .filter({ hasText: /Add/ })
        .click();

      if (i === 0) {
        await expect(
          authedPage.locator("td").filter({ hasText: "HPG" }),
        ).toBeVisible({ timeout: 15000 });
      }
    }

    await expect(
      authedPage.locator("text=/already exists|duplicate|already in/i"),
    ).toBeVisible({ timeout: 5000 });
  });
});
