#!/usr/bin/env sh

##
# This script is used to install the dependencies for the project.
# It ignores the postinstall scripts for all packages except those listed in trusted_deps list.
# This gives us additional security protection against malicious packages.
##

# Enable debugging in GHA
if [ "$ACTIONS_RUNNER_DEBUG" = "true" ]; then
  set -x
fi

print_message() {
  color=$1
  shift
  message=$@

  case $color in
    "error")
      echo "\033[0;31mERROR:\033[0m $message"
      ;;
    "warn")
      echo "\033[0;33mWARNING:\033[0m $message"
      ;;
    "important")
      echo "\033[1m$message\033[0m"
      ;;
    * )
      echo "$message"
      ;;
  esac
}

npm ci --ignore-scripts "${@}"
if [ $? -ne 0 ]; then
  print_message "error" "npm ci failed"
  exit 1
fi

echo "\n"
print_message "important" "Triggering install npm script for trusted packages"
echo "\n"

for package_and_version in $(node -p -e 'require("./package.json").trustedDependencies.join("\n")'); do
  if [ "$(echo $package_and_version | cut -c1)" = "@" ]; then
    package=@$(echo $package_and_version | cut -d'@' -f2)
    trusted_version=$(echo $package_and_version | cut -d'@' -f3)
  else
    package=$(echo $package_and_version | cut -d'@' -f1)
    trusted_version=$(echo $package_and_version | cut -d'@' -f2)
  fi

  print_message "info" "$package@$trusted_version: npm run install"

  if [ -z "$trusted_version" ]; then
    print_message "error" "Skipping $package_and_version because it does not have a version"
    echo "\n"
    continue
  fi

  for package_json_path in $(find . -name package.json ! -path \*/.next/\* -path \*/node_modules/$package/\* -print); do
    dir_path=$(dirname $package_json_path)
    pkg_version=$(grep -E '"version": *"[^"]*"' $package_json_path | head -n 1 | cut -d'"' -f4)

    if [ "$pkg_version" != "$trusted_version" ]; then
      print_message "error" "$package_json_path (version: $pkg_version) is not trusted (expected: $trusted_version)"
      continue
    fi

    print_message "info" "... running npm run install in $dir_path (version: $pkg_version)"
    (cd $dir_path && npm run --if-present install) || print_message "error" "  $package_json_path (version: $pkg_version) failed to run npm run install"
  done
  echo "\n"
done
