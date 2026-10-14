import type { SecretFieldOption } from "./types";

export type ClassificationLeaf = {
  id: string;
  label: string;
  templateId: string;
  databaseEngine?: string;
  fieldDefaults?: Record<string, string>;
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
    ],
  },
  {
    id: "server-network",
    label: "服务器与网络",
    leaves: [
      {
        id: "cloud.ssh",
        label: "SSH 主机",
        templateId: "ssh",
        providers: withDefaultProviders([
          option("OpenSSH"), option("AWS EC2", "AWS EC2"), option("阿里云 ECS", "阿里云 ECS"),
          option("腾讯云 CVM", "腾讯云 CVM"), option("华为云 ECS", "华为云 ECS"),
          option("DigitalOcean"), option("Synology"), option("QNAP"),
        ]),
      },
      {
        id: "server.ftp",
        label: "FTP",
        templateId: "ftp",
        fieldDefaults: { protocol: "FTP" },
        providers: withDefaultProviders([
          option("Synology"), option("QNAP"), option("TrueNAS"), option("FileZilla Server", "FileZilla Server"),
          option("ProFTPD"), option("vsftpd"), option("Pure-FTPd"), option("Serv-U"),
        ]),
      },
      {
        id: "server.ftps",
        label: "FTPS",
        templateId: "ftp",
        fieldDefaults: { protocol: "FTPS" },
        providers: withDefaultProviders([
          option("Synology"), option("QNAP"), option("TrueNAS"), option("FileZilla Server", "FileZilla Server"),
          option("ProFTPD"), option("vsftpd"), option("Pure-FTPd"),
        ]),
      },
      {
        id: "server.sftp",
        label: "SFTP",
        templateId: "ftp",
        fieldDefaults: { protocol: "SFTP" },
        providers: withDefaultProviders([
          option("OpenSSH"), option("Synology"), option("QNAP"), option("TrueNAS"),
          option("AWS Transfer Family", "AWS Transfer Family"), option("Azure Blob SFTP", "Azure Blob SFTP"),
        ]),
      },
      {
        id: "server.webdav",
        label: "WebDAV",
        templateId: "webdav",
        providers: withDefaultProviders([
          option("Nextcloud"), option("ownCloud"), option("Synology"), option("QNAP"),
          option("TrueNAS"), option("Apache mod_dav", "Apache mod_dav"), option("Nginx WebDAV", "Nginx WebDAV"),
          option("坚果云", "坚果云"),
        ]),
      },
      {
        id: "server.vpn",
        label: "VPN",
        templateId: "vpn",
        providers: withDefaultProviders([
          option("OpenVPN"), option("WireGuard"), option("Tailscale"), option("ZeroTier"),
          option("Cloudflare WARP", "Cloudflare WARP"), option("AWS Client VPN", "AWS Client VPN"),
          option("Azure VPN", "Azure VPN"), option("阿里云 VPN", "阿里云 VPN"), option("腾讯云 VPN", "腾讯云 VPN"),
        ]),
      },
      {
        id: "server.remote-desktop",
        label: "远程桌面",
        templateId: "remote-desktop",
        providers: withDefaultProviders([
          option("Windows RDP", "Windows RDP"), option("Apache Guacamole", "Apache Guacamole"),
          option("RustDesk"), option("AnyDesk"), option("TeamViewer"), option("VMware Horizon", "VMware Horizon"),
          option("Citrix"),
        ]),
      },
      {
        id: "server.proxy",
        label: "代理服务",
        templateId: "proxy",
        providers: withDefaultProviders([
          option("Squid"), option("Nginx"), option("HAProxy"), option("tinyproxy"),
          option("3proxy"), option("Clash"), option("Surge"),
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
    label: "开发运维",
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
      {
        id: "devops.ci-cd",
        label: "CI/CD 令牌",
        templateId: "api-key",
        providers: withDefaultProviders([
          option("GitHub Actions", "GitHub Actions"), option("GitLab CI", "GitLab CI"),
          option("Jenkins"), option("CircleCI"), option("Buildkite"), option("Drone"),
          option("Tekton"), option("Argo CD", "Argo CD"),
        ]),
      },
      {
        id: "devops.registry",
        label: "容器镜像仓库",
        templateId: "registry",
        providers: withDefaultProviders([
          option("Docker Hub", "Docker Hub"), option("GHCR"), option("GitLab Container Registry", "GitLab Container Registry"),
          option("Harbor"), option("AWS ECR", "AWS ECR"), option("Google Artifact Registry", "Google Artifact Registry"),
          option("Azure ACR", "Azure ACR"), option("阿里云 ACR", "阿里云 ACR"), option("腾讯云 TCR", "腾讯云 TCR"),
          option("Quay"), option("JFrog Artifactory", "JFrog Artifactory"),
        ]),
      },
      {
        id: "devops.package-repo",
        label: "软件包仓库",
        templateId: "registry",
        providers: withDefaultProviders([
          option("npm"), option("PyPI"), option("Maven Central", "Maven Central"),
          option("JFrog Artifactory", "JFrog Artifactory"), option("Sonatype Nexus", "Sonatype Nexus"),
          option("Verdaccio"), option("GitHub Packages", "GitHub Packages"), option("GitLab Package Registry", "GitLab Package Registry"),
        ]),
      },
    ],
  },
  {
    id: "mail-message",
    label: "邮件与消息",
    leaves: [
      {
        id: "mail.smtp",
        label: "SMTP 邮件发送",
        templateId: "mail",
        fieldDefaults: { protocol: "SMTP" },
        providers: withDefaultProviders([
          option("SendGrid"), option("Amazon SES", "Amazon SES"), option("Mailgun"),
          option("Postmark"), option("Resend"), option("SMTP2GO"), option("阿里云邮件推送", "阿里云邮件推送"),
          option("腾讯云 SES", "腾讯云 SES"),
        ]),
      },
      {
        id: "mail.imap",
        label: "IMAP 邮箱",
        templateId: "mail",
        fieldDefaults: { protocol: "IMAP" },
        providers: withDefaultProviders([
          option("Gmail"), option("Microsoft 365", "Microsoft 365"), option("Fastmail"),
          option("Zoho Mail", "Zoho Mail"), option("QQ 邮箱", "QQ 邮箱"), option("163 邮箱", "163 邮箱"),
          option("腾讯企业邮", "腾讯企业邮"), option("阿里云企业邮箱", "阿里云企业邮箱"),
        ]),
      },
      {
        id: "mail.pop3",
        label: "POP3 邮箱",
        templateId: "mail",
        fieldDefaults: { protocol: "POP3" },
        providers: withDefaultProviders([
          option("Gmail"), option("Microsoft 365", "Microsoft 365"), option("Zoho Mail", "Zoho Mail"),
          option("QQ 邮箱", "QQ 邮箱"), option("163 邮箱", "163 邮箱"), option("腾讯企业邮", "腾讯企业邮"),
        ]),
      },
      {
        id: "message.sms-push",
        label: "短信 / 消息推送",
        templateId: "api-key",
        providers: withDefaultProviders([
          option("Twilio"), option("Vonage"), option("阿里云短信", "阿里云短信"), option("腾讯云短信", "腾讯云短信"),
          option("Slack"), option("Discord"), option("Telegram"), option("Bark"), option("ntfy"),
        ]),
      },
    ],
  },
  {
    id: "domain-network",
    label: "域名与网络",
    leaves: [
      {
        id: "network.dns",
        label: "DNS API",
        templateId: "api-key",
        providers: withDefaultProviders([
          option("Cloudflare"), option("AWS Route 53", "AWS Route 53"), option("Google Cloud DNS", "Google Cloud DNS"),
          option("Azure DNS", "Azure DNS"), option("阿里云 DNS", "阿里云 DNS"), option("腾讯云 DNSPod", "腾讯云 DNSPod"),
          option("华为云 DNS", "华为云 DNS"), option("Namecheap"), option("GoDaddy"), option("Porkbun"),
        ]),
      },
      {
        id: "network.cdn-waf",
        label: "CDN / WAF",
        templateId: "api-key",
        providers: withDefaultProviders([
          option("Cloudflare"), option("Akamai"), option("Fastly"), option("Amazon CloudFront", "Amazon CloudFront"),
          option("Azure Front Door", "Azure Front Door"), option("阿里云 CDN", "阿里云 CDN"),
          option("腾讯云 EdgeOne", "腾讯云 EdgeOne"), option("华为云 CDN", "华为云 CDN"),
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
    id: "monitoring",
    label: "监控告警",
    leaves: [
      {
        id: "monitoring.platform",
        label: "监控 / 日志平台",
        templateId: "api-key",
        providers: withDefaultProviders([
          option("Datadog"), option("Grafana"), option("Prometheus"), option("Zabbix"),
          option("Sentry"), option("New Relic", "New Relic"), option("Uptime Kuma", "Uptime Kuma"),
          option("Better Stack", "Better Stack"),
        ]),
      },
      {
        id: "monitoring.alert-webhook",
        label: "告警 Webhook",
        templateId: "webhook",
        providers: withDefaultProviders([
          option("PagerDuty"), option("Opsgenie"), option("Slack"), option("Discord"),
          option("Telegram"), option("钉钉"), option("飞书"), option("企业微信"),
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
  ftp: "server.ftp",
  webdav: "server.webdav",
  vpn: "server.vpn",
  "remote-desktop": "server.remote-desktop",
  proxy: "server.proxy",
  mail: "mail.smtp",
  registry: "devops.registry",
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

export function fieldDefaultsForCategory(category: string): Record<string, string> {
  return CLASSIFICATION_LEAF_BY_ID.get(category)?.fieldDefaults ?? {};
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
