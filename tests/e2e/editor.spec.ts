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

test("warns when the opened file is not a Gen 1 save, and not for a real one", async ({ page }) => {
  await page.goto("/");
  // A 32 KiB file of patterned garbage: correct size, wrong everything else.
  const garbage = Buffer.alloc(0x8000);
  for (let i = 0; i < garbage.length; i++) garbage[i] = (i * 37 + 11) & 0xff;
  await page.setInputFiles('[data-testid="file-input"]', {
    name: "garbage.sav",
    mimeType: "application/octet-stream",
    buffer: garbage,
  });
  const banner = page.getByTestId("assessment-banner");
  await expect(banner).toBeVisible();
  await expect(banner).toContainText("does not look like a Gen 1");
  await banner.getByRole("button", { name: "Dismiss" }).click();
  await expect(page.getByTestId("assessment-banner")).toHaveCount(0);

  // A real save shows no banner.
  await page.getByRole("button", { name: "Close" }).click();
  await page.setInputFiles('[data-testid="file-input"]', fixturePath);
  await expect(page.locator(".page-header__title")).toHaveText("Overview");
  await expect(page.getByTestId("assessment-banner")).toHaveCount(0);
});

test("About dialog shows repo, license, and disclaimer from both entry points", async ({ page }) => {
  await page.goto("/");
  // Empty state: footer under the dropzone.
  await page.getByTestId("about-open").click();
  const dialog = page.locator("dialog.about[open]");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("link", { name: /GitHub/ })).toHaveAttribute(
    "href",
    "https://github.com/VdustR/shinpokered-save-editor",
  );
  await expect(dialog).toContainText("MIT License");
  await expect(dialog).toContainText("not affiliated with, endorsed, or sponsored by Nintendo");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();

  // File open: side-nav footer.
  await page.setInputFiles('[data-testid="file-input"]', fixturePath);
  await expect(page.locator(".page-header__title")).toHaveText("Overview");
  await page.getByTestId("about-open").click();
  await expect(page.locator("dialog.about[open]")).toBeVisible();
});

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

test("party DV edits persist and one-click Max fills values", async ({ page }) => {
  await loadFixture(page);
  await page.locator(".sidenav__item", { hasText: "Party" }).click();
  await page.getByRole("button", { name: "Add Pokémon" }).first().click();
  await page.getByRole("button", { name: "DVs & EXP" }).click();

  const atk = page.locator(".field", { hasText: "ATK DV" }).locator("input");
  await atk.fill("13");
  await atk.press("Enter");
  await expect(atk).toHaveValue("13");

  await page.getByRole("button", { name: "Max DVs" }).click();
  await expect(atk).toHaveValue("15");
});

test("changing species on a non-nicknamed mon does not leak the old species name", async ({ page }) => {
  await loadFixture(page);
  await page.locator(".sidenav__item", { hasText: "Party" }).click();
  await page.getByRole("button", { name: "Add Pokémon" }).first().click();

  const nick = page.locator(".field", { hasText: "Nickname" }).locator("input");
  await expect(nick).toHaveValue(""); // not custom -> placeholder only
  await expect(nick).toHaveAttribute("placeholder", "BULBASAUR");

  // Change species without touching the nickname; it must follow the new species.
  await page.locator(".field", { hasText: "Species" }).locator(".picker-trigger").click();
  const dialog = page.locator("dialog.picker[open]");
  await dialog.getByLabel("Search").fill("charmander");
  await dialog.locator(".picker__row").filter({ hasText: "CHARMANDER" }).click();
  await expect(dialog).toBeHidden();
  await expect(nick).toHaveValue("");
  await expect(nick).toHaveAttribute("placeholder", "CHARMANDER");

  // The slot label should read CHARMANDER, not the old BULBASAUR.
  await expect(page.locator(".slot__name").first()).toHaveText("CHARMANDER");
});

test("encyclopedia fuzzy-searches moves and filters by type", async ({ page }) => {
  await loadFixture(page);
  await page.locator(".sidenav__item", { hasText: "Encyclopedia" }).click();
  await page.getByLabel("Search", { exact: true }).fill("thunderbolt");
  await expect(page.locator(".enc-name").first()).toHaveText("THUNDERBOLT");

  await page.getByLabel("Search", { exact: true }).fill("");
  await page.getByLabel("Type filter").selectOption({ label: "ELECTRIC" });
  const rows = page.locator(".enc-table tbody tr");
  expect(await rows.count()).toBeGreaterThan(0);
  for (const tag of await page.locator(".enc-table tbody .type-tag").allTextContents()) {
    expect(tag).toBe("ELECTRIC");
  }
});

test("move picker searches, filters by type, and assigns the chosen move", async ({ page }) => {
  await loadFixture(page);
  await page.locator(".sidenav__item", { hasText: "Party" }).click();
  await page.getByRole("button", { name: "Add Pokémon" }).first().click();
  await page.getByRole("button", { name: "Moves" }).click();

  await page.locator(".move-row .picker-trigger").first().click();
  const dialog = page.locator("dialog.picker[open]");
  await expect(dialog).toBeVisible();

  // Fuzzy search.
  await dialog.getByLabel("Search").fill("thunderbolt");
  await expect(dialog.locator(".picker__row .picker__name").first()).toHaveText("THUNDERBOLT");

  // Type filter narrows to electric moves only.
  await dialog.getByLabel("Search").fill("");
  await dialog.getByLabel("Filter by type").selectOption({ label: "ELECTRIC" });
  await dialog.locator(".picker__row").filter({ hasText: "THUNDERBOLT" }).click();

  await expect(dialog).toBeHidden();
  await expect(page.locator(".move-row .picker-trigger__label").first()).toHaveText("THUNDERBOLT");

  // The picker can also clear a slot back to empty (regression guard).
  await page.locator(".move-row .picker-trigger").first().click();
  await expect(dialog).toBeVisible();
  await dialog.locator(".picker__row").filter({ hasText: "No move" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.locator(".move-row .picker-trigger__label").first()).toHaveText("Empty slot");
});

test("move picker labels legality and can filter to learnable moves", async ({ page }) => {
  await loadFixture(page);
  await page.locator(".sidenav__item", { hasText: "Party" }).click();
  await page.getByRole("button", { name: "Add Pokémon" }).first().click(); // Bulbasaur
  await page.getByRole("button", { name: "Moves" }).click();
  await page.locator(".move-row .picker-trigger").first().click();
  const dialog = page.locator("dialog.picker[open]");

  // Thunderbolt is illegal for Bulbasaur; Tackle is legal.
  await dialog.getByLabel("Search").fill("thunderbolt");
  await expect(dialog.locator(".picker__row").filter({ hasText: "THUNDERBOLT" }).locator(".picker__illegal")).toBeVisible();
  await dialog.getByLabel("Search").fill("tackle");
  await expect(dialog.locator(".picker__row").filter({ hasText: "TACKLE" }).locator(".picker__legal")).toBeVisible();

  // "Learnable" filter hides illegal moves.
  await dialog.getByLabel("Search").fill("");
  await dialog.getByLabel("Legality filter").getByText("Learnable").click();
  const illegalCount = await dialog.locator(".picker__illegal").count();
  expect(illegalCount).toBe(0);
});

test("an illegal assigned move stays flagged on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await loadFixture(page);
  await page.locator(".sidenav__item", { hasText: "Party" }).click();
  await page.getByRole("button", { name: "Add Pokémon" }).first().click(); // Bulbasaur
  await page.getByRole("button", { name: "Moves" }).click();

  // Assign Thunderbolt (illegal for Bulbasaur) to the first slot.
  await page.locator(".move-row .picker-trigger").first().click();
  const dialog = page.locator("dialog.picker[open]");
  await dialog.getByLabel("Search").fill("thunderbolt");
  await dialog.locator(".picker__row").filter({ hasText: "THUNDERBOLT" }).click();

  // The Illegal flag must remain visible at mobile width (it lives outside the
  // hidden meta column).
  await expect(page.locator(".move-row__illegal").first()).toBeVisible();
});

test("species picker searches and filters, and updates the mon", async ({ page }) => {
  await loadFixture(page);
  await page.locator(".sidenav__item", { hasText: "Party" }).click();
  await page.getByRole("button", { name: "Add Pokémon" }).first().click();

  await page.locator(".field", { hasText: "Species" }).locator(".picker-trigger").click();
  const dialog = page.locator("dialog.picker[open]");
  await expect(dialog).toBeVisible();

  // Pressing Enter while a sort control is focused must not pick a row.
  await dialog.getByRole("button", { name: "BST" }).focus();
  await page.keyboard.press("Enter");
  await expect(dialog).toBeVisible();

  await dialog.getByLabel("Search").fill("gengar");
  await expect(dialog.locator(".picker__row .picker__name").first()).toHaveText("GENGAR");
  await dialog.locator(".picker__row").filter({ hasText: "GENGAR" }).click();

  await expect(dialog).toBeHidden();
  await expect(page.locator(".field", { hasText: "Species" }).locator(".picker-trigger__label")).toContainText("GENGAR");
  // The slot list reflects the new species too.
  await expect(page.locator(".slot__name").first()).toHaveText("GENGAR");
});

test("item picker searches and assigns the chosen item", async ({ page }) => {
  await loadFixture(page);
  await page.locator(".sidenav__item", { hasText: "Inventory" }).click();
  // Add a bag item so there is a row regardless of the fixture's contents.
  await page.getByRole("button", { name: "Add item" }).first().click();
  await page.locator(".item-row .picker-trigger").first().click();
  const dialog = page.locator("dialog.picker[open]");
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Search").fill("max potion");
  await dialog.locator(".picker__row").filter({ hasText: "MAX POTION" }).first().click();
  await expect(dialog).toBeHidden();
  await expect(page.locator(".item-row .picker-trigger__label").first()).toHaveText("MAX POTION");
});

test("party members can be reordered with the up/down controls", async ({ page }) => {
  await loadFixture(page);
  await page.locator(".sidenav__item", { hasText: "Party" }).click();
  await page.getByRole("button", { name: "Add Pokémon" }).first().click(); // slot 0 Bulbasaur
  // Add a second, distinct species.
  await page.getByRole("button", { name: "Add Pokémon" }).first().click(); // slot 1 Bulbasaur
  await page.locator(".slot__btn").nth(1).click();
  await page.locator(".field", { hasText: "Species" }).locator(".picker-trigger").click();
  const dialog = page.locator("dialog.picker[open]");
  await dialog.getByLabel("Search").fill("charmander");
  await dialog.locator(".picker__row").filter({ hasText: "CHARMANDER" }).click();

  await expect(page.locator(".slot__name").nth(1)).toHaveText("CHARMANDER");
  await page.locator(".slot").nth(1).getByLabel(/Move .* up/).click();
  await expect(page.locator(".slot__name").first()).toHaveText("CHARMANDER");
});

test("inventory auto-sort orders items by the game's built-in order", async ({ page }) => {
  await loadFixture(page);
  await page.locator(".sidenav__item", { hasText: "Inventory" }).click();

  // Add a few items and set them so a Poké Ball sorts before a Potion.
  const bag = page.locator(".panel", { hasText: "Bag" });
  await bag.getByRole("button", { name: "Add item" }).click();
  await bag.getByRole("button", { name: "Add item" }).click();

  const rows = bag.locator(".item-row");
  // Row 0 -> POTION, Row 1 -> POKé BALL.
  await rows.nth(0).locator(".picker-trigger").click();
  let dialog = page.locator("dialog.picker[open]");
  await dialog.getByLabel("Search").fill("potion");
  await dialog.locator(".picker__row").filter({ hasText: /^POTION/ }).first().click();
  await rows.nth(1).locator(".picker-trigger").click();
  dialog = page.locator("dialog.picker[open]");
  await dialog.getByLabel("Search").fill("poke ball");
  await dialog.locator(".picker__row").filter({ hasText: "POKé BALL" }).first().click();

  await bag.getByRole("button", { name: "Auto-sort" }).click();
  // Poké Ball comes before Potion in the ROM order.
  await expect(bag.locator(".item-row .picker-trigger__label").first()).toHaveText("POKé BALL");
});

test("Shin feature toggles persist into the exported save", async ({ page }) => {
  await loadFixture(page);
  await page.locator(".sidenav__item", { hasText: "Trainer" }).click();
  await page.getByRole("switch", { name: "Nuzlocke mode" }).click();
  await page.getByRole("switch", { name: "Female trainer" }).click();
  const streak = page.getByLabel("Underground win streak");
  await streak.fill("5");
  await streak.blur();
  const bytes = await exportBytes(page);
  // wUnusedD721 -> 0x29cd: bit 6 nuzlocke, bit 0 female trainer.
  expect(bytes[0x29cd] & 0b0100_0001).toBe(0b0100_0001);
  // wUnusedD5A3 -> 0x284f: underground NPC win streak.
  expect(bytes[0x284f]).toBe(5);
  // Main checksum still valid after the repair pass.
  expect(bytes[MAIN_CKSUM]).toBe(gen1MainChecksum(bytes));
});

test("gender symbol derives from the attack DV and Make shiny sets shiny DVs", async ({ page }) => {
  await loadFixture(page);
  await page.locator(".sidenav__item", { hasText: "Party" }).click();
  await page.getByRole("button", { name: "Add Pokémon" }).first().click(); // Bulbasaur, atk DV 8 default? set below
  await page.getByRole("button", { name: "DVs & EXP" }).click();

  // Attack DV >= 2 -> male for Bulbasaur's band; set to 1 -> female.
  const atkDv = page.getByLabel("ATK DV");
  await atkDv.fill("1");
  await atkDv.blur();
  await expect(page.locator(".gender-tag")).toHaveText("♀");
  await atkDv.fill("3");
  await atkDv.blur();
  await expect(page.locator(".gender-tag")).toHaveText("♂");

  await page.getByRole("button", { name: "Make shiny" }).click();
  await expect(page.locator(".shiny-tag")).toBeVisible();
  // def/spd/spc pinned to 10; atk keeps bit 1 (3 stays 3).
  await expect(page.getByLabel("DEF DV")).toHaveValue("10");
  await expect(page.getByLabel("SPD DV")).toHaveValue("10");
  await expect(page.getByLabel("SPC DV")).toHaveValue("10");
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
