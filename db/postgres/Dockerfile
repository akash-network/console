FROM postgres:14.9

RUN apt-get update && apt-get install -y curl \
    && rm -rf /var/lib/apt/lists/*
COPY prepare-and-seed-db.sh /docker-entrypoint-initdb.d/
