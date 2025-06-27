# 📸 bing-wallpaper-archive

本项目旨在归档和管理必应每日壁纸数据，包含两个核心模块：

- **自动更新 Bing 壁纸 JSON 数据**，通过脚本和 GitHub Actions 每日抓取并合并最新壁纸信息。
- **Windows 批处理下载工具（.bat）**，支持按日期范围和分辨率批量下载高清壁纸。

## 🚀 功能特色

- ✅ 支持分辨率选择：4K、2K、1080P 或自定义尺寸
- ✅ 支持按时间范围批量下载
- ✅ 自动跳过已下载文件
- ✅ 直接下载 Bing 官方原图
- ✅ 配套 JSON 数据每日自动更新
- ✅ GitHub Actions 每日北京时间 00:00 自动同步最新壁纸信息

---

## 📦 项目结构

```text
📁 项目根目录
├── Bing_zh-CN_all.json         # 所有已归档的必应壁纸 JSON 数据
├── update_bing.sh              # Bash 脚本：自动下载并合并 JSON 数据
├── 必应壁纸下载器.bat         # Windows 批处理脚本，支持交互下载壁纸
└── .github/workflows
    └── update-bing.yml         # GitHub Actions 自动每日更新任务

```
