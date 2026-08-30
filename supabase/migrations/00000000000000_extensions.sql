create extension if not exists pgcrypto;
create extension if not exists "uuid-ossp";

comment on extension pgcrypto is 'Cryptographic functions used by Bunker Studio identifiers and protected data.';
