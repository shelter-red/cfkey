import { describe, expect, it } from "vitest";
import {
  constantTimeEqual,
  createSignedToken,
  decryptSecretData,
  encryptSecretData,
  verifySignedToken,
} from "../src/worker/crypto";

const secret = "a".repeat(64);

describe("vault crypto", () => {
  it("round trips encrypted data and binds it to the item identity", async () => {
    const data = { fields: { token: "secret-value" }, notes: "private note" };
    const encrypted = await encryptSecretData(secret, "item-1", "api-key", data);
    const decrypted = await decryptSecretData([secret], "item-1", "api-key", encrypted.ciphertext, encrypted.iv);
    expect(decrypted.data).toEqual(data);
    await expect(decryptSecretData([secret], "item-2", "api-key", encrypted.ciphertext, encrypted.iv)).rejects.toThrow("VAULT_DECRYPT_FAILED");
  });

  it("can read with the previous secret during rotation", async () => {
    const encrypted = await encryptSecretData(secret, "item-1", "generic", { fields: { secret: "value" }, notes: "" });
    const result = await decryptSecretData(["b".repeat(64), secret], "item-1", "generic", encrypted.ciphertext, encrypted.iv);
    expect(result.secretIndex).toBe(1);
  });

  it("signs stateless session tokens", async () => {
    const token = await createSignedToken(secret, 60);
    expect(await verifySignedToken(secret, token)).toBe(true);
    expect(await verifySignedToken("wrong", token)).toBe(false);
  });

  it("compares deployment passwords without early length acceptance", () => {
    expect(constantTimeEqual("same", "same")).toBe(true);
    expect(constantTimeEqual("same", "different")).toBe(false);
    expect(constantTimeEqual("short", "shorter")).toBe(false);
  });
});
