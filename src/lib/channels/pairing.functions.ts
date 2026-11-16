import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { pairingInput } from "./security";

export const connectTelegramChannel = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => pairingInput.parse(input))
  .handler(async ({ data }) => {
    const { authenticate } = await import("@/lib/ceyo/auth.server");
    const { db, userId } = await authenticate(getRequest());
    const { createTelegramPairing } = await import("./pairing.server");
    return createTelegramPairing(db, userId, data.botId);
  });