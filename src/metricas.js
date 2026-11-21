'use strict';

// Métricas en formato de texto de Prometheus, sin dependencias externas.
// Se exponen en GET /metrics y Prometheus las recolecta cada 15 s.

const BUCKETS = [0.05, 0.1, 0.25, 0.5, 1, 2.5];

class Metricas {
  constructor({ version, entorno }) {
    this.version = version;
    this.entorno = entorno;
    this.inicio = Date.now();
    this.peticiones = new Map(); // "metodo|ruta|estado" -> total
    this.duraciones = new Map(); // "metodo|ruta" -> { buckets[], suma, total }
    this.erroresValidacion = 0;
    this.loginsFallidos = 0;
    this.invitadosRegistrados = 0; // se actualiza con el almacén
  }

  middleware() {
    return (req, res, next) => {
      const t0 = process.hrtime.bigint();
      res.on('finish', () => {
        // Usar la ruta declarada (/api/invitados/:id) evita miles de series distintas.
        const ruta = req.route ? req.baseUrl + req.route.path : rutaGenerica(req.path);
        const seg = Number(process.hrtime.bigint() - t0) / 1e9;
        this.registrar(req.method, ruta, res.statusCode, seg);
      });
      next();
    };
  }

  registrar(metodo, ruta, estado, segundos) {
    const k = `${metodo}|${ruta}|${estado}`;
    this.peticiones.set(k, (this.peticiones.get(k) || 0) + 1);

    const kd = `${metodo}|${ruta}`;
    let h = this.duraciones.get(kd);
    if (!h) {
      h = { buckets: BUCKETS.map(() => 0), suma: 0, total: 0 };
      this.duraciones.set(kd, h);
    }
    BUCKETS.forEach((b, i) => {
      if (segundos <= b) h.buckets[i] += 1;
    });
    h.suma += segundos;
    h.total += 1;
  }

  exponer() {
    const l = [];
    l.push('# HELP app_info Versión y entorno de la aplicación desplegada');
    l.push('# TYPE app_info gauge');
    l.push(`app_info{version="${this.version}",entorno="${this.entorno}"} 1`);

    l.push('# HELP app_uptime_seconds Segundos desde que arrancó el proceso');
    l.push('# TYPE app_uptime_seconds gauge');
    l.push(`app_uptime_seconds ${((Date.now() - this.inicio) / 1000).toFixed(0)}`);

    l.push('# HELP http_requests_total Peticiones HTTP atendidas');
    l.push('# TYPE http_requests_total counter');
    for (const [k, v] of this.peticiones) {
      const [metodo, ruta, estado] = k.split('|');
      l.push(`http_requests_total{method="${metodo}",route="${ruta}",status="${estado}"} ${v}`);
    }

    l.push('# HELP http_request_duration_seconds Latencia de las peticiones HTTP');
    l.push('# TYPE http_request_duration_seconds histogram');
    for (const [k, h] of this.duraciones) {
      const [metodo, ruta] = k.split('|');
      const etq = `method="${metodo}",route="${ruta}"`;
      BUCKETS.forEach((b, i) => {
        l.push(`http_request_duration_seconds_bucket{${etq},le="${b}"} ${h.buckets[i]}`);
      });
      l.push(`http_request_duration_seconds_bucket{${etq},le="+Inf"} ${h.total}`);
      l.push(`http_request_duration_seconds_sum{${etq}} ${h.suma.toFixed(6)}`);
      l.push(`http_request_duration_seconds_count{${etq}} ${h.total}`);
    }

    l.push('# HELP invitados_registrados Invitados guardados actualmente');
    l.push('# TYPE invitados_registrados gauge');
    l.push(`invitados_registrados ${this.invitadosRegistrados}`);

    l.push('# HELP invitados_errores_validacion_total Altas rechazadas por datos inválidos');
    l.push('# TYPE invitados_errores_validacion_total counter');
    l.push(`invitados_errores_validacion_total ${this.erroresValidacion}`);

    l.push('# HELP auth_login_fallidos_total Intentos de inicio de sesión fallidos');
    l.push('# TYPE auth_login_fallidos_total counter');
    l.push(`auth_login_fallidos_total ${this.loginsFallidos}`);

    const mem = process.memoryUsage();
    l.push('# HELP process_resident_memory_bytes Memoria residente del proceso');
    l.push('# TYPE process_resident_memory_bytes gauge');
    l.push(`process_resident_memory_bytes ${mem.rss}`);

    return l.join('\n') + '\n';
  }
}

function rutaGenerica(p) {
  if (p.startsWith('/uploads/')) return '/uploads/:archivo';
  if (p.startsWith('/api/')) return '/api/otra';
  return '/estatico';
}

module.exports = { Metricas, BUCKETS };
