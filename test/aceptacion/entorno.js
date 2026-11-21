'use strict';

// Decide contra qué entorno corren las pruebas de aceptación:
//  - Si existe BASE_URL (p. ej. http://localhost:8081 en staging), se prueban contra ese entorno ya desplegado.
//  - Si no, se levanta la app en memoria en un puerto libre con un directorio temporal (útil en CI y en local).
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

async function prepararEntorno() {
  if (process.env.BASE_URL) {
    return {
      baseUrl: process.env.BASE_URL.replace(/\/$/, ''),
      usuario: process.env.ADMIN_USER || 'admin',
      password: process.env.ADMIN_PASSWORD || 'admin123',
      cerrar: async () => {},
    };
  }

  const { crearApp } = require('../../src/app');
  const { cargarConfig } = require('../../src/config');
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'invitados-'));
  const config = cargarConfig({
    APP_ENV: 'test',
    DATA_DIR: dataDir,
    ADMIN_USER: 'admin',
    ADMIN_PASSWORD: 'admin123',
    APP_VERSION: 'test',
  });
  const servidor = await new Promise((ok) => {
    const s = crearApp(config).listen(0, () => ok(s));
  });
  return {
    baseUrl: `http://127.0.0.1:${servidor.address().port}`,
    usuario: 'admin',
    password: 'admin123',
    cerrar: async () => {
      await new Promise((ok) => servidor.close(ok));
      fs.rmSync(dataDir, { recursive: true, force: true });
    },
  };
}

function imagen(nombre) {
  return fs.readFileSync(path.join(__dirname, '..', 'fixtures', nombre));
}

module.exports = { prepararEntorno, imagen };
