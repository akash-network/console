#!/bin/bash

function print_help() {
  echo "Description: this cli script is a wrapper around Docker Compose commands. It runs Docker Compose commands with the specific Akash Network Console Docker Compose files based on the arguments provided."
  echo ""
  echo "Usage: $COMMAND_PREFIX <command> [--no-db] [additional docker compose options]"
  echo ""
  echo "Commands:"
  echo "  build                Build the Docker images using the '${DC_FILES_DIR}docker-compose.build.yml' file."
  echo "  down                 Bring down the services and remove containers."
  echo "  up                   Bring up development services with Docker Compose."
  echo ""
  echo "Options:"
  echo "  --no-db              Exclude the DB service from being started."
  echo "  -h, --help           Show this help message."
  echo ""
  echo "Examples:"
  echo "  $COMMAND_PREFIX build <docker compose args>                        # Build Docker images"
  echo "  $COMMAND_PREFIX up <docker compose args>                           # Start dev services with DB"
  echo "  $COMMAND_PREFIX up --no-db <docker compose args>                   # Start dev services without DB"
  echo "  $COMMAND_PREFIX down <docker compose args>                         # Stop and remove containers"
  echo "  USE_DOCKER_BUILDKIT=1 $COMMAND_PREFIX build <docker compose args>  # Builds Docker images using buildkit"
  echo "  USE_DOCKER_BUILDKIT=1 $COMMAND_PREFIX up:dev <docker compose args> # Builds Docker images using buildkit and start them"
}

remove_array_item_by_value() {
  local -n arr="$1"
  local value_to_remove="$2"
  local new_array=()

  for item in "${arr[@]}"; do
    if [[ "$item" != "$value_to_remove" ]]; then
      new_array+=("$item")
    fi
  done
  arr=("${new_array[@]}")
}

ensure_builder() {
  docker buildx version >/dev/null 2>&1 || { echo "Docker Buildx not available"; exit 1; }
  if ! docker buildx inspect ci-builder >/dev/null 2>&1; then
    docker buildx create --name ci-builder --use >/dev/null
  else
    docker buildx use ci-builder >/dev/null
  fi
}

docker_buildx_bake() {
  ensure_builder
  # Build only requested services if any; otherwise build all targets from compose
  local targets=()
  if [[ ${#REQUESTED_SERVICES[@]} -gt 0 ]]; then
    buildable_targets=$(docker buildx bake \
      $(printf -- " --file %q" "${COMPOSE_FILES[@]}") \
      --print | jq -r '.target | keys[]' | tr '\n' ' ')
    for target in "${REQUESTED_SERVICES[@]}"; do
      if [[ " $buildable_targets " == *" $target "* ]]; then
        targets+=("$target")
      fi
    done
  fi

  echo "docker buildx bake $(printf -- " --file %q" "${COMPOSE_FILES[@]}") --set *.cache-from="type=gha,scope=${BUILDKIT_CACHE_SCOPE}" --set *.cache-from="type=gha,scope=${BUILDKIT_CACHE_FALLBACK_SCOPE}" --set *.cache-to="type=gha,mode=max,scope=${BUILDKIT_CACHE_FALLBACK_SCOPE}" --load ${targets[@]}"
  docker buildx bake \
    $(printf -- " --file %q" "${COMPOSE_FILES[@]}") \
    --set *.cache-from="type=gha,scope=${BUILDKIT_CACHE_SCOPE}" \
    --set *.cache-from="type=gha,scope=${BUILDKIT_CACHE_FALLBACK_SCOPE}" \
    --set *.cache-to="type=gha,mode=max,scope=${BUILDKIT_CACHE_FALLBACK_SCOPE}" \
    --load \
    "${targets[@]}"
}

bake_cached() {
  (cd $DC_FILES_DIR && docker_buildx_bake)
}

docker_compose() {
  echo "Running: docker compose $(printf -- " -f %q" "${COMPOSE_FILES[@]}") $@ $PASSTHRU_ARGS"
  docker compose $(printf -- " -f %q" "${COMPOSE_FILES[@]}") $@ $PASSTHRU_ARGS
}

for arg in "$@"; do
  case $arg in
    -h|--help)
      print_help
      exit 0
      ;;
  esac
done

if [ "$npm_command" = "run-script" ]; then
  COMMAND_PREFIX="npm run dc --"
else
  COMMAND_PREFIX="./dc.sh"
fi

COMMAND=$1
shift

USE_BUILDKIT="${USE_DOCKER_BUILDKIT:-0}"
BUILDKIT_CACHE_SCOPE="${DOCKER_BUILDKIT_CACHE_SCOPE:-main}"
BUILDKIT_CACHE_SCOPE="${BUILDKIT_CACHE_SCOPE// /-}"
# uses cache fallback scope in case package-lock.json changed in a branch PR
BUILDKIT_CACHE_FALLBACK_SCOPE="${DOCKER_BUILDKIT_CACHE_FALLBACK_SCOPE:-$BUILDKIT_CACHE_SCOPE}"
BUILDKIT_CACHE_FALLBACK_SCOPE="${BUILDKIT_CACHE_FALLBACK_SCOPE// /-}"
REQUESTED_SERVICES=()
DC_FILES_DIR="$(dirname "$(dirname "$(readlink -f "$0")")")/"
COMPOSE_FILES=(
  "${DC_FILES_DIR}docker-compose.build.yml"
  "${DC_FILES_DIR}docker-compose.prod.yml"
  "${DC_FILES_DIR}docker-compose.prod-with-db.yml"
  "${DC_FILES_DIR}docker-compose.dev.yml"
)
KNOWN_SERVICES=$(docker compose $(printf -- " -f %q" "${COMPOSE_FILES[@]}") config --services | tr '\n' ' ')
PASSTHRU_ARGS=""

for arg in "$@"; do
  case $arg in
    --no-db)
      remove_array_item_by_value COMPOSE_FILES "${DC_FILES_DIR}docker-compose.prod-with-db.yml"
      echo "Excluding DB services from Docker Compose."
      ;;
    *)
      if [[ " $KNOWN_SERVICES " == *" $arg "* ]]; then
        REQUESTED_SERVICES+=("$arg")
        echo "requested services: ${REQUESTED_SERVICES[@]}"
      else
        PASSTHRU_ARGS="$PASSTHRU_ARGS $arg"
      fi
      ;;
  esac
done

case "$COMMAND" in
  build)
    COMPOSE_FILES=("${DC_FILES_DIR}docker-compose.build.yml")
    if [[ "$USE_BUILDKIT" -eq 1 ]]; then
      bake_cached || { echo "Docker build failed"; exit 1; }
    else
      docker_compose build ${REQUESTED_SERVICES[@]} || { echo "Docker build failed"; exit 1; }
    fi
    ;;
  down)
    echo "Running: docker compose -p console down $*"
    docker compose -p console down $PASSTHRU_ARGS || { echo "Docker down failed"; exit 1; }
    ;;
  up:dev | up)
    if [[ "$USE_BUILDKIT" -eq 1 ]]; then
      bake_cached || { echo "Docker buildkit failed"; exit 1; }
    fi
    docker_compose -p console up --renew-anon-volumes ${REQUESTED_SERVICES[@]} || { echo "Docker $COMMAND failed"; exit 1; }
    ;;
  *)
    echo "Unknown command: $COMMAND"
    echo "Use '$COMMAND_PREFIX --help' for more information."
    exit 1
    ;;
esac
