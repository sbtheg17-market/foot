import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  addMoney,
  createMoney,
  isPaymentTransitionAllowed,
  subtractMoney,
  sumMoney,
  transitionPaymentStatus,
} from "../lib/payments-foundation.js";

describe("provider-neutral money", () => {
  it("uses integer minor units and preserves currency", () => {
    assert.deepEqual(addMoney(createMoney(1250, "CAD"), createMoney(275, "CAD")), {
      amountMinor: 1525,
      currency: "CAD",
    });
  });

  it("sums and subtracts without floating point arithmetic", () => {
    const total = sumMoney(
      createMoney(999, "CAD"),
      createMoney(1, "CAD"),
      createMoney(500, "CAD"),
    );
    assert.deepEqual(subtractMoney(total, createMoney(500, "CAD")), {
      amountMinor: 1000,
      currency: "CAD",
    });
  });

  it("rejects invalid amounts and mixed currencies", () => {
    assert.throws(() => createMoney(10.5, "CAD"));
    assert.throws(() => createMoney(-1, "CAD"));
    assert.throws(() => createMoney(1, "cad"));
    assert.throws(() => addMoney(createMoney(1, "CAD"), createMoney(1, "USD")));
    assert.throws(() => subtractMoney(createMoney(1, "CAD"), createMoney(2, "CAD")));
  });
});

describe("payment lifecycle", () => {
  it("allows the documented authorization, capture, and refund path", () => {
    assert.equal(isPaymentTransitionAllowed("draft", "pending"), true);
    assert.equal(transitionPaymentStatus("pending", "authorized"), "authorized");
    assert.equal(transitionPaymentStatus("authorized", "captured"), "captured");
    assert.equal(
      transitionPaymentStatus("captured", "partially_refunded"),
      "partially_refunded",
    );
    assert.equal(transitionPaymentStatus("partially_refunded", "refunded"), "refunded");
  });

  it("allows retry from failed without allowing terminal-state mutation", () => {
    assert.equal(transitionPaymentStatus("failed", "pending"), "pending");
    assert.equal(isPaymentTransitionAllowed("captured", "pending"), false);
    assert.equal(isPaymentTransitionAllowed("refunded", "captured"), false);
    assert.throws(() => transitionPaymentStatus("void", "pending"));
  });

  it("rejects self transitions and skips capture from pending", () => {
    assert.equal(isPaymentTransitionAllowed("pending", "pending"), false);
    assert.equal(isPaymentTransitionAllowed("pending", "captured"), false);
    assert.throws(() => transitionPaymentStatus("pending", "captured"));
  });
});