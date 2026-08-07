

# 📸 bing-wallpaper-archive

This project archives Bing daily wallpaper data from 2016-03-05 to the present, and provides a Cloudflare Pages website, JSON API, direct image link interface, and batch download capabilities.

Total images: **3809**

Latest data date: **20260807**

## 🚀 Features

### Bing JSON Data

- ✅ Companion JSON data is automatically updated daily at 00:00 Beijing Time via GitHub Actions

### Batch Downloader

- ✅ Supports resolution selection: Original, 4K, 2K, 1080P, or custom dimensions
- ✅ Supports batch downloading by date range
- ✅ Organizes downloaded images by year
- ✅ Automatically skips already downloaded files to prevent duplicates
- ✅ All images are downloaded directly from official sources

Note:

- Wallpapers prior to 20190510 only provide 1080P resolution for download.
---

## 📦 Project Structure

```text
📁 Project Root
├── 20**/                           # JSON data divided by day
├── Bing_zh-CN_all.json             # All archived Bing wallpaper JSON data
├── functions/                      # Cloudflare Pages Functions (/api, /img)
├── public/                         # Cloudflare Pages static site directory
│   ├── _headers                    # Response headers and cache policies
│   ├── api-doc/                    # API documentation page
│   └── Bing_zh-CN_all.json         # Public data copy for Functions to read
├── update_bing.sh                  # Bash script: Automatically downloads and merges JSON data
├── bing-wallpaper-downloader.bat   # Windows batch script for interactive wallpaper downloading
└── .github/workflows
    └── update-bing.yml             # GitHub Actions daily auto-update workflow
```

## ⚙️ Usage

- Method 1: Download the [bing-wallpaper-downloader.bat](https://github.com/Zhu-junwei/bing-wallpaper-archive/releases/download/v1.3/bing-wallpaper-downloader.bat) script from the [releases](https://github.com/Zhu-junwei/bing-wallpaper-archive/releases/) page, run it, and follow the prompts to download images.
- Method 2: Download the `bing-wallpaper-archive-20xx.zip` archive file from the [releases](https://github.com/Zhu-junwei/bing-wallpaper-archive/releases) page.
- Method 3: Build your own downloader based on the project's JSON data.

## ☁️ Cloudflare Pages Deployment

This project can be deployed directly to Cloudflare Pages, using the `functions/` directory as Pages Functions. [Demo Site](https://bw.900198.xyz)

### 1. Create a Pages Project

- Navigate to Cloudflare Dashboard -> `Workers & Pages` -> `Create` -> `Pages`.
- Select `Connect to Git`, link this repository, and choose the branch (usually `master`).

### 2. Build Configuration

- `Framework preset`: `None`
- `Build command`: Leave blank (no build step required)
- `Build output directory`: `public`
- `Root directory`: `/` (repository root)

### 3. Post-Deployment Verification

- Homepage: `https://<your-domain>/`
- API Documentation: `https://<your-domain>/api-doc/`
- Latest JSON Entry: `https://<your-domain>/api/latest`
- Latest N JSON Entries: `https://<your-domain>/api/latest/10`
- Latest Image Direct Link: `https://<your-domain>/img/latest?res=hd`

### 4. Automatic Data Update Instructions

- The GitHub Actions workflow `update-bing.yml` automatically updates data daily at 00:00 Beijing Time.
- The workflow syncs `Bing_zh-CN_all.json` to `public/Bing_zh-CN_all.json` for Cloudflare Pages Functions to read.

## 🧪 Local Preview (Cloudflare Pages)

You can preview the project locally, closely matching the online Cloudflare Pages environment (including `functions/` routing).

### 1. Prerequisites

- Node.js 18+ (with npm installed)

### 2. Start Local Server

Run the following in the repository root directory:

```bash
npx wrangler pages dev public --port 8788
```

### 3. Local Access URLs

- Homepage: `http://127.0.0.1:8788/`
- API Documentation: `http://127.0.0.1:8788/api-doc/`
- Example Endpoint: `http://127.0.0.1:8788/api/latest/1`

To stop the server: `Ctrl + C`

## 📥 Data Access

**GitHub:**

```
# Full dataset
https://raw.githubusercontent.com/Zhu-junwei/bing-wallpaper-archive/master/Bing_zh-CN_all.json

# Data for specific date
https://raw.githubusercontent.com/Zhu-junwei/bing-wallpaper-archive/master/2025/12/20.json
# Data for specific month
https://raw.githubusercontent.com/Zhu-junwei/bing-wallpaper-archive/master/2025/12/all.json
# Data for specific year
https://raw.githubusercontent.com/Zhu-junwei/bing-wallpaper-archive/master/2025/all.json
```

**jsDelivr:**

```
# Full dataset (CDN accelerated)
https://cdn.jsdelivr.net/gh/Zhu-junwei/bing-wallpaper-archive/Bing_zh-CN_all.json
# If CDN is not up-to-date, use the link below to purge/reset
https://purge.jsdelivr.net/gh/Zhu-junwei/bing-wallpaper-archive/Bing_zh-CN_all.json

# Data for specific date (CDN accelerated)
https://cdn.jsdelivr.net/gh/Zhu-junwei/bing-wallpaper-archive/2025/12/20.json
# Data for specific month (CDN accelerated)
https://cdn.jsdelivr.net/gh/Zhu-junwei/bing-wallpaper-archive/2025/12/all.json
# Data for specific year (CDN accelerated)
https://cdn.jsdelivr.net/gh/Zhu-junwei/bing-wallpaper-archive/2025/all.json
```

**Cloudflare API:**

```
https://<your-domain>/api-doc/
```

## ⚠️ Notes

- Some images may fail to download. Please test accordingly.
- BAT files downloaded via Git might have `LF` line endings, which may require manual adjustment. Alternatively, download directly from the project's releases.

## 💖 Acknowledgments

The initial dataset for this project was sourced from [flow2000/bing-wallpaper-api](https://github.com/flow2000/bing-wallpaper-api).
