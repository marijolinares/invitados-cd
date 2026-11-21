'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { Sesiones } = require('../../src/auth');
const { Metricas } = require('../../src/metricas');
const { cargarConfig } = require('../../src/config');

test('sesión: credenciales correctas generan token válido', () => {
  const s = new Sesiones({ usuario: 'admin', password: 'secreto123', minutos: 1 });
  const token = s.iniciar('admin', 'secreto123');
  assert.ok(token);
  assert.equal(s.valido(token), true);
  s.cerrar(token);
  assert.equal(s.valido(token), false);
});

test('sesión: credenciales incorrectas o vacías no generan token', () => {
  const s = new Sesiones({ usuario: 'admin', password: 'secreto123', minutos: 1 });
  assert.equal(s.iniciar('admin', 'otra'), null);
  assert.equal(s.iniciar('', ''), null);
  assert.equal(s.iniciar(undefined, undefined), null);
});

test('sesión: el token expira', () => {
  const s = new Sesiones({ usuario: 'a', password: 'b', minutos: 0 });
  const token = s.iniciar('a', 'b');
  assert.equal(s.valido(token), false);
});

test('métricas: expone contadores e histograma en formato Prometheus', () => {
  const m = new Metricas({ version: '1.2.3', entorno: 'test' });
  m.registrar('GET', '/health', 200, 0.01);
  m.registrar('GET', '/health', 200, 0.3);
  const txt = m.exponer();
  assert.match(txt, /app_info\{version="1.2.3",entorno="test"\} 1/);
  assert.match(txt, /http_requests_total\{method="GET",route="\/health",status="200"\} 2/);
  assert.match(txt, /http_request_duration_seconds_bucket\{method="GET",route="\/health",le="0.05"\} 1/);
  assert.match(txt, /http_request_duration_seconds_count\{method="GET",route="\/health"\} 2/);
});

test('config: fuera de desarrollo exige ADMIN_PASSWORD segura', () => {
  assert.throws(() => cargarConfig({ APP_ENV: 'production' }), /ADMIN_PASSWORD/);
  assert.throws(() => cargarConfig({ APP_ENV: 'staging', ADMIN_PASSWORD: 'corta' }), /ADMIN_PASSWORD/);
  assert.equal(cargarConfig({ APP_ENV: 'production', ADMIN_PASSWORD: 'larga-y-segura' }).entorno, 'production');
});
