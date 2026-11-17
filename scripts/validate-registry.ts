import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { Ajv } from "ajv";
import addFormatsModule from "ajv-formats";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const SCHEMA_PATH = join(ROOT, "registry.schema.json");

// ajv-formats is CommonJS; under ESM its default export can arrive wrapped.
const addFormats = ((addFormatsModule as unknown as { default?: unknown }).default ??
  addFormatsModule) as unknown as (ajv: Ajv) => Ajv;

interface Pool {
  chainId: number;
  network: string;
  address: string;
  client: string;
  supersededBy?: string;
}

interface RegistryLike {
  networks: Record<string, { chainId: number; slug: string }>;
  clients: Record<string, { logo?: string }>;
  pools: Pool[];
}

/**
 * Checks a registry against registry.schema.json, then the rules the schema can't express.
 * Returns a list of errors; empty means valid. `root` is the directory registry.json lives in,
 * against which relative logo paths are resolved.
 */
export function validateRegistry(registry: unknown, root: string = ROOT): string[] {
  const schema = JSON.parse(readFileSync(SCHEMA_PATH, "utf-8"));
  const ajv = new Ajv({ allErrors: true, strict: true });
  addFormats(ajv);
  const validate = ajv.compile(schema);

  if (!validate(registry)) {
    return (validate.errors ?? []).map(
      (e) => `${e.instancePath || "(root)"} ${e.message}${e.params ? " " + JSON.stringify(e.params) : ""}`
    );
  }

  const errors: string[] = [];
  const r = registry as RegistryLike;

  for (const [key, network] of Object.entries(r.networks)) {
    if (String(network.chainId) !== key) {
      errors.push(`/networks/${key} has chainId ${network.chainId}`);
    }
  }
  const slugs = new Map<string, string>();
  for (const [key, network] of Object.entries(r.networks)) {
    const other = slugs.get(network.slug);
    if (other) errors.push(`/networks/${key} and /networks/${other} share the slug ${network.slug}`);
    slugs.set(network.slug, key);
  }

  for (const [key, client] of Object.entries(r.clients)) {
    if (client.logo && !client.logo.startsWith("https://") && !existsSync(join(root, client.logo))) {
      errors.push(`/clients/${key}/logo: ${client.logo} does not exist`);
    }
  }

  const seen = new Set<string>();
  const poolId = (chainId: number, address: string) => `${chainId}:${address.toLowerCase()}`;
  for (const p of r.pools) seen.add(poolId(p.chainId, p.address));
  const counted = new Set<string>();

  r.pools.forEach((p, i) => {
    const at = `/pools/${i} (${p.address})`;
    const network = r.networks[String(p.chainId)];
    if (!network) {
      errors.push(`${at}: chainId ${p.chainId} is not in networks`);
    } else if (network.slug !== p.network) {
      errors.push(`${at}: network ${p.network} doesn't match chain ${p.chainId}'s slug ${network.slug}`);
    }
    if (!r.clients[p.client]) {
      errors.push(`${at}: client ${p.client} is not in clients`);
    }
    const id = poolId(p.chainId, p.address);
    if (counted.has(id)) errors.push(`${at}: listed more than once on chain ${p.chainId}`);
    counted.add(id);
    if (p.supersededBy && !seen.has(poolId(p.chainId, p.supersededBy))) {
      errors.push(`${at}: supersededBy ${p.supersededBy} is not a pool on chain ${p.chainId}`);
    }
  });

  return errors;
}

// `npm run validate`: check the committed registry.json.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const path = join(ROOT, "registry.json");
  const errors = validateRegistry(JSON.parse(readFileSync(path, "utf-8")));
  if (errors.length > 0) {
    console.error(`registry.json does not match registry.schema.json:\n  ${errors.join("\n  ")}`);
    process.exit(1);
  }
  console.log("registry.json matches registry.schema.json");
}
