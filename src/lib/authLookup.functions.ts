import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** Tells the sign-in screen whether an email already has an account, so new and returning people get the right screen. */
export const emailHasAccount = createServerFn({ method: "POST" })
  .inputValidator(z.object({ email: z.string().trim().toLowerCase().email().max(254) }))
  .handler(async ({ data }) => {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return { known: false, exists: false };
    try {
      const res = await fetch(`${url}/auth/v1/admin/users?filter=${encodeURIComponent(data.email)}&per_page=50`, {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
      });
      if (!res.ok) return { known: false, exists: false };
      const body = (await res.json()) as { users?: { email?: string }[] };
      return { known: true, exists: (body.users ?? []).some((u) => u.email?.toLowerCase() === data.email) };
    } catch {
      return { known: false, exists: false };
    }
  });
