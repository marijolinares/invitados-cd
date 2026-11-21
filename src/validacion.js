'use strict';

// Reglas de negocio del alta de invitados.
// Se mantienen separadas de Express para poder probarlas con pruebas unitarias.

const LIMITES = {
  nombre: 50,
  apellidos: 80,
  biografia: 500,
};

const ETIQUETAS = { nombre: 'nombre', apellidos: 'apellidos', biografia: 'biografía' };

const TIPOS_IMAGEN = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
};

function textoLimpio(valor) {
  return typeof valor === 'string' ? valor.trim() : '';
}

function validarCampos(datos) {
  const errores = {};
  const limpio = {
    nombre: textoLimpio(datos.nombre),
    apellidos: textoLimpio(datos.apellidos),
    biografia: textoLimpio(datos.biografia),
  };

  for (const campo of Object.keys(LIMITES)) {
    if (!limpio[campo]) {
      errores[campo] = `El campo ${ETIQUETAS[campo]} es obligatorio`;
    } else if (limpio[campo].length > LIMITES[campo]) {
      errores[campo] = `El campo ${ETIQUETAS[campo]} admite máximo ${LIMITES[campo]} caracteres`;
    }
  }

  // Nombre y apellidos: solo letras (incluye acentos y ñ), espacios, guion y apóstrofo.
  const soloLetras = /^[\p{L}][\p{L} '\-]*$/u;
  for (const campo of ['nombre', 'apellidos']) {
    if (!errores[campo] && !soloLetras.test(limpio[campo])) {
      errores[campo] = `El campo ${campo} solo admite letras`;
    }
  }

  return { valido: Object.keys(errores).length === 0, errores, datos: limpio };
}

function validarImagen(archivo, maxBytes) {
  if (!archivo) {
    return 'La imagen es obligatoria (jpg o png)';
  }
  const nombre = (archivo.originalname || '').toLowerCase();
  const extensiones = TIPOS_IMAGEN[archivo.mimetype];
  if (!extensiones || !extensiones.some((ext) => nombre.endsWith(ext))) {
    return 'Formato de imagen no permitido. Solo jpg o png';
  }
  if (!archivo.size) {
    return 'La imagen está vacía (0 bytes)';
  }
  if (archivo.size > maxBytes) {
    return `La imagen supera el tamaño máximo de ${Math.round(maxBytes / 1024)} KB`;
  }
  if (!firmaValida(archivo.buffer, archivo.mimetype)) {
    return 'El contenido del archivo no corresponde a una imagen jpg o png';
  }
  return null;
}

// Revisa los "magic bytes" para que no se cuele un archivo renombrado a .png
function firmaValida(buffer, mimetype) {
  if (!buffer || buffer.length < 4) return false;
  if (mimetype === 'image/png') {
    return buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
  }
  if (mimetype === 'image/jpeg') {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  return false;
}

module.exports = { validarCampos, validarImagen, firmaValida, LIMITES, TIPOS_IMAGEN };
