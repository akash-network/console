#!/bin/bash

set -euo pipefail

function print_help() {
  echo "Description: This script builds and promotes Docker images based on the latest commit SHA."
  echo ""
  echo "Usage: ./build-o-promote.sh -r <repo> -t <tag> -a <app>"
  echo ""
  echo "Options:"
  echo "  -r, --repo           Docker repository"
  echo "  -t, --tag            Docker image tag"
  echo "  -a, --app            Application name"
  echo "  -f, --force-build    Force build the Docker image"
  echo "  -h, --help           Show this help message."
  echo ""
  echo "Examples:"
  echo "  ./build-o-promote.sh -r myrepo -t mytag -a myapp"
}

REPO=""
TAG=""
APP=""
FORCE_BUILD=false

while [[ $# -gt 0 ]]; do
  case $1 in
    -r|--repo)
      REPO="$2"
      shift 2
      ;;
    -t|--tag)
      TAG="$2"
      shift 2
      ;;
    -a|--app)
      APP="$2"
      shift 2
      ;;
    -f|--force-build)
      FORCE_BUILD=true
      shift
      ;;
    -h|--help)
      print_help
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      print_help
      exit 1
      ;;
  esac
done

if [[ -z "$REPO" || -z "$TAG" || -z "$APP" ]]; then
  echo "Error: Missing required arguments."
  print_help
  exit 1
fi

commits=$(git log -n 10 --pretty=format:"%H %s")

while IFS= read -r commit; do
  MESSAGE=$(echo $commit | cut -d' ' -f2-)

  if [[ ! $MESSAGE =~ ^chore\(release\):\ released\ version ]]; then
    echo "Base commit: $commit"
    SHA=$(echo $commit | awk '{print $1}')
    break
  fi
done <<< "$commits"

SCRIPTS_DIR="$(dirname "$(readlink -f "$0")")"
BASE_IMAGE="${REPO}:${SHA}"
echo "using base image: ${BASE_IMAGE}"

IS_BUILT_FOR_SHA=1
if [ -n "$SHA" ]; then
  IS_BUILT_FOR_SHA=$(docker manifest inspect "${REPO}:${SHA}" > /dev/null 2>&1; echo $?)
fi

TAGGED_IMAGE="${REPO}:${TAG}"
IS_BUILT_FOR_TAG=$(docker manifest inspect "${TAGGED_IMAGE}" > /dev/null 2>&1; echo $?)

echo "is built for sha: ${IS_BUILT_FOR_SHA}"
echo "is built for tag: ${IS_BUILT_FOR_TAG}"

if [[ "${IS_BUILT_FOR_TAG}" -eq 0 ]]; then
    echo 'image is already tagged, skipping build'
else
  if [[ "${IS_BUILT_FOR_SHA}" -eq 0 ]]; then
    echo 'image is already tagged for sha. using existing one'
    docker pull "${BASE_IMAGE}"
    docker image tag "${REPO}:${SHA}" "${TAGGED_IMAGE}"
  else
    echo 'building new image'
    ENV_PREFIX=$(echo $APP | tr '[:lower:]' '[:upper:]')
    ENV_PREFIX=$(echo $ENV_PREFIX | tr '-' '_')
    export ${ENV_PREFIX}_TAG=$TAG
    export ${ENV_PREFIX}_REPO=$REPO
    DEPLOYMENT_ENV=''

    if [[ "${TAG}" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
      DEPLOYMENT_ENV='production'
    elif [[ "${TAG}" =~ ^[0-9]+\.[0-9]+\.[0-9]+-beta\.[0-9]+$ ]]; then
      DEPLOYMENT_ENV='staging'
    elif [[ "${TAG}" =~ ^[0-9]+\.[0-9]+\.[0-9]+-alpha\.[0-9]+$ ]]; then
      DEPLOYMENT_ENV='development'
    fi
    export DEPLOYMENT_ENV=$DEPLOYMENT_ENV

    echo "building image for ${APP} with tag ${TAG} and deployment env ${DEPLOYMENT_ENV}"

    $SCRIPTS_DIR/dc.sh build $APP

    if [[ "${FORCE_BUILD}" == false ]]; then
      docker image tag "${TAGGED_IMAGE}" "${REPO}:${SHA}"
    fi
  fi

  if [[ "${TAG}" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    docker image tag "${TAGGED_IMAGE}" "${REPO}:latest"
  fi

  docker push "${REPO}" --all-tags
fi