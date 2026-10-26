'use strict';
require('./helpers/setup');
const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const d = require('../src/services/discount.service');
const clock = require('../src/services/clock.service');
const { haversineKm } = require('../src/services/geo.service');

describe('aturan diskon (Tabel 1.6 laporan M4)', () => {
  const cases = [
    [121, null], [120, 20], [91, 20], [90, 30], [61, 30], [60, 40], [31, 40], [30, 50], [1, 50], [0, null], [-15, null],
  ];
  for (const [rem, pct] of cases) {
    test(`sisa ${rem} menit -> ${pct === null ? 'tanpa diskon' : pct + '%'}`, () => assert.equal(d.discountPct(rem), pct));
  }

  test('BDD US-07: tutup 21.00, Rp25.000, sisa 75 menit -> 30% = Rp17.500', () => {
    const c = d.computeListing({ closeMinutes: 21 * 60, nowMinutes: 21 * 60 - 75, stock: 5, isActive: true, normalPrice: 25000 });
    assert.equal(c.state, 'live');
    assert.equal(c.discountPct, 30);
    assert.equal(c.discountPrice, 17500);
  });
  test('BDD US-07: sisa 30 menit -> 50% = Rp12.500', () => {
    const c = d.computeListing({ closeMinutes: 21 * 60, nowMinutes: 21 * 60 - 30, stock: 5, isActive: true, normalPrice: 25000 });
    assert.equal(c.discountPct, 50);
    assert.equal(c.discountPrice, 12500);
  });
  test('BDD US-07: lewat jam tutup -> closed, tanpa diskon', () => {
    const c = d.computeListing({ closeMinutes: 21 * 60, nowMinutes: 21 * 60 + 1, stock: 5, isActive: true, normalPrice: 25000 });
    assert.equal(c.state, 'closed');
    assert.equal(c.discountPct, null);
    assert.equal(c.discountPrice, null);
  });
  test('prioritas status: dijeda > tutup > habis > belum tayang > tayang', () => {
    const base = { closeMinutes: 1260, normalPrice: 20000 };
    assert.equal(d.computeListing({ ...base, nowMinutes: 1300, stock: 0, isActive: false }).state, 'paused');
    assert.equal(d.computeListing({ ...base, nowMinutes: 1300, stock: 0, isActive: true }).state, 'closed');
    assert.equal(d.computeListing({ ...base, nowMinutes: 1200, stock: 0, isActive: true }).state, 'soldout');
    assert.equal(d.computeListing({ ...base, nowMinutes: 1000, stock: 3, isActive: true }).state, 'upcoming');
    assert.equal(d.computeListing({ ...base, nowMinutes: 1200, stock: 3, isActive: true }).state, 'live');
  });
  test('diskon berikutnya dan sisa menit menuju kenaikan', () => {
    assert.deepEqual(d.nextDiscount(105), { pct: 30, inMinutes: 15 });
    assert.deepEqual(d.nextDiscount(75), { pct: 40, inMinutes: 15 });
    assert.deepEqual(d.nextDiscount(45), { pct: 50, inMinutes: 15 });
    assert.equal(d.nextDiscount(20), null);
    assert.equal(d.nextDiscount(150), null);
  });
  test('harga dibulatkan ke rupiah terdekat', () => assert.equal(d.discountPrice(18000, 20), 14400));
});

describe('jendela pembuatan listing 19.00 sampai 00.59', () => {
  const t = (h, m) => h * 60 + m;
  for (const [h, m, ok] of [[18, 59, false], [19, 0, true], [23, 59, true], [0, 0, true], [0, 59, true], [1, 0, false], [12, 0, false]]) {
    test(`${String(h).padStart(2, '0')}.${String(m).padStart(2, '0')} -> ${ok ? 'boleh' : 'dikunci'}`, () => assert.equal(d.canCreateListing(t(h, m)), ok));
  }
});

describe('jam server (WIB)', () => {
  test('pin dan setTimeOfDay memakai zona WIB', () => {
    clock.pin('2026-10-22T19:45:00+07:00');
    assert.equal(clock.timeString(), '19:45');
    assert.equal(clock.dateString(), '2026-10-22');
    clock.setTimeOfDay('23:50');
    assert.equal(clock.timeString(), '23:50');
    clock.advance(15);
    assert.equal(clock.timeString(), '00:05');
    assert.equal(clock.dateString(), '2026-10-23');
    clock.unpin();
  });
  test('parse dan format HH:MM', () => {
    assert.equal(clock.parseHHMM('21:30'), 1290);
    assert.equal(clock.parseHHMM('21:30:00'), 1290);
    assert.ok(Number.isNaN(clock.parseHHMM('abc')));
    assert.equal(clock.formatHHMM(1290), '21:30');
  });
});

describe('jarak Haversine', () => {
  test('nol untuk titik yang sama, simetris, dan masuk akal', () => {
    assert.equal(haversineKm(-6.26, 106.81, -6.26, 106.81), 0);
    const a = haversineKm(-6.26, 106.81, -6.252805, 106.818133);
    const b = haversineKm(-6.252805, 106.818133, -6.26, 106.81);
    assert.ok(Math.abs(a - b) < 1e-9);
    assert.ok(a > 1.1 && a < 1.3, 'Warteg Bahari sekitar 1,2 km dari titik acuan, dapat ' + a);
  });
  test('Jakarta ke Bandung sekitar 118 km', () => {
    const km = haversineKm(-6.2088, 106.8456, -6.9175, 107.6191);
    assert.ok(km > 110 && km < 125, String(km));
  });
});
