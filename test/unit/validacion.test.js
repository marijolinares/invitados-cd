'use strict';

// Pruebas unitarias de las reglas de negocio (base de la pirámide de pruebas).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { validarCampos, validarImagen } = require('../../src/validacion');

const FIX = path.join(__dirname, '..', 'fixtures');
const MAX = 2 * 1024 * 1024;

function archivo(nombre, mimetype, buffer) {
  return { originalname: nombre, mimetype, size: buffer.length, buffer };
}

const validos = { nombre: 'Andrea', apellidos: 'Parra López', biografia: 'Ejecutiva de tecnología.' };

test('acepta campos válidos y recorta espacios', () => {
  const r = validarCampos({ nombre: '  Andrea ', apellidos: 'Parra López', biografia: ' Bio ' });
  assert.equal(r.valido, true);
  assert.equal(r.datos.nombre, 'Andrea');
  assert.equal(r.datos.biografia, 'Bio');
});

test('acepta acentos, ñ, guion y apóstrofo en nombre', () => {
  const r = validarCampos({ ...validos, nombre: "María-José O'Neil", apellidos: 'Muñoz Peña' });
  assert.equal(r.valido, true);
});

for (const campo of ['nombre', 'apellidos', 'biografia']) {
  test(`rechaza ${campo} vacío`, () => {
    const r = validarCampos({ ...validos, [campo]: '' });
    assert.equal(r.valido, false);
    assert.match(r.errores[campo], /obligatorio/);
  });

  test(`rechaza ${campo} con solo espacios`, () => {
    const r = validarCampos({ ...validos, [campo]: '    ' });
    assert.equal(r.valido, false);
    assert.match(r.errores[campo], /obligatorio/);
  });
}

test('rechaza nombre con números o caracteres especiales', () => {
  for (const nombre of ['Andrea2', '<script>', '#Andrea', '&']) {
    const r = validarCampos({ ...validos, nombre });
    assert.equal(r.valido, false, `debió rechazar ${nombre}`);
  }
});

test('respeta los límites de longitud', () => {
  assert.equal(validarCampos({ ...validos, nombre: 'a'.repeat(50) }).valido, true);
  assert.equal(validarCampos({ ...validos, nombre: 'a'.repeat(51) }).valido, false);
  assert.equal(validarCampos({ ...validos, biografia: 'b'.repeat(500) }).valido, true);
  assert.equal(validarCampos({ ...validos, biografia: 'b'.repeat(501) }).valido, false);
});

test('la biografía sí admite caracteres especiales (se escapan al mostrar)', () => {
  const r = validarCampos({ ...validos, biografia: 'Habla de C# & "IA" <hoy>' });
  assert.equal(r.valido, true);
});

test('acepta png y jpg reales', () => {
  const png = fs.readFileSync(path.join(FIX, 'invitado.png'));
  const jpg = fs.readFileSync(path.join(FIX, 'invitado.jpg'));
  assert.equal(validarImagen(archivo('foto.png', 'image/png', png), MAX), null);
  assert.equal(validarImagen(archivo('foto.JPG', 'image/jpeg', jpg), MAX), null);
});

test('rechaza imagen ausente', () => {
  assert.match(validarImagen(undefined, MAX), /obligatoria/);
});

test('rechaza archivo de 0 bytes', () => {
  assert.match(validarImagen(archivo('vacio.png', 'image/png', Buffer.alloc(0)), MAX), /0 bytes/);
});

test('rechaza formatos no permitidos', () => {
  const pdf = fs.readFileSync(path.join(FIX, 'documento.pdf'));
  assert.match(validarImagen(archivo('doc.pdf', 'application/pdf', pdf), MAX), /no permitido/);
});

test('rechaza archivo renombrado a .png que no es imagen', () => {
  const falso = fs.readFileSync(path.join(FIX, 'falso.png'));
  assert.match(validarImagen(archivo('falso.png', 'image/png', falso), MAX), /no corresponde/);
});

test('rechaza imagen que supera el tamaño máximo', () => {
  const png = fs.readFileSync(path.join(FIX, 'invitado.png'));
  const grande = { ...archivo('g.png', 'image/png', png), size: MAX + 1 };
  assert.match(validarImagen(grande, MAX), /tamaño máximo/);
});
