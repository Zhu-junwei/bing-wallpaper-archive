# Cloudflare Pages (方案 A)

目标：使用 Cloudflare Pages + 现有 GitHub Actions，每天自动更新并展示 Bing 壁纸，无服务器运行。

## 代码侧已完成

- 前端站点：`public/index.html`
- 静态资源：`public/assets/*`
- 缓存策略：`public/_headers`
- 每日同步数据到 Pages 目录：
  - Workflow: `.github/workflows/update-bing.yml`
  - 每次更新后会执行：
    - `cp Bing_zh-CN_all.json public/Bing_zh-CN_all.json`

## Cloudflare 控制台配置

1. 进入 `Workers & Pages` -> `Create application` -> `Pages` -> `Connect to Git`.
2. 选择仓库：`Zhu-junwei/bing-wallpaper-archive`
3. 关键构建配置：
   - `Production branch`: `master`
   - `Framework preset`: `None`
   - `Build command`: 留空
   - `Build output directory`: `public`
   - `Root directory`: 留空（仓库根目录）
4. 点击 `Save and Deploy`。

## 自动更新链路

1. GitHub Actions `Update Bing Wallpaper JSON` 每天运行。
2. 更新 `Bing_zh-CN_all.json` 并同步到 `public/Bing_zh-CN_all.json`。
3. workflow 自动 commit + push 到 `master`（仅有变化时）。
4. Cloudflare Pages 检测到新 commit 后自动重新部署。

## 首次上线检查

1. 在 GitHub Actions 手动触发一次 `Update Bing Wallpaper JSON`（确保 `public/Bing_zh-CN_all.json` 已存在）。
2. 在 Cloudflare Pages 查看最近一次 Deploy 日志为成功。
3. 打开站点后检查：
   - 首页 Hero 可显示图片。
   - 搜索/年份筛选正常。
   - `UHD` / `1080P` 下载链接可打开。

## 可选优化

1. 绑定自定义域名（Pages -> Custom domains）。
2. 在 Cloudflare DNS 打开 `Proxy`（橙云）并启用 `Auto Minify`。
3. 后续若要 API 化分页，可再加 Cloudflare Worker（当前方案不需要）。
