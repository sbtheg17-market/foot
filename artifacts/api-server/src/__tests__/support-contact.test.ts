/**
 * Pure unit tests: pilot support-contact resolution (env override chain,
 * placeholder fallback, invalid-value throw posture).
 */

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  getSupportContact,
  InvalidSupportContactError,
  SUPPORT_CONTACT_PLACEHOLDER_EMAIL,
} from "../lib/support-contact.js";

const savedUrl = process.env["SUPPORT_CONTACT_URL"];
const savedEmail = process.env["SUPPORT_CONTACT_EMAIL"];

describe("support contact resolution", () => {
  beforeEach(() => {
    delete process.env["SUPPORT_CONTACT_URL"];
    delete process.env["SUPPORT_CONTACT_EMAIL"];
  });

  afterEach(() => {
    if (savedUrl === undefined) delete process.env["SUPPORT_CONTACT_URL"];
    else process.env["SUPPORT_CONTACT_URL"] = savedUrl;
    if (savedEmail === undefined) delete process.env["SUPPORT_CONTACT_EMAIL"];
    else process.env["SUPPORT_CONTACT_EMAIL"] = savedEmail;
  });

  it("falls back to the documented pilot placeholder when nothing is configured", () => {
    const contact = getSupportContact();
    assert.equal(contact.url, `mailto:${SUPPORT_CONTACT_PLACEHOLDER_EMAIL}`);
    assert.equal(contact.label, SUPPORT_CONTACT_PLACEHOLDER_EMAIL);
    assert.equal(contact.isPlaceholder, true);
  });

  it("uses SUPPORT_CONTACT_EMAIL as a mailto link when set", () => {
    process.env["SUPPORT_CONTACT_EMAIL"] = "help@example.com";
    const contact = getSupportContact();
    assert.equal(contact.url, "mailto:help@example.com");
    assert.equal(contact.label, "help@example.com");
    assert.equal(contact.isPlaceholder, false);
  });

  it("SUPPORT_CONTACT_URL takes precedence over the email", () => {
    process.env["SUPPORT_CONTACT_EMAIL"] = "help@example.com";
    process.env["SUPPORT_CONTACT_URL"] = "https://forms.example.com/support";
    const contact = getSupportContact();
    assert.equal(contact.url, "https://forms.example.com/support");
    assert.equal(contact.label, "Contact support");
    assert.equal(contact.isPlaceholder, false);
  });

  it("blank overrides are treated as unset (placeholder)", () => {
    process.env["SUPPORT_CONTACT_URL"] = "   ";
    process.env["SUPPORT_CONTACT_EMAIL"] = "";
    assert.equal(getSupportContact().isPlaceholder, true);
  });

  it("an invalid SUPPORT_CONTACT_URL throws — never a silent fallback", () => {
    process.env["SUPPORT_CONTACT_URL"] = "ftp://not-allowed";
    assert.throws(() => getSupportContact(), InvalidSupportContactError);
    process.env["SUPPORT_CONTACT_URL"] = "not a url";
    assert.throws(() => getSupportContact(), InvalidSupportContactError);
  });

  it("an invalid SUPPORT_CONTACT_EMAIL throws — never a silent fallback", () => {
    process.env["SUPPORT_CONTACT_EMAIL"] = "not-an-email";
    assert.throws(() => getSupportContact(), InvalidSupportContactError);
  });
});
