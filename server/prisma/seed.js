/**
 * prisma/seed.js
 * Populates the CosmeticItem catalog with board themes and piece sets at three
 * price tiers. Safe to re-run.
 * Usage: node prisma/seed.js
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');

let adapter;
if (process.env.DATABASE_URL) {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  adapter = new PrismaPg(pool);
}
const prisma = new PrismaClient(adapter ? { adapter } : undefined);

const BOARD_THEMES = [
  { name: 'Classic', description: 'The timeless wooden board.', coinCost: 0, isDefault: true,
    lightSquareColor: '#f0d9b5', darkSquareColor: '#b58863', highlightColor: 'rgba(255,255,0,0.4)' },
  { name: 'Ocean', description: 'Cool blue tones inspired by the deep sea.', coinCost: 100,
    lightSquareColor: '#cfe3f0', darkSquareColor: '#3a7ca5', highlightColor: 'rgba(100,210,255,0.4)' },
  { name: 'Forest', description: 'Earthy greens for a natural feel.', coinCost: 150,
    lightSquareColor: '#d4ead4', darkSquareColor: '#4a7c59', highlightColor: 'rgba(100,255,130,0.4)' },
  { name: 'Midnight', description: 'Deep navy and slate for late-night games.', coinCost: 400,
    lightSquareColor: '#8b9dc3', darkSquareColor: '#2c3e6b', highlightColor: 'rgba(130,160,255,0.5)' },
  { name: 'Crimson', description: 'Bold red and black for champions.', coinCost: 1000,
    lightSquareColor: '#f0c8c8', darkSquareColor: '#8b2020', highlightColor: 'rgba(255,80,80,0.45)' },
];

const PIECE_SETS = [
  { name: 'Standard', description: 'Classic Staunton-style pieces.', coinCost: 0, isDefault: true, pieceSetKey: 'standard' },
  { name: 'Neo', description: 'Clean, modern outlines.', coinCost: 100, pieceSetKey: 'neo' },
  { name: 'Minimal', description: 'Ultra-simplified geometric shapes.', coinCost: 150, pieceSetKey: 'cburnett' },
  { name: 'Tatiana', description: 'Elegant hand-drawn style.', coinCost: 450, pieceSetKey: 'tatiana' },
  { name: 'Royal', description: 'Premium ornate pieces fit for a king.', coinCost: 1200, pieceSetKey: 'merida' },
];

async function upsertCosmeticItem(data, type) {
  const existing = await prisma.cosmeticItem.findFirst({ where: { name: data.name, type } });
  if (existing) {
    await prisma.cosmeticItem.update({ where: { id: existing.id }, data: { ...data, type } });
    console.log('  updated  [' + type + '] ' + data.name);
    return existing.id;
  } else {
    const created = await prisma.cosmeticItem.create({ data: { ...data, type } });
    console.log('  created  [' + type + '] ' + data.name + ' (' + data.coinCost + ' coins)');
    return created.id;
  }
}

async function main() {
  console.log('Seeding cosmetics catalog...');
  for (const theme of BOARD_THEMES) await upsertCosmeticItem(theme, 'BOARD_THEME');
  for (const set of PIECE_SETS)     await upsertCosmeticItem(set,   'PIECE_SET');
  const defaultTheme = await prisma.cosmeticItem.findFirst({ where: { type: 'BOARD_THEME', isDefault: true } });
  const defaultSet   = await prisma.cosmeticItem.findFirst({ where: { type: 'PIECE_SET',   isDefault: true } });
  console.log('Seed complete.');
  console.log('Default board theme: ' + defaultTheme?.name + ' id=' + defaultTheme?.id);
  console.log('Default piece set:   ' + defaultSet?.name   + ' id=' + defaultSet?.id);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
