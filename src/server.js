'use strict';

const { cargarConfig } = require('./config');
const { crearApp } = require('./app');

const config = cargarConfig();
const app = crearApp(config);

const servidor = app.listen(config.puerto, () => {
  console.log(
    JSON.stringify({
      nivel: 'info',
      msg: 'servidor iniciado',
      puerto: config.puerto,
      entorno: config.entorno,
      version: config.version,
    }),
  );
});

// Apagado ordenado: Docker manda SIGTERM al redesplegar.
function apagar(senal) {
  console.log(JSON.stringify({ nivel: 'info', msg: `recibido ${senal}, cerrando` }));
  servidor.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on('SIGTERM', () => apagar('SIGTERM'));
process.on('SIGINT', () => apagar('SIGINT'));
