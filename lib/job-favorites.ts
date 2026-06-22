import { prisma } from "@/lib/prisma";

export async function getFavoriteJobIdsForUser(
  userId: string,
): Promise<string[]> {
  const favorites = await prisma.jobFavorite.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { jobId: true },
  });

  return favorites.map((favorite) => favorite.jobId);
}
