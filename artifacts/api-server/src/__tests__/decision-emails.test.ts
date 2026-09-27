import { test } from "node:test";
import assert from "node:assert/strict";
import {
  assertSafeEmail,
  renderDecisionEmail,
  sendApplicationDecisionEmail,
  isEmailConfigured,
} from "../lib/decision-emails.js";

const APPROVED = { to: "a@example.test", firstName: "Ada", decision: "approved" as const, rejectionReason: null };

test("guardrail gate rejects forms, credential asks, non-https and shortened links", () => {
  assert.throws(() => assertSafeEmail("s", "<form><input></form>"), /No forms/);
  assert.throws(() => assertSafeEmail("s", "<p>Please reply with your password</p>"), /credentials/);
  assert.throws(() => assertSafeEmail("s", '<a href="http://example.test/x">x</a>'), /absolute https/);
  assert.throws(() => assertSafeEmail("s", '<a href="https://bit.ly/x">x</a>'), /Shortened/);
  assert.throws(() => assertSafeEmail("s", '<a href="https://10.0.0.1/x">x</a>'), /Unsafe/);
  assert.doesNotThrow(() => assertSafeEmail("s", '<a href="https://app.example.test/x">x</a><a href="mailto:a@b.c">m</a>'));
});

test("rendered emails pass the gate, escape the reason and never embed reviewer notes", () => {
  process.env["PUBLIC_APP_URL"] = "https://app.example.test/";
  const rejected = renderDecisionEmail(
    { to: "a@example.test", firstName: "<Ada>", decision: "rejected", rejectionReason: "Expired <b>insurance</b>" },
    "OnCall Foot",
  );
  assert.doesNotThrow(() => assertSafeEmail(rejected.subject, rejected.html));
  assert.match(rejected.html, /Hi &lt;Ada&gt;,/);
  assert.match(rejected.html, /Expired &lt;b&gt;insurance&lt;\/b&gt;/);
  assert.match(rejected.html, /href="https:\/\/app\.example\.test\/provider\/application-status"/);
  assert.doesNotMatch(rejected.html, /reviewer notes/i);

  const approved = renderDecisionEmail(APPROVED, "OnCall Foot");
  assert.doesNotThrow(() => assertSafeEmail(approved.subject, approved.html));
  assert.match(approved.subject, /approved/);
  assert.match(approved.html, /credentials are reviewed separately/);

  process.env["PUBLIC_APP_URL"] = "http://insecure.example.test";
  const noLink = renderDecisionEmail(APPROVED, "OnCall Foot");
  assert.doesNotMatch(noLink.html, /href=/);
  delete process.env["PUBLIC_APP_URL"];
});

test("sending is skipped honestly when email is not configured", async () => {
  const saved = { key: process.env["EMERGENT_EMAIL_KEY"], from: process.env["EMAIL_FROM_NAME"] };
  delete process.env["EMERGENT_EMAIL_KEY"];
  delete process.env["EMAIL_FROM_NAME"];
  assert.equal(isEmailConfigured(), false);
  assert.deepEqual(await sendApplicationDecisionEmail(APPROVED), { sent: false, reason: "not_configured" });
  if (saved.key) process.env["EMERGENT_EMAIL_KEY"] = saved.key;
  if (saved.from) process.env["EMAIL_FROM_NAME"] = saved.from;
});

test("an invalid recipient is refused before any network call", async () => {
  process.env["EMERGENT_EMAIL_KEY"] = "test-key";
  process.env["EMAIL_FROM_NAME"] = "OnCall Foot";
  const originalFetch = globalThis.fetch;
  let called = false;
  globalThis.fetch = (async () => { called = true; return new Response("{}"); }) as typeof fetch;
  try {
    assert.deepEqual(await sendApplicationDecisionEmail({ ...APPROVED, to: "not-an-email" }), { sent: false, reason: "invalid_recipient" });
    assert.equal(called, false);
  } finally {
    globalThis.fetch = originalFetch;
    delete process.env["EMERGENT_EMAIL_KEY"];
    delete process.env["EMAIL_FROM_NAME"];
  }
});

test("provider failures are reported, never thrown", async () => {
  process.env["EMERGENT_EMAIL_KEY"] = "test-key";
  process.env["EMAIL_FROM_NAME"] = "OnCall Foot";
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response("boom", { status: 500 })) as typeof fetch;
  try {
    assert.deepEqual(await sendApplicationDecisionEmail(APPROVED), { sent: false, reason: "provider_error" });
  } finally {
    globalThis.fetch = originalFetch;
    delete process.env["EMERGENT_EMAIL_KEY"];
    delete process.env["EMAIL_FROM_NAME"];
  }
});
