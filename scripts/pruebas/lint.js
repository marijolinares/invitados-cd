'use strict';

// Análisis estático mínimo sin dependencias: revisa la sintaxis de todos los .js
// y busca patrones prohibidos (console.log de depuración en src, secretos escritos a mano).
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const RAIZ = path.join(__dirname, '..', '..');
const CARPETAS = ['src', 'public', 'test', 'scripts'];
const PROHIBIDOS = [
  { patron: /debugger;/, mensaje: 'sentencia debugger olvidada' },
  { patron: /(ghp_|github_pat_)[A-Za-z0-9_]{20,}/, mensaje: 'posible token de GitHub en el código' },
];

function archivosJs(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const ruta = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === 'node_modules' ? [] : archivosJs(ruta);
    return e.name.endsWith('.js') ? [ruta] : [];
  });
}

let errores = 0;
const archivos = CARPETAS.flatMap((c) => archivosJs(path.join(RAIZ, c)));
for (const archivo of archivos) {
  const rel = path.relative(RAIZ, archivo);
  try {
    execFileSync(process.execPath, ['--check', archivo], { stdio: 'pipe' });
  } catch (err) {
    errores += 1;
    console.error(`✗ ${rel}: error de sintaxis\n${err.stderr}`);
    continue;
  }
  const texto = fs.readFileSync(archivo, 'utf8');
  for (const { patron, mensaje } of PROHIBIDOS) {
    if (patron.test(texto) && !rel.endsWith('lint.js')) {
      errores += 1;
      console.error(`✗ ${rel}: ${mensaje}`);
    }
  }
}

if (errores) {
  console.error(`\nLint falló con ${errores} problema(s).`);
  process.exit(1);
}
console.log(`✓ Lint correcto en ${archivos.length} archivos`);
