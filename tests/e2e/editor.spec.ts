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

test("inventory sort orders items by the game's built-in order", async ({ page }) => {
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

  await bag.getByRole("button", { name: "Sort", exact: true }).click();
  // Poké Ball comes before Potion in the ROM order.
  await expect(bag.locator(".item-row .picker-trigger__label").first()).toHaveText("POKé BALL");
});

test("party nickname/OT export to the game's name regions without touching records", async ({ page }) => {
  await loadFixture(page);
  await page.locator(".sidenav__item", { hasText: "Party" }).click();
  // Two mons so we can prove slot 0's names don't bleed into slot 1's record.
  await page.getByRole("button", { name: "Add Pokémon" }).first().click();
  await page.getByRole("button", { name: "Add Pokémon" }).first().click();
  await page.locator(".slot__btn").first().click();
  const nick = page.locator(".field", { hasText: "Nickname" }).locator("input");
  await nick.fill("LEAFY");
  await nick.blur();

  const bytes = await exportBytes(page);
  const PARTY_MONS = 0x2f34;
  const OTS = 0x303c; // d273: after all six 44-byte records
  const NICKS = 0x307e; // d2b5
  // "LEAFY" in Gen 1 text: L=0x8b E=0x84 A=0x80 F=0x85 Y=0x98 then 0x50.
  expect(Array.from(bytes.slice(NICKS, NICKS + 6))).toEqual([0x8b, 0x84, 0x80, 0x85, 0x98, 0x50]);
  expect(bytes[OTS]).not.toBe(0); // OT written in the real region
  // Slot 1's record must still hold its own species/level, not name bytes.
  expect(bytes[PARTY_MONS + 44]).toBe(0x99); // Bulbasaur internal id
  expect(bytes[PARTY_MONS + 44 + 0x21]).toBe(5); // its level, not a letter

  // Reload the exported file: the nickname survives the round trip.
  await page.getByRole("button", { name: "Close" }).click();
  await page.setInputFiles('[data-testid="file-input"]', {
    name: "roundtrip.sav",
    mimeType: "application/octet-stream",
    buffer: Buffer.from(bytes),
  });
  await page.locator(".sidenav__item", { hasText: "Party" }).click();
  await expect(page.locator(".slot__name").first()).toHaveText("LEAFY");
});

test("changing the rival's starter persists into the exported save", async ({ page }) => {
  await loadFixture(page);
  await page.locator(".sidenav__item", { hasText: "Trainer" }).click();
  await page.getByLabel("Rival's starter").selectOption({ label: "SQUIRTLE" });
  const bytes = await exportBytes(page);
  // wRivalStarter -> 0x29c1; SQUIRTLE internal id 0xb1.
  expect(bytes[0x29c1]).toBe(0xb1);
  expect(bytes[MAIN_CKSUM]).toBe(gen1MainChecksum(bytes));
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

test("warp position edits persist into the exported save", async ({ page }) => {
  await loadFixture(page);
  await page.locator(".sidenav__item", { hasText: "Trainer" }).click();
  await page.getByLabel("Current map").selectOption({ label: "Pewter City ($02)" });
  const x = page.getByLabel("X coordinate");
  await x.fill("10");
  await x.blur();
  const y = page.getByLabel("Y coordinate");
  await y.fill("5");
  await y.blur();
  const bytes = await exportBytes(page);
  expect(bytes[0x260a]).toBe(2); // PEWTER_CITY
  expect(bytes[0x260e]).toBe(10);
  expect(bytes[0x260d]).toBe(5);
  expect(bytes[MAIN_CKSUM]).toBe(gen1MainChecksum(bytes));
});

test("day care boards a mon that persists into the exported save", async ({ page }) => {
  await loadFixture(page);
  await page.locator(".sidenav__item", { hasText: "Party" }).click();
  await page.getByRole("button", { name: "Board a Pokémon" }).click();
  // Editable via the shared mon editor inside the panel.
  const panel = page.locator(".daycare-panel");
  await expect(panel.locator(".picker-trigger__label").first()).toContainText("BULBASAUR");

  const bytes = await exportBytes(page);
  expect(bytes[0x2cf4]).toBe(1); // wDayCareInUse
  expect(bytes[0x2d0b]).toBe(0x99); // boarded species: Bulbasaur
  expect(bytes[MAIN_CKSUM]).toBe(gen1MainChecksum(bytes));

  // Emptying clears the record.
  await page.getByRole("button", { name: "Empty day care" }).click();
  const cleared = await exportBytes(page);
  expect(cleared[0x2cf4]).toBe(0);
  expect(cleared[0x2d0b]).toBe(0);
});

test("visited-town toggles unlock fly bits in the exported save", async ({ page }) => {
  await loadFixture(page);
  await page.locator(".sidenav__item", { hasText: "Story Flags" }).click();
  await page.getByRole("switch", { name: "Saffron City" }).click();
  await page.getByRole("switch", { name: "Pallet Town" }).click();
  const bytes = await exportBytes(page);
  // wTownVisitedFlag -> 0x29b7: Pallet = byte 0 bit 0, Saffron (map $0a) = byte 1 bit 2.
  expect(bytes[0x29b7] & 0b1).toBe(1);
  expect(bytes[0x29b8] & 0b100).toBe(0b100);
  expect(bytes[MAIN_CKSUM]).toBe(gen1MainChecksum(bytes));
});

test("item-ball toggle persists into the exported save", async ({ page }) => {
  await loadFixture(page);
  await page.locator(".sidenav__item", { hasText: "Story Flags" }).click();
  // HS_ROUTE_2_ITEM_1 = bit 25 -> byte 3 bit 1 of 0x2852.
  await page.getByRole("switch", { name: "Route 2 — MOON STONE" }).click();
  const bytes = await exportBytes(page);
  expect(bytes[0x2852 + 3] & 0b10).toBe(0b10);
  expect(bytes[MAIN_CKSUM]).toBe(gen1MainChecksum(bytes));
});

test("hall of fame counts wins and clears records", async ({ page }) => {
  await loadFixture(page);
  await page.locator(".sidenav__item", { hasText: "Hall of Fame" }).click();
  const count = page.getByLabel("Championship count");
  await count.fill("3");
  await count.blur();
  let bytes = await exportBytes(page);
  expect(bytes[0x284e]).toBe(3);
  await page.getByRole("button", { name: "Clear records" }).click();
  bytes = await exportBytes(page);
  expect(bytes[0x284e]).toBe(0);
  expect(bytes[MAIN_CKSUM]).toBe(gen1MainChecksum(bytes));
});

test("hidden item toggle persists and all flags can be shown", async ({ page }) => {
  await loadFixture(page);
  await page.locator(".sidenav__item", { hasText: "Story Flags" }).click();

  // First HiddenItemCoords row: Viridian Forest potion -> bit 0 of 0x299c.
  await page.getByRole("switch", { name: "Viridian Forest — POTION (1, 18)" }).click();

  // Full list renders without a display cap; unnamed bits are opt-in.
  await page.getByRole("switch", { name: "Show unnamed bits" }).click();
  await expect(page.locator(".flags-controls .mono")).toContainText("/ 2560");
  await page.getByLabel("Search flags").fill("unnamed $00");
  await expect(page.locator(".flag-row").first()).toContainText("Unnamed $00");

  const bytes = await exportBytes(page);
  expect(bytes[0x299c] & 0b1).toBe(1);
  expect(bytes[MAIN_CKSUM]).toBe(gen1MainChecksum(bytes));
});

test("story flags search and toggle persist into the exported save", async ({ page }) => {
  await loadFixture(page);
  await page.locator(".sidenav__item", { hasText: "Story Flags" }).click();
  await page.getByLabel("Search flags").fill("got town map");
  const row = page.locator(".flag-row").filter({ hasText: "Got town map" }).first();
  await row.getByRole("switch").click();
  const bytes = await exportBytes(page);
  // EVENT_GOT_TOWN_MAP = index 24 -> wEventFlags (0x29f3) byte 3, bit 0.
  expect(bytes[0x29f3 + 3] & 0b1).toBe(1);
  expect(bytes[MAIN_CKSUM]).toBe(gen1MainChecksum(bytes));
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

test("switching the current box persists cache and updates the box number", async ({ page }) => {
  await loadFixture(page);
  await page.locator(".sidenav__item", { hasText: "Boxes" }).click();
  // Put a mon into box 1 (current), then make box 5 current.
  await page.getByRole("button", { name: "Add Pokémon" }).click();
  await page.locator(".box-tab", { hasText: /^5$/ }).click();
  await page.getByRole("button", { name: "Set as current" }).click();

  const bytes = await exportBytes(page);
  expect(bytes[0x284c]).toBe(0x80 | 4); // bit 7 + new index
  expect(bytes[0x4000]).toBe(1); // box 1 stored slot holds the old cache (1 mon)
  expect(bytes[0x30c0]).toBe(0); // cache is now the empty box 5
  expect(bytes[MAIN_CKSUM]).toBe(gen1MainChecksum(bytes));
});

test("undo/redo works via keyboard and toolbar buttons", async ({ page }) => {
  await loadFixture(page);
  await page.locator(".sidenav__item", { hasText: "Trainer" }).click();
  const money = page.getByTestId("money-input");
  await money.fill("1111");
  await money.blur();
  await money.fill("2222");
  await money.blur();
  await expect(money).toHaveValue("2222");

  // Keyboard undo steps back through both edits (blur left focus on <body>).
  await page.keyboard.press("ControlOrMeta+z");
  await expect(money).toHaveValue("1111");
  await page.keyboard.press("ControlOrMeta+z");
  await expect(money).toHaveValue("3000");
  await expect(page.locator(".dirty")).toContainText("No changes");

  // Keyboard redo, then toolbar buttons for the rest.
  await page.keyboard.press("ControlOrMeta+Shift+z");
  await expect(money).toHaveValue("1111");
  const undoBtn = page.getByRole("button", { name: "Undo" });
  const redoBtn = page.getByRole("button", { name: "Redo" });
  await redoBtn.click();
  await expect(money).toHaveValue("2222");
  await expect(redoBtn).toBeDisabled();
  await undoBtn.click();
  await undoBtn.click();
  await expect(money).toHaveValue("3000");
  await expect(undoBtn).toBeDisabled();

  // A fresh edit after undo clears the redo branch.
  await money.fill("5555");
  await money.blur();
  await expect(redoBtn).toBeDisabled();

  // The undone-then-redone state exports correctly.
  await page.keyboard.press("ControlOrMeta+z");
  const exported = await exportBytes(page);
  expect(decodeBcd3(exported, MONEY_OFFSET)).toBe(3000);
  expect(exported[MAIN_CKSUM]).toBe(gen1MainChecksum(exported));
});

test("battle options polarity: unchecking animations sets wOptions bit 7", async ({ page }) => {
  await loadFixture(page);
  await page.locator(".sidenav__item", { hasText: "Trainer" }).click();
  // Positive toggle: on-screen ON = bit clear. Turn animations off.
  await page.getByRole("switch", { name: "Battle animations" }).click();
  await page.locator(".field", { hasText: "Battle style" }).getByRole("button", { name: "Set", exact: true }).click();
  await page.getByRole("switch", { name: "Caught & gender indicators" }).click();
  const bytes = await exportBytes(page);
  expect(bytes[0x2601] & 0x80).toBe(0x80); // animations off
  expect(bytes[0x2601] & 0x40).toBe(0x40); // battle style Set
  expect(bytes[0x29f3 + (0x90e >> 3)] & (1 << (0x90e & 7))).not.toBe(0); // EVENT_90E on
  expect(bytes[MAIN_CKSUM]).toBe(gen1MainChecksum(bytes));
});

test("test drive validates ROM files and gates the boot button", async ({ page }) => {
  await loadFixture(page);
  await page.locator(".sidenav__item", { hasText: "Test Drive" }).click();
  await expect(page.locator(".page-header__title")).toHaveText("Test Drive");
  await expect(page.getByText("never uploaded")).toBeVisible();
  const boot = page.getByTestId("boot-button");
  await expect(boot).toBeDisabled();

  // Garbage of the right size is rejected by the header checksum.
  const garbage = Buffer.alloc(0x8000);
  for (let i = 0; i < garbage.length; i++) garbage[i] = (i * 37 + 11) & 0xff;
  await page.setInputFiles('[data-testid="rom-input"]', {
    name: "garbage.gb",
    mimeType: "application/octet-stream",
    buffer: garbage,
  });
  await expect(page.getByTestId("rom-info")).toContainText("Not a GB ROM");
  await expect(boot).toBeDisabled();

  // A well-formed MBC3+RAM+BATTERY header unlocks boot.
  const fake = Buffer.alloc(0x8000);
  const title = "POKEMON RED";
  for (let i = 0; i < title.length; i++) fake[0x134 + i] = title.charCodeAt(i);
  fake[0x147] = 0x13;
  let x = 0;
  for (let i = 0x134; i <= 0x14c; i++) x = (x - fake[i] - 1) & 0xff;
  fake[0x14d] = x;
  await page.setInputFiles('[data-testid="rom-input"]', {
    name: "fake.gb",
    mimeType: "application/octet-stream",
    buffer: fake,
  });
  await expect(page.getByTestId("rom-info")).toContainText("Looks bootable");
  await expect(page.getByTestId("rom-info")).toContainText("POKEMON RED");
  await expect(boot).toBeEnabled();

  // The ROM persists in IndexedDB across a reload.
  await page.reload();
  await page.setInputFiles('[data-testid="file-input"]', fixturePath);
  await page.locator(".sidenav__item", { hasText: "Test Drive" }).click();
  await expect(page.getByTestId("rom-info")).toContainText("fake.gb");
  await page.getByRole("button", { name: "Forget ROM" }).click();
  await expect(page.getByTestId("rom-info")).toHaveCount(0);
});

test("test drive boots a real ROM and paints frames", async ({ page }) => {
  test.skip(!process.env.SHINPOKERED_ROM, "set SHINPOKERED_ROM to run the real-ROM boot test");
  await loadFixture(page);
  await page.locator(".sidenav__item", { hasText: "Test Drive" }).click();
  await page.setInputFiles('[data-testid="rom-input"]', process.env.SHINPOKERED_ROM!);
  await expect(page.getByTestId("rom-info")).toContainText("Looks bootable");

  await page.getByTestId("boot-button").click();
  await expect(page.getByTestId("pull-save")).toBeEnabled();

  // The screen must not stay a single flat color once the ROM is running.
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const canvas = document.querySelector<HTMLCanvasElement>('[data-testid="gb-canvas"]');
          const ctx = canvas?.getContext("2d");
          if (!ctx) return 0;
          const { data } = ctx.getImageData(0, 0, 160, 144);
          const colors = new Set<number>();
          for (let i = 0; i < data.length; i += 4)
            colors.add((data[i] << 16) | (data[i + 1] << 8) | data[i + 2]);
          return colors.size;
        }),
      { timeout: 15_000 },
    )
    .toBeGreaterThan(1);

  // Pull the emulator SRAM back into the editor: byte-identical injection
  // means zero dirty bytes (boot uses the already checksum-valid fixture).
  await page.getByTestId("pull-save").click();
  await expect(page.getByTestId("testdrive-notice")).toContainText("Pulled the emulator save");

  await page.getByRole("button", { name: "Stop", exact: true }).click();
  await expect(page.getByTestId("pull-save")).toBeDisabled();
});

test("legality tab reports a clean mon and flags EXP drift", async ({ page }) => {
  await loadFixture(page);
  await page.locator(".sidenav__item", { hasText: "Party" }).click();
  await page.getByRole("button", { name: "Add Pokémon" }).first().click();

  await page.getByRole("button", { name: "Legality" }).click();
  await expect(page.getByTestId("legality-ok")).toBeVisible();

  // Push EXP out of sync with the level; the report should call it out.
  await page.getByRole("button", { name: "Summary" }).click();
  const exp = page.locator(".field", { hasText: "EXP" }).locator("input");
  await exp.fill("5");
  await exp.blur();
  await page.getByRole("button", { name: "Legality" }).click();
  const list = page.getByTestId("legality-list");
  await expect(list).toContainText("EXP");
  await expect(list).toContainText("level 1");
});

test("team coverage panel updates and heal team restores the party", async ({ page }) => {
  await loadFixture(page);
  await page.locator(".sidenav__item", { hasText: "Party" }).click();
  await page.getByRole("button", { name: "Add Pokémon" }).first().click();

  // Fresh Bulbasaur: Tackle/Growl only -> Ghost is immune to Normal (×0).
  const offense = page.getByTestId("offense-coverage");
  await expect(offense).toBeVisible();
  await expect(offense.locator(".coverage-cell", { hasText: "GHOST" })).toContainText("×0");
  // Grass/Poison Bulbasaur is weak to Fire on defense.
  await expect(
    page.getByTestId("defense-list").locator(".cov--weak", { hasText: "FIRE" }),
  ).toBeVisible();

  // Hurt the mon, then heal the team: HP returns to max.
  const hp = page.locator(".field", { hasText: "Current HP" }).locator("input");
  await hp.fill("1");
  await hp.blur();
  await page.getByTestId("heal-team").click();
  await expect(hp).not.toHaveValue("1");

  const exported = await exportBytes(page);
  expect(exported[MAIN_CKSUM]).toBe(gen1MainChecksum(exported));
});

test("pk1 export and re-import round-trips a party mon", async ({ page }) => {
  await loadFixture(page);
  await page.locator(".sidenav__item", { hasText: "Party" }).click();
  await page.getByRole("button", { name: "Add Pokémon" }).first().click();

  // Give it a distinctive nickname, then export the slot as .pk1.
  const nick = page.locator(".field", { hasText: "Nickname" }).locator("input");
  await nick.fill("LEAFY");
  await nick.blur();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByTestId("pk1-export").click(),
  ]);
  expect(download.suggestedFilename()).toBe("leafy.pk1");
  const file = await download.path();
  const pk1 = new Uint8Array(await readFile(file));
  expect(pk1).toHaveLength(69);
  expect(pk1[0]).toBe(1);

  // Import it back: the party grows to two identical mons.
  await page.setInputFiles('[data-testid="pk1-input"]', file);
  await expect(page.locator(".slot")).toHaveCount(2);
  await expect(page.locator(".slot__name").nth(1)).toHaveText("LEAFY");

  // Garbage import surfaces a readable error and adds nothing.
  await page.setInputFiles('[data-testid="pk1-input"]', {
    name: "junk.pk1",
    mimeType: "application/octet-stream",
    buffer: Buffer.alloc(50),
  });
  await expect(page.getByTestId("pk1-error")).toContainText("Unrecognized");
  await expect(page.locator(".slot")).toHaveCount(2);

  // The imported copy exports into a valid save.
  const exported = await exportBytes(page);
  expect(exported[0x2f2c]).toBe(2);
  expect(exported[MAIN_CKSUM]).toBe(gen1MainChecksum(exported));
});

test("compare page reports semantic changes against the loaded file", async ({ page }) => {
  await loadFixture(page);
  await page.locator(".sidenav__item", { hasText: "Compare" }).click();
  await expect(page.getByTestId("compare-clean")).toBeVisible();

  // Change money, then the diff should describe it in game terms.
  await page.locator(".sidenav__item", { hasText: "Trainer" }).click();
  const money = page.getByTestId("money-input");
  await money.fill("123456");
  await money.blur();
  await page.locator(".sidenav__item", { hasText: "Compare" }).click();
  const trainer = page.getByTestId("compare-Trainer");
  await expect(trainer).toContainText("Money");
  await expect(trainer).toContainText("3,000");
  await expect(trainer).toContainText("123,456");

  // Comparing against a copy of the fixture as "another file" shows the same diff.
  await page.getByRole("button", { name: "Another file" }).click();
  await page.setInputFiles('[data-testid="compare-input"]', fixturePath);
  await expect(page.getByTestId("compare-Trainer")).toContainText("Money");
});

test("living dex filler populates boxes and marks the dex", async ({ page }) => {
  await loadFixture(page);
  await page.locator(".sidenav__item", { hasText: "Boxes" }).click();
  await page.getByTestId("fill-living-dex").click();
  await expect(page.getByTestId("living-dex-notice")).toContainText("Added 151 species");

  // Box 1 fills with the first 20 dex entries.
  await expect(page.locator(".box-cell")).toHaveCount(20);
  await expect(page.locator(".box-cell__btn").first()).toHaveAttribute("title", /BULBASAUR · Lv5/);

  // Running it again adds nothing.
  await page.getByTestId("fill-living-dex").click();
  await expect(page.getByTestId("living-dex-notice")).toContainText("Nothing to add");

  // Exported save has valid box checksums and a full dex.
  const exported = await exportBytes(page);
  expect(exported[MAIN_CKSUM]).toBe(gen1MainChecksum(exported));
  let owned = 0;
  for (let i = 0; i < 19; i++)
    for (let b = 0; b < 8; b++) if (exported[0x25a3 + i] & (1 << b)) owned++;
  expect(owned).toBe(151);
});

test("test drive virtual pad is opt-in on desktop and fullscreen toggles", async ({ page }) => {
  await loadFixture(page);
  await page.locator(".sidenav__item", { hasText: "Test Drive" }).click();

  // No touch on desktop chromium: the pad hides behind the toggle.
  await expect(page.getByTestId("virtual-pad")).toHaveCount(0);
  await page.getByRole("switch", { name: "Virtual gamepad" }).click();
  const pad = page.getByTestId("virtual-pad");
  await expect(pad).toBeVisible();
  for (const name of ["Up", "Down", "Left", "Right", "A", "B", "Start", "Select"]) {
    await expect(pad.getByRole("button", { name, exact: true })).toBeVisible();
  }

  // Fullscreen: native API or the CSS overlay fallback must engage.
  await page.getByTestId("fullscreen-toggle").click();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const stage = document.querySelector('[data-testid="stage"]');
        return document.fullscreenElement === stage || stage?.classList.contains("testdrive__stage--overlay");
      }),
    )
    .toBe(true);
  await expect(page.getByTestId("fullscreen-toggle")).toHaveText("Exit full screen");
  // In native fullscreen only the stage subtree is clickable; use its exit button.
  await page.getByTestId("stage").getByRole("button", { name: "Exit full screen" }).click();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const stage = document.querySelector('[data-testid="stage"]');
        return !document.fullscreenElement && !stage?.classList.contains("testdrive__stage--overlay");
      }),
    )
    .toBe(true);
});

test.describe("touch device", () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });

  test("test drive shows the virtual pad automatically", async ({ page }) => {
    await loadFixture(page);
    await page.locator(".sidenav__item", { hasText: "Test Drive" }).click();
    await expect(page.getByTestId("virtual-pad")).toBeVisible();
  });
});

test.describe("narrow window", () => {
  // Narrow enough that the brand and the action cluster used to collide
  // (real-device report; the threshold shifts with device font scaling).
  test.use({ viewport: { width: 400, height: 800 } });

  test("topbar brand never overlaps the action cluster", async ({ page }) => {
    await loadFixture(page);
    const brand = await page.locator(".brand").boundingBox();
    // The checksum status is the leftmost element of the action cluster.
    const checksum = await page.locator(".checksum").boundingBox();
    expect(brand).not.toBeNull();
    expect(checksum).not.toBeNull();
    expect(brand!.x + brand!.width).toBeLessThanOrEqual(checksum!.x);
  });
});

test.describe("narrow touch device", () => {
  test.use({ hasTouch: true, viewport: { width: 360, height: 740 } });

  test("virtual pad and screen fit the viewport, in page and fullscreen", async ({ page }) => {
    await loadFixture(page);
    await page.locator(".sidenav__item", { hasText: "Test Drive" }).click();
    const pad = page.getByTestId("virtual-pad");
    await expect(pad).toBeVisible();

    const expectEverythingFits = async () => {
      // No horizontal page overflow…
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
      // …and every pad button and the screen sit fully inside the viewport.
      for (const name of ["Up", "Down", "Left", "Right", "A", "B", "Start", "Select"]) {
        const box = await pad.getByRole("button", { name, exact: true }).boundingBox();
        expect(box).not.toBeNull();
        expect(box!.x).toBeGreaterThanOrEqual(0);
        expect(box!.x + box!.width).toBeLessThanOrEqual(360);
      }
      const canvas = await page.getByTestId("gb-canvas").boundingBox();
      expect(canvas).not.toBeNull();
      expect(canvas!.x).toBeGreaterThanOrEqual(0);
      expect(canvas!.x + canvas!.width).toBeLessThanOrEqual(360);
    };

    await expectEverythingFits();

    await page.getByTestId("fullscreen-toggle").click();
    await expect(page.getByTestId("fullscreen-toggle")).toHaveText("Exit full screen");
    await expectEverythingFits();
    await page.getByTestId("stage").getByRole("button", { name: "Exit full screen" }).click();
  });
});

test("box pk1 export/import round-trips through the current box", async ({ page }) => {
  await loadFixture(page);
  await page.locator(".sidenav__item", { hasText: "Boxes" }).click();
  await page.getByRole("button", { name: "Add Pokémon" }).first().click();

  const nick = page.locator(".field", { hasText: "Nickname" }).locator("input");
  await nick.fill("BOXY");
  await nick.blur();

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByTestId("box-pk1-export").click(),
  ]);
  expect(download.suggestedFilename()).toBe("boxy.pk1");
  const file = await download.path();
  const pk1 = new Uint8Array(await readFile(file));
  expect(pk1).toHaveLength(69);

  // Import back into the same box: two mons now.
  await page.setInputFiles('[data-testid="box-pk1-input"]', file);
  await expect(page.locator(".box-cell")).toHaveCount(2);

  // Garbage import errors without adding.
  await page.setInputFiles('[data-testid="box-pk1-input"]', {
    name: "junk.pk1",
    mimeType: "application/octet-stream",
    buffer: Buffer.alloc(50),
  });
  await expect(page.getByTestId("box-pk1-error")).toContainText("Unrecognized");
  await expect(page.locator(".box-cell")).toHaveCount(2);

  const exported = await exportBytes(page);
  expect(exported[MAIN_CKSUM]).toBe(gen1MainChecksum(exported));
});

test("party slots show a legality badge when findings exist", async ({ page }) => {
  await loadFixture(page);
  await page.locator(".sidenav__item", { hasText: "Party" }).click();
  await page.getByRole("button", { name: "Add Pokémon" }).first().click();

  // A fresh mon is clean: no badge.
  await expect(page.getByTestId("slot-legality")).toHaveCount(0);

  // Break the EXP/level consistency; the slot gains a warning badge.
  const exp = page.locator(".field", { hasText: "EXP" }).locator("input");
  await exp.fill("5");
  await exp.blur();
  const badge = page.getByTestId("slot-legality");
  await expect(badge).toBeVisible();
  await expect(badge).toHaveText("1");

  // Undo clears it again.
  await page.keyboard.press("ControlOrMeta+z");
  await expect(page.getByTestId("slot-legality")).toHaveCount(0);
});

test("in-game SAVE is detected and offered for pull-back", async ({ page }) => {
  test.skip(!process.env.SHINPOKERED_ROM, "set SHINPOKERED_ROM to run the real-ROM save test");
  test.setTimeout(180_000);
  await loadFixture(page);
  await page.locator(".sidenav__item", { hasText: "Test Drive" }).click();
  await page.setInputFiles('[data-testid="rom-input"]', process.env.SHINPOKERED_ROM!);
  await page.getByTestId("boot-button").click();

  /** Hold a key long enough for the emulator to sample it, then settle. */
  async function press(key: string, settle: number) {
    await page.keyboard.down(key);
    await page.waitForTimeout(160);
    await page.keyboard.up(key);
    await page.waitForTimeout(settle);
  }

  // Verified interactively: inputs during screen transitions are eaten, and
  // START is a no-op on the main menu, so repeated Enter presses converge
  // there from anywhere in the intro/title sequence.
  await page.waitForTimeout(20000); // boot + GAME FREAK intro
  for (let i = 0; i < 4; i++) await press("Enter", 3000); // -> main menu
  await press("KeyX", 3000); // A: CONTINUE (save summary opens)
  await press("KeyX", 4000); // A: enter the overworld

  // Long gameplay so far, plenty of sprite-scratch SRAM writes: no banner.
  await expect(page.getByTestId("save-detected")).toHaveCount(0);

  await press("Enter", 2500); // START menu: POKeMON/ITEM/RED/SAVE/OPTION/EXIT
  await press("ArrowDown", 900);
  await press("ArrowDown", 900);
  await press("ArrowDown", 900); // cursor on SAVE
  await press("KeyX", 2500); // A: SAVE prompt
  await press("KeyX", 7000); // A: YES -> "SAVING..."

  await expect(page.getByTestId("save-detected")).toBeVisible({ timeout: 20_000 });
  await page.getByTestId("save-detected").getByRole("button", { name: "Pull save" }).click();
  await expect(page.getByTestId("testdrive-notice")).toContainText("Pulled the emulator save");
  await expect(page.getByTestId("save-detected")).toHaveCount(0);
});
