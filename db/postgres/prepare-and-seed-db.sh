#!/bin/bash

echo "DB_SEEDER: Importing databases from cloud storage..."

BASE_URL="https://storage.googleapis.com/cloudmos-postgresql-backups"

if [ -z "${POSTGRES_USER:-}" ]; then
    echo "DB_SEEDER: POSTGRES_USER is not set. Skipping seeding."
    exit 1
fi

if [ -z "${POSTGRES_PASSWORD:-}" ]; then
    echo "DB_SEEDER: POSTGRES_PASSWORD is not set. Skipping seeding."
    exit 1
fi

if [ -z "${POSTGRES_DBS_FOR_IMPORT:-}" ]; then
    echo "DB_SEEDER: POSTGRES_DBS_FOR_IMPORT is not set. Skipping seeding."
    exit 1
fi

if [ -z "${POSTGRES_USERS_DB:-}" ]; then
    echo "DB_SEEDER: POSTGRES_USERS_DB is not set. Skipping seeding."
    exit 1
fi

export PGUSER=$POSTGRES_USER
export PGPASSWORD=$POSTGRES_PASSWORD

psql -c "CREATE DATABASE \"$POSTGRES_USERS_DB\""

old_IFS=$IFS
IFS=','

for dbname in $POSTGRES_DBS_FOR_IMPORT; do
    url="${BASE_URL}/${dbname}.sql.gz"
    echo "DB_SEEDER: Importing \"$dbname\""

    if ! psql -c "CREATE DATABASE \"$dbname\""; then
        echo "DB_SEEDER: Failed to create database \"$dbname\""
        exit 1
    fi

    if ! curl -s -S -L "$url" | gunzip | psql "$dbname"; then
        echo "DB_SEEDER: Failed to download and import \"$url\""
        exit 1
    fi
done

IFS=$old_IFS

echo "DB_SEEDER: Done."
