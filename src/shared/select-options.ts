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

export const FILE_TRANSFER_PROTOCOL_OPTIONS: SecretFieldOption[] = [
  { label: "FTP", value: "FTP" },
  { label: "FTPS", value: "FTPS" },
  { label: "SFTP", value: "SFTP" },
];

export const FTP_MODE_OPTIONS: SecretFieldOption[] = [
  { label: "被动模式", value: "passive" },
  { label: "主动模式", value: "active" },
];

export const VPN_PROTOCOL_OPTIONS: SecretFieldOption[] = [
  { label: "OpenVPN", value: "OpenVPN" },
  { label: "WireGuard", value: "WireGuard" },
  { label: "IKEv2", value: "IKEv2" },
  { label: "L2TP/IPSec", value: "L2TP/IPSec" },
  { label: "SSTP", value: "SSTP" },
  { label: "Tailscale", value: "Tailscale" },
  { label: "ZeroTier", value: "ZeroTier" },
  { label: "其他", value: "其他" },
];

export const REMOTE_DESKTOP_PROTOCOL_OPTIONS: SecretFieldOption[] = [
  { label: "RDP", value: "RDP" },
  { label: "VNC", value: "VNC" },
  { label: "SSH X11", value: "SSH X11" },
  { label: "其他", value: "其他" },
];

export const PROXY_PROTOCOL_OPTIONS: SecretFieldOption[] = [
  { label: "HTTP", value: "HTTP" },
  { label: "HTTPS", value: "HTTPS" },
  { label: "SOCKS5", value: "SOCKS5" },
  { label: "其他", value: "其他" },
];

export const MAIL_PROTOCOL_OPTIONS: SecretFieldOption[] = [
  { label: "SMTP", value: "SMTP" },
  { label: "IMAP", value: "IMAP" },
  { label: "POP3", value: "POP3" },
];

export const MAIL_ENCRYPTION_OPTIONS: SecretFieldOption[] = [
  { label: "STARTTLS", value: "STARTTLS" },
  { label: "SSL/TLS", value: "SSL/TLS" },
  { label: "无加密", value: "none" },
  { label: "其他", value: "其他" },
];
