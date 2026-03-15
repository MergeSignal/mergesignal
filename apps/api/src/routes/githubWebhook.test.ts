import { describe, it, expect } from "vitest";
import { createHmac } from "crypto";

describe("GitHub Webhook Tests", () => {
  const webhookSecret = "test-webhook-secret";

  function signPayload(payload: string): string {
    const mac = createHmac("sha256", webhookSecret).update(payload, "utf8").digest("hex");
    return `sha256=${mac}`;
  }

  function verifySignature(body: string, signatureHeader: string, secret: string) {
    if (!signatureHeader.startsWith("sha256=")) return false;
    const sig = signatureHeader.slice("sha256=".length);
    const mac = createHmac("sha256", secret).update(body, "utf8").digest("hex");
    try {
      const sigBuf = Buffer.from(sig, "hex");
      const macBuf = Buffer.from(mac, "hex");
      if (sigBuf.length !== macBuf.length) return false;
      return sigBuf.equals(macBuf);
    } catch {
      return false;
    }
  }

  describe("Webhook signature verification", () => {
    it("should verify valid signature", () => {
      const payload = JSON.stringify({ test: "data" });
      const signature = signPayload(payload);
      expect(verifySignature(payload, signature, webhookSecret)).toBe(true);
    });

    it("should reject invalid signature", () => {
      const payload = JSON.stringify({ test: "data" });
      const invalidSignature = "sha256=invalid";
      expect(verifySignature(payload, invalidSignature, webhookSecret)).toBe(false);
    });

    it("should reject signature without sha256 prefix", () => {
      const payload = JSON.stringify({ test: "data" });
      expect(verifySignature(payload, "invalid", webhookSecret)).toBe(false);
    });

    it("should reject tampered payload", () => {
      const payload = JSON.stringify({ test: "data" });
      const signature = signPayload(payload);
      const tamperedPayload = JSON.stringify({ test: "tampered" });
      expect(verifySignature(tamperedPayload, signature, webhookSecret)).toBe(false);
    });
  });
});
