const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');

let adapter;
if (process.env.DATABASE_URL) {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  adapter = new PrismaPg(pool);
}

const prisma = new PrismaClient(adapter ? { adapter } : undefined);
module.exports = prisma;
