import { readFileSync, writeFileSync, existsSync, readdirSync } from "fs";
import { join, dirname, basename } from "path";
import { fileURLToPath } from "url";
import { validateRegistry } from "./validate-registry.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

// Source repos that provide contract addresses
const CONTRACT_SOURCES = ["bulla-contracts", "bulla-contracts-v2", "factoring-contracts"];

// Source repo that provides GraphQL endpoints
const GRAPHQL_SOURCE = "bulla-subgraph";

// Source repo (and file in its export) that provides the factoring pools and their clients
const POOLS_SOURCE = "factoring-contracts";
const POOLS_FILE = "pools.json";

interface Token {
  address: string;
  symbol: string;
  decimals: number;
}

interface NetworkFacts {
  name: string;
  slug: string;
  nativeCurrency: { symbol: string; decimals: number };
  wrappedNativeToken: Token | null;
  usdc: Token | null;
}

// Every network the registry lists. A chain ID that a source exports but that isn't here fails the run:
// add it with its name; its slug, the network's name in the subgraph (bulla-contracts-<slug>) and pools.json;
// its native currency; and its wrapped native token and the USDC Bulla uses, or null where there is none.
// Token symbols and decimals are what the contract returns (checked on-chain); addresses are checksummed.
const NETWORKS: Record<string, NetworkFacts> = {
  "1": {
    name: "Ethereum Mainnet",
    slug: "mainnet",
    nativeCurrency: { symbol: "ETH", decimals: 18 },
    wrappedNativeToken: { address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", symbol: "WETH", decimals: 18 },
    usdc: { address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", symbol: "USDC", decimals: 6 },
  },
  "10": {
    name: "Optimism",
    slug: "optimism",
    nativeCurrency: { symbol: "ETH", decimals: 18 },
    wrappedNativeToken: { address: "0x4200000000000000000000000000000000000006", symbol: "WETH", decimals: 18 },
    usdc: { address: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85", symbol: "USDC", decimals: 6 },
  },
  "50": {
    name: "XDC",
    slug: "xdc",
    nativeCurrency: { symbol: "XDC", decimals: 18 },
    wrappedNativeToken: { address: "0x951857744785E80e2De051c32EE7b25f9c458C42", symbol: "WXDC", decimals: 18 },
    usdc: { address: "0xfA2958CB79b0491CC627c1557F441eF849Ca8eb1", symbol: "USDC", decimals: 6 },
  },
  "56": {
    name: "BNB Chain",
    slug: "bnb_chain",
    nativeCurrency: { symbol: "BNB", decimals: 18 },
    wrappedNativeToken: { address: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c", symbol: "WBNB", decimals: 18 },
    // Binance-Peg USDC, which has 18 decimals.
    usdc: { address: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d", symbol: "USDC", decimals: 18 },
  },
  "100": {
    name: "Gnosis Chain",
    slug: "gnosis",
    nativeCurrency: { symbol: "XDAI", decimals: 18 },
    wrappedNativeToken: { address: "0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d", symbol: "WXDAI", decimals: 18 },
    usdc: { address: "0xDDAfbb505ad214D7b80b1f830fcCc89B60fb7A83", symbol: "USDC", decimals: 6 },
  },
  "137": {
    name: "Polygon",
    slug: "polygon",
    nativeCurrency: { symbol: "POL", decimals: 18 },
    wrappedNativeToken: { address: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270", symbol: "WPOL", decimals: 18 },
    usdc: { address: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359", symbol: "USDC", decimals: 6 },
  },
  "151": {
    name: "RedBelly",
    slug: "redbelly",
    nativeCurrency: { symbol: "RBNT", decimals: 18 },
    wrappedNativeToken: { address: "0x6ed1F491e2d31536D6561f6bdB2AdC8F092a6076", symbol: "WRBNT", decimals: 18 },
    usdc: { address: "0x8201c02d4AB2214471E8C3AD6475C8b0CD9F2D06", symbol: "USDC.e", decimals: 6 },
  },
  "8453": {
    name: "Base",
    slug: "base",
    nativeCurrency: { symbol: "ETH", decimals: 18 },
    wrappedNativeToken: { address: "0x4200000000000000000000000000000000000006", symbol: "WETH", decimals: 18 },
    usdc: { address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", symbol: "USDC", decimals: 6 },
  },
  "42161": {
    name: "Arbitrum",
    slug: "arbitrum",
    nativeCurrency: { symbol: "ETH", decimals: 18 },
    wrappedNativeToken: { address: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1", symbol: "WETH", decimals: 18 },
    usdc: { address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", symbol: "USDC", decimals: 6 },
  },
  "42220": {
    name: "Celo",
    slug: "celo",
    nativeCurrency: { symbol: "CELO", decimals: 18 },
    // CELO is itself an ERC-20 (0x471EcE3750Da237f93B8E339c536989b8978a438), so nothing wraps it.
    wrappedNativeToken: null,
    usdc: null,
  },
  "43114": {
    name: "Avalanche",
    slug: "avalanche",
    nativeCurrency: { symbol: "AVAX", decimals: 18 },
    wrappedNativeToken: { address: "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7", symbol: "WAVAX", decimals: 18 },
    usdc: { address: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E", symbol: "USDC", decimals: 6 },
  },
  "11155111": {
    name: "Sepolia",
    slug: "sepolia",
    nativeCurrency: { symbol: "ETH", decimals: 18 },
    wrappedNativeToken: { address: "0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9", symbol: "WETH", decimals: 18 },
    // The test USDC Bulla's Sepolia pools use, not Circle's (0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238).
    usdc: { address: "0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8", symbol: "USDC", decimals: 6 },
  },
};

// The subgraph's Goldsky project. Each network's endpoint is <base>/bulla-contracts-<slug>/<tag>/gn.
const GOLDSKY_SUBGRAPHS = "https://api.goldsky.com/api/public/project_clxvwihx9eci401ud1suddgpf/subgraphs";

function subgraphEndpoint(slug: string, tag: string): string {
  return `${GOLDSKY_SUBGRAPHS}/bulla-contracts-${slug}/${tag}/gn`;
}

interface ContractAddressConfig {
  repo: string;
  contracts: Record<string, Record<string, string>>;
}

interface GraphQLConfig {
  repo: string;
  endpoints: Record<string, string>;
}

interface PoolsFile {
  clients: Record<string, { displayName: string; website?: string; logo?: string }>;
  pools: Array<Record<string, unknown>>;
}

interface NetworkEntry {
  name: string;
  chainId: number;
  slug: string;
  subgraph: { dev: string; prod: string };
  nativeCurrency: NetworkFacts["nativeCurrency"];
  wrappedNativeToken: Token | null;
  usdc: Token | null;
  contracts: Record<string, Record<string, string>>;
}

interface Registry {
  $schema: string;
  generatedAt: string;
  networks: Record<string, NetworkEntry>;
  clients: PoolsFile["clients"];
  pools: PoolsFile["pools"];
}

function loadJSON<T>(path: string): T | null {
  if (!existsSync(path)) {
    console.warn(`Warning: ${path} not found, skipping`);
    return null;
  }
  return JSON.parse(readFileSync(path, "utf-8")) as T;
}

function fail(errors: string[]): never {
  console.error(`\nConsolidation failed, nothing was written:\n  ${errors.join("\n  ")}`);
  process.exit(1);
}

function consolidate(): void {
  const errors: string[] = [];
  const networks: Record<string, NetworkEntry> = {};

  for (const [chainId, { name, slug, nativeCurrency, wrappedNativeToken, usdc }] of Object.entries(NETWORKS)) {
    networks[chainId] = {
      name,
      chainId: Number(chainId),
      slug,
      subgraph: { dev: subgraphEndpoint(slug, "dev"), prod: subgraphEndpoint(slug, "prod") },
      nativeCurrency,
      wrappedNativeToken,
      usdc,
      contracts: {},
    };
  }

  // The subgraph export lists which networks have a subgraph. Its URLs aren't copied (they use the retired
  // v2-main/latest tags); each network's dev and prod endpoints are built above from its slug. The export only
  // has to agree: every network listed, under bulla-contracts-<slug>.
  const graphqlConfig = loadJSON<GraphQLConfig>(join(ROOT, GRAPHQL_SOURCE, "address_config.json"));
  const withSubgraph = new Set<string>();
  for (const [chainId, url] of Object.entries(graphqlConfig?.endpoints ?? {})) {
    const network = networks[chainId];
    if (!network) {
      errors.push(`chainId ${chainId} from ${GRAPHQL_SOURCE} is not in NETWORKS (scripts/consolidate.ts)`);
      continue;
    }
    const expected = `${GOLDSKY_SUBGRAPHS}/bulla-contracts-${network.slug}/`;
    if (!url.startsWith(expected)) {
      errors.push(`${GRAPHQL_SOURCE}'s endpoint for ${chainId} (${url}) doesn't start with ${expected}`);
    }
    withSubgraph.add(chainId);
  }
  for (const network of Object.values(networks)) {
    if (!withSubgraph.has(String(network.chainId))) {
      errors.push(`${GRAPHQL_SOURCE} has no endpoint for ${network.name} (${network.chainId})`);
    }
  }

  // Contract addresses from each source
  for (const source of CONTRACT_SOURCES) {
    const config = loadJSON<ContractAddressConfig>(join(ROOT, source, "address_config.json"));
    if (!config) continue;

    for (const [chainId, contracts] of Object.entries(config.contracts)) {
      if (!networks[chainId]) {
        errors.push(`chainId ${chainId} from ${source} is not in NETWORKS (scripts/consolidate.ts)`);
        continue;
      }
      networks[chainId].contracts[config.repo] = contracts;
    }
  }

  // Factoring pools and their clients. Logo paths are relative to pools.json upstream; make them
  // relative to registry.json, which sits at the root next to the copied export.
  const poolsPath = join(ROOT, POOLS_SOURCE, POOLS_FILE);
  if (!existsSync(poolsPath)) fail([`${POOLS_SOURCE}/${POOLS_FILE} not found`]);
  const poolsFile = JSON.parse(readFileSync(poolsPath, "utf-8")) as PoolsFile;
  const clients: PoolsFile["clients"] = {};
  for (const [key, client] of Object.entries(poolsFile.clients ?? {})) {
    clients[key] =
      client.logo && !client.logo.startsWith("https://")
        ? { ...client, logo: `${POOLS_SOURCE}/${client.logo}` }
        : client;
  }

  if (errors.length > 0) fail(errors);

  const registry: Registry = {
    $schema: "./registry.schema.json",
    generatedAt: new Date().toISOString(),
    networks,
    clients,
    pools: poolsFile.pools,
  };

  // Check the shape before writing, so a broken consolidation never reaches a commit.
  const invalid = validateRegistry(registry, ROOT);
  if (invalid.length > 0) fail(invalid.map((e) => `registry.schema.json: ${e}`));

  // Integer-like keys keep ascending order in a JS object, so networks come out sorted by chainId.
  writeFileSync(join(ROOT, "registry.json"), JSON.stringify(registry, null, 2) + "\n");
  console.log(
    `registry.json generated with ${Object.keys(networks).length} networks, ` +
      `${Object.keys(clients).length} clients and ${registry.pools.length} pools; it matches registry.schema.json`
  );

  generateClaudeMd(registry);
}

// Repo descriptions for the directory tree
const REPO_DESCRIPTIONS: Record<string, string> = {
  "bulla-contracts": "V1 contracts",
  "bulla-contracts-v2": "V2 contracts",
  "bulla-subgraph": "GraphQL subgraph",
  "bulla-backend": "Backend API (private repo, manually maintained)",
  "factoring-contracts": "Factoring contracts",
};

function getSkillDescription(skillPath: string): string {
  const content = readFileSync(skillPath, "utf-8");
  const descMatch = content.match(/## Description\s*\n(.+)/);
  if (descMatch) {
    // Take first sentence (up to first period or end of line)
    const firstLine = descMatch[1].trim();
    const sentence = firstLine.match(/^(.+?\.)\s/);
    return sentence ? sentence[1] : firstLine;
  }
  // Fallback: use the # title
  const titleMatch = content.match(/^# (.+)/m);
  return titleMatch ? titleMatch[1] : basename(skillPath, ".md");
}

function listDir(dirPath: string, ext?: string): string[] {
  if (!existsSync(dirPath)) return [];
  return readdirSync(dirPath)
    .filter((f) => !ext || f.endsWith(ext))
    .sort();
}

function buildRegistryStructure(): string {
  const lines: string[] = [];
  lines.push("registry.json                    # Addresses, subgraph endpoints, factoring pools and clients (generated)");
  lines.push("registry.schema.json             # JSON Schema registry.json is checked against");

  // dist/ is the npm package's build output (it has an abis/ too), not a source repo.
  const repoDirs = readdirSync(ROOT)
    .filter((d) => {
      if (d === "dist" || d === "node_modules" || d.startsWith(".")) return false;
      const full = join(ROOT, d);
      return (
        existsSync(join(full, "skills")) ||
        existsSync(join(full, "abis")) ||
        existsSync(join(full, "address_config.json"))
      );
    })
    .sort();

  for (const repo of repoDirs) {
    const repoPath = join(ROOT, repo);
    const desc = REPO_DESCRIPTIONS[repo] || repo;
    lines.push("");
    lines.push(`${repo}/`.padEnd(33) + `# ${desc}`);

    // address_config.json
    if (existsSync(join(repoPath, "address_config.json"))) {
      lines.push("  address_config.json");
    }

    // abis/
    const abis = listDir(join(repoPath, "abis"), ".json");
    if (abis.length > 0) {
      const abiNames = abis.map((f) => basename(f, ".json")).join(", ");
      lines.push(`  abis/`.padEnd(33) + `# ${abiNames}`);
    }

    // typechain/
    const typechain = listDir(join(repoPath, "typechain"), ".ts");
    if (typechain.length > 0) {
      lines.push("  typechain/                     # TypeChain generated types");
    }

    // skills/
    const skills = listDir(join(repoPath, "skills"), ".md");
    if (skills.length > 0) {
      lines.push("  skills/");
      for (const skill of skills) {
        const desc = getSkillDescription(join(repoPath, "skills", skill));
        lines.push(`    ${skill}`.padEnd(33) + `# ${desc}`);
      }
    }
  }

  return lines.join("\n");
}

function buildNetworksTable(registry: Registry): string {
  const lines: string[] = [];
  lines.push("| Chain ID | Name | Slug | Native | Wrapped | USDC | V1 | V2 | Factoring | Pools (active / all) |");
  lines.push("|----------|------|------|--------|---------|------|----|----|-----------|----------------------|");

  for (const [chainId, network] of Object.entries(registry.networks)) {
    const v1 = network.contracts["bulla-contracts"] ? "yes" : "no";
    const v2 = network.contracts["bulla-contracts-v2"] ? "yes" : "no";
    const factoring = network.contracts["factoring-contracts"] ? "yes" : "no";
    const pools = registry.pools.filter((p) => p.chainId === network.chainId);
    const active = pools.filter((p) => p.category === "active").length;
    const poolCell = pools.length > 0 ? `${active} / ${pools.length}` : "-";
    const wrapped = network.wrappedNativeToken?.symbol ?? "-";
    const usdc = network.usdc?.symbol ?? "-";
    lines.push(`| ${chainId} | ${network.name} | ${network.slug} | ${network.nativeCurrency.symbol} | ${wrapped} | ${usdc} | ${v1} | ${v2} | ${factoring} | ${poolCell} |`);
  }

  return lines.join("\n");
}

function generateClaudeMd(registry: Registry): void {
  const templatePath = join(ROOT, "CLAUDE.md.template");
  if (!existsSync(templatePath)) {
    console.warn("Warning: CLAUDE.md.template not found, skipping CLAUDE.md generation");
    return;
  }

  const template = readFileSync(templatePath, "utf-8");
  const structure = buildRegistryStructure();
  const networksTable = buildNetworksTable(registry);

  const output = template
    .replace("{{REGISTRY_STRUCTURE}}", structure)
    .replace("{{NETWORKS_TABLE}}", networksTable);

  writeFileSync(join(ROOT, "CLAUDE.md"), output);
  console.log("CLAUDE.md generated from template");
}

consolidate();
