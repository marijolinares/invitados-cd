'use strict';

// Pruebas automatizadas de aceptación. Cada bloque corresponde a un caso de prueba
// documentado en docs/casos-de-prueba.md (CP-01 ... CP-06) con el mismo formato
// de la plantilla: propósito, prerrequisitos, datos de prueba y pasos.
//
// Uso:
//   npm run test:aceptacion                                  -> levanta la app en memoria
//   BASE_URL=http://localhost:8081 ADMIN_PASSWORD=... npm run test:aceptacion  -> contra staging

const test = require('node:test');
const assert = require('node:assert/strict');
const { prepararEntorno, imagen } = require('./entorno');

let env;
let token;

test.before(async () => {
  env = await prepararEntorno();
});

test.after(async () => {
  // Limpieza: borra los invitados que crearon estas pruebas para no ensuciar staging.
  if (token) {
    const lista = await (await fetch(`${env.baseUrl}/api/invitados`)).json();
    for (const inv of lista.filter((i) => i.biografia.startsWith('[prueba-automatizada]'))) {
      await fetch(`${env.baseUrl}/api/invitados/${inv.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
    }
  }
  await env.cerrar();
});

async function login(usuario, password) {
  return fetch(`${env.baseUrl}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usuario, password }),
  });
}

function formulario({ nombre, apellidos, biografia, archivo, tipo, nombreArchivo }) {
  const fd = new FormData();
  if (nombre !== undefined) fd.append('nombre', nombre);
  if (apellidos !== undefined) fd.append('apellidos', apellidos);
  if (biografia !== undefined) fd.append('biografia', biografia);
  if (archivo !== undefined) fd.append('imagen', new Blob([archivo], { type: tipo }), nombreArchivo);
  return fd;
}

async function agregar(datos, conToken = token) {
  const headers = conToken ? { Authorization: `Bearer ${conToken}` } : {};
  return fetch(`${env.baseUrl}/api/invitados`, { method: 'POST', headers, body: formulario(datos) });
}

const BIO = '[prueba-automatizada] Ejecutiva de tecnología y conferencista.';

// ---------------------------------------------------------------------------
test('CP-01 Inicio de sesión del administrador', async (t) => {
  await t.test('usuario y contraseña válidos -> token', async () => {
    const r = await login(env.usuario, env.password);
    assert.equal(r.status, 200);
    const cuerpo = await r.json();
    assert.ok(cuerpo.token);
    token = cuerpo.token;
  });

  const invalidos = [
    ['usuario inválido', 'noexiste', env?.password],
    ['contraseña inválida', 'admin', 'incorrecta'],
    ['ambos vacíos', '', ''],
  ];
  for (const [caso, u, p] of invalidos) {
    await t.test(`${caso} -> 401 con mensaje`, async () => {
      const r = await login(u, p ?? '');
      assert.equal(r.status, 401);
      assert.equal((await r.json()).error, 'Usuario o contraseña incorrectos');
    });
  }
});

// ---------------------------------------------------------------------------
test('CP-02 Agregar invitado con datos válidos', async (t) => {
  const combinaciones = [
    { etiqueta: 'png', nombre: 'Andrea', apellidos: 'Parra López', archivo: imagen('invitado.png'), tipo: 'image/png', nombreArchivo: 'andrea.png' },
    { etiqueta: 'jpg con acentos y ñ', nombre: 'José', apellidos: 'Muñoz Peña', archivo: imagen('invitado.jpg'), tipo: 'image/jpeg', nombreArchivo: 'jose.jpg' },
  ];
  for (const c of combinaciones) {
    await t.test(c.etiqueta, async () => {
      const r = await agregar({ ...c, biografia: BIO });
      assert.equal(r.status, 201);
      const cuerpo = await r.json();
      assert.equal(cuerpo.mensaje, 'Invitado agregado');
      assert.equal(cuerpo.invitado.nombre, c.nombre);
      // La imagen quedó publicada
      const img = await fetch(`${env.baseUrl}${cuerpo.invitado.imagen}`);
      assert.equal(img.status, 200);
      assert.match(img.headers.get('content-type'), /image\/(png|jpeg)/);
    });
  }

  await t.test('biografía con caracteres especiales se guarda tal cual', async () => {
    const bio = `${BIO} Habla de C# & "IA" <hoy>`;
    const r = await agregar({ nombre: 'Ana', apellidos: 'Ruiz', biografia: bio, archivo: imagen('invitado.png'), tipo: 'image/png', nombreArchivo: 'ana.png' });
    assert.equal(r.status, 201);
    assert.equal((await r.json()).invitado.biografia, bio);
  });
});

// ---------------------------------------------------------------------------
test('CP-03 Agregar invitado (campos en blanco y archivos no válidos)', async (t) => {
  const base = { nombre: 'Andrea', apellidos: 'Parra López', biografia: BIO, archivo: imagen('invitado.png'), tipo: 'image/png', nombreArchivo: 'a.png' };

  const casos = [
    ['nombre vacío', { nombre: '' }, 'nombre'],
    ['nombre con solo espacios', { nombre: '   ' }, 'nombre'],
    ['apellidos vacíos', { apellidos: '' }, 'apellidos'],
    ['biografía vacía', { biografia: '' }, 'biografia'],
    ['nombre con números', { nombre: 'Andrea2' }, 'nombre'],
    ['nombre de 51 caracteres', { nombre: 'a'.repeat(51) }, 'nombre'],
    ['sin imagen', { archivo: undefined }, 'imagen'],
    ['archivo de 0 bytes', { archivo: imagen('vacio.png'), nombreArchivo: 'vacio.png' }, 'imagen'],
    ['archivo pdf', { archivo: imagen('documento.pdf'), tipo: 'application/pdf', nombreArchivo: 'doc.pdf' }, 'imagen'],
    ['texto renombrado a .png', { archivo: imagen('falso.png'), nombreArchivo: 'falso.png' }, 'imagen'],
    ['imagen mayor a 2 MB', { archivo: Buffer.concat([imagen('invitado.png'), Buffer.alloc(2 * 1024 * 1024)]), nombreArchivo: 'grande.png' }, 'imagen'],
  ];

  const antes = (await (await fetch(`${env.baseUrl}/api/invitados`)).json()).length;

  for (const [caso, cambio, campo] of casos) {
    await t.test(caso, async () => {
      const r = await agregar({ ...base, ...cambio });
      assert.equal(r.status, 400);
      const cuerpo = await r.json();
      assert.ok(cuerpo.errores[campo], `se esperaba mensaje de error en ${campo}`);
    });
  }

  await t.test('ningún registro inválido se guardó', async () => {
    const despues = (await (await fetch(`${env.baseUrl}/api/invitados`)).json()).length;
    assert.equal(despues, antes);
  });
});

// ---------------------------------------------------------------------------
test('CP-04 Consultar la sección de invitados', async () => {
  const r = await fetch(`${env.baseUrl}/api/invitados`);
  assert.equal(r.status, 200);
  const lista = await r.json();
  const andrea = lista.find((i) => i.nombre === 'Andrea' && i.biografia === BIO);
  assert.ok(andrea, 'el invitado de CP-02 aparece en la lista');
  for (const campo of ['id', 'nombre', 'apellidos', 'biografia', 'imagen', 'creadoEn']) {
    assert.ok(andrea[campo], `falta ${campo}`);
  }
});

// ---------------------------------------------------------------------------
test('CP-05 Agregar invitado sin sesión de administrador', async (t) => {
  const datos = { nombre: 'Intruso', apellidos: 'Sin Sesión', biografia: BIO, archivo: imagen('invitado.png'), tipo: 'image/png', nombreArchivo: 'x.png' };
  for (const [caso, tk] of [['sin token', ''], ['token inventado', 'abc123']]) {
    await t.test(caso, async () => {
      const r = await agregar(datos, tk);
      assert.equal(r.status, 401);
    });
  }
});

// ---------------------------------------------------------------------------
test('CP-06 Verificación operativa del entorno (smoke)', async (t) => {
  await t.test('/health responde ok', async () => {
    const r = await fetch(`${env.baseUrl}/health`);
    assert.equal(r.status, 200);
    assert.equal((await r.json()).estado, 'ok');
  });
  await t.test('/ready confirma volumen de datos escribible', async () => {
    const r = await fetch(`${env.baseUrl}/ready`);
    assert.equal(r.status, 200);
  });
  await t.test('/api/version informa versión y entorno', async () => {
    const v = await (await fetch(`${env.baseUrl}/api/version`)).json();
    assert.ok(v.version && v.entorno);
    if (process.env.EXPECTED_VERSION) assert.equal(v.version, process.env.EXPECTED_VERSION);
  });
  await t.test('/metrics expone métricas de Prometheus', async () => {
    const txt = await (await fetch(`${env.baseUrl}/metrics`)).text();
    for (const m of ['app_info', 'http_requests_total', 'http_request_duration_seconds_bucket', 'invitados_registrados']) {
      assert.match(txt, new RegExp(m));
    }
  });
  await t.test('la página principal carga', async () => {
    const r = await fetch(`${env.baseUrl}/`);
    assert.equal(r.status, 200);
    assert.match(await r.text(), /Iniciar sesión/);
  });
});
