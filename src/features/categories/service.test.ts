import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import type { Prisma } from "@prisma/client";

import { createRegisteredUser } from "@/features/auth/service";
import { prisma } from "@/lib/prisma";

import { defaultCategories } from "./default-categories";
import { deduplicateAvailableCategories, getAvailableCategories } from "./queries";
import { ensureDefaultCategoriesForUser } from "./service";

type StoredCategory = {
  id: string;
  userId: string | null;
  name: string;
  color: string | null;
  isDefault: boolean;
};

test("registration creates default categories for the new user", async (t) => {
  const categories: StoredCategory[] = [];
  const categoryClient = createCategoryClient(categories);
  const client = prisma as unknown as {
    $transaction: (callback: (transaction: unknown) => Promise<unknown>) => Promise<unknown>;
  };
  const originalTransaction = client.$transaction;

  client.$transaction = async (callback) =>
    callback({
      user: {
        create: async ({ data }: { data: { name: string; email: string; passwordHash: string } }) => ({
          id: "user-1",
          ...data
        })
      },
      ...categoryClient
    });

  t.after(() => {
    client.$transaction = originalTransaction;
  });

  const user = await createRegisteredUser({
    name: "Adi",
    email: "adi@example.com",
    passwordHash: "hashed-password"
  });

  assert.equal(user.id, "user-1");
  assert.equal(categories.length, defaultCategories.length);
  assert.deepEqual(
    categories.map(({ name, color }) => ({ name, color })),
    [...defaultCategories]
  );
  assert.ok(categories.every((category) => category.userId === "user-1" && category.isDefault));
});

test("default category initialization is idempotent", async () => {
  const categories: StoredCategory[] = [];
  const categoryClient = createCategoryClient(categories);

  await ensureDefaultCategoriesForUser("user-1", categoryClient);
  await ensureDefaultCategoriesForUser("user-1", categoryClient);

  assert.equal(categories.length, defaultCategories.length);
});

test("getAvailableCategories repairs a user with no categories", async (t) => {
  const categories: StoredCategory[] = [];

  mockCategoryDelegate(t, categories);

  const availableCategories = await getAvailableCategories("user-1");

  assert.equal(availableCategories.length, defaultCategories.length);
  assert.ok(availableCategories.every((category) => category.userId === "user-1"));
  assert.deepEqual(
    availableCategories.map((category) => category.name),
    [...defaultCategories].map((category) => category.name).sort((left, right) => left.localeCompare(right, "id-ID"))
  );
});

test("available categories preserve global defaults without duplicate names", () => {
  const categories = deduplicateAvailableCategories(
    [
      { id: "global-food", userId: null, name: "Makanan", isDefault: true },
      { id: "user-food", userId: "user-1", name: "Makanan", isDefault: true },
      { id: "global-other", userId: null, name: "Lainnya", isDefault: true },
      { id: "user-custom", userId: "user-1", name: "Liburan", isDefault: false }
    ],
    "user-1"
  );

  assert.deepEqual(
    categories.map((category) => category.id),
    ["global-other", "user-food", "user-custom"]
  );
});

function createCategoryClient(categories: StoredCategory[]) {
  return {
    category: {
      createMany: async ({ data }: Prisma.CategoryCreateManyArgs) => {
        const records = Array.isArray(data) ? data : [data];
        let count = 0;

        for (const record of records) {
          if (categories.some((category) => category.userId === record.userId && category.name === record.name)) {
            continue;
          }

          categories.push({
            id: `category-${categories.length + 1}`,
            userId: record.userId ?? null,
            name: record.name,
            color: record.color ?? null,
            isDefault: record.isDefault ?? false
          });
          count += 1;
        }

        return { count };
      }
    }
  };
}

function mockCategoryDelegate(t: TestContext, categories: StoredCategory[]) {
  const categoryClient = createCategoryClient(categories);
  const delegate = prisma.category as unknown as {
    createMany: typeof categoryClient.category.createMany;
    findMany: () => Promise<StoredCategory[]>;
  };
  const originalCreateMany = delegate.createMany;
  const originalFindMany = delegate.findMany;

  delegate.createMany = categoryClient.category.createMany;
  delegate.findMany = async () => categories;

  t.after(() => {
    delegate.createMany = originalCreateMany;
    delegate.findMany = originalFindMany;
  });
}
