# 📸 bing-wallpaper-archive

本项目归档 2016-03-05 至今的必应每日壁纸数据，并提供 Cloudflare Pages 网站、JSON API、图片直链接口和批量下载能力。

总图片数：**3645**

最新数据日期：**20260224**

## 🚀 功能特色

### 必应json数据

- ✅ 配套 JSON 数据使用 GitHub Actions 每日北京时间 00:00 自动更新

### 批处理下载器

- ✅ 支持分辨率选择：原图、4K、2K、1080P 或自定义尺寸
- ✅ 支持按时间范围批量下载
- ✅ 按照年份存放下载的图片
- ✅ 自动跳过已下载文件，避免重复下载
- ✅ 所有图片均通过官方进行下载

注：

- 20190510之前的壁纸只提供下载1080P分辨率
- https://cdn.bimg.cc 域名官方不支持下载，这是欠费了？
---

## 📦 项目结构

```text
📁 项目根目录
├── 20**/                           # 每天划分的 JSON 数据
├── Bing_zh-CN_all.json             # 所有已归档的必应壁纸 JSON 数据
├── functions/                      # Cloudflare Pages Functions（/api、/img）
├── public/                         # Cloudflare Pages 静态站点目录
│   ├── _headers                    # 响应头与缓存策略
│   ├── api-doc/                    # API 文档页面
│   └── Bing_zh-CN_all.json         # 供 Functions 读取的公开数据副本
├── update_bing.sh                  # Bash 脚本：自动下载并合并 JSON 数据
├── bing-wallpaper-downloader.bat   # Windows 批处理脚本，支持交互下载壁纸
└── .github/workflows
    └── update-bing.yml             # GitHub Actions 自动每日更新任务
```

## ⚙️ 使用方式

- 方式一：下载[release](https://github.com/Zhu-junwei/bing-wallpaper-archive/releases/)中的[bing-wallpaper-downloader.bat](https://github.com/Zhu-junwei/bing-wallpaper-archive/releases/download/v1.3/bing-wallpaper-downloader.bat)脚本运行后按照提示下载图片。
- 方式二：下载[release](https://github.com/Zhu-junwei/bing-wallpaper-archive/releases)中的`bing-wallpaper-archive-20xx.zip`图片压缩包。
- 方式三：根据项目的json数据构建自己的下载程序

## ☁️ Cloudflare Pages 部署

本项目可直接部署到 Cloudflare Pages，并使用 `functions/` 作为 Pages Functions。[示例站点](https://bw.900198.xyz)

### 1. 创建 Pages 项目

- 进入 Cloudflare 控制台 -> `Workers & Pages` -> `Create` -> `Pages`。
- 选择 `Connect to Git`，绑定本仓库并选择分支（通常为 `master`）。

### 2. 构建配置

- `Framework preset`：`None`
- `Build command`：留空（无需构建）
- `Build output directory`：`public`
- `Root directory`：`/`（仓库根目录）

### 3. 部署后验证

- 首页：`https://<你的域名>/`
- API 文档：`https://<你的域名>/api-doc/`
- 最新一条 JSON：`https://<你的域名>/api/latest`
- 最新 N 条 JSON：`https://<你的域名>/api/latest/10`
- 最新图片直链：`https://<你的域名>/img/latest?res=hd`

### 4. 数据自动更新说明

- GitHub Actions 工作流 `update-bing.yml` 每日北京时间 `00:00` 自动更新数据。
- 工作流会同步 `Bing_zh-CN_all.json` 到 `public/Bing_zh-CN_all.json`，用于 Cloudflare Pages Functions 读取。

## 📥 数据获取

**GitHub：**

```
# 全量数据
https://raw.githubusercontent.com/Zhu-junwei/bing-wallpaper-archive/master/Bing_zh-CN_all.json

# 指定日期数据
https://raw.githubusercontent.com/Zhu-junwei/bing-wallpaper-archive/master/2025/12/20.json
# 指定月份数据
https://raw.githubusercontent.com/Zhu-junwei/bing-wallpaper-archive/master/2025/12/all.json
# 指定年份数据
https://raw.githubusercontent.com/Zhu-junwei/bing-wallpaper-archive/master/2025/all.json
```

**jsdelivr：**

```
# 全量数据 cdn加速
https://cdn.jsdelivr.net/gh/Zhu-junwei/bing-wallpaper-archive/Bing_zh-CN_all.json
# 如果cdn不是最新数据，建议使用下面链接重置
https://purge.jsdelivr.net/gh/Zhu-junwei/bing-wallpaper-archive/Bing_zh-CN_all.json

# 指定日期数据 cdn加速
https://cdn.jsdelivr.net/gh/Zhu-junwei/bing-wallpaper-archive/2025/12/20.json
# 指定月份数据 cdn加速
https://cdn.jsdelivr.net/gh/Zhu-junwei/bing-wallpaper-archive/2025/12/all.json
# 指定年份数据 cdn加速
https://cdn.jsdelivr.net/gh/Zhu-junwei/bing-wallpaper-archive/2025/all.json
```

## ⚠️ 注意事项

- 可能存在有些图片无法下载的现象，请自行测试。
- 通过git下载的bat文件可能存在换行符是`LF`的情况，需要手动调整，或通过本项目的release进行下载。

## 💖 鸣谢

项目前期初始数据来自[flow2000/bing-wallpaper-api](https://github.com/flow2000/bing-wallpaper-api)
