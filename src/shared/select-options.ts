import type { SecretFieldOption } from "./types";

/**
 * Candidate lists for fields whose value set is effectively fixed. Every list is
 * advisory: the editor lets users type a value that is not listed, so existing
 * free-text data keeps working without any migration.
 */

/**
 * Database engines. `value` is the URL scheme used to build a connection string,
 * so it must stay lowercase ASCII: `buildDatabaseConnectionString` normalises the
 * engine with `toLowerCase().replace(/[^a-z0-9+.-]/g, "")`, which would strip a
 * value such as `达梦` down to an empty string.
 */
export const DATABASE_ENGINE_OPTIONS: SecretFieldOption[] = [
  { label: "PostgreSQL", value: "postgresql" },
  { label: "MySQL", value: "mysql" },
  { label: "MariaDB", value: "mariadb" },
  { label: "SQL Server", value: "sqlserver" },
  { label: "Oracle", value: "oracle" },
  { label: "SQLite", value: "sqlite" },
  { label: "MongoDB", value: "mongodb" },
  { label: "Redis", value: "redis" },
  { label: "ClickHouse", value: "clickhouse" },
  { label: "TiDB", value: "tidb" },
  { label: "CockroachDB", value: "cockroachdb" },
  { label: "openGauss", value: "opengauss" },
  { label: "达梦 DM", value: "dm" },
  { label: "人大金仓 KingbaseES", value: "kingbase" },
];

export const PATH_STYLE_OPTIONS: SecretFieldOption[] = [
  { label: "virtual-hosted", value: "virtual-hosted" },
  { label: "path-style", value: "path-style" },
];

export const WEBHOOK_HEADER_OPTIONS: SecretFieldOption[] = [
  { label: "X-Signature", value: "X-Signature" },
  { label: "X-Signature-256", value: "X-Signature-256" },
  { label: "X-Hub-Signature", value: "X-Hub-Signature" },
  { label: "X-Hub-Signature-256", value: "X-Hub-Signature-256" },
  { label: "X-Webhook-Signature", value: "X-Webhook-Signature" },
  { label: "Stripe-Signature", value: "Stripe-Signature" },
  { label: "Authorization", value: "Authorization" },
];

/** Shared by object storage and cloud templates; label matches the stored code. */
export const REGION_OPTIONS: SecretFieldOption[] = [
  { label: "us-east-1", value: "us-east-1" },
  { label: "us-west-1", value: "us-west-1" },
  { label: "us-west-2", value: "us-west-2" },
  { label: "eu-west-1", value: "eu-west-1" },
  { label: "eu-central-1", value: "eu-central-1" },
  { label: "ap-southeast-1", value: "ap-southeast-1" },
  { label: "ap-northeast-1", value: "ap-northeast-1" },
  { label: "ap-south-1", value: "ap-south-1" },
  { label: "ap-east-1", value: "ap-east-1" },
  { label: "cn-hangzhou", value: "cn-hangzhou" },
  { label: "cn-beijing", value: "cn-beijing" },
  { label: "cn-shanghai", value: "cn-shanghai" },
  { label: "auto", value: "auto" },
];

export const WALLET_NETWORK_OPTIONS: SecretFieldOption[] = [
  { label: "Bitcoin", value: "Bitcoin" },
  { label: "Ethereum", value: "Ethereum" },
  { label: "BNB Chain", value: "BNB Chain" },
  { label: "Polygon", value: "Polygon" },
  { label: "Solana", value: "Solana" },
  { label: "Tron", value: "Tron" },
  { label: "Arbitrum", value: "Arbitrum" },
  { label: "Base", value: "Base" },
  { label: "Avalanche", value: "Avalanche" },
  { label: "Cosmos", value: "Cosmos" },
  { label: "Polkadot", value: "Polkadot" },
  { label: "MetaMask", value: "MetaMask" },
];

export const PROVIDER_OPTIONS: SecretFieldOption[] = [
  { label: "AWS", value: "AWS" },
  { label: "Cloudflare", value: "Cloudflare" },
  { label: "Google Cloud", value: "Google Cloud" },
  { label: "Azure", value: "Azure" },
  { label: "阿里云", value: "阿里云" },
  { label: "腾讯云", value: "腾讯云" },
  { label: "华为云", value: "华为云" },
  { label: "火山引擎", value: "火山引擎" },
  { label: "DigitalOcean", value: "DigitalOcean" },
  { label: "Vercel", value: "Vercel" },
  { label: "Netlify", value: "Netlify" },
  { label: "GitHub", value: "GitHub" },
  { label: "GitLab", value: "GitLab" },
  { label: "Stripe", value: "Stripe" },
  { label: "OpenAI", value: "OpenAI" },
  { label: "Anthropic", value: "Anthropic" },
  { label: "Slack", value: "Slack" },
  { label: "Twilio", value: "Twilio" },
  { label: "SendGrid", value: "SendGrid" },
  { label: "MongoDB Atlas", value: "MongoDB Atlas" },
  { label: "Supabase", value: "Supabase" },
  { label: "PlanetScale", value: "PlanetScale" },
  { label: "自建", value: "自建" },
];

export const CATEGORY_OPTIONS: SecretFieldOption[] = [
  { label: "云服务", value: "云服务" },
  { label: "数据库", value: "数据库" },
  { label: "开发工具", value: "开发工具" },
  { label: "代码托管", value: "代码托管" },
  { label: "对象存储", value: "对象存储" },
  { label: "CDN", value: "CDN" },
  { label: "DNS", value: "DNS" },
  { label: "支付", value: "支付" },
  { label: "邮件", value: "邮件" },
  { label: "短信", value: "短信" },
  { label: "监控告警", value: "监控告警" },
  { label: "AI 服务", value: "AI 服务" },
  { label: "内部系统", value: "内部系统" },
  { label: "域名", value: "域名" },
  { label: "证书", value: "证书" },
];
