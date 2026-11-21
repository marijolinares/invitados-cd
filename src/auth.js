'use strict';

const crypto = require('node:crypto');

// Sesiones en memoria con token opaco y expiración.
class Sesiones {
  constructor({ usuario, password, minutos }) {
    this.usuario = usuario;
    this.password = password;
    this.duracionMs = minutos * 60 * 1000;
    this.tokens = new Map();
  }

  iniciar(usuario, password) {
    if (!comparar(usuario, this.usuario) || !comparar(password, this.password)) {
      return null;
    }
    const token = crypto.randomBytes(32).toString('hex');
    this.tokens.set(token, Date.now() + this.duracionMs);
    return token;
  }

  valido(token) {
    const expira = this.tokens.get(token);
    if (!expira) return false;
    if (Date.now() >= expira) {
      this.tokens.delete(token);
      return false;
    }
    return true;
  }

  cerrar(token) {
    this.tokens.delete(token);
  }

  middleware() {
    return (req, res, next) => {
      const encabezado = req.get('authorization') || '';
      const token = encabezado.startsWith('Bearer ') ? encabezado.slice(7) : '';
      if (!this.valido(token)) {
        return res.status(401).json({ error: 'Sesión no válida. Inicia sesión como administrador' });
      }
      req.token = token;
      next();
    };
  }
}

// Comparación en tiempo constante para no filtrar información por timing.
function comparar(a, b) {
  const ba = Buffer.from(String(a ?? ''));
  const bb = Buffer.from(String(b ?? ''));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

module.exports = { Sesiones };
