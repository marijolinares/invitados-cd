# Casos de prueba — Registro de invitados (entorno de liberación)

Formato basado en la plantilla *ReadySET — Formato de Casos de Prueba* (Plan de QA › Conjunto de Pruebas).
Cada caso tiene su versión automatizada en `test/aceptacion/casos-de-prueba.test.js` con el mismo identificador
(CP-01 … CP-06), que el pipeline ejecuta en el entorno de liberación (staging). CP-07 lo ejecuta el job de
liberación con `scripts/despliegue/desplegar.sh`.

**Entorno de liberación:** `http://localhost:8081` (se genera con `scripts/entorno/crear-entorno.sh staging`).
**Archivos de prueba:** carpeta `test/fixtures/`.

---

## CP-01: Inicio de sesión del administrador

| | |
|---|---|
| **Propósito** | Comprobar que solo el administrador con credenciales correctas entra al panel y que las credenciales incorrectas o vacías muestran un mensaje de error. |
| **Prerrequisitos** | Entorno de liberación levantado y sano. Usuario `admin` configurado en `deploy/.env.staging`. Navegador sin sesión iniciada. |
| **Datos de prueba** | usuario = {admin, usuario inexistente, vacío}<br>password = {válida, inválida, vacía} |
| **Pasos** | 1. visitar `http://localhost:8081`<br>2. ver: LoginPage “Iniciar sesión”<br>3. introducir usuario<br>4. introducir password<br>5. hacer click en “Entrar”<br>6. ver: panel de administración con menú lateral (solo si usuario y password son válidos)<br>7. verificar el mensaje “Usuario o contraseña incorrectos” si algún dato es inválido<br>8. verificar que la barra superior muestra la versión y el entorno (`v1.0.N · staging`) |
| **Notas y preguntas** | • NOTA: con campos vacíos el navegador bloquea el envío; la API también responde 401 (lo cubre la prueba automatizada).<br>• NOTA: cada intento fallido incrementa la métrica `auth_login_fallidos_total`.<br>• PREGUNTA: ¿se debe bloquear la cuenta tras N intentos? Por ahora solo hay alerta en Prometheus (más de 20 en 5 min). |

## CP-02: Agregar invitado

| | |
|---|---|
| **Propósito** | Verificar que el administrador puede registrar un invitado con nombre, apellidos, biografía e imagen, y que aparece en la sección de invitados. |
| **Prerrequisitos** | Sesión iniciada como administrador (realizar CP-01 con datos válidos). |
| **Datos de prueba** | Nombre: {Andrea, José}<br>Apellidos: {Parra López, Muñoz Peña}<br>Biografía: {“Ejecutiva de tecnología y conferencista.”, “Habla de C# & "IA" <hoy>”}<br>Imagen: {invitado.png, invitado.jpg} |
| **Pasos** | 1. realizar CP-01 (login como administrador)<br>2. ver: menú lateral con las opciones<br>3. hacer click en la pestaña “Nuevo invitado”<br>4. introducir el nombre<br>5. introducir los apellidos<br>6. introducir la biografía de la persona invitada<br>7. añadir la imagen de la persona invitada<br>8. hacer click en el botón “Agregar”<br>9. ver: mensaje “Invitado agregado”<br>10. hacer click en “Invitados”<br>11. verificar que aparece la tarjeta con foto, nombre completo y biografía |
| **Notas y preguntas** | • NOTA: la biografía con `<hoy>` debe verse como texto, no interpretarse como HTML (protección XSS).<br>• NOTA: los acentos y la ñ deben guardarse sin alterarse. |

## CP-03: Agregar invitado (campos en blanco y carga de archivos no válidos)

| | |
|---|---|
| **Propósito** | Comprobar que el sistema rechaza espacios en blanco, valores fuera de rango y archivos no permitidos al registrar un invitado, mostrando el error junto a cada campo. |
| **Prerrequisitos** | Sesión iniciada como administrador. |
| **Datos de prueba** | nombre = {vacío, solo espacios “   ”, “Andrea2”, 51 caracteres}<br>apellidos = {vacío, solo espacios}<br>biografía = {vacío, 501 caracteres}<br>imagen = {sin archivo, vacio.png (0 bytes), documento.pdf, falso.png (texto renombrado), imagen mayor a 2 MB} |
| **Pasos** | 1. realizar CP-01 (login como administrador)<br>2. hacer click en la pestaña “Nuevo invitado”<br>3. introducir los campos con un valor no válido a la vez y el resto válidos<br>4. añadir la imagen indicada en los datos de prueba<br>5. hacer click en el botón “Agregar”<br>6. ver: mensaje de error en rojo debajo del campo no válido (p. ej. “El campo nombre es obligatorio”, “Formato de imagen no permitido. Solo jpg o png”, “La imagen está vacía (0 bytes)”)<br>7. verificar que NO aparece el mensaje “Invitado agregado”<br>8. hacer click en “Invitados”<br>9. verificar que no se agregó ningún registro nuevo |
| **Notas y preguntas** | • NOTA: los campos tienen `maxlength`, así que 51 caracteres no se pueden teclear en la interfaz; la prueba automatizada lo envía directo a la API.<br>• NOTA: la validación revisa los primeros bytes del archivo, por eso un `.txt` renombrado a `.png` se rechaza.<br>• NOTA: cada rechazo incrementa `invitados_errores_validacion_total`. |

## CP-04: Consultar la sección de invitados

| | |
|---|---|
| **Propósito** | Verificar que la lista de invitados muestra todos los registros con sus datos completos y su imagen. |
| **Prerrequisitos** | Al menos un invitado registrado (realizar CP-02). |
| **Datos de prueba** | Ninguno adicional. |
| **Pasos** | 1. realizar CP-01 (login como administrador)<br>2. hacer click en “Invitados” en el menú lateral<br>3. ver: sección “Invitados” con tarjetas<br>4. verificar que cada tarjeta tiene imagen, nombre completo y biografía<br>5. verificar que el invitado más reciente aparece primero |
| **Notas y preguntas** | • PREGUNTA: ¿la lista debe ser pública para la página del evento? Hoy `GET /api/invitados` no requiere sesión. |

## CP-05: Agregar invitado sin sesión de administrador

| | |
|---|---|
| **Propósito** | Comprobar que nadie puede registrar invitados sin un token de sesión válido. |
| **Prerrequisitos** | Entorno de liberación levantado. Terminal de PowerShell. |
| **Datos de prueba** | token = {sin token, token inventado “abc123”, token de una sesión cerrada} |
| **Pasos** | 1. abrir PowerShell<br>2. ejecutar `Invoke-WebRequest -Method Post http://localhost:8081/api/invitados -Headers @{Authorization="Bearer abc123"}`<br>3. ver: error HTTP 401<br>4. verificar el mensaje “Sesión no válida. Inicia sesión como administrador”<br>5. en el navegador, hacer click en “Cerrar sesión” y repetir el paso 2 con el token anterior<br>6. verificar que también responde 401 |
| **Notas y preguntas** | • NOTA: las sesiones viven en memoria; un redespliegue cierra todas las sesiones. |

## CP-06: Verificación operativa del entorno de liberación (smoke test)

| | |
|---|---|
| **Propósito** | Confirmar que la versión desplegada está viva, lista, expone métricas y responde dentro del SLO de latencia. |
| **Prerrequisitos** | Despliegue terminado en staging o producción. |
| **Datos de prueba** | url = {`http://localhost:8081` (staging), URL de producción}<br>versión = {la versión del pipeline, p. ej. 1.0.15} |
| **Pasos** | 1. visitar `/health`<br>2. verificar `{"estado":"ok"}`<br>3. visitar `/ready`<br>4. verificar `{"estado":"listo"}`<br>5. visitar `/api/version`<br>6. verificar que la versión es la esperada<br>7. visitar `/metrics`<br>8. verificar que existen `http_requests_total`, `http_request_duration_seconds` e `invitados_registrados`<br>9. verificar que `/health` responde en menos de 500 ms |
| **Notas y preguntas** | • NOTA: automatizado en `scripts/pruebas/smoke-test.sh`; se ejecuta después de cada despliegue. |

## CP-07: Despliegue con rollback automático

| | |
|---|---|
| **Propósito** | Comprobar que si una versión nueva no pasa la verificación, el entorno regresa solo a la versión anterior sin perder datos. |
| **Prerrequisitos** | Entorno staging corriendo una versión sana y con al menos un invitado registrado. |
| **Datos de prueba** | imagen = {versión sana nueva, versión que no arranca} |
| **Pasos** | 1. ejecutar `scripts/despliegue/desplegar.sh staging <imagen-sana> <versión>`<br>2. ver: “Despliegue exitoso”<br>3. ejecutar el mismo script con la imagen que no arranca<br>4. ver: “El despliegue falló la verificación. Iniciando rollback”<br>5. verificar que `/api/version` muestra la versión sana anterior<br>6. hacer click en “Invitados” en el navegador<br>7. verificar que los invitados registrados siguen ahí |
| **Notas y preguntas** | • NOTA: los datos viven en el volumen `datos`, por eso sobreviven al cambio de contenedor. |
