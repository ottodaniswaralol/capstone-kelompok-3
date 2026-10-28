'use strict';
/**
 * Jam server dalam WIB (UTC+7, tanpa DST).
 * - offsetMs : dipakai alat demo (DEV_TOOLS) untuk menggeser jam
 * - pinned   : dipakai pengujian untuk mengunci waktu
 */
const WIB_MS = 7 * 3600 * 1000;
let offsetMs = 0;
let pinned = null;

const now = () => new Date((pinned ? pinned.getTime() : Date.now()) + offsetMs);
const wib = (d = now()) => new Date(d.getTime() + WIB_MS); // baca dengan getUTC*

function parts(d = now()) {
  const t = wib(d);
  return {
    date: t.toISOString().slice(0, 10),
    hour: t.getUTCHours(),
    minute: t.getUTCMinutes(),
    second: t.getUTCSeconds(),
  };
}
const minuteOfDay = (d = now()) => { const p = parts(d); return p.hour * 60 + p.minute; };
const dateString = (d = now()) => parts(d).date;
const dateTimeString = (d = now()) => wib(d).toISOString().slice(0, 19).replace('T', ' ');
const timeString = (d = now()) => { const p = parts(d); return String(p.hour).padStart(2, '0') + ':' + String(p.minute).padStart(2, '0'); };

function parseHHMM(s) {
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(String(s));
  return m ? Number(m[1]) * 60 + Number(m[2]) : NaN;
}
const formatHHMM = (min) => String(Math.floor(min / 60) % 24).padStart(2, '0') + ':' + String(min % 60).padStart(2, '0');

function advance(minutes) { offsetMs += minutes * 60000; }
function setTimeOfDay(hhmm) {
  const target = parseHHMM(hhmm);
  const p = parts();
  const currentMs = (p.hour * 60 + p.minute) * 60000 + p.second * 1000 + (now().getTime() % 1000);
  offsetMs += target * 60000 - currentMs;
}
function resetOffset() { offsetMs = 0; }
/** Kunci waktu (untuk uji): pin('2026-10-22T19:45:00+07:00') */
function pin(iso) { pinned = new Date(iso); offsetMs = 0; }
function unpin() { pinned = null; offsetMs = 0; }
const getOffsetMinutes = () => Math.round(offsetMs / 60000);

module.exports = { now, parts, minuteOfDay, dateString, dateTimeString, timeString, parseHHMM, formatHHMM, advance, setTimeOfDay, resetOffset, pin, unpin, getOffsetMinutes };
