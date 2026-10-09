import type { SecretTemplate } from "./types";

export const SECRET_TEMPLATES: SecretTemplate[] = [
  {
    id: "api-key",
    name: "API 密钥",
    description: "接口令牌、访问密钥和 API 地址",
    fields: [
      { id: "keyId", label: "密钥 ID", kind: "text", copyable: true },
      { id: "secret", label: "密钥或令牌", kind: "password", required: true, sensitive: true, copyable: true },
      { id: "endpoint", label: "API 地址", kind: "url", copyable: true },
      { id: "scopes", label: "权限范围", kind: "text" },
    ],
  },
  {
    id: "login",
    name: "账号密码",
    description: "网站、控制台或内部系统登录信息",
    fields: [
      { id: "username", label: "用户名", kind: "text", required: true, sensitive: true, copyable: true },
      { id: "password", label: "密码", kind: "password", required: true, sensitive: true, copyable: true, generate: "random" },
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
      { id: "password", label: "密码", kind: "password", sensitive: true, copyable: true, generate: "random" },
      { id: "connectionString", label: "连接字符串", kind: "textarea", sensitive: true, copyable: true, placeholder: "粘贴已有连接串会自动拆分到上方字段" },
    ],
  },
  {
    id: "object-storage",
    name: "对象存储",
    description: "S3、R2、OSS 等对象存储访问密钥",
    fields: [
      { id: "endpoint", label: "端点（Endpoint）", kind: "url", required: true, copyable: true },
      { id: "bucket", label: "存储桶（Bucket）", kind: "text", required: true, copyable: true },
      { id: "region", label: "区域", kind: "text", copyable: true },
      { id: "accessKeyId", label: "访问密钥 ID", kind: "text", required: true, sensitive: true, copyable: true },
      { id: "secretAccessKey", label: "访问密钥", kind: "password", required: true, sensitive: true, copyable: true },
      { id: "sessionToken", label: "会话令牌", kind: "textarea", sensitive: true, copyable: true },
      { id: "pathStyle", label: "寻址方式", kind: "text", placeholder: "virtual-hosted 或 path-style" },
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
      { id: "privateKey", label: "私钥", kind: "textarea", required: true, sensitive: true, copyable: true, uploadAccept: ".pem,.key,.ppk,text/plain" },
      { id: "passphrase", label: "私钥口令", kind: "password", sensitive: true, copyable: true, generate: "random" },
      { id: "publicKey", label: "公钥", kind: "textarea", copyable: true, uploadAccept: ".pub,.pem,text/plain" },
      { id: "fingerprint", label: "指纹", kind: "text", copyable: true },
    ],
  },
  {
    id: "tls",
    name: "TLS 证书",
    description: "证书、私钥和证书链",
    fields: [
      { id: "certificate", label: "证书", kind: "textarea", required: true, sensitive: true, copyable: true, uploadAccept: ".pem,.crt,.cer,text/plain,application/x-pem-file" },
      { id: "privateKey", label: "私钥", kind: "textarea", required: true, sensitive: true, copyable: true, uploadAccept: ".pem,.key,text/plain,application/x-pem-file" },
      { id: "chain", label: "证书链", kind: "textarea", sensitive: true, copyable: true, uploadAccept: ".pem,.crt,.cer,text/plain,application/x-pem-file" },
      { id: "passphrase", label: "私钥口令", kind: "password", sensitive: true, copyable: true, generate: "random" },
      { id: "expiresAt", label: "到期时间", kind: "text" },
    ],
  },
  {
    id: "cloud",
    name: "云平台密钥",
    description: "云平台访问密钥、租户和区域",
    fields: [
      { id: "account", label: "账号或租户", kind: "text", sensitive: true, copyable: true },
      { id: "accessKeyId", label: "访问密钥 ID", kind: "text", required: true, sensitive: true, copyable: true },
      { id: "secretAccessKey", label: "访问密钥", kind: "password", required: true, sensitive: true, copyable: true },
      { id: "sessionToken", label: "会话令牌", kind: "textarea", sensitive: true, copyable: true },
      { id: "region", label: "区域", kind: "text" },
      { id: "project", label: "项目", kind: "text" },
    ],
  },
  {
    id: "oauth",
    name: "OAuth 客户端",
    description: "OAuth 客户端 ID、客户端密钥和地址",
    fields: [
      { id: "clientId", label: "客户端 ID（Client ID）", kind: "text", required: true, sensitive: true, copyable: true },
      { id: "clientSecret", label: "客户端密钥", kind: "password", required: true, sensitive: true, copyable: true },
      { id: "authorizationUrl", label: "授权地址", kind: "url", copyable: true },
      { id: "tokenUrl", label: "令牌地址", kind: "url", copyable: true },
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
      { id: "signingSecret", label: "签名密钥", kind: "password", required: true, sensitive: true, copyable: true, generate: "random" },
      { id: "headerName", label: "签名请求头", kind: "text" },
    ],
  },
  {
    id: "kubernetes",
    name: "Kubernetes",
    description: "集群地址、服务账号和 kubeconfig 配置",
    fields: [
      { id: "cluster", label: "集群名称", kind: "text", required: true },
      { id: "server", label: "API 服务地址（API Server）", kind: "url", sensitive: true, copyable: true },
      { id: "namespace", label: "命名空间（Namespace）", kind: "text" },
      { id: "serviceAccountToken", label: "服务账号令牌", kind: "textarea", sensitive: true, copyable: true, uploadAccept: ".token,.txt,text/plain" },
      { id: "kubeconfig", label: "kubeconfig", kind: "textarea", sensitive: true, copyable: true, uploadAccept: ".yaml,.yml,.config,text/yaml,application/yaml,text/plain" },
    ],
  },
  {
    id: "recovery-phrase",
    name: "助记词",
    description: "恢复短语与附加口令",
    fields: [
      { id: "phrase", label: "助记词或恢复短语", kind: "textarea", required: true, sensitive: true, copyable: true },
      { id: "passphrase", label: "附加口令", kind: "password", sensitive: true, copyable: true },
      { id: "network", label: "网络或钱包", kind: "text" },
    ],
  },
  {
    id: "generic",
    name: "通用密钥",
    description: "不属于其他模板的密钥值",
    fields: [
      { id: "identifier", label: "标识", kind: "text", copyable: true },
      { id: "secret", label: "密钥值", kind: "textarea", required: true, sensitive: true, copyable: true, generate: "random", uploadAccept: ".txt,.json,.pem,.key,text/plain,application/json" },
    ],
  },
];

export const TEMPLATE_BY_ID = new Map(SECRET_TEMPLATES.map((template) => [template.id, template]));
