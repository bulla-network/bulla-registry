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

test("a network without its native currency, wrapped native token or USDC fails", () => {
  for (const field of ["nativeCurrency", "wrappedNativeToken", "usdc"]) {
    const r = registry();
    delete r.networks["1"][field];
    assertFails(r, new RegExp(`must have required property '${field}'`));
  }
});

test("a network's wrapped native token and USDC are tokens, never null", () => {
  for (const field of ["wrappedNativeToken", "usdc"]) {
    const r = registry();
    r.networks["1"][field] = null;
    assertFails(r, new RegExp(`/networks/1/${field} must be object`));
  }

  const r2 = registry();
  delete r2.networks["1"].usdc.decimals;
  assertFails(r2, /\/networks\/1\/usdc must have required property 'decimals'/);

  const r3 = registry();
  r3.networks["1"].wrappedNativeToken.address = "0x1234";
  assertFails(r3, /\/networks\/1\/wrappedNativeToken\/address must match pattern/);
});

test("a pool whose asset is the network's USDC must agree on its symbol and decimals", () => {
  const r = registry();
  const i = r.pools.findIndex(
    (p: { chainId: number; asset: { address: string } }) =>
      p.asset.address.toLowerCase() === r.networks[String(p.chainId)].usdc?.address.toLowerCase()
  );
  assert.ok(i >= 0, "some pool takes the network's USDC");
  r.networks[String(r.pools[i].chainId)].usdc.decimals = 18;
  assertFails(r, new RegExp(`/pools/${i} .*doesn't match chain .*'s usdc USDC`));
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

test("a pool's category is active, test, archived or hidden", () => {
  for (const category of ["active", "test", "archived", "hidden"]) {
    const r = registry();
    r.pools[0].category = category;
    assert.deepEqual(validateRegistry(r), [], category);
  }

  const r = registry();
  r.pools[0].category = "paused";
  assertFails(r, /\/pools\/0\/category must be equal to one of the allowed values/);
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
