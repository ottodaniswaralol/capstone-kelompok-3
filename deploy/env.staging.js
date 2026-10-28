/* env.js versi staging: frontend dan API berada di domain yang sama (Nginx meneruskan /api ke backend).
   File ini menimpa frontend/js/env.js di dalam container web (lihat docker-compose.staging.yml). */
window.NGEWARTEG_API_BASE = window.NGEWARTEG_API_BASE !== undefined ? window.NGEWARTEG_API_BASE : '/api';
