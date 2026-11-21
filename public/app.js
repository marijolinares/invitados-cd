'use strict';

// Interfaz mínima para el administrador. Sin frameworks para que sea fácil de probar manualmente.
(function () {
  const $ = (id) => document.getElementById(id);
  let token = sessionStorage.getItem('token') || '';

  fetch('/api/version')
    .then((r) => r.json())
    .then((v) => { $('version').textContent = `v${v.version} · ${v.entorno}`; })
    .catch(() => {});

  function mostrarPanel(visible) {
    $('pantalla-login').hidden = visible;
    $('pantalla-panel').hidden = !visible;
    if (visible) cargarInvitados();
  }

  function mostrarSeccion(idSeccion) {
    document.querySelectorAll('.seccion').forEach((s) => { s.hidden = s.id !== idSeccion; });
    document.querySelectorAll('.tab[data-seccion]').forEach((t) => {
      t.classList.toggle('activa', t.dataset.seccion === idSeccion);
    });
    if (idSeccion === 'seccion-lista') cargarInvitados();
  }

  $('form-login').addEventListener('submit', async (e) => {
    e.preventDefault();
    $('login-error').textContent = '';
    const r = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuario: $('login-usuario').value, password: $('login-password').value }),
    });
    const datos = await r.json();
    if (!r.ok) {
      $('login-error').textContent = datos.error;
      return;
    }
    token = datos.token;
    sessionStorage.setItem('token', token);
    mostrarPanel(true);
  });

  document.querySelectorAll('.tab[data-seccion]').forEach((t) => {
    t.addEventListener('click', () => mostrarSeccion(t.dataset.seccion));
  });

  $('btn-salir').addEventListener('click', async () => {
    await fetch('/api/logout', { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
    sessionStorage.removeItem('token');
    token = '';
    mostrarPanel(false);
  });

  $('form-invitado').addEventListener('submit', async (e) => {
    e.preventDefault();
    ['nombre', 'apellidos', 'biografia', 'imagen'].forEach((c) => { $(`error-${c}`).textContent = ''; });
    $('mensaje').textContent = '';

    const r = await fetch('/api/invitados', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: new FormData(e.target),
    });
    const datos = await r.json();

    if (r.status === 401) {
      sessionStorage.removeItem('token');
      mostrarPanel(false);
      $('login-error').textContent = datos.error;
      return;
    }
    if (!r.ok) {
      Object.entries(datos.errores || {}).forEach(([campo, msg]) => {
        const nodo = $(`error-${campo}`);
        if (nodo) nodo.textContent = msg;
      });
      return;
    }
    $('mensaje').textContent = 'Invitado agregado';
    e.target.reset();
  });

  async function cargarInvitados() {
    const r = await fetch('/api/invitados');
    const lista = await r.json();
    $('lista-vacia').hidden = lista.length > 0;
    $('lista-invitados').innerHTML = '';
    for (const inv of lista) {
      const li = document.createElement('li');
      const img = document.createElement('img');
      img.src = inv.imagen;
      img.alt = `Foto de ${inv.nombre}`;
      const h = document.createElement('h3');
      h.textContent = `${inv.nombre} ${inv.apellidos}`;
      const p = document.createElement('p');
      p.textContent = inv.biografia; // textContent evita XSS
      li.append(img, h, p);
      $('lista-invitados').append(li);
    }
  }

  mostrarPanel(Boolean(token));
})();
