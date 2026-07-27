# JONTOP · 地平线月报

蓝白主题的报纸网站：每日新闻、记者展廊、匿名情报酒馆，以及全站 tomato coin 弹幕。

技术栈：**Vite + React + TypeScript**（前端）/ **Node.js + Express**（后端）/ JSON 文件存储。

---

## 启动

```bash
# 需要 Node.js 18+
npm run setup          # 安装根目录 + server + client 依赖
npm run dev            # 同时启动 API(4000) 与前端(5173)
```

单独启动：

```bash
npm run dev:server     # http://localhost:4000
npm run dev:client     # http://localhost:5173 （/api 与 /files 已代理到后端）
```

重置演示数据：

```bash
npm run reset          # 覆盖写入种子内容
```

打开：**http://localhost:5173**

---

## 三种视角

| 视角 | 入口 | 说明 |
|------|------|------|
| 读者 / 交易者 | `/` | 新闻、记者、酒馆、番茄弹幕、钱包 |
| 管理员 | `/admin`（需 admin 账号） | 刊发、记者、用户、标签、番茄治理、举报仲裁 |
| Ghost（hacker） | `/ghost` | 无痕查看任意数据，含酒馆匿名身份与付费正文 |

### 演示账号

| 用户名 | 密码 | 角色 |
|--------|------|------|
| `admin` | `admin123456` | 总编 / 管理台 |
| `nightowl` | `nightowl123456` | 间谍（马甲：夜航船、灰烬账房） |
| `chancellor` | `chancellor123456` | 委托方（马甲：第七顾问、空椅子） |
| `lyra` | `lyra123456` | 记者向用户（种子里有一条待仲裁情报） |
| `reader` | `reader123456` | 普通读者 |

### Ghost 口令

前端 `/ghost` 输入：

```
moon-sees-everything
```

可在 `server/.env` 中用 `GHOST_KEY` 修改（参考 `server/.env.example`）。

约定：

- 会话放在 `sessionStorage`，关标签即失效
- 错误口令 / 无会话一律返回 **404**（伪装成不存在）
- **不写审计日志、不增加浏览数、不通知任何人**
- 可摘下面具、读付费正文、看买家真身、全站检索（含正文）

---

## 功能一览

### 新闻
- 列表筛选（版面 / 标签 / 热度）、全文搜索、详情与相关报道
- 管理台可新建 / 编辑 / 下架

### 记者展廊
- 条线筛选、履历 / 获奖 / 代表作、署名稿件列表

### 酒馆（匿名情报交易）
- 每人最多 **6** 个马甲；站内只见面具，不见真身
- **卖情报**：标题与标签公开；正文按阶梯档位付费解锁；可附证据
- **买情报**：预付保证金（≥ 最高档赏金）→ 阶梯赏金 → 应征 → 采纳结算 / 关闭退回
- 标签必须二选一：`有详细证据` / `没有详细证据`；其余标签可新增
- 首次进入弹出规约：假信息 / 拖欠付款 → 仲裁（封禁全部马甲、冻结财产赔偿、情节过重可公开披露）
- 举报系统 + 管理台仲裁 + `/tavern/disclosures` 公开处罚栏

### Tomato Coin 弹幕
- 右下角开关：开 = 显示本页番茄，关 = 不显示
- 「扔一颗」后点击页面落点；每颗消耗 1 TMT（可配置）
- 可附短留言；自己的番茄可点擦掉

### 钱包
- 余额 / 托管保证金 / 仲裁冻结；演示水龙头充值；完整流水

---

## 目录结构

```
jontop/
├── client/                 # Vite + React
│   └── src/
│       ├── pages/          # 用户 / 酒馆 / 管理台 / ghost
│       ├── components/     # 月眼 Logo、番茄层、布局
│       └── context/        # 登录、番茄弹幕、Toast
├── server/
│   ├── src/
│   │   ├── routes/         # auth / news / tavern / admin / ghost …
│   │   ├── seed.js         # 演示数据
│   │   └── index.js
│   ├── data/db.json        # 运行时数据（gitignore）
│   └── uploads/            # 证据文件
└── package.json            # concurrently 一键开发
```

---

## 环境变量（可选）

复制 `server/.env.example` → `server/.env`：

| 变量 | 默认 | 含义 |
|------|------|------|
| `PORT` | `4000` | API 端口 |
| `CLIENT_ORIGIN` | `http://localhost:5173` | CORS |
| `AUTH_SECRET` | 开发默认值 | 登录令牌密钥 |
| `GHOST_KEY` | `moon-sees-everything` | Ghost 入口令 |
| `TOMATO_PRICE` | `1` | 扔一颗番茄的 TMT 价格 |
