#!/bin/bash
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    CREATE USER gateway WITH PASSWORD 'gateway_password';
    CREATE DATABASE channel_gateway;
    GRANT ALL PRIVILEGES ON DATABASE channel_gateway TO gateway;
EOSQL

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "channel_gateway" <<-EOSQL
    GRANT ALL ON SCHEMA public TO gateway;
EOSQL
