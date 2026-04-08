import { Hono } from "hono";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { signToken } from "../middleware/auth.js";

const auth = new Hono();

interface GoogleTokenInfo {
  sub: string;
  email: string;
  name: string;
  picture: string;
  email_verified: string;
}

auth.post("/google", async (c) => {
  const { idToken } = await c.req.json<{ idToken: string }>();

  if (!idToken) {
    return c.json({ error: "idToken is required" }, 400);
  }

  // Verify the Google token
  let googleUser: GoogleTokenInfo;
  try {
    const res = await fetch(
      `https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${idToken}`
    );
    if (!res.ok) {
      const info = await fetch(
        `https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`
      );
      if (!info.ok) throw new Error("Invalid token");
      googleUser = (await info.json()) as GoogleTokenInfo;
    } else {
      googleUser = (await res.json()) as GoogleTokenInfo;
    }
  } catch {
    return c.json({ error: "Failed to verify Google token" }, 401);
  }

  // Find or create user
  let user = await db
    .select()
    .from(users)
    .where(eq(users.googleId, googleUser.sub))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!user) {
    const [newUser] = await db
      .insert(users)
      .values({
        googleId: googleUser.sub,
        email: googleUser.email,
        name: googleUser.name || googleUser.email,
      })
      .returning();
    user = newUser;
  }

  const token = signToken({ userId: user.id, email: user.email });

  return c.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
    },
  });
});

export default auth;
