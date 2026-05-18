import assert from "node:assert/strict";
import test from "node:test";
import { ReminderStatus, ReminderType, RepeatType } from "@prisma/client";

import { assistantFunctionDeclarations, upcomingRemindersArgsSchema } from "@/lib/assistant/tool-schemas";
import { reminderSchema } from "@/lib/validation/reminder";
import {
  buildReminderNotificationsFromReminders,
  buildReminderWhere,
  buildUpcomingExpenseSummaryFromReminders,
  sortRemindersByDueDate
} from "@/features/reminders/queries";
import {
  defaultReminderOffsetsByType,
  formatReminderAmount,
  formatReminderDate,
  formatReminderOffsets,
  getCountdownLabel,
  getNextDueDate,
  getReminderOffsets,
  normalizeReminderOffsets,
  reminderTypeLabels
} from "./format";
import { suggestReminderFromTextFallback } from "./gemini";

test("validates create reminder payload", () => {
  const parsed = reminderSchema.parse({
    title: "YouTube Premium",
    type: "SUBSCRIPTION",
    amount: "59000",
    dueDate: "2026-06-10",
    reminderOffsets: ["3", "1", "0"],
    repeatType: "MONTHLY",
    status: "ACTIVE",
    notes: "Langganan keluarga"
  });

  assert.equal(parsed.title, "YouTube Premium");
  assert.equal(parsed.amount, 59000);
  assert.equal(parsed.type, ReminderType.SUBSCRIPTION);
  assert.deepEqual(parsed.reminderOffsets, [3, 1, 0]);
});

test("validates edit reminder payload", () => {
  const parsed = reminderSchema.parse({
    title: "Internet rumah",
    type: "BILL",
    amount: 350000,
    dueDate: "2026-06-05",
    repeatType: "MONTHLY",
    status: "ACTIVE",
    relatedMerchant: "Provider Internet"
  });

  assert.equal(parsed.title, "Internet rumah");
  assert.equal(parsed.relatedMerchant, "Provider Internet");
});

test("mark done for one-time reminder resolves to done status", () => {
  assert.equal(getNextDueDate(new Date(Date.UTC(2026, 5, 5)), RepeatType.NONE), null);
});

test("mark done for monthly reminder advances due date", () => {
  assert.equal(getNextDueDate(new Date(Date.UTC(2026, 5, 10)), RepeatType.MONTHLY)?.toISOString().slice(0, 10), "2026-07-10");
});

test("mark done for yearly reminder advances due date", () => {
  assert.equal(getNextDueDate(new Date(Date.UTC(2026, 5, 10)), RepeatType.YEARLY)?.toISOString().slice(0, 10), "2027-06-10");
});

test("sorts upcoming reminders by nearest due date", () => {
  const sorted = sortRemindersByDueDate([
    { dueDate: new Date(Date.UTC(2026, 6, 10)), createdAt: new Date(Date.UTC(2026, 4, 1)) },
    { dueDate: new Date(Date.UTC(2026, 5, 5)), createdAt: new Date(Date.UTC(2026, 4, 2)) }
  ]);

  assert.equal(sorted[0].dueDate.toISOString().slice(0, 10), "2026-06-05");
});

test("formats overdue reminder label", () => {
  assert.equal(getCountdownLabel(new Date(Date.UTC(2026, 5, 3)), new Date(Date.UTC(2026, 5, 5))), "Sudah lewat 2 hari");
});

test("builds upcoming expense summary", () => {
  const summary = buildUpcomingExpenseSummaryFromReminders(
    [
      { amount: 59000, dueDate: new Date(Date.UTC(2026, 5, 10)) },
      { amount: 350000, dueDate: new Date(Date.UTC(2026, 5, 28)) },
      { amount: 100000, dueDate: new Date(Date.UTC(2026, 4, 20)) }
    ],
    new Date(Date.UTC(2026, 5, 1))
  );

  assert.equal(summary.next30DaysAmount, 409000);
  assert.equal(summary.thisMonthAmount, 409000);
  assert.equal(summary.activeReminderCount, 3);
  assert.equal(summary.overdueReminderCount, 1);
});

test("builds user-isolated reminder where clause", () => {
  assert.deepEqual(buildReminderWhere("user-1", { type: ReminderType.SIM, status: ReminderStatus.ACTIVE }), {
    userId: "user-1",
    type: ReminderType.SIM,
    status: ReminderStatus.ACTIVE
  });
});

test("declares assistant reminder tools", () => {
  const names = assistantFunctionDeclarations.map((declaration) => declaration.name);

  assert.ok(names.includes("getUpcomingReminders"));
  assert.ok(names.includes("getUpcomingExpenseSummary"));
  assert.deepEqual(upcomingRemindersArgsSchema.parse({ period: "week", type: "SUBSCRIPTION" }), {
    period: "week",
    type: "SUBSCRIPTION"
  });
});

test("formats Rupiah and Indonesian dates", () => {
  assert.equal(formatReminderAmount(350000), "Rp350.000");
  assert.equal(formatReminderDate("2026-06-05"), "5 Juni 2026");
});

test("maps reminder type labels", () => {
  assert.equal(reminderTypeLabels.SUBSCRIPTION, "Langganan");
  assert.equal(reminderTypeLabels.STNK, "STNK");
  assert.equal(reminderTypeLabels.WARRANTY, "Garansi");
});

test("uses default reminder offsets by type", () => {
  assert.deepEqual(defaultReminderOffsetsByType.SUBSCRIPTION, [3, 1, 0]);
  assert.deepEqual(defaultReminderOffsetsByType.SIM, [30, 14, 7, 1, 0]);
  assert.deepEqual(defaultReminderOffsetsByType.VEHICLE_TAX, [30, 14, 7, 1, 0]);
  assert.deepEqual(defaultReminderOffsetsByType.WARRANTY, [30, 7, 0]);
  assert.deepEqual(defaultReminderOffsetsByType.OTHER, [7, 1, 0]);
});

test("normalizes reminder offsets", () => {
  assert.deepEqual(normalizeReminderOffsets([1, 30, 1, 7], ReminderType.OTHER), [30, 7, 1]);
  assert.deepEqual(normalizeReminderOffsets([30, "7", 1, 0], ReminderType.OTHER), [30, 7, 1, 0]);
  assert.deepEqual(normalizeReminderOffsets([], ReminderType.BILL), [3, 1, 0]);
  assert.deepEqual(normalizeReminderOffsets(undefined, ReminderType.SUBSCRIPTION), [3, 1, 0]);
  assert.deepEqual(normalizeReminderOffsets(null, ReminderType.SIM), [30, 14, 7, 1, 0]);
  assert.deepEqual(normalizeReminderOffsets("[30,\"7\",1,0]", ReminderType.OTHER), [30, 7, 1, 0]);
  assert.deepEqual(normalizeReminderOffsets("{bad json", ReminderType.OTHER), [7, 1, 0]);
  assert.deepEqual(normalizeReminderOffsets([2, "abc", -1, {}, null], ReminderType.OTHER), [7, 1, 0]);
});

test("rejects unsupported reminder offsets", () => {
  assert.throws(() =>
    reminderSchema.parse({
      title: "YouTube Premium",
      type: "SUBSCRIPTION",
      amount: "59000",
      dueDate: "2026-06-10",
      reminderOffsets: ["2"],
      repeatType: "MONTHLY",
      status: "ACTIVE"
    })
  );
});

test("formats reminder offsets", () => {
  assert.equal(formatReminderOffsets([30, 7, 1, 0]), "H-30, H-7, H-1, Hari H");
});

test("falls back to type default offsets when stored offsets are empty", () => {
  assert.deepEqual(getReminderOffsets({ type: ReminderType.DOCUMENT, reminderOffsets: [] }), [30, 7, 1, 0]);
  assert.deepEqual(getReminderOffsets({ type: ReminderType.SUBSCRIPTION }), [3, 1, 0]);
  assert.deepEqual(getReminderOffsets({ type: ReminderType.SIM, reminderOffsets: undefined }), [30, 14, 7, 1, 0]);
});

test("builds dashboard notifications for old reminders without reminder offsets", () => {
  const notifications = buildReminderNotificationsFromReminders(
    [
      {
        id: "old-subscription",
        title: "YouTube Premium",
        type: ReminderType.SUBSCRIPTION,
        dueDate: new Date(Date.UTC(2026, 5, 4))
      }
    ],
    new Date(Date.UTC(2026, 5, 1))
  );

  assert.deepEqual(
    notifications.map((notification) => notification.id),
    ["old-subscription"]
  );
  assert.equal(notifications[0].message, "YouTube Premium jatuh tempo dalam 3 hari.");
});

test("builds offset-triggered reminder notifications", () => {
  const now = new Date(Date.UTC(2026, 5, 1));
  const notifications = buildReminderNotificationsFromReminders(
    [
      {
        id: "overdue",
        title: "STNK",
        type: ReminderType.STNK,
        dueDate: new Date(Date.UTC(2026, 4, 30)),
        reminderOffsets: [30, 14, 7, 1, 0]
      },
      {
        id: "h30",
        title: "Pajak motor",
        type: ReminderType.VEHICLE_TAX,
        dueDate: new Date(Date.UTC(2026, 6, 1)),
        reminderOffsets: [30, 14, 7, 1, 0]
      },
      {
        id: "h1",
        title: "YouTube Premium",
        type: ReminderType.SUBSCRIPTION,
        dueDate: new Date(Date.UTC(2026, 5, 2)),
        reminderOffsets: [3, 1, 0]
      },
      {
        id: "h0",
        title: "SIM C",
        type: ReminderType.SIM,
        dueDate: new Date(Date.UTC(2026, 5, 1)),
        reminderOffsets: [30, 14, 7, 1, 0]
      },
      {
        id: "not-matched",
        title: "Garansi monitor",
        type: ReminderType.WARRANTY,
        dueDate: new Date(Date.UTC(2026, 5, 4)),
        reminderOffsets: [30, 7, 0]
      }
    ],
    now
  );

  assert.deepEqual(
    notifications.map((notification) => notification.id),
    ["overdue", "h0", "h1", "h30"]
  );
  assert.equal(notifications[0].message, "STNK sudah lewat 2 hari.");
  assert.equal(notifications[1].message, "SIM C jatuh tempo hari ini.");
  assert.equal(notifications[2].message, "YouTube Premium jatuh tempo besok.");
  assert.equal(notifications[3].message, "Pajak motor jatuh tempo dalam 30 hari.");
});

test("suggests subscription reminder from text", () => {
  const draft = suggestReminderFromTextFallback("ingatkan bayar YouTube Premium 59 ribu tiap tanggal 10", new Date(Date.UTC(2026, 4, 18)));

  assert.equal(draft.type, ReminderType.SUBSCRIPTION);
  assert.equal(draft.title, "YouTube Premium");
  assert.equal(draft.relatedMerchant, "YouTube Premium");
  assert.equal(draft.amount, 59000);
  assert.equal(draft.repeatType, RepeatType.MONTHLY);
  assert.equal(draft.dueDate, "2026-06-10");
});

test("suggests IndiHome subscription reminder from Indonesian quick text", () => {
  const draft = suggestReminderFromTextFallback(
    "ingatkan untuk langganan internet indihome setiap jatuh tempo tanggal 20 dengan biaya 255.300",
    new Date(Date.UTC(2026, 4, 18))
  );

  assert.equal(draft.title, "Langganan internet IndiHome");
  assert.equal(draft.type, ReminderType.SUBSCRIPTION);
  assert.equal(draft.relatedMerchant, "IndiHome");
  assert.equal(draft.amount, 255300);
  assert.equal(draft.repeatType, RepeatType.MONTHLY);
  assert.equal(draft.dueDate, "2026-05-20");
  assert.match(draft.notes ?? "", /tanggal 20/);
});

test("suggests Biznet bill reminder from Indonesian quick text", () => {
  const draft = suggestReminderFromTextFallback("tagihan internet rumah biznet 350 ribu setiap tanggal 5", new Date(Date.UTC(2026, 4, 18)));

  assert.equal(draft.title, "Tagihan internet Biznet");
  assert.equal(draft.type, ReminderType.BILL);
  assert.equal(draft.relatedMerchant, "Biznet");
  assert.equal(draft.amount, 350000);
  assert.equal(draft.repeatType, RepeatType.MONTHLY);
  assert.equal(draft.dueDate, "2026-06-05");
});

test("parses quick reminder amount formats", () => {
  assert.equal(suggestReminderFromTextFallback("tagihan internet biznet 350rb setiap tanggal 5").amount, 350000);
  assert.equal(suggestReminderFromTextFallback("tagihan lisensi sebesar 1 juta setiap tanggal 5").amount, 1000000);
  assert.equal(suggestReminderFromTextFallback("tagihan internet Rp255.300 setiap tanggal 5").amount, 255300);
});

test("suggests BCA debit card document expiration reminder", () => {
  const draft = suggestReminderFromTextFallback("ganti kartu debit bca yang valid thru nya sampai bulan september 2026");

  assert.equal(draft.title, "Ganti kartu debit BCA");
  assert.equal(draft.type, ReminderType.DOCUMENT);
  assert.equal(draft.dueDate, "2026-09-30");
  assert.equal(draft.amount, null);
  assert.equal(draft.repeatType, RepeatType.NONE);
  assert.equal(draft.relatedMerchant, "BCA");
  assert.equal(draft.relatedDocumentName, "Kartu debit BCA");
  assert.match(draft.notes ?? "", /Valid thru sampai September 2026/);
});

test("suggests Mandiri credit card expiration reminder", () => {
  const draft = suggestReminderFromTextFallback("kartu kredit mandiri valid sampai desember 2027");

  assert.equal(draft.title, "Kartu kredit Mandiri");
  assert.equal(draft.type, ReminderType.DOCUMENT);
  assert.equal(draft.dueDate, "2027-12-31");
  assert.equal(draft.amount, null);
  assert.equal(draft.relatedMerchant, "Mandiri");
});

test("parses valid thru month-year without inferring amount", () => {
  const draft = suggestReminderFromTextFallback("valid thru september 2026");

  assert.equal(draft.amount, null);
  assert.equal(draft.dueDate, "2026-09-30");
});

test("parses leap-year expiration month end", () => {
  const draft = suggestReminderFromTextFallback("kartu debit bca valid thru Februari 2028");

  assert.equal(draft.dueDate, "2028-02-29");
});

test("parses payment context formatted amount without explicit currency word", () => {
  const draft = suggestReminderFromTextFallback("ingatkan bayar internet 255.300 setiap tanggal 20", new Date(Date.UTC(2026, 4, 18)));

  assert.equal(draft.amount, 255300);
  assert.equal(draft.dueDate, "2026-05-20");
});

test("suggests SIM STNK and warranty reminders from text", () => {
  const simDraft = suggestReminderFromTextFallback("SIM C habis masa berlaku 20 Agustus 2027");
  const warrantyDraft = suggestReminderFromTextFallback("garansi monitor habis 12 Juli 2026");
  const warrantyMonthDraft = suggestReminderFromTextFallback("garansi monitor habis Juli 2026");

  assert.equal(simDraft.type, ReminderType.SIM);
  assert.equal(simDraft.dueDate, "2027-08-20");
  assert.equal(suggestReminderFromTextFallback("STNK motor 20 Agustus 2027").type, ReminderType.STNK);
  assert.equal(warrantyDraft.type, ReminderType.WARRANTY);
  assert.equal(warrantyDraft.dueDate, "2026-07-12");
  assert.equal(warrantyMonthDraft.type, ReminderType.WARRANTY);
  assert.equal(warrantyMonthDraft.dueDate, "2026-07-31");
});

test("suggests license and document reminders from text", () => {
  assert.equal(suggestReminderFromTextFallback("domain website habis 15 Oktober 2026").type, ReminderType.LICENSE);
  assert.equal(suggestReminderFromTextFallback("dokumen paspor habis 15 Oktober 2026").type, ReminderType.DOCUMENT);
});
