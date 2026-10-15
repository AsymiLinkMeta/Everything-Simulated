import { describe, expect, it } from "vitest";
import {
  parseSignatureHeader,
  signStripePayload,
  verifyStripeSignature,
} from "../supabase/functions/_shared/stripe-signature.ts";

const SECRET = "whsec_test_secret";
const NOW = 1_760_000_000;
const PAYLOAD = JSON.stringify({ id: "evt_1", type: "checkout.session.completed" });

describe("verifyStripeSignature", () => {
  it("accepts a correctly signed, fresh payload", async () => {
    const header = await signStripePayload(PAYLOAD, SECRET, NOW);
    await expect(verifyStripeSignature({ payload: PAYLOAD, header, secret: SECRET, nowSeconds: NOW })).resolves.toEqual({
      ok: true,
      timestamp: NOW,
    });
  });

  it("fails closed when the secret is missing", async () => {
    const header = await signStripePayload(PAYLOAD, SECRET, NOW);
    for (const secret of ["", undefined, null]) {
      const r = await verifyStripeSignature({ payload: PAYLOAD, header, secret, nowSeconds: NOW });
      expect(r).toEqual({ ok: false, reason: "webhook secret not configured" });
    }
  });

  it("rejects a missing header", async () => {
    const r = await verifyStripeSignature({ payload: PAYLOAD, header: null, secret: SECRET, nowSeconds: NOW });
    expect(r.ok).toBe(false);
  });

  it("rejects a tampered body", async () => {
    const header = await signStripePayload(PAYLOAD, SECRET, NOW);
    const r = await verifyStripeSignature({ payload: PAYLOAD.replace("evt_1", "evt_2"), header, secret: SECRET, nowSeconds: NOW });
    expect(r).toEqual({ ok: false, reason: "signature mismatch" });
  });

  it("rejects a signature made with another secret", async () => {
    const header = await signStripePayload(PAYLOAD, "whsec_other", NOW);
    const r = await verifyStripeSignature({ payload: PAYLOAD, header, secret: SECRET, nowSeconds: NOW });
    expect(r.ok).toBe(false);
  });

  it("rejects replays outside the tolerance window (both directions)", async () => {
    const header = await signStripePayload(PAYLOAD, SECRET, NOW);
    const late = await verifyStripeSignature({ payload: PAYLOAD, header, secret: SECRET, nowSeconds: NOW + 301 });
    const early = await verifyStripeSignature({ payload: PAYLOAD, header, secret: SECRET, nowSeconds: NOW - 301 });
    expect(late).toEqual({ ok: false, reason: "timestamp outside tolerance" });
    expect(early).toEqual({ ok: false, reason: "timestamp outside tolerance" });
    const edge = await verifyStripeSignature({ payload: PAYLOAD, header, secret: SECRET, nowSeconds: NOW + 300 });
    expect(edge.ok).toBe(true);
  });

  it("does not let a re-signed old timestamp through by editing t=", async () => {
    const header = await signStripePayload(PAYLOAD, SECRET, NOW - 10_000);
    const forged = header.replace(`t=${NOW - 10_000}`, `t=${NOW}`);
    const r = await verifyStripeSignature({ payload: PAYLOAD, header: forged, secret: SECRET, nowSeconds: NOW });
    expect(r).toEqual({ ok: false, reason: "signature mismatch" });
  });

  it("accepts when any of several v1 signatures matches (secret rotation)", async () => {
    const good = await signStripePayload(PAYLOAD, SECRET, NOW);
    const v1 = good.split("v1=")[1];
    const header = `t=${NOW},v1=${"0".repeat(64)},v1=${v1},v0=ignored`;
    const r = await verifyStripeSignature({ payload: PAYLOAD, header, secret: SECRET, nowSeconds: NOW });
    expect(r.ok).toBe(true);
  });

  it("rejects headers without a timestamp or v1", async () => {
    expect((await verifyStripeSignature({ payload: PAYLOAD, header: "v1=abc", secret: SECRET, nowSeconds: NOW })).ok).toBe(false);
    expect((await verifyStripeSignature({ payload: PAYLOAD, header: `t=${NOW}`, secret: SECRET, nowSeconds: NOW })).ok).toBe(false);
  });
});

describe("parseSignatureHeader", () => {
  it("collects every v1 and ignores junk", () => {
    expect(parseSignatureHeader("t=12, v1=a ,v1=b,junk,v0=c")).toEqual({ t: 12, v1: ["a", "b"] });
    expect(parseSignatureHeader("t=notanumber")).toEqual({ t: null, v1: [] });
  });
});
