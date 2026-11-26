import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import personasJson from "../../src/config/content/personas.json";

const arjun = personasJson.personas.find((p) => p.id === "arjun")!;

function bookingBody(slotId: string, sessionId: string) {
  return {
    sessionId,
    slotId,
    customer: { name: "Race Tester", mobile: "9876543210", email: "", language: "English" },
    consents: { prepare: true, share: true, contact: true, version: "v1.2" },
    journey: { profile: arjun.profile, assumptions: {}, provided: arjun.provided, options: { frequency: "YEARLY", rider: false }, comprehension: {}, existingPolicy: null },
    events: [],
  };
}

async function freeSlot(request: APIRequestContext, skip = 0): Promise<string> {
  const d = await (await request.get("/api/slots")).json();
  for (const day of d.days as string[]) {
    const s = await (await request.get(`/api/slots?day=${day}`)).json();
    const free = (s.advisors as { slots: { id: string; free: boolean }[] }[]).flatMap((a) => a.slots.filter((x) => x.free).map((x) => x.id));
    if (free.length > skip) return free[skip];
    skip -= free.length;
  }
  throw new Error("no free slot");
}

async function noHorizontalScroll(page: Page) {
  const { sw, cw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  expect(sw).toBeLessThanOrEqual(cw);
}

test("Arjun journey: landing → verdict → gap → options → booked → handoff → trail", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Could your family carry on without you?");
  await page.getByRole("link", { name: /Check my family's gap/ }).click();
  await page.getByRole("button", { name: /^Arjun/ }).click();
  await expect(page.getByTestId("quick-range")).toHaveText("₹2.7 Cr – ₹3.6 Cr");
  await expect(page.getByText("Likely underinsured").first()).toBeVisible();

  await page.getByRole("link", { name: /Refine my gap/ }).click();
  await expect(page.getByTestId("gap-figure")).toHaveText("₹2.39 Cr");
  await expect(page.getByText("Check: ₹2.97 Cr − ₹10 L − ₹36 L − ₹12 L = ₹2.39 Cr.")).toBeVisible();
  await page.getByRole("button", { name: /Living costs: ₹1.32 Cr/ }).click();
  await expect(page.getByTestId("explain-need.living").getByText("₹1,31,90,423").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Why ₹2.39 Cr and not ₹1 Cr?" })).toBeVisible();

  await page.getByRole("link", { name: /See what fits this gap/ }).first().click();
  await expect(page.getByTestId("premium")).toHaveText("₹25,920 a year");
  await expect(page.getByText(/table RT-TS-01 · exact cell/)).toBeVisible();
  await page.getByRole("button", { name: /Book a free advisor call/ }).click();

  // Reality check: Q1 right, Q2 wrong then right, Q3 right
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "₹2.4 Cr, the cover amount" }).click();
  await dialog.getByRole("button", { name: "I get all my money back" }).click();
  await expect(dialog.getByText("Have another go.")).toBeVisible();
  await dialog.getByRole("button", { name: "I get back much less than I paid" }).click();
  await dialog.getByRole("button", { name: "Protection only" }).click();
  await expect(dialog.getByText("2 of 3 right first time · all done")).toBeVisible();
  await dialog.getByRole("button", { name: "Continue" }).click();

  // First free slot (records which advisor it belongs to)
  const slotBtn = dialog.locator("[data-advisor] button:not([disabled])").first();
  await expect(slotBtn).toBeVisible();
  const advisorId = await slotBtn.locator("xpath=ancestor::li[@data-advisor]").getAttribute("data-advisor");
  await slotBtn.click();
  await dialog.getByLabel("Your name").fill("Arjun Demo");
  await dialog.getByLabel("Mobile number").fill("98765 43210");
  for (const cb of await dialog.getByRole("checkbox").all()) await cb.check();
  await dialog.getByTestId("confirm-booking").click();

  await expect(page.getByRole("heading", { name: "You're booked, Arjun" })).toBeVisible({ timeout: 20_000 });
  const bookingId = (await page.getByText(/^Booking BK-/).textContent())!.replace("Booking ", "").trim();

  // Advisor view (demo role)
  await page.request.post("/api/demo-role", { data: { role: "advisor", advisorId } });
  await page.goto(`/advisor/handoff/${bookingId}`);
  await expect(page.getByRole("heading", { name: /Call with Arjun/ })).toBeVisible();
  await expect(page.getByText("Protection gap")).toBeVisible();
  await expect(page.getByText("₹2.39 Cr").first()).toBeVisible();
  await expect(page.getByText("Clarified, then right")).toBeVisible();
  await page.getByRole("link", { name: "Decision trail · compliance view" }).click();
  for (const ev of ["session.created", "estimate.basic", "calc.result", "flag.raised", "rule.recommend", "rule.lock", "eligibility.reject", "slider.final", "check.result", "consent.recorded", "booking.created", "handoff.generated"]) {
    await expect(page.getByRole("cell", { name: ev, exact: true }).first()).toBeVisible();
  }
  expect(errors.filter((e) => !/favicon|Download the React DevTools/.test(e))).toEqual([]);
});

test("double-booking race: two parallel requests for one slot → exactly one booking", async ({ request }) => {
  const slot = await freeSlot(request);
  const [a, b] = await Promise.all([
    request.post("/api/bookings", { headers: { "idempotency-key": `race-a-${Date.now()}` }, data: bookingBody(slot, "s_racee2e1") }),
    request.post("/api/bookings", { headers: { "idempotency-key": `race-b-${Date.now()}` }, data: bookingBody(slot, "s_racee2e2") }),
  ]);
  expect([a.status(), b.status()].sort()).toEqual([201, 409]);
  const loser = a.status() === 409 ? a : b;
  expect((await loser.json()).alternatives).toHaveLength(3);
});

test("idempotent double click: same key twice → one booking", async ({ request }) => {
  const slot = await freeSlot(request);
  const key = `dbl-${Date.now()}`;
  const [r1, r2] = await Promise.all([
    request.post("/api/bookings", { headers: { "idempotency-key": key }, data: bookingBody(slot, "s_dblclk01") }),
    request.post("/api/bookings", { headers: { "idempotency-key": key }, data: bookingBody(slot, "s_dblclk01") }),
  ]);
  expect([r1.status(), r2.status()].sort()).toEqual([200, 201]);
  expect((await r1.json()).booking.id).toBe((await r2.json()).booking.id);
});

test("expired-licence advisor is hidden", async ({ request, page }) => {
  const d = await (await request.get("/api/slots")).json();
  for (const day of (d.days as string[]).slice(0, 3)) {
    const s = await (await request.get(`/api/slots?day=${day}`)).json();
    expect((s.advisors as { advisor: { id: string } }[]).map((a) => a.advisor.id)).not.toContain("ADV-RV");
  }
  await page.goto("/estimate");
  await page.getByRole("button", { name: /^Arjun/ }).click();
  await page.goto("/options?book=1");
  await page.getByRole("button", { name: /2 · Choose an advisor and time/ }).click();
  await expect(page.getByText("Priya Raman").first()).toBeVisible();
  await expect(page.getByText("Rahul Verma")).toHaveCount(0);
});

test("judge mode on and off", async ({ page }) => {
  await page.goto("/estimate?judge=1");
  await page.getByRole("button", { name: /^Arjun/ }).click();
  await page.goto("/gap");
  await expect(page.locator("[data-judge-chip]", { hasText: "FR-2.8" })).toBeVisible();
  await page.getByRole("switch", { name: /Judge mode/ }).click();
  await expect(page.locator("[data-judge-chip]")).toHaveCount(0);
});

test.describe("390px viewport", () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test("Stage 1, Stage 2 and the drawer fit without horizontal scroll", async ({ page }) => {
    await page.goto("/estimate");
    await page.getByRole("button", { name: /^Arjun/ }).click();
    await expect(page.getByTestId("quick-range")).toBeVisible();
    await noHorizontalScroll(page);
    await expect(page.getByRole("link", { name: /Step 1 of 4/ })).toBeVisible();
    await page.goto("/gap");
    await expect(page.getByTestId("gap-figure")).toHaveText("₹2.39 Cr");
    await noHorizontalScroll(page);
    await page.getByRole("button", { name: /Living costs/ }).first().click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await page.goto("/options?book=1");
    await expect(page.getByRole("dialog")).toBeVisible();
    const box = await page.getByRole("dialog").boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(389);
    await noHorizontalScroll(page);
  });
});

test.describe("360px viewport", () => {
  test.use({ viewport: { width: 360, height: 780 } });
  test("no horizontal page scroll on any journey or judges page", async ({ page }) => {
    await page.goto("/estimate");
    await page.getByRole("button", { name: /^Arjun/ }).click();
    for (const path of ["/", "/estimate", "/gap", "/options", "/options?panel=policy", "/options?book=1", "/summary", "/judges", "/judges/states", "/judges/qa", "/advisor"]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      await noHorizontalScroll(page);
    }
  });
});
