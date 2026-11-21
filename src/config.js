'use strict';

const path = require('node:path');

// Toda la configuración viene de variables de entorno (12-factor).
// Los valores por defecto solo sirven para desarrollo local.
function cargarConfig(env = process.env) {
  const entorno = env.APP_ENV || 'development';

  const config = {
    entorno,
    puerto: Number(env.PORT || 3000),
    version: env.APP_VERSION || 'dev',
    commit: env.GIT_SHA || 'local',
    dataDir: path.resolve(env.DATA_DIR || path.join(__dirname, '..', 'data')),
    adminUser: env.ADMIN_USER || 'admin',
    adminPassword: env.ADMIN_PASSWORD || 'admin123',
    sesionMinutos: Number(env.SESSION_MINUTES || 60),
    imagenMaxBytes: Number(env.IMAGE_MAX_BYTES || 2 * 1024 * 1024),
    logLevel: env.LOG_LEVEL || 'info',
  };

  // En staging y producción no se permiten credenciales por defecto.
  if (entorno !== 'development' && entorno !== 'test') {
    if (!env.ADMIN_PASSWORD || env.ADMIN_PASSWORD.length < 8) {
      throw new Error('ADMIN_PASSWORD es obligatoria (mínimo 8 caracteres) fuera de desarrollo');
    }
  }

  return config;
}

module.exports = { cargarConfig };
