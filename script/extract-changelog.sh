#!/bin/bash

if [ -z "$1" ] || [ -z "$2" ]; then
  echo "Usage: $0 <tag> <changelog_file>"
  exit 1
fi

tag=$1
changelog_file=$2

if [ ! -f "$changelog_file" ]; then
  echo "Error: Changelog file $changelog_file does not exist."
  exit 1
fi

entry=$(awk -v tag="$tag" '
  BEGIN { found = 0 }
  $0 ~ "^## \\[" tag "\\]" { found = 1; print; next }
  found && $0 ~ "^## \\[" { found = 0 }
  found { print }
' "$changelog_file")

if [ -n "$entry" ]; then
  echo "$entry"
fi