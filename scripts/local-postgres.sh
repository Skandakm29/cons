#!/usr/bin/env bash
# Starts a throwaway, user-owned PostgreSQL cluster in ./.pgdata on port 5433.
# Use this when Docker is not available. Same credentials as docker-compose.yml.
set -euo pipefail

PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
DATA_DIR="$(pwd)/.pgdata"
PORT="${PGPORT:-5433}"

if [ -z "$PGBIN" ] || [ ! -x "$PGBIN/initdb" ]; then
  echo "Could not find PostgreSQL binaries. Set PGBIN=/path/to/postgresql/bin" >&2
  exit 1
fi

if [ ! -f "$DATA_DIR/PG_VERSION" ]; then
  echo "Initialising cluster in $DATA_DIR"
  PWFILE="$(mktemp)"
  echo "buildbid" > "$PWFILE"
  "$PGBIN/initdb" -D "$DATA_DIR" -U buildbid --pwfile="$PWFILE" --auth=scram-sha-256 >/dev/null
  rm -f "$PWFILE"
fi

if "$PGBIN/pg_ctl" -D "$DATA_DIR" status >/dev/null 2>&1; then
  echo "Postgres already running on port $PORT"
else
  "$PGBIN/pg_ctl" -D "$DATA_DIR" -l "$DATA_DIR/server.log" \
    -o "-p $PORT -k $DATA_DIR -c listen_addresses=localhost" start >/dev/null
  echo "Postgres started on port $PORT"
fi

PGPASSWORD=buildbid "$PGBIN/psql" -h localhost -p "$PORT" -U buildbid -d postgres -tAc \
  "SELECT 1 FROM pg_database WHERE datname='buildbid'" | grep -q 1 \
  || PGPASSWORD=buildbid "$PGBIN/createdb" -h localhost -p "$PORT" -U buildbid buildbid

echo "DATABASE_URL=postgresql://buildbid:buildbid@localhost:$PORT/buildbid?schema=public"
echo "Stop with: $PGBIN/pg_ctl -D $DATA_DIR stop"
