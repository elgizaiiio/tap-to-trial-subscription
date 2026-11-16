import { describe, expect, it } from "vitest";
import { playTrialOfferPayload } from "./playCatalog";
describe("Play 3-day free trial", () => {
  it("is free for exactly one 3-day phase", () => {
    const o = playTrialOfferPayload("ceyo_plus_monthly", ["EG"]);
    expect(o.phases).toEqual([{ duration: "P3D", recurrenceCount: 1, regionalConfigs: [{ regionCode: "EG", free: {} }] }]);
  });
  it("is limited to people who never subscribed before", () => {
    expect(playTrialOfferPayload("ceyo_pro_monthly", ["US"]).targeting).toEqual({ acquisitionRule: { scope: { anySubscriptionInApp: {} } } });
  });
});
