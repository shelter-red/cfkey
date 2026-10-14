# CFKey

CFKey 是一个面向个人运维场景的密钥管理器，使用一个 Cloudflare Worker 和一个 D1 数据库运行。它支持大类 / 小类级联分类、类型专属服务商候选、前缀搜索、按需解密、复制、收藏和回收站。SSH、FTP/FTPS/SFTP、WebDAV、VPN、远程桌面、代理、邮件、TLS、Kubernetes 等文本配置可以上传已有文件，密码和签名密钥等字段可以在浏览器中生成新值；数据库连接串由表单字段自动拼接，也可粘贴已有连接串自动解析。对象存储模板覆盖 S3、R2、OSS 等常见访问密钥。

## 部署方式一：创建新仓库

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/shelter-red/cfkey)

Cloudflare 会复制公开仓库、创建 Worker 和 D1、执行迁移并完成部署。部署页面会要求填写以下 Worker 密钥：

- `ADMIN_PASSWORD`：管理员密码。
- `SESSION_SECRET`：会话签名密钥。
- `VAULT_MASTER_SECRET`：数据加密主密钥。

三个值不限制长度，建议使用高强度随机值，并离线备份主密钥。

`VAULT_MASTER_SECRET_PREVIOUS` 是可选的旧主密钥槽位。首次部署不要配置，也不要随意填写；它只在轮换 `VAULT_MASTER_SECRET` 时临时使用，用于解密仍由旧主密钥加密的记录。旧记录完成重新加密后应立即删除该密钥。

Deploy to Cloudflare 按钮会在 GitHub 账户中新建一份仓库，并自动创建 D1、替换 `wrangler.jsonc` 中的占位 ID。它不能覆盖或复用同名仓库。

仓库不包含生产域名、Cloudflare Account ID、真实数据库 ID、API 令牌或任何可用密钥。`wrangler.jsonc` 中的全零 D1 ID 只是供一键部署识别资源的无效占位符。默认部署使用当前 Cloudflare 账户的 `workers.dev` 地址。

> `VAULT_MASTER_SECRET` 丢失后，已保存内容无法恢复。不要将三个部署密钥设为相同值。

## 部署方式二：导入已有仓库

要直接部署已经存在的 `cfkey` 仓库：

1. 在 **Workers & Pages → Create → Import a repository** 中选择现有仓库。
2. 将 Build command 设置为 `npm run build`，Deploy command 设置为 `npm run deploy:import`，生产分支选择 `main`。
3. 在 Worker 的 **Settings → Variables & Secrets** 中添加 `ADMIN_PASSWORD`、`SESSION_SECRET` 和 `VAULT_MASTER_SECRET`，类型选择 **Secret（密钥）**。
4. 在 **Settings → Build** 中选择具备 Workers Scripts Edit 和 D1 Edit 权限的有效 API Token，然后运行或重试构建。

导入部署脚本会按名称自动复用 `cfkey-db`，首次不存在时自动创建，然后执行迁移并部署。它使用正式的 `wrangler.import.jsonc`，不会生成临时配置文件，也不会把真实 D1 ID 提交到 Git。首次部署不要添加 `VAULT_MASTER_SECRET_PREVIOUS`。

## 私有配置自定义域名

生产域名不写进仓库。完成一键部署后，在 Cloudflare Dashboard 中打开对应 Worker：

1. 进入 **Settings → Domains & Routes**。
2. 选择 **Add → Custom Domain**，在控制台中填写域名并完成绑定。
3. 确认自定义域名可访问后，按需要在同一页面关闭 `workers.dev` 入口。

域名绑定保存在 Cloudflare 项目配置中，不需要修改或提交 `wrangler.jsonc`。本地临时配置如 `wrangler.private.jsonc` 和 `wrangler.local.jsonc` 已加入 `.gitignore`。

## 强制 HTTPS

生产环境必须在域名对应的 Cloudflare Zone 中开启 **SSL/TLS → Edge Certificates → Always Use HTTPS**。Worker 的 API 也会对 HTTP 请求返回 308 跳转；页面入口会在挂载应用前跳转到 HTTPS。静态资源不经过 Worker，因此不会为 HTTPS 跳转增加额外 Worker 请求。

本地 Worker 开发使用 HTTPS：

```bash
npx wrangler dev --local-protocol https
```

## 助记词

恢复短语模板使用编号助记词输入：每个单词一个格子，粘贴整串短语会按空格拆分并依次填入，也可以用 Tab、空格、回车、方向键在格子间移动，退格回到上一格。编辑输入区不显示复制按钮，避免 Tab 焦点落在复制控件上；详情页默认隐藏整段助记词，点“显示”后才按编号列出，每个单词仍可单独复制。

长度和重复只做提示，不阻止保存：系统接受 12 / 15 / 18 / 21 / 24 等常见长度，遇到其他长度或重复单词时显示警告，但仍允许保存。

## 分类与服务商

新建和编辑时只选择一个级联分类字段：第一层包括云服务、服务器与网络、数据库、开发运维、邮件与消息、域名与网络、监控告警、账号与登录、加密资产和其他，第二层是具体类型。内部模板由第二层自动决定，不额外暴露“数据库类型”等重复表项。

服务商候选按当前小类生成，并允许输入自定义值。例如 PostgreSQL 只提供 PostgreSQL 相关数据库服务商，FTP 不会出现支付平台，镜像仓库也不会出现邮件服务商。数据库表格里的引擎由小类直接派生，粘贴连接串时会自动切换到匹配的数据库小类。

编辑已有密钥时可以切换到任意分类。若新旧分类使用不同的字段模板，保存前会先确认：名称、标签、收藏、备注和同名字段会保留，不兼容字段会丢弃，服务商会清空。确认后的记录会按新模板重新加密保存，旧记录不会被批量迁移。

列表和详情显示完整的“大类 / 小类”，筛选使用小类叶子。旧记录和旧备份中原有的自由文本分类会在写入时按内部类型补齐，不改变密文、模板或主密钥。

## 加密备份导出与导入

加密备份用于在实例之间迁移，或在主密钥丢失前离线保存一份副本。

- 导出的文件名形如 `cfkey-backup-YYYYMMDD-HHmmss.cfkey.json`，内容是 CFKey 自有封套（`format`、`version`、`kdf`、`cipher`、`iv`、`ciphertext`），不是明文。
- 备份口令只在浏览器输入，**不会上传**。浏览器用 PBKDF2-SHA256（随机盐、默认 250000 次迭代）派生出 32 字节密钥，只把这个派生密钥发送给 Worker；Worker 用 AES-256-GCM 完成加解密，解密后的明文始终留在 Worker 内，不回传浏览器。
- 导出范围是全部未删除的密钥，回收站中的记录不包含在内。
- 导入分两步：先选择文件，再输入口令。口令正确后会先预览条目数以及与现有记录的冲突数量，然后选择导入方式：
  - **合并新建**：所有条目都以新的 UUID 写入，绝不覆盖任何现有记录。
  - **覆盖还原**：与现有记录 id 相同的条目会被备份内容替换，其余条目按原 id 新建。
- 加密同时绑定固定 AAD 与格式版本，只有 CFKey 导出的备份能被导入；文件被改动、口令错误或版本不受支持都会在写入前被拒绝。

任意 CFKey 实例都可以用同一口令导入这份备份，口令丢失后备份无法恢复，请单独保存。

## Cloudflare 资源

运行时只使用以下资源：

- 1 个 Worker
- 1 个 D1 数据库
- Workers Static Assets

不使用 Durable Objects、KV、R2、Queues、Cron、Vectorize、Access、Turnstile 或 Analytics API。静态页面与资源不进入 Worker，只有 `/api/*` 请求执行 Worker 代码。

| 操作 | 动态请求 | D1 读取 | D1 写入 |
| --- | ---: | ---: | ---: |
| 加载静态页面 | 0 | 0 | 0 |
| 登录或会话检查 | 1 | 0 | 0 |
| 列表、搜索、筛选 | 1 | 最多 11 行 | 0 |
| 选择密钥并查看详情 | 1 | 1 行 | 0（主密钥轮换时可能重新加密 1 行） |
| 复制已显示字段 | 0 | 0 | 0 |
| 创建或编辑 | 1 | 0 | 1 条密钥记录（D1 同步维护必要索引） |
| 收藏、移入回收站或恢复 | 1 | 0 | 1 条密钥记录 |
| 导出加密备份 | 1 | 读取所有未删除记录 | 0（主密钥轮换时可能重新加密若干行） |
| 预览导入备份 | 1 | 查询备份中涉及的记录 id | 0 |
| 导入加密备份 | 1 | 覆盖模式会查询备份中涉及的记录 id | 合并模式每条 1 次写入，覆盖命中的记录改写、其余新建 |

应用没有轮询、WebSocket、定时任务或自动健康检查。列表使用每页 10 条的游标分页，不执行总数查询；回收站只在用户主动操作时变更。

## 本地开发

要求 Node.js 22+。

```bash
npm install
cp .dev.vars.example .dev.vars
npm run db:migrate:local
npm run build
npm run dev:worker
```

Vue 开发服务器仅用于前端样式开发：

```bash
npm run dev
```

## 持续部署

一键部署创建的仓库使用 Cloudflare Workers Builds 持续部署。导入已有仓库时，使用 Cloudflare 的导入构建配置和 `npm run deploy:import`，不需要额外的 GitHub Actions 部署工作流。

为减少外部脚本和额度消耗，请在 Cloudflare Dashboard 的 Web Analytics / Browser Insights 设置中关闭自动注入。仓库保持严格的本地脚本 CSP，不会为该 beacon 放宽白名单。

## 公开仓库安全

- `.dev.vars*`、`.env*`、私有 Wrangler 配置和常见私钥文件默认不会被 Git 收录。
- `.dev.vars.example` 只保留空变量名，不提供示例密码或示例主密钥。
- GitHub Actions 会在每次推送和 Pull Request 时使用 Gitleaks 扫描完整 Git 历史。
- 生产密钥只通过 Cloudflare Dashboard、`wrangler secret put` 或 GitHub Repository Secrets 配置。
- 提交前可运行 `git status --short --ignored`，确认本地配置显示为 ignored。

## 密钥轮换

更新 `ADMIN_PASSWORD` 时同步更新 `SESSION_SECRET`，以使旧会话失效。

轮换加密主密钥时：

1. 先保存当前 `VAULT_MASTER_SECRET` 的旧值，避免覆盖后无法恢复。
2. 在 Cloudflare Worker 密钥中将旧值临时配置为 `VAULT_MASTER_SECRET_PREVIOUS`。
3. 将新生成的随机值配置为 `VAULT_MASTER_SECRET` 并部署。
4. 正常打开或编辑旧密钥；系统检测到旧密钥后，会在后台使用新密钥重新加密该密钥。
5. 确认所有旧密钥均可访问并已重新加密后，删除 `VAULT_MASTER_SECRET_PREVIOUS`。

轮换期间不要交换新旧变量，也不要在旧记录迁移完成前删除 `VAULT_MASTER_SECRET_PREVIOUS`，否则旧记录将无法解密。

## 安全边界

- 部署密码直接保存在 Worker 密钥，不写入 D1。
- 敏感字段由 AES-256-GCM 加密，元数据只保存名称、内部模板、服务商、分类叶子和标签。
- 登录 Cookie 有效 12 小时；登录后选择密钥会直接解密并显示其中字段，不再要求二次输入密码。
- 复制使用当前页面已经读取的字段，不会再次请求 Worker；退出登录时会清除页面中的明文状态。
- 上传仅在浏览器中读取不超过 60KB 的文本内容并填入加密字段，不保存文件名或附件对象；单条加密内容最大 64KB。
- 备份口令只在浏览器内存中使用，仅有 PBKDF2 派生密钥发送到 Worker；导出内容不含任何明文或主密钥。
- 搜索仅支持名称和服务商前缀及分类筛选，以避免 D1 全表扫描和重复标签索引。

## 验证

```bash
npm run typecheck
npm test
npm run build
```

## License

MIT
