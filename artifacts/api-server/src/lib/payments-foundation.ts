/**
 * Provider-neutral payment primitives.
 *
 * This module deliberately has no database, network, or provider SDK
 * dependencies. It is a contract for future payment work, not a payment
 * processor and must not be used to create financial side effects.
 */

export type CurrencyCode = string;

export interface Money {
  readonly amountMinor: number;
  readonly currency: CurrencyCode;
}

export type PaymentStatus =
  | "draft"
  | "pending"
  | "requires_action"
  | "authorized"
  | "captured"
  | "failed"
  | "void"
  | "refunded"
  | "partially_refunded"
  | "disputed";

const PAYMENT_TRANSITIONS: Record<PaymentStatus, readonly PaymentStatus[]> = {
  draft: ["pending", "void"],
  pending: ["requires_action", "authorized", "failed", "void"],
  requires_action: ["authorized", "failed", "void"],
  authorized: ["captured", "failed", "void"],
  captured: ["partially_refunded", "refunded", "disputed"],
  failed: ["pending", "void"],
  void: [],
  refunded: [],
  partially_refunded: ["refunded", "disputed"],
  disputed: [],
};

function assertCurrency(currency: CurrencyCode): string {
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new Error("Currency must be a three-letter uppercase ISO 4217 code.");
  }
  return currency;
}

function assertMinorAmount(amountMinor: number): number {
  if (!Number.isSafeInteger(amountMinor) || amountMinor < 0) {
    throw new Error("Money amounts must be non-negative safe integers in minor units.");
  }
  return amountMinor;
}

export function createMoney(amountMinor: number, currency: CurrencyCode): Money {
  return Object.freeze({
    amountMinor: assertMinorAmount(amountMinor),
    currency: assertCurrency(currency),
  });
}

function assertSameCurrency(left: Money, right: Money): void {
  if (left.currency !== right.currency) {
    throw new Error(`Cannot combine ${left.currency} and ${right.currency} money.`);
  }
}

export function addMoney(left: Money, right: Money): Money {
  assertSameCurrency(left, right);
  return createMoney(left.amountMinor + right.amountMinor, left.currency);
}

export function subtractMoney(left: Money, right: Money): Money {
  assertSameCurrency(left, right);
  if (right.amountMinor > left.amountMinor) {
    throw new Error("Money subtraction cannot produce a negative amount.");
  }
  return createMoney(left.amountMinor - right.amountMinor, left.currency);
}

export function sumMoney(...amounts: readonly Money[]): Money {
  if (amounts.length === 0) {
    throw new Error("At least one money amount is required.");
  }
  return amounts.slice(1).reduce(addMoney, amounts[0]);
}

export function isPaymentTransitionAllowed(
  from: PaymentStatus,
  to: PaymentStatus,
): boolean {
  return PAYMENT_TRANSITIONS[from].includes(to);
}

export function transitionPaymentStatus(
  from: PaymentStatus,
  to: PaymentStatus,
): PaymentStatus {
  if (!isPaymentTransitionAllowed(from, to)) {
    throw new Error(`Invalid payment transition: ${from} → ${to}.`);
  }
  return to;
}

export const PAYMENT_STATUS_TRANSITIONS = PAYMENT_TRANSITIONS;

export interface PaymentAuditContext {
  readonly paymentId: string;
  readonly invoiceId: number;
  readonly bookingId: number;
  readonly clientId: number;
  readonly providerId: number;
  readonly platformId: string;
  readonly amount: Money;
  readonly platformFee: Money;
  readonly tax: Money;
  readonly refund: Money;
  readonly providerEventId?: string;
  readonly idempotencyKey: string;
  readonly correlationId: string;
  readonly occurredAt: string;
  readonly previousStatus: PaymentStatus;
  readonly newStatus: PaymentStatus;
}