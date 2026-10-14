import type { SecretFieldOption } from "./types";

export type ClassificationLeaf = {
  id: string;
  label: string;
  templateId: string;
  databaseEngine?: string;
  providers: SecretFieldOption[];
};

export type ClassificationGroup = {
  id: string;
  label: string;
  leaves: ClassificationLeaf[];
};

export type ClassificationCascaderOption = {
  label: string;
  value: string;
  children?: ClassificationCascaderOption[];
};

const DEFAULT_PROVIDERS: SecretFieldOption[] = [
  { label: "自建", value: "自建" },
  { label: "通用", value: "通用" },
  { label: "其他", value: "其他" },
];

function option(label: string, value = label): SecretFieldOption {
  return { label, value };
}

function withDefaultProviders(providers: SecretFieldOption[]): SecretFieldOption[] {
  const seen = new Set(providers.map((provider) => provider.value));
  return [
    ...providers,
    ...DEFAULT_PROVIDERS.filter((provider) => !seen.has(provider.value)),
  ];
}

type DatabaseProviderDefinition = {
  label: string;
  engines: string[];
};

const ALL_DATABASE_ENGINES = [
  "postgresql", "mysql", "mariadb", "sqlserver", "oracle", "sqlite", "mongodb",
  "redis", "clickhouse", "tidb", "cockroachdb", "opengauss", "dm", "kingbase",
];

const DATABASE_PROVIDER_DEFINITIONS: DatabaseProviderDefinition[] = [
  { label: "自建", engines: ALL_DATABASE_ENGINES },
  { label: "AWS RDS", engines: ["postgresql", "mysql", "mariadb", "sqlserver", "oracle"] },
  { label: "Amazon Aurora", engines: ["postgresql", "mysql"] },
  { label: "Amazon ElastiCache", engines: ["redis"] },
  { label: "Azure Database", engines: ["postgresql", "mysql", "mariadb", "sqlserver"] },
  { label: "Azure SQL Database", engines: ["sqlserver"] },
  { label: "Azure Cache for Redis", engines: ["redis"] },
  { label: "Google Cloud SQL", engines: ["postgresql", "mysql", "sqlserver"] },
  { label: "Google AlloyDB", engines: ["postgresql"] },
  { label: "阿里云 RDS", engines: ["postgresql", "mysql", "mariadb", "sqlserver"] },
  { label: "阿里云 PolarDB", engines: ["postgresql", "mysql"] },
  { label: "腾讯云数据库", engines: ["postgresql", "mysql", "mariadb", "sqlserver"] },
  { label: "华为云 RDS", engines: ["postgresql", "mysql", "mariadb", "sqlserver"] },
  { label: "Supabase", engines: ["postgresql"] },
  { label: "Neon", engines: ["postgresql"] },
  { label: "PlanetScale", engines: ["mysql"] },
  { label: "MongoDB Atlas", engines: ["mongodb"] },
  { label: "Redis Cloud", engines: ["redis"] },
  { label: "ClickHouse Cloud", engines: ["clickhouse"] },
  { label: "TiDB Cloud", engines: ["tidb"] },
  { label: "CockroachDB Cloud", engines: ["cockroachdb"] },
  { label: "Oracle Autonomous Database", engines: ["oracle"] },
  { label: "SQLite", engines: ["sqlite"] },
  { label: "openGauss", engines: ["opengauss"] },
  { label: "达梦数据库", engines: ["dm"] },
  { label: "人大金仓", engines: ["kingbase"] },
];

function databaseProviders(engine: string): SecretFieldOption[] {
  const relevant = DATABASE_PROVIDER_DEFINITIONS
    .filter((provider) => provider.engines.includes(engine))
    .map((provider) => option(provider.label));
  return withDefaultProviders(relevant);
}

function databaseLeaf(id: string, label: string, engine: string): ClassificationLeaf {
  return {
    id,
    label,
    templateId: "database",
    databaseEngine: engine,
    providers: databaseProviders(engine),
  };
}

export const CLASSIFICATION_TREE: ClassificationGroup[] = [
  {
    id: "cloud",
    label: "云服务",
    leaves: [
      {
        id: "cloud.cloud-platform",
        label: "云平台密钥",
        templateId: "cloud",
        providers: withDefaultProviders([
          option("AWS"), option("Cloudflare"), option("Google Cloud"), option("Azure"),
          option("阿里云"), option("腾讯云"), option("华为云"), option("火山引擎"),
          option("DigitalOcean"),
        ]),
      },
      {
        id: "cloud.object-storage",
        label: "对象存储",
        templateId: "object-storage",
        providers: withDefaultProviders([
          option("AWS S3", "AWS S3"), option("Cloudflare R2", "Cloudflare R2"),
          option("Google Cloud Storage", "Google Cloud Storage"), option("Azure Blob Storage", "Azure Blob Storage"),
          option("阿里云 OSS", "阿里云 OSS"), option("腾讯云 COS", "腾讯云 COS"),
          option("华为云 OBS", "华为云 OBS"), option("火山引擎 TOS", "火山引擎 TOS"),
          option("MinIO"), option("Backblaze B2", "Backblaze B2"),
          option("DigitalOcean Spaces", "DigitalOcean Spaces"),
        ]),
      },
      {
        id: "cloud.ssh",
        label: "SSH 主机",
        templateId: "ssh",
        providers: withDefaultProviders([
          option("AWS EC2", "AWS EC2"), option("阿里云 ECS", "阿里云 ECS"),
          option("腾讯云 CVM", "腾讯云 CVM"), option("华为云 ECS", "华为云 ECS"),
          option("DigitalOcean"),
        ]),
      },
      {
        id: "cloud.kubernetes",
        label: "Kubernetes",
        templateId: "kubernetes",
        providers: withDefaultProviders([
          option("Amazon EKS", "Amazon EKS"), option("Google GKE", "Google GKE"),
          option("Azure AKS", "Azure AKS"), option("阿里云 ACK", "阿里云 ACK"),
          option("腾讯云 TKE", "腾讯云 TKE"), option("华为云 CCE", "华为云 CCE"),
          option("DigitalOcean Kubernetes", "DigitalOcean Kubernetes"),
        ]),
      },
      {
        id: "cloud.tls",
        label: "TLS 证书",
        templateId: "tls",
        providers: withDefaultProviders([
          option("Let's Encrypt", "Let's Encrypt"), option("DigiCert"), option("GlobalSign"),
          option("Sectigo"), option("ZeroSSL"), option("Cloudflare"),
          option("阿里云"), option("腾讯云"), option("华为云"),
        ]),
      },
    ],
  },
  {
    id: "database",
    label: "数据库",
    leaves: [
      databaseLeaf("database.postgresql", "PostgreSQL", "postgresql"),
      databaseLeaf("database.mysql", "MySQL", "mysql"),
      databaseLeaf("database.mariadb", "MariaDB", "mariadb"),
      databaseLeaf("database.sqlserver", "SQL Server", "sqlserver"),
      databaseLeaf("database.oracle", "Oracle", "oracle"),
      databaseLeaf("database.sqlite", "SQLite", "sqlite"),
      databaseLeaf("database.mongodb", "MongoDB", "mongodb"),
      databaseLeaf("database.redis", "Redis", "redis"),
      databaseLeaf("database.clickhouse", "ClickHouse", "clickhouse"),
      databaseLeaf("database.tidb", "TiDB", "tidb"),
      databaseLeaf("database.cockroachdb", "CockroachDB", "cockroachdb"),
      databaseLeaf("database.opengauss", "openGauss", "opengauss"),
      databaseLeaf("database.dm", "达梦 DM", "dm"),
      databaseLeaf("database.kingbase", "KingbaseES", "kingbase"),
      { id: "database.legacy", label: "旧数据库记录", templateId: "database", providers: DEFAULT_PROVIDERS },
    ],
  },
  {
    id: "development",
    label: "开发工具",
    leaves: [
      {
        id: "development.api-key",
        label: "API 密钥",
        templateId: "api-key",
        providers: withDefaultProviders([
          option("OpenAI"), option("Anthropic"), option("Google AI", "Google AI"),
          option("Azure OpenAI", "Azure OpenAI"), option("Cloudflare"), option("GitHub"),
          option("GitLab"), option("Stripe"), option("Slack"), option("Twilio"), option("SendGrid"),
        ]),
      },
      {
        id: "development.oauth",
        label: "OAuth 客户端",
        templateId: "oauth",
        providers: withDefaultProviders([
          option("GitHub"), option("GitLab"), option("Google"), option("Microsoft"),
          option("Apple"), option("Auth0"), option("Okta"), option("Keycloak"),
        ]),
      },
      {
        id: "development.webhook",
        label: "Webhook",
        templateId: "webhook",
        providers: withDefaultProviders([
          option("Stripe"), option("GitHub"), option("GitLab"), option("Slack"),
          option("Twilio"), option("SendGrid"),
        ]),
      },
    ],
  },
  {
    id: "account",
    label: "账号与登录",
    leaves: [
      {
        id: "account.login",
        label: "账号密码",
        templateId: "login",
        providers: withDefaultProviders([
          option("GitHub"), option("GitLab"), option("Google Workspace", "Google Workspace"),
          option("Microsoft 365", "Microsoft 365"), option("AWS"), option("Cloudflare"),
          option("阿里云"), option("腾讯云"),
        ]),
      },
    ],
  },
  {
    id: "crypto",
    label: "加密资产",
    leaves: [
      {
        id: "crypto.recovery-phrase",
        label: "助记词",
        templateId: "recovery-phrase",
        providers: withDefaultProviders([
          option("MetaMask"), option("Ledger"), option("Trezor"), option("Trust Wallet", "Trust Wallet"),
          option("Coinbase Wallet", "Coinbase Wallet"), option("Phantom"), option("Keplr"),
        ]),
      },
    ],
  },
  {
    id: "other",
    label: "其他",
    leaves: [
      {
        id: "other.generic",
        label: "通用密钥",
        templateId: "generic",
        providers: DEFAULT_PROVIDERS,
      },
    ],
  },
];

export const CLASSIFICATION_LEAVES: ClassificationLeaf[] = CLASSIFICATION_TREE.flatMap((group) => group.leaves);

export const CLASSIFICATION_LEAF_BY_ID = new Map(CLASSIFICATION_LEAVES.map((leaf) => [leaf.id, leaf]));

const DEFAULT_CATEGORY_BY_TYPE: Record<string, string> = {
  "api-key": "development.api-key",
  login: "account.login",
  database: "database.legacy",
  "object-storage": "cloud.object-storage",
  ssh: "cloud.ssh",
  tls: "cloud.tls",
  cloud: "cloud.cloud-platform",
  oauth: "development.oauth",
  webhook: "development.webhook",
  kubernetes: "cloud.kubernetes",
  "recovery-phrase": "crypto.recovery-phrase",
  generic: "other.generic",
};

export function defaultCategoryForType(type: string): string {
  return DEFAULT_CATEGORY_BY_TYPE[type] ?? "other.generic";
}

export function classificationLeafForType(type: string): ClassificationLeaf | undefined {
  return CLASSIFICATION_LEAF_BY_ID.get(defaultCategoryForType(type));
}

export function isClassificationLeaf(category: string): boolean {
  return CLASSIFICATION_LEAF_BY_ID.has(category);
}

export function isCategoryForTemplate(category: string, templateId: string): boolean {
  return CLASSIFICATION_LEAF_BY_ID.get(category)?.templateId === templateId;
}

export function resolveStoredCategory(category: unknown, type: string): string {
  const normalized = typeof category === "string"
    ? category.trim().normalize("NFKC").slice(0, 80)
    : "";
  if (normalized && isCategoryForTemplate(normalized, type)) return normalized;
  return defaultCategoryForType(type);
}

export function categoryLeaf(category: unknown, type: string): ClassificationLeaf {
  const resolved = resolveStoredCategory(category, type);
  return CLASSIFICATION_LEAF_BY_ID.get(resolved) ?? classificationLeafForType(type)!;
}

export function categoryPath(category: unknown, type: string): string {
  const leaf = categoryLeaf(category, type);
  const group = CLASSIFICATION_TREE.find((candidate) => candidate.leaves.includes(leaf));
  return group ? `${group.label} / ${leaf.label}` : leaf.label;
}

export function providerOptionsForCategory(category: string): SecretFieldOption[] {
  return CLASSIFICATION_LEAF_BY_ID.get(category)?.providers ?? DEFAULT_PROVIDERS;
}

export function databaseEngineForCategory(category: string): string | undefined {
  return CLASSIFICATION_LEAF_BY_ID.get(category)?.databaseEngine;
}

export function databaseCategoryForEngine(engine: string): string | undefined {
  const normalized = engine.trim().toLowerCase().replace(/[^a-z0-9+.-]/g, "");
  const aliases: Record<string, string> = {
    postgres: "postgresql",
    postgresql: "postgresql",
    mysql: "mysql",
    mariadb: "mariadb",
    sqlserver: "sqlserver",
    mssql: "sqlserver",
    oracle: "oracle",
    sqlite: "sqlite",
    mongodb: "mongodb",
    redis: "redis",
    clickhouse: "clickhouse",
    tidb: "tidb",
    cockroachdb: "cockroachdb",
    opengauss: "opengauss",
    dm: "dm",
    kingbase: "kingbase",
  };
  const target = aliases[normalized];
  if (!target) return undefined;
  return CLASSIFICATION_LEAVES.find((leaf) => leaf.databaseEngine === target)?.id;
}

export function createClassificationOptions(
  templateId?: string,
  includeLegacyDatabase = false,
): ClassificationCascaderOption[] {
  return CLASSIFICATION_TREE.flatMap((group) => {
    const leaves = group.leaves.filter((leaf) =>
      (!templateId || leaf.templateId === templateId)
      && (includeLegacyDatabase || leaf.id !== "database.legacy"),
    );
    if (leaves.length === 0) return [];
    return [{
      label: group.label,
      value: group.id,
      children: leaves.map((leaf) => ({ label: leaf.label, value: leaf.id })),
    }];
  });
}

export const CLASSIFICATION_FILTER_OPTIONS = CLASSIFICATION_TREE.flatMap((group) =>
  group.leaves.map((leaf) => ({ label: `${group.label} / ${leaf.label}`, value: leaf.id })),
);
