'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

// Almacén sencillo en archivo JSON + carpeta de imágenes.
// En Docker, DATA_DIR se monta como volumen para que los datos sobrevivan a un redespliegue.
class Almacen {
  constructor(dataDir) {
    this.dataDir = dataDir;
    this.archivo = path.join(dataDir, 'invitados.json');
    this.uploadsDir = path.join(dataDir, 'uploads');
    fs.mkdirSync(this.uploadsDir, { recursive: true });
    if (!fs.existsSync(this.archivo)) {
      this._guardar([]);
    }
  }

  _leer() {
    return JSON.parse(fs.readFileSync(this.archivo, 'utf8'));
  }

  _guardar(lista) {
    // Escritura atómica: primero a un temporal y luego rename.
    const tmp = `${this.archivo}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(lista, null, 2));
    fs.renameSync(tmp, this.archivo);
  }

  listar() {
    return this._leer().sort((a, b) => b.creadoEn.localeCompare(a.creadoEn));
  }

  contar() {
    return this._leer().length;
  }

  agregar({ nombre, apellidos, biografia }, imagen) {
    const id = crypto.randomUUID();
    const ext = imagen.mimetype === 'image/png' ? '.png' : '.jpg';
    const nombreImagen = `${id}${ext}`;
    fs.writeFileSync(path.join(this.uploadsDir, nombreImagen), imagen.buffer);

    const invitado = {
      id,
      nombre,
      apellidos,
      biografia,
      imagen: `/uploads/${nombreImagen}`,
      creadoEn: new Date().toISOString(),
    };
    const lista = this._leer();
    lista.push(invitado);
    this._guardar(lista);
    return invitado;
  }

  eliminar(id) {
    const lista = this._leer();
    const invitado = lista.find((i) => i.id === id);
    if (!invitado) return false;
    this._guardar(lista.filter((i) => i.id !== id));
    const ruta = path.join(this.uploadsDir, path.basename(invitado.imagen));
    fs.rmSync(ruta, { force: true });
    return true;
  }

  // Usado por /ready: comprueba que el volumen de datos se puede escribir.
  verificarEscritura() {
    const prueba = path.join(this.dataDir, '.ready-check');
    fs.writeFileSync(prueba, String(Date.now()));
    fs.rmSync(prueba, { force: true });
    return true;
  }
}

module.exports = { Almacen };
