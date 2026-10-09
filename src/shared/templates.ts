import type { SecretTemplate } from "./types";

export const SECRET_TEMPLATES: SecretTemplate[] = [
  {
    id: "api-key",
    name: "API Key",
    description: "接口令牌、访问密钥与服务端点",
    fields: [
      { id: "keyId", label: "Key ID", kind: "text", copyable: true },
      { id: "secret", label: "Secret / Token", kind: "password", required: true, sensitive: true, copyable: true },
      { id: "endpoint", label: "API 地址", kind: "url", copyable: true },
      { id: "scopes", label: "权限范围", kind: "text" },
    ],
  },
  {
    id: "login",
    name: "账号密码",
    description: "网站、控制台或内部系统登录凭据",
    fields: [
      { id: "username", label: "用户名", kind: "text", required: true, sensitive: true, copyable: true },
      { id: "password", label: "密码", kind: "password", required: true, sensitive: true, copyable: true },
      { id: "url", label: "登录地址", kind: "url", copyable: true },
    ],
  },
  {
    id: "database",
    name: "数据库",
    description: "数据库连接地址、账号和密码",
    fields: [
      { id: "engine", label: "数据库类型", kind: "text", required: true },
      { id: "host", label: "主机", kind: "text", required: true, sensitive: true, copyable: true },
      { id: "port", label: "端口", kind: "number", copyable: true },
      { id: "database", label: "数据库名", kind: "text", copyable: true },
      { id: "username", label: "用户名", kind: "text", sensitive: true, copyable: true },
      { id: "password", label: "密码", kind: "password", sensitive: true, copyable: true },
      { id: "connectionString", label: "连接字符串", kind: "textarea", sensitive: true, copyable: true },
    ],
  },
  {
    id: "ssh",
    name: "SSH",
    description: "SSH 主机、私钥与口令",
    fields: [
      { id: "host", label: "主机", kind: "text", required: true, copyable: true },
      { id: "port", label: "端口", kind: "number", copyable: true },
      { id: "username", label: "用户名", kind: "text", copyable: true },
      { id: "privateKey", label: "私钥", kind: "textarea", required: true, sensitive: true, copyable: true },
      { id: "passphrase", label: "私钥口令", kind: "password", sensitive: true, copyable: true },
      { id: "publicKey", label: "公钥", kind: "textarea", copyable: true },
      { id: "fingerprint", label: "指纹", kind: "text", copyable: true },
    ],
  },
  {
    id: "tls",
    name: "TLS 证书",
    description: "证书、私钥和证书链",
    fields: [
      { id: "certificate", label: "证书", kind: "textarea", required: true, sensitive: true, copyable: true },
      { id: "privateKey", label: "私钥", kind: "textarea", required: true, sensitive: true, copyable: true },
      { id: "chain", label: "证书链", kind: "textarea", sensitive: true, copyable: true },
      { id: "passphrase", label: "私钥口令", kind: "password", sensitive: true, copyable: true },
      { id: "expiresAt", label: "到期时间", kind: "text" },
    ],
  },
  {
    id: "cloud",
    name: "云平台凭据",
    description: "云平台访问密钥、租户和区域",
    fields: [
      { id: "account", label: "账号 / 租户", kind: "text", sensitive: true, copyable: true },
      { id: "accessKeyId", label: "Access Key ID", kind: "text", required: true, sensitive: true, copyable: true },
      { id: "secretAccessKey", label: "Secret Access Key", kind: "password", required: true, sensitive: true, copyable: true },
      { id: "sessionToken", label: "Session Token", kind: "textarea", sensitive: true, copyable: true },
      { id: "region", label: "区域", kind: "text" },
      { id: "project", label: "项目", kind: "text" },
    ],
  },
  {
    id: "oauth",
    name: "OAuth Client",
    description: "OAuth 客户端 ID、Secret 和端点",
    fields: [
      { id: "clientId", label: "Client ID", kind: "text", required: true, sensitive: true, copyable: true },
      { id: "clientSecret", label: "Client Secret", kind: "password", required: true, sensitive: true, copyable: true },
      { id: "authorizationUrl", label: "授权地址", kind: "url", copyable: true },
      { id: "tokenUrl", label: "Token 地址", kind: "url", copyable: true },
      { id: "scopes", label: "权限范围", kind: "text" },
      { id: "redirectUris", label: "回调地址", kind: "textarea" },
    ],
  },
  {
    id: "webhook",
    name: "Webhook",
    description: "Webhook 地址和签名密钥",
    fields: [
      { id: "url", label: "Webhook 地址", kind: "url", required: true, sensitive: true, copyable: true },
      { id: "signingSecret", label: "签名密钥", kind: "password", required: true, sensitive: true, copyable: true },
      { id: "headerName", label: "签名请求头", kind: "text" },
    ],
  },
  {
    id: "kubernetes",
    name: "Kubernetes",
    description: "集群端点、Service Account 和 kubeconfig",
    fields: [
      { id: "cluster", label: "集群名称", kind: "text", required: true },
      { id: "server", label: "API Server", kind: "url", sensitive: true, copyable: true },
      { id: "namespace", label: "Namespace", kind: "text" },
      { id: "serviceAccountToken", label: "Service Account Token", kind: "textarea", sensitive: true, copyable: true },
      { id: "kubeconfig", label: "kubeconfig", kind: "textarea", sensitive: true, copyable: true },
    ],
  },
  {
    id: "recovery-phrase",
    name: "助记词",
    description: "恢复短语与附加口令",
    strict: true,
    fields: [
      { id: "phrase", label: "助记词 / 恢复短语", kind: "textarea", required: true, sensitive: true, copyable: true },
      { id: "passphrase", label: "附加口令", kind: "password", sensitive: true, copyable: true },
      { id: "network", label: "网络 / 钱包", kind: "text" },
    ],
  },
  {
    id: "generic",
    name: "通用密钥",
    description: "不属于其他模板的秘密值",
    fields: [
      { id: "identifier", label: "标识", kind: "text", copyable: true },
      { id: "secret", label: "秘密值", kind: "textarea", required: true, sensitive: true, copyable: true },
    ],
  },
];

export const TEMPLATE_BY_ID = new Map(SECRET_TEMPLATES.map((template) => [template.id, template]));
