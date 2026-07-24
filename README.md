# ANTS 越南散货车平台 · MVP

企业散货下单 + 管理端撮合派单（司机端暂不做）。部署目标：Railway。

## 功能范围

- 客户端 `/`：企业注册审核、登录、创建订单、查看本人订单、确认完成
- 管理端 `/admin`：客户审核、司机档案、订单审核、线下代录司机报价、手动匹配、复制司机通知消息
- 价格规则：客户仅可见自己的企业出价；成交价/司机价仅管理端可见
- 佣金：成交司机报价 × 15%
- 中越双语：语言包支持 CSV 导出 → 人工修改 → 导入更新

## 本地开发

1. 准备 PostgreSQL，配置 `.env`（可参考 `.env.example`）
2. 安装依赖并初始化：

```bash
npm install
npx prisma db push
npm run db:seed
npm run dev
```

3. 访问 http://localhost:3000

### 测试账号

| 角色 | 用户名 | 密码 |
|------|--------|------|
| 管理员 | admin | Admin@2026 |
| 货主 | 河内快运物流 | Test123456 |

## Railway 部署

1. 新建 Railway 项目，添加 **PostgreSQL** 插件
2. 添加 Web Service，连接本仓库
3. 环境变量：
   - `DATABASE_URL`（Railway Postgres 自动注入或手动填）
   - `JWT_SECRET`（随机长字符串）
   - `ADMIN_HOTLINE`（调度热线，写入司机通知模板）
4. Build：`npm install && npx prisma generate && npm run build`
5. Start：见 `docker-entrypoint.sh` / `railway.json`

## 司机通知模板

管理端订单详情页点击「复制通知消息」，按越南语模板一键复制到 Zalo/WhatsApp。

## 目录

- `src/app` 页面与 API
- `prisma/schema.prisma` 数据模型
- `src/lib/notify.ts` 司机通知模板
