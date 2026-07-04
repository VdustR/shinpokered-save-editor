import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";

const fixturePath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../fixtures/newgame.sav",
);

function decodeBcd3(bytes: Uint8Array, offset: number): number {
  let v = 0;
  for (let i = 0; i < 3; i++) v = v * 100 + (bytes[offset + i] >> 4) * 10 + (bytes[offset + i] & 0x0f);
  return v;
}

const MONEY_OFFSET = 0x25f3;
const MAIN_CKSUM = 0x3523;

function gen1MainChecksum(bytes: Uint8Array): number {
  let sum = 0;
  for (let i = 0x2598; i < 0x3523; i++) sum = (sum + bytes[i]) & 0xff;
  return ~sum & 0xff;
}

async function loadFixture(page: Page) {
  await page.goto("/");
  await page.setInputFiles('[data-testid="file-input"]', fixturePath);
  await expect(page.locator(".page-header__title")).toHaveText("Overview");
}

async function exportBytes(page: Page): Promise<Uint8Array> {
  await page.getByRole("button", { name: "Export…" }).click();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByTestId("download-save").click(),
  ]);
  const file = await download.path();
  return new Uint8Array(await readFile(file));
}

test("loads a save and shows the trainer name", async ({ page }) => {
  await loadFixture(page);
  await page.locator(".sidenav__item", { hasText: "Trainer" }).click();
  await expect(page.getByTestId("money-input")).toHaveValue("3000");
});

test("no-op export is byte-for-byte identical to the source", async ({ page }) => {
  await loadFixture(page);
  const original = new Uint8Array(await readFile(fixturePath));
  const exported = await exportBytes(page);
  expect(exported.length).toBe(original.length);
  expect(Buffer.from(exported).equals(Buffer.from(original))).toBe(true);
});

test("editing money exports a valid save with only the expected bytes changed", async ({ page }) => {
  await loadFixture(page);
  const original = new Uint8Array(await readFile(fixturePath));

  await page.locator(".sidenav__item", { hasText: "Trainer" }).click();
  const money = page.getByTestId("money-input");
  await money.fill("123456");
  await money.blur();

  // Dirty state is reflected in the top bar.
  await expect(page.locator(".dirty--on")).toBeVisible();

  const exported = await exportBytes(page);

  // Money is written as BCD and the main checksum is repaired.
  expect(decodeBcd3(exported, MONEY_OFFSET)).toBe(123456);
  expect(exported[MAIN_CKSUM]).toBe(gen1MainChecksum(exported));

  // Only the money bytes and the main checksum byte differ from the original.
  const changed: number[] = [];
  for (let i = 0; i < exported.length; i++) if (exported[i] !== original[i]) changed.push(i);
  expect(changed).toEqual([MONEY_OFFSET, MONEY_OFFSET + 1, MONEY_OFFSET + 2, MAIN_CKSUM]);
});

test("adding a party Pokémon updates the party count and stays exportable", async ({ page }) => {
  await loadFixture(page);
  await page.locator(".sidenav__item", { hasText: "Party" }).click();
  await page.getByRole("button", { name: "Add Pokémon" }).first().click();

  // The new mon appears in the slot list and the editor renders stats.
  await expect(page.locator(".slot")).toHaveCount(1);
  await expect(page.locator(".statbar")).toHaveCount(5);

  const exported = await exportBytes(page);
  expect(exported[0x2f2c]).toBe(1); // party count
  expect(exported[MAIN_CKSUM]).toBe(gen1MainChecksum(exported));
});

test("Expert hex view highlights an edit and can jump from a field", async ({ page }) => {
  await loadFixture(page);
  await page.locator(".sidenav__item", { hasText: "Trainer" }).click();
  await page.getByTestId("money-input").fill("999999");
  // Jump to the money offset via its chip.
  await page.getByRole("button", { name: /0x25F3/i }).click();
  await expect(page.locator(".page-header__title")).toHaveText("Raw Hex");
  await expect(page.locator(".hx__b--dirty").first()).toBeVisible();
});
