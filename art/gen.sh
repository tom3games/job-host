#!/bin/zsh
# 1枚生成。gen.sh <名前>。_h と _c は元の人物を参照に渡す
k=$1; P="$(cd "$(dirname "$0")" && pwd)"; cd "$P/../../_art_raw/job-host"; mkdir -p raw logs; [[ -s raw/$k.png ]] && { echo "$k skip"; exit 0; }
s=1024x1536; case $k in bg|items_a|items_b|bottles|crew) s=1536x1024;; esac
ref=""; [[ $k == *_h || $k == *_c ]] && ref="raw/${k%_*}.png"
python3 ~/.claude/skills/3d-homepage/scripts/codex_imagegen.py raw/$k.png "$P/prompts/$k.md" ${ref:+$ref} --quality high --size $s > logs/$k.log 2>&1; echo "$k done $?"
