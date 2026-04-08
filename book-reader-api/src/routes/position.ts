import { Hono } from "hono";
import { db } from "../db/index.js";
import { readingPositions } from "../db/schema.js";
import { eq, and } from "drizzle-orm";
import { authMiddleware } from "../middleware/auth.js";
import type { AppVariables } from "../types.js";

const position = new Hono<{ Variables: AppVariables }>();

position.use("/*", authMiddleware);

position.get("/:bookHash", async (c) => {
  const userId = c.get("userId") as string;
  const bookHash = c.req.param("bookHash");

  const pos = await db
    .select()
    .from(readingPositions)
    .where(
      and(
        eq(readingPositions.userId, userId),
        eq(readingPositions.bookHash, bookHash)
      )
    )
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!pos) {
    return c.json({ error: "Position not found" }, 404);
  }

  return c.json({
    bookHash: pos.bookHash,
    bookTitle: pos.bookTitle,
    chapterIndex: pos.chapterIndex,
    scrollOffset: pos.scrollOffset,
    percentage: pos.percentage,
    updatedAt: pos.updatedAt.toISOString(),
  });
});

position.put("/:bookHash", async (c) => {
  const userId = c.get("userId") as string;
  const bookHash = c.req.param("bookHash");
  const body = await c.req.json<{
    bookTitle: string;
    chapterIndex: number;
    scrollOffset: number;
    percentage: number;
  }>();

  const existing = await db
    .select()
    .from(readingPositions)
    .where(
      and(
        eq(readingPositions.userId, userId),
        eq(readingPositions.bookHash, bookHash)
      )
    )
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (existing) {
    const [updated] = await db
      .update(readingPositions)
      .set({
        bookTitle: body.bookTitle || existing.bookTitle,
        chapterIndex: body.chapterIndex,
        scrollOffset: body.scrollOffset,
        percentage: body.percentage,
        updatedAt: new Date(),
      })
      .where(eq(readingPositions.id, existing.id))
      .returning();

    return c.json({
      bookHash: updated.bookHash,
      bookTitle: updated.bookTitle,
      chapterIndex: updated.chapterIndex,
      scrollOffset: updated.scrollOffset,
      percentage: updated.percentage,
      updatedAt: updated.updatedAt.toISOString(),
    });
  }

  const [created] = await db
    .insert(readingPositions)
    .values({
      userId,
      bookHash,
      bookTitle: body.bookTitle || "",
      chapterIndex: body.chapterIndex,
      scrollOffset: body.scrollOffset,
      percentage: body.percentage,
    })
    .returning();

  return c.json({
    bookHash: created.bookHash,
    bookTitle: created.bookTitle,
    chapterIndex: created.chapterIndex,
    scrollOffset: created.scrollOffset,
    percentage: created.percentage,
    updatedAt: created.updatedAt.toISOString(),
  });
});

export default position;
