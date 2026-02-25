import { readFileSync, writeFileSync, existsSync, readdirSync } from "fs";
import { join, dirname, basename } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

// Source repos that provide contract addresses
const CONTRACT_SOURCES = ["bulla-contracts", "bulla-contracts-v2", "factoring-contracts"];

// Source repo that provides GraphQL endpoints
const GRAPHQL_SOURCE = "bulla-subgraph";

// Network name mapping by chainId
const NETWORK_NAMES: Record<string, string> = {
  "1": "Ethereum Mainnet",
  "10": "Optimism",
  "56": "BNB Chain",
  "100": "Gnosis Chain",
  "137": "Polygon",
  "151": "RedBelly",
  "8453": "Base",
  "42161": "Arbitrum",
  "42220": "Celo",
  "43114": "Avalanche",
  "11155111": "Sepolia",
};

interface ContractAddressConfig {
  repo: string;
  contracts: Record<string, Record<string, string>>;
}

interface GraphQLConfig {
  repo: string;
  endpoints: Record<string, string>;
}

interface NetworkEntry {
  name: string;
  chainId: number;
  graphql: string | null;
  contracts: Record<string, Record<string, string>>;
}

interface Registry {
  generatedAt: string;
  networks: Record<string, NetworkEntry>;
}

function loadJSON<T>(path: string): T | null {
  if (!existsSync(path)) {
    console.warn(`Warning: ${path} not found, skipping`);
    return null;
  }
  return JSON.parse(readFileSync(path, "utf-8")) as T;
}

function consolidate(): void {
  const registry: Registry = {
    generatedAt: new Date().toISOString(),
    networks: {},
  };

  // Initialize all known networks
  for (const [chainId, name] of Object.entries(NETWORK_NAMES)) {
    registry.networks[chainId] = {
      name,
      chainId: Number(chainId),
      graphql: null,
      contracts: {},
    };
  }

  // Load GraphQL endpoints
  const graphqlPath = join(ROOT, GRAPHQL_SOURCE, "address_config.json");
  const graphqlConfig = loadJSON<GraphQLConfig>(graphqlPath);
  if (graphqlConfig) {
    for (const [chainId, url] of Object.entries(graphqlConfig.endpoints)) {
      if (registry.networks[chainId]) {
        registry.networks[chainId].graphql = url;
      }
    }
  }

  // Load contract addresses from each source
  for (const source of CONTRACT_SOURCES) {
    const configPath = join(ROOT, source, "address_config.json");
    const config = loadJSON<ContractAddressConfig>(configPath);
    if (!config) continue;

    for (const [chainId, contracts] of Object.entries(config.contracts)) {
      if (!registry.networks[chainId]) {
        console.warn(
          `Warning: chainId ${chainId} from ${source} not in known networks, adding`
        );
        registry.networks[chainId] = {
          name: `Unknown (${chainId})`,
          chainId: Number(chainId),
          graphql: null,
          contracts: {},
        };
      }

      registry.networks[chainId].contracts[config.repo] = contracts;
    }
  }

  // Sort networks by chainId
  const sorted: Record<string, NetworkEntry> = {};
  const sortedKeys = Object.keys(registry.networks).sort(
    (a, b) => Number(a) - Number(b)
  );
  for (const key of sortedKeys) {
    sorted[key] = registry.networks[key];
  }
  registry.networks = sorted;

  // Write output
  const outputPath = join(ROOT, "registry.json");
  writeFileSync(outputPath, JSON.stringify(registry, null, 2) + "\n");
  console.log(`registry.json generated with ${sortedKeys.length} networks`);

  // Validate
  let issues = 0;
  for (const [chainId, network] of Object.entries(registry.networks)) {
    if (!network.graphql) {
      console.warn(`  Warning: no GraphQL endpoint for ${network.name} (${chainId})`);
      issues++;
    }
    if (Object.keys(network.contracts).length === 0) {
      console.warn(`  Warning: no contracts for ${network.name} (${chainId})`);
      issues++;
    }
  }

  if (issues > 0) {
    console.warn(`\n${issues} warnings found`);
  } else {
    console.log("All networks have GraphQL endpoints and contracts");
  }

  // Generate CLAUDE.md from template
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
  lines.push("registry.json                    # All addresses + GraphQL endpoints (generated)");

  const repoDirs = readdirSync(ROOT)
    .filter((d) => {
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
  lines.push("| Chain ID | Name | V1 | V2 | Factoring | Subgraph |");
  lines.push("|----------|------|----|----|-----------|----------|");

  for (const [chainId, network] of Object.entries(registry.networks)) {
    const v1 = network.contracts["bulla-contracts"] ? "yes" : "no";
    const v2 = network.contracts["bulla-contracts-v2"] ? "yes" : "no";
    const factoring = network.contracts["factoring-contracts"] ? "yes" : "no";
    const subgraph = network.graphql ? "yes" : "no";
    lines.push(`| ${chainId} | ${network.name} | ${v1} | ${v2} | ${factoring} | ${subgraph} |`);
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
