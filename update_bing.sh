#!/bin/bash

old_file="Bing_zh-CN_all.json"
new_file="Bing_new.json"
merged_file="Bing_zh-CN_all_merged.json"

# 下载最新 JSON 数据
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

# 如果没有新数据，退出
#new_count=$(jq '.images | length' __new_filtered.json)
#if [[ "$new_count" -eq 0 ]]; then
#  echo "✅ 没有新图片数据，无需更新。"
#  rm __new_simplified.json __new_filtered.json "$new_file"
#  exit 0
#fi

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

# 🔥 拆分 __new_filtered.json 为按天的单独文件
jq -c '.images[]' Bing_zh-CN_all.json | while read -r item; do
#jq -c '.images[]' __new_filtered.json | while read -r item; do
    enddate=$(echo "$item" | jq -r '.enddate')
    year=${enddate:0:4}
    month=${enddate:4:2}
    day=${enddate:6:2}
    # 创建目录
    mkdir -p "$year/$month"
    # 保存到 年/月/日.json
    echo "{ \"images\": [ $item ] }" | jq '.' > "$year/$month/$day.json"
    echo "📦 已保存: $year/$month/$day.json"
done

# 清理临时文件
rm __new_simplified.json __new_filtered.json "$new_file"

# 统计总图片数
total_images=$(jq '.images | length' "$old_file")

# 获取最新数据的 enddate（假设是排序后的第一项）
latest_date=$(jq -r '.images[0].enddate' "$old_file")
# 替换 README.md 中的总图片数
sed -i "s/总图片数：\*\*[0-9]\+\*\*/总图片数：**$total_images**/" README.md
# 替换 README.md 中的最新数据日期
sed -i "s/最新数据日期：\*\*[0-9]\+\*\*/最新数据日期：**$latest_date**/" README.md

echo "🎉 更新和拆分完成，总图片数：$total_images"
