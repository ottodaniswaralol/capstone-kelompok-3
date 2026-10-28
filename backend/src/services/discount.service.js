'use strict';
/**
 * Aturan diskon otomatis (FR-06), Tabel 1.6 laporan Minggu 1-4. Fungsi murni, mudah diuji.
 *
 *   sisa waktu menuju jam tutup   diskon
 *   > 90 sampai 120 menit          20%
 *   > 60 sampai 90 menit           30%
 *   > 30 sampai 60 menit           40%
 *   <= 30 menit                    50%
 *   > 120 menit                    belum tayang (upcoming)
 *   <= 0 menit                     tutup (closed)
 */
const WINDOW_MIN = 120;
const LISTING_OPEN_FROM = 19 * 60; // pembuatan listing: 19.00 sampai 00.59 (aturan tim, v5)
const LISTING_OPEN_UNTIL = 60;

function discountPct(remaining) {
  if (remaining <= 0 || remaining > WINDOW_MIN) return null;
  if (remaining > 90) return 20;
  if (remaining > 60) return 30;
  if (remaining > 30) return 40;
  return 50;
}

function discountPrice(normalPrice, pct) {
  return pct ? Math.round(normalPrice * (1 - pct / 100)) : null;
}

/** Diskon berikutnya: { pct, inMinutes } atau null bila sudah maksimal / belum tayang */
function nextDiscount(remaining) {
  const pct = discountPct(remaining);
  if (!pct || pct >= 50) return null;
  const threshold = pct === 20 ? 90 : pct === 30 ? 60 : 30;
  return { pct: pct + 10, inMinutes: remaining - threshold };
}

/**
 * Status listing. Urutan prioritas sama dengan frontend:
 * dijeda > tutup > habis > belum tayang > tayang
 */
function computeListing({ closeMinutes, nowMinutes, stock, isActive, normalPrice }) {
  const remaining = closeMinutes - nowMinutes;
  let state;
  if (!isActive) state = 'paused';
  else if (remaining <= 0) state = 'closed';
  else if (stock <= 0) state = 'soldout';
  else if (remaining > WINDOW_MIN) state = 'upcoming';
  else state = 'live';
  const pct = discountPct(remaining);
  return { remaining, state, discountPct: pct, discountPrice: discountPrice(normalPrice, pct), next: nextDiscount(remaining) };
}

/** Listing baru hanya boleh dibuat pukul 19.00 sampai 00.59 WIB */
function canCreateListing(nowMinutes) {
  return nowMinutes < LISTING_OPEN_UNTIL || nowMinutes >= LISTING_OPEN_FROM;
}

module.exports = { WINDOW_MIN, discountPct, discountPrice, nextDiscount, computeListing, canCreateListing };
