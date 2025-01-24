#!/bin/bash

echo "DB_SEEDER: Setting up databases..."

BASE_URL="https://storage.googleapis.com/console-postgresql-backups"

if [ -z "${POSTGRES_USER:-}" ]; then
    echo "DB_SEEDER: POSTGRES_USER is not set. Skipping seeding."
    exit 1
fi

if [ -z "${POSTGRES_PASSWORD:-}" ]; then
    echo "DB_SEEDER: POSTGRES_PASSWORD is not set. Skipping seeding."
    exit 1
fi

if [ -z "${POSTGRES_DBS:-}" ]; then
    echo "DB_SEEDER: POSTGRES_DBS is not set. Skipping seeding."
    exit 1
fi

export PGUSER=$POSTGRES_USER
export PGPASSWORD=$POSTGRES_PASSWORD

# Step 1: Create all databases from POSTGRES_DBS
old_IFS=$IFS
IFS=','
for dbname in $POSTGRES_DBS; do
    echo "DB_SEEDER: Creating database \"$dbname\""
    if ! psql -c "CREATE DATABASE \"$dbname\"" 2>/dev/null; then
        echo "DB_SEEDER: Database \"$dbname\" already exists or failed to create"
    fi
done

# Step 2: Import data for specified databases if POSTGRES_SKIP_IMPORT is not "true"
if [ "${POSTGRES_SKIP_IMPORT:-false}" != "true" ] && [ -n "${POSTGRES_DBS_FOR_IMPORT:-}" ]; then
    for dbname in $POSTGRES_DBS_FOR_IMPORT; do
        url="${BASE_URL}/${dbname}.sql.gz"
        echo "DB_SEEDER: Importing \"$dbname\""

        # Create database if it doesn't exist
        if ! psql -lqt | cut -d \| -f 1 | grep -qw "$dbname"; then
            echo "DB_SEEDER: Database \"$dbname\" doesn't exist, creating..."
            if ! psql -c "CREATE DATABASE \"$dbname\""; then
                echo "DB_SEEDER: Failed to create database \"$dbname\""
                exit 1
            fi
        fi

        if ! curl -s -S -L "$url" | gunzip | psql "$dbname"; then
            echo "DB_SEEDER: Failed to download and import \"$url\""
            exit 1
        fi
    done
else
    echo "DB_SEEDER: Skipping import step"
fi

IFS=$old_IFS

touch /var/lib/postgresql/data/init-complete
echo "DB_SEEDER: Done."
