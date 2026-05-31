import { prisma } from "@/lib/prisma";
import { ensureDefaultCategoriesForUser } from "@/features/categories/service";

type RegisteredUserInput = {
  name: string;
  email: string;
  passwordHash: string;
};

export function createRegisteredUser(input: RegisteredUserInput) {
  return prisma.$transaction(async (transaction) => {
    const user = await transaction.user.create({
      data: input
    });

    await ensureDefaultCategoriesForUser(user.id, transaction);

    return user;
  });
}
