#!/usr/bin/env node
/**
 * End-to-end check: RPC shape + client-side search result mapping.
 */
const fs = require('fs');
const path = require('path');

const EWKB_SRID_FLAG = 0x20000000;

function decodeGeographyPoint(value) {
  if (typeof value !== 'string' || value.length < 42) return null;
  const hex = value.startsWith('\\x') ? value.slice(2) : value;
  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < hex.length; index += 2) {
    bytes[index / 2] = Number.parseInt(hex.slice(index, index + 2), 16);
  }
  if (bytes.length < 21) return null;
  const littleEndian = bytes[0] === 1;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const readUInt32 = (offset) =>
    littleEndian ? view.getUint32(offset, true) : view.getUint32(offset, false);
  const readDouble = (offset) =>
    littleEndian ? view.getFloat64(offset, true) : view.getFloat64(offset, false);
  let offset = 1;
  const geometryType = readUInt32(offset);
  offset += 4;
  if (geometryType & EWKB_SRID_FLAG) offset += 4;
  const longitude = readDouble(offset);
  offset += 8;
  const latitude = readDouble(offset);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude };
}

function mapRpcRows(rows) {
  return rows
    .map((row) => {
      const coords =
        row.latitude != null && row.longitude != null
          ? { latitude: Number(row.latitude), longitude: Number(row.longitude) }
          : decodeGeographyPoint(row.coordinates);
      if (!coords || !row.id || !row.name) return null;
      return { id: row.id, name: row.name, ...coords };
    })
    .filter(Boolean);
}

async function main() {
  const envPath = path.join(__dirname, '..', '.env');
  const env = fs.readFileSync(envPath, 'utf8');
  const url = env.match(/EXPO_PUBLIC_SUPABASE_URL=(.+)/)?.[1]?.trim();
  const key = env.match(/EXPO_PUBLIC_SUPABASE_ANON_KEY=(.+)/)?.[1]?.trim();

  const res = await fetch(`${url}/rest/v1/rpc/search_fishing_spots`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ search_term: 'Del Valle' }),
  });

  const rows = await res.json();
  const mapped = mapRpcRows(rows);
  console.log('RPC rows:', rows.length);
  console.log('Mapped search results:', mapped.length);
  console.log('Sample:', mapped[0]);
  if (mapped.length === 0) {
    console.error('FAIL — search still returns no usable coordinates');
    process.exit(1);
  }
  console.log('OK — client mapping produces searchable locations');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
