'use strict';
const R = 6371; // km

/** Jarak Haversine (km) antara dua koordinat */
function haversineKm(lat1, lng1, lat2, lng2) {
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Ekspresi SQL Haversine; parameter berurutan: lat, lat, lng */
const HAVERSINE_SQL =
  '(6371 * 2 * ASIN(SQRT(POW(SIN(RADIANS(m.lat - ?) / 2), 2) + COS(RADIANS(?)) * COS(RADIANS(m.lat)) * POW(SIN(RADIANS(m.lng - ?) / 2), 2))))';

module.exports = { haversineKm, HAVERSINE_SQL };
