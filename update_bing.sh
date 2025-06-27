#!/bin/bash

old_file="Bing_zh-CN_all.json"
new_file="Bing_new.json"
merged_file="Bing_zh-CN_all_merged.json"

# 下载最新 JSON 数据（新接口返回含有大量字段）
curl -s "https://www.bing.com/HPImageArchive.aspx?format=js&idx=0&n=8&uhd=1&mkt=zh-CN" -o "$new_file"

# 提取新数据中关心的字段，并存为 __new_simplified.json
jq '{ images: [.images[] | {
  enddate,
  url,
  urlbase,
  copyright,
  copyrightlink,
  title
}] }' "$new_file" > __new_simplified.json

# 取旧文件中所有已存在的 enddate 值
existing_dates=$(jq -r '.images[].enddate' "$old_file" | sort -u)

# 过滤新数据中 enddate 不在旧文件中的项
jq --argjson existing_dates "$(jq -R -s -c 'split("\n")[:-1]' <<< "$existing_dates")" '
  .images |= map(select(.enddate as $d | ($existing_dates | index($d) | not)))
' __new_simplified.json > __new_filtered.json

# 合并两份数据，并按 enddate 倒序排列
jq -s '
  {
    images: (
      (.[0].images + .[1].images)
      | sort_by(.enddate) | reverse
    )
  }
' "$old_file" __new_filtered.json > "$merged_file"

# 替换旧文件
mv "$merged_file" "$old_file"
rm __new_simplified.json __new_filtered.json "$new_file"
