#!/bin/bash

if [ "$npm_command" = "run-script" ]; then
  COMMAND_PREFIX="npm run dc --"
else
  COMMAND_PREFIX="./dc.sh"
fi

function print_help() {


  echo "Description: this cli script is a wrapper around Docker Compose commands. It runs Docker Compose commands with the specific Akash Network Console Docker Compose files based on the arguments provided."
  echo ""
  echo "Usage: $COMMAND_PREFIX <command> [--no-db] [additional docker compose options]"
  echo ""
  echo "Commands:"
  echo "  build                Build the Docker images using the '${DC_FILES_DIR}docker-compose.build.yml' file."
  echo "  down                 Bring down the services and remove containers."
  echo "  up:db                Bring up only the DB service, unless --no-db is passed."
  echo "  up:dev               Bring up development services with Docker Compose."
  echo "  up:prod              Bring up production services with Docker Compose."
  echo ""
  echo "Options:"
  echo "  --no-db              Exclude the DB service from being started."
  echo "  -h, --help           Show this help message."
  echo ""
  echo "Examples:"
  echo "  $COMMAND_PREFIX build <docker compose args>             # Build Docker images"
  echo "  $COMMAND_PREFIX up:dev <docker compose args>            # Start dev services with DB"
  echo "  $COMMAND_PREFIX up:dev --no-db <docker compose args>    # Start dev services without DB"
  echo "  $COMMAND_PREFIX up:prod <docker compose args>           # Start production services with DB"
  echo "  $COMMAND_PREFIX down <docker compose args>              # Stop and remove containers"
}

for arg in "$@"; do
  case $arg in
    -h|--help)
      print_help
      exit 0
      ;;
  esac
done

COMMAND=$1
shift

WITH_DB=true

for arg in "$@"; do
  case $arg in
    --no-db)
      WITH_DB=false
      shift
      ;;
  esac
done

DC_FILES_DIR="$(dirname "$(dirname "$(readlink -f "$0")")")/"

if [ "$WITH_DB" = true ]; then
  DOCKER_COMPOSE_FILES="-f ${DC_FILES_DIR}docker-compose.build.yml -f ${DC_FILES_DIR}docker-compose.prod.yml -f ${DC_FILES_DIR}docker-compose.prod-with-db.yml -f ${DC_FILES_DIR}docker-compose.dev.yml"
  echo "Including DB services in Docker Compose."
else
  DOCKER_COMPOSE_FILES="-f ${DC_FILES_DIR}docker-compose.build.yml -f ${DC_FILES_DIR}docker-compose.prod.yml -f ${DC_FILES_DIR}docker-compose.dev.yml"
  echo "Excluding DB services from Docker Compose."
fi

case "$COMMAND" in
  build)
    echo "Running: docker compose -f ${DC_FILES_DIR}docker-compose.build.yml build $*"
    docker compose -f "${DC_FILES_DIR}docker-compose.build.yml" build "$@" || { echo "Docker build failed"; exit 1; }
    ;;
  down)
    echo "Running: docker compose -p console down $*"
    docker compose -p console down "$@" || { echo "Docker down failed"; exit 1; }
    ;;
  up:db)
    if [ "$WITH_DB" = true ]; then
      echo "Running: docker compose -p console $DOCKER_COMPOSE_FILES up -d db $*"
      docker compose -p console $DOCKER_COMPOSE_FILES up -d db "$@" || { echo "Docker up:db failed"; exit 1; }
    else
      echo "Skipping DB setup due to --no-db flag."
    fi
    ;;
  up:dev)
    echo "Running: docker compose -p console $DOCKER_COMPOSE_FILES up $*"
    docker compose -p console $DOCKER_COMPOSE_FILES up --renew-anon-volumes "$@" || { echo "Docker up:dev failed"; exit 1; }
    ;;
  up:prod)
    echo "Running: docker compose -p console $DOCKER_COMPOSE_FILES up $*"
    docker compose -p console $DOCKER_COMPOSE_FILES up --renew-anon-volumes "$@" || { echo "Docker up:prod failed"; exit 1; }
    ;;
  *)
    echo "Unknown command: $COMMAND"
    echo "Use '$COMMAND_PREFIX --help' for more information."
    exit 1
    ;;
esac
