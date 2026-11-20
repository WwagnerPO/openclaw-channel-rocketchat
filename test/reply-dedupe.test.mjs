import { test } from "node:test";
import assert from "node:assert/strict";
import { createRocketChatReplyDeduper } from "../dist/src/rocketchat/reply-dedupe.js";

test("drops empty and identical consecutive replies, keeps different ones", () => {
  const d = createRocketChatReplyDeduper();
  assert.equal(d.shouldDeliver(""), false);
  assert.equal(d.shouldDeliver("   "), false);
  assert.equal(d.shouldDeliver("hola"), true);
  assert.equal(d.shouldDeliver("hola"), false);
  assert.equal(d.shouldDeliver(" hola \n"), false);
  assert.equal(d.shouldDeliver("adiós"), true);
  assert.equal(d.shouldDeliver("hola"), true);
});

test("each inbound turn gets an independent deduper", () => {
  const a = createRocketChatReplyDeduper();
  const b = createRocketChatReplyDeduper();
  assert.equal(a.shouldDeliver("x"), true);
  assert.equal(b.shouldDeliver("x"), true);
});
