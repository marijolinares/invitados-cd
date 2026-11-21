'use strict';

const path = require('node:path');
const express = require('express');
const multer = require('multer');

const { Almacen } = require('./almacen');
const { Sesiones } = require('./auth');
const { Metricas } = require('./metricas');
const { validarCampos, validarImagen } = require('./validacion');

function crearApp(config) {
  const app = express();
  const almacen = new Almacen(config.dataDir);
  const sesiones = new Sesiones({
    usuario: config.adminUser,
    password: config.adminPassword,
    minutos: config.sesionMinutos,
  });
  const metricas = new Metricas({ version: config.version, entorno: config.entorno });
  metricas.invitadosRegistrados = almacen.contar();

  const subida = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: config.imagenMaxBytes, files: 1, fields: 10 },
  });

  app.disable('x-powered-by');
  app.use(metricas.middleware());
  app.use(express.json({ limit: '10kb' }));

  // Encabezados de seguridad básicos
  app.use((req, res, next) => {
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('X-Frame-Options', 'DENY');
    res.set('Referrer-Policy', 'no-referrer');
    next();
  });

  // ---------- Endpoints operativos (los usa el pipeline y el monitoreo) ----------

  // Liveness: el proceso responde
  app.get('/health', (req, res) => {
    res.json({ estado: 'ok' });
  });

  // Readiness: el proceso puede atender (volumen de datos escribible)
  app.get('/ready', (req, res) => {
    try {
      almacen.verificarEscritura();
      res.json({ estado: 'listo' });
    } catch (err) {
      res.status(503).json({ estado: 'no-listo', detalle: err.message });
    }
  });

  app.get('/metrics', (req, res) => {
    metricas.invitadosRegistrados = almacen.contar();
    res.type('text/plain; version=0.0.4').send(metricas.exponer());
  });

  app.get('/api/version', (req, res) => {
    res.json({ version: config.version, commit: config.commit, entorno: config.entorno });
  });

  // ---------- Autenticación ----------

  app.post('/api/login', (req, res) => {
    const { usuario, password } = req.body || {};
    const token = sesiones.iniciar(usuario, password);
    if (!token) {
      metricas.loginsFallidos += 1;
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
    }
    res.json({ token });
  });

  app.post('/api/logout', sesiones.middleware(), (req, res) => {
    sesiones.cerrar(req.token);
    res.status(204).end();
  });

  // ---------- Invitados ----------

  app.get('/api/invitados', (req, res) => {
    res.json(almacen.listar());
  });

  app.post('/api/invitados', sesiones.middleware(), (req, res, next) => {
    subida.single('imagen')(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        metricas.erroresValidacion += 1;
        const mensaje =
          err.code === 'LIMIT_FILE_SIZE'
            ? `La imagen supera el tamaño máximo de ${Math.round(config.imagenMaxBytes / 1024)} KB`
            : `Error en la carga del archivo: ${err.code}`;
        return res.status(400).json({ error: 'Datos no válidos', errores: { imagen: mensaje } });
      }
      if (err) return next(err);

      const { valido, errores, datos } = validarCampos(req.body || {});
      const errorImagen = validarImagen(req.file, config.imagenMaxBytes);
      if (errorImagen) errores.imagen = errorImagen;

      if (!valido || errorImagen) {
        metricas.erroresValidacion += 1;
        return res.status(400).json({ error: 'Datos no válidos', errores });
      }

      const invitado = almacen.agregar(datos, req.file);
      metricas.invitadosRegistrados = almacen.contar();
      res.status(201).json({ mensaje: 'Invitado agregado', invitado });
    });
  });

  app.delete('/api/invitados/:id', sesiones.middleware(), (req, res) => {
    if (!almacen.eliminar(req.params.id)) {
      return res.status(404).json({ error: 'Invitado no encontrado' });
    }
    metricas.invitadosRegistrados = almacen.contar();
    res.status(204).end();
  });

  // ---------- Archivos estáticos ----------

  app.use('/uploads', express.static(almacen.uploadsDir, { fallthrough: false, maxAge: '1h' }));
  app.use(express.static(path.join(__dirname, '..', 'public')));

  app.use('/api', (req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));

  // Manejador de errores: nunca exponer el stack al cliente
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    const estado = err.status || err.statusCode || 500;
    if (estado >= 500) console.error(JSON.stringify({ nivel: 'error', msg: err.message }));
    res.status(estado).json({ error: estado >= 500 ? 'Error interno' : err.message });
  });

  return app;
}

module.exports = { crearApp };
