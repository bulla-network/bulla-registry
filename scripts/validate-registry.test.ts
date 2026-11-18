import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { validateRegistry } from "./validate-registry.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const committed = JSON.parse(readFileSync(join(ROOT, "registry.json"), "utf-8"));

// A fresh copy of the committed registry.json to break in one way per test.
const registry = () => structuredClone(committed);

function assertFails(r: unknown, match: RegExp) {
  const errors = validateRegistry(r);
  assert.ok(errors.some((e) => match.test(e)), `expected an error matching ${match}, got:\n${errors.join("\n")}`);
}

test("the committed registry.json is valid", () => {
  assert.deepEqual(validateRegistry(registry()), []);
});

test("a dropped required field fails", () => {
  const r = registry();
  delete r.pools[0].deployBlock;
  assertFails(r, /must have required property 'deployBlock'/);

  const r2 = registry();
  delete r2.networks["1"].subgraph;
  assertFails(r2, /must have required property 'subgraph'/);

  const r3 = registry();
  delete r3.clients;
  assertFails(r3, /must have required property 'clients'/);
});

test("an unknown field fails", () => {
  const r = registry();
  r.networks["1"].graphql = r.networks["1"].subgraph.prod;
  assertFails(r, /must NOT have additional properties/);
});

test("a malformed address fails", () => {
  const r = registry();
  r.networks["1"].contracts["bulla-contracts-v2"].bullaInvoice = "0x1234";
  assertFails(r, /must match pattern/);
});

test("an unnamed network fails", () => {
  const r = registry();
  r.networks["50"].name = "Unknown (50)";
  assertFails(r, /\/networks\/50\/name/);
});

test("a network with no contracts fails", () => {
  const r = registry();
  r.networks["1"].contracts = {};
  assertFails(r, /must NOT have fewer than 1 properties/);
});

test("a network key that isn't its chainId fails", () => {
  const r = registry();
  r.networks["1"].chainId = 2;
  assertFails(r, /\/networks\/1 has chainId 2/);
});

test("a pool on an unknown chain, or whose slug doesn't match, fails", () => {
  const r = registry();
  r.pools[0].chainId = 999;
  assertFails(r, /chainId 999 is not in networks/);

  const r2 = registry();
  r2.pools[0].network = r2.pools[0].network === "base" ? "arbitrum" : "base";
  assertFails(r2, /doesn't match chain/);
});

test("a pool with an unknown client fails", () => {
  const r = registry();
  r.pools[0].client = "nobody";
  assertFails(r, /client nobody is not in clients/);
});

test("a pool listed twice fails", () => {
  const r = registry();
  r.pools.push({ ...r.pools[0], address: r.pools[0].address.toLowerCase() });
  assertFails(r, /listed more than once/);
});

test("a supersededBy that isn't a pool on the same chain fails", () => {
  const r = registry();
  r.pools[0].supersededBy = "0x000000000000000000000000000000000000dEaD";
  assertFails(r, /supersededBy .* is not a pool/);
});

test("a missing logo file fails", () => {
  const r = registry();
  const key = Object.keys(r.clients)[0];
  r.clients[key].logo = "factoring-contracts/logos/missing.png";
  assertFails(r, /missing\.png does not exist/);
});
