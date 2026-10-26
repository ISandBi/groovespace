# GrooveSpace — instalación, accesos y API

## Inicio local

1. Copia `.env.example` a `.env`. Configura MongoDB, Stripe, el origen del frontend y secretos independientes para bandas, administración e ingeniería.
2. Para desarrollo, usa claves de prueba de Stripe. Configura `STRIPE_WEBHOOK_SECRET` para los eventos `checkout.session.completed`, `checkout.session.expired`, `checkout.session.async_payment_succeeded` y `checkout.session.async_payment_failed` en `/api/payments/webhook`.
3. En `groovespace-frontend`, copia `.env.example` a `.env` y configura `VITE_API_URL` con la URL base del backend, por ejemplo `http://localhost:5000/api`.
4. Inicia MongoDB y ejecuta `npm run dev` desde las carpetas `groovespace-backend` y `groovespace-frontend`.

El API escucha por defecto en `http://localhost:5000/api`. La interfaz usa rutas de acceso independientes:
Si agregas/modificas rutas en el backend, reinicia el proceso de Node para cargarlas. En desarrollo, CORS acepta los alias `localhost` y `127.0.0.1` en el mismo protocolo/puerto de `FRONTEND_URL`.

Si el formulario muestra `Unexpected token '<'` o indica que la API respondió HTML, comprueba que `VITE_API_URL` apunte al backend y reinicia el backend para cargar las rutas actualizadas; las respuestas JSON no deben provenir del servidor de desarrollo de Vite.

| Ruta del sitio | Uso |
| --- | --- |
| `/banda` | Registro o inicio de sesión de banda; con sesión activa muestra el perfil. |
| `/administracion` | Acceso al panel administrativo. |
| `/ingenieria` | Acceso a la agenda de ingeniería. |
| `/qa` | Panel web protegido para iniciar pruebas y observar el mini-SIEM en tiempo real. |

## Datos para iniciar sesión

### Administración (solo desarrollo local)

Si no se configuran variables de entorno y `NODE_ENV` no es `production`, las credenciales de desarrollo incluidas en el código son:

- Usuario: `admin_groove`
- Contraseña: `space2026`

Se pueden reemplazar con `STAFF_USERNAME` y `STAFF_PASSWORD`. En producción no existen credenciales predeterminadas: configura ambas variables y `STAFF_TOKEN_SECRET`. No publiques ni reutilices las credenciales de desarrollo.

### Ingeniería (solo desarrollo local)

Elige el perfil en la pantalla `/ingenieria` y usa su usuario y contraseña locales:

| Perfil | ID enviado al API | Usuario | Contraseña |
| --- | --- | --- | --- |
| Ana Torres | `eng-ana` | `ana_groove` | `ana2026` |
| Mateo Ruiz | `eng-mateo` | `mateo_groove` | `mateo2026` |
| Lucía Vega | `eng-lucia` | `lucia_groove` | `lucia2026` |
| Diego Salas | `eng-diego` | `diego_groove` | `diego2026` |

En producción, configura `ENGINEER_ANA_USERNAME` / `ENGINEER_ANA_PASSWORD` y los equivalentes para `MATEO`, `LUCIA` y `DIEGO`. Configura también `ENGINEER_TOKEN_SECRET`. Los valores de desarrollo anteriores solo se usan cuando `NODE_ENV` no es `production` y no hay variables específicas configuradas.

### Banda

No hay usuario ni contraseña de banda predefinidos. Registra la banda desde `/banda` con un nombre de correo y elige un dominio del selector cargado desde MongoDB (`gmail.com`, `hotmail.com` u `outlook.com`); la API valida el dominio de nuevo en el servidor. La contraseña debe tener al menos 10 caracteres. Para iniciar sesión, usa el correo completo y la misma contraseña. La API devuelve un token de acceso al completar el registro o el inicio de sesión. `BAND_TOKEN_SECRET` es obligatorio en producción.

## Endpoints HTTP

En las tablas, todas las rutas son relativas a `/api`. Los endpoints marcados con **Banda**, **Administración** o **Ingeniería** requieren `Authorization: Bearer <token>` del rol correspondiente. Los endpoints de login son públicos y cuentan con límite de intentos.

### Bandas y perfiles

| Método | Ruta | Acceso | Uso |
| --- | --- | --- | --- |
| `POST` | `/bands/register` | Público; multipart/form-data | Registrar banda, perfil de líder, email, contraseña, logo e instrumentos con fotos. |
| `POST` | `/bands/login` | Público | Iniciar sesión de banda con `{ "email", "password" }`. |
| `GET` | `/bands/engineers` | Público | Consultar perfiles de ingeniería disponibles. |
| `GET` | `/bands/email-domains` | Público | Consultar los dominios permitidos para registrar el correo de una banda (`gmail.com`, `hotmail.com`, `outlook.com`), obtenidos desde MongoDB. |
| `GET` | `/bands/all` | Administración | Listar bandas registradas. |
| `POST` | `/bands/invite` | Banda | Crear invitación para integrantes. |
| `GET` | `/bands/invite/:token` | Público | Consultar una invitación. |
| `POST` | `/bands/invite/:token/members` | Público | Añadir integrante con `{ "name", "instrument" }`. |
| `GET` | `/bands/:bandId/profile` | Banda propietaria | Consultar el perfil de la banda autenticada. |
| `PATCH` | `/bands/:bandId/profile` | Banda propietaria | Actualizar datos del perfil. |
| `POST` | `/bands/:bandId/instruments` | Banda propietaria; multipart/form-data | Añadir instrumentos (hasta 12) con sus fotografías. |
| `DELETE` | `/bands/:bandId` | Administración | Eliminar permanentemente una banda, sus reservas y horarios, integrantes, instrumentos y archivos; usa transacción cuando MongoDB es replica set. |
| `DELETE` | `/bands/:bandId/members/:memberId` | Banda propietaria | Quitar integrante del perfil. |

### Administración e ingeniería

| Método | Ruta | Acceso | Uso |
| --- | --- | --- | --- |
| `POST` | `/staff/login` | Público; limitado | Iniciar sesión administrativa con `{ "username", "password" }`. |
| `POST` | `/engineers/login` | Público; limitado | Iniciar sesión con `{ "engineerId", "username", "password" }`. |
| `GET` | `/engineers/me/schedule` | Ingeniería | Consultar la agenda del ingeniero autenticado. |

### Monitor mini SIEM para QA

El monitor solo funciona fuera de producción y requiere `QA_MONITORING_ENABLED=true` más un `QA_INGEST_TOKEN` aleatorio de al menos 32 caracteres. Configura `QA_HASH_SECRET` como secreto privado e independiente para pseudonimizar datos; si no está configurado, se utiliza `STAFF_TOKEN_SECRET`. Mantén apagada esta función fuera del entorno QA y nunca reutilices un token de sesión administrativa.

Para habilitarlo en desarrollo local, agrega al `.env` del backend `NODE_ENV=development`, `QA_MONITORING_ENABLED=true`, `QA_INGEST_TOKEN=<secreto aleatorio de 32+ caracteres>` y `QA_HASH_SECRET=<otro secreto aleatorio>`, y reinicia el backend. El `.env` está excluido de Git; no compartas esos secretos.

Para el uso normal de QA, abre `http://localhost:5173/qa` en el navegador, pega el token QA que te proporcione el administrador y selecciona **Conectar monitor**. Después, pulsa **Abrir sitio para probar** para abrir GrooveSpace en otra pestaña. El panel web muestra el flujo en tiempo real sin usar consola ni terminal. El token se conserva solo en la sesión temporal del navegador y no se incluye en la dirección web.


Para etiquetar el uso de la aplicación, el panel abre el sitio en una pestaña QA y transmite el token mediante mensajería entre ventanas del mismo origen. No es necesario abrir la consola del navegador. Se guarda la acción de copiar y la ruta, nunca el texto del portapapeles.

| Método | Ruta | Acceso | Uso |
| --- | --- | --- | --- |
| `GET` | `/qa/events?limit=50` | Token QA | Consultar los últimos eventos persistidos (máximo 100); admite `after=<fecha ISO>`. |
| `GET` | `/qa/events/stream` | Token QA | Flujo SSE en tiempo real; envía los últimos 25 eventos al conectar y luego los eventos nuevos. |
| `POST` | `/qa/events` | Token QA | Registrar `ui_navigation` o `ui_copy` de la interfaz, con ruta y `qaSessionId` opaco; no enviar contenido copiado. |

En las solicitudes al monitor usa `Authorization: Bearer <QA_INGEST_TOKEN>`. Las demás solicitudes de la app solo se registran cuando llevan `X-QA-Token: <QA_INGEST_TOKEN>`; sin ese encabezado no se audita la actividad de usuarios normales. Para etiquetar la sesión usa `X-QA-Session-Id`. El middleware registra acciones nombradas, resultado HTTP, duración y alertas de exploración repetida o volumen alto (180 solicitudes/minuto por sesión QA). La pestaña de pruebas recibe las cabeceras QA automáticamente cuando se abre desde el panel web `/qa`. Se guarda la acción de copiar y la ruta, nunca el texto del portapapeles. No es necesario usar un cliente de terminal para las pruebas desde el panel.

Cada evento incluye `description` con la acción interpretada, método/ruta saneada, resultado HTTP y duración; el resumen técnico se conserva en `summary`. Las solicitudes no marcadas con token QA se excluyen antes de registrar cualquier evento o calcular alertas por volumen.

Los eventos no incluyen contraseñas, cuerpos de solicitud ni texto copiado; las IP e identificadores de actor se guardan como hashes HMAC, con retención TTL de 30 días en MongoDB. Las alertas por patrones son heurísticas: el navegador no puede detectar de forma fiable inspección de DevTools ni extracción de código fuente público. El flujo en tiempo real usa memoria del proceso y requiere una sola instancia del backend para distribuir eventos live; el historial sí se conserva en MongoDB. No es un SIEM certificado ni sustituye monitoreo de infraestructura.

La eliminación de bandas es irreversible: también elimina reservas y el historial local asociado a pagos; no realiza reembolsos ni elimina registros dentro de Stripe. Antes de borrar, intenta expirar sesiones de Checkout abiertas y bloquea la acción si detecta un pago completado aún en proceso. En MongoDB replica set se usa una transacción; en una instancia standalone se usa borrado secuencial y, ante un fallo parcial, el endpoint informa que debe reintentarse. Configura políticas de retención y conciliación financiera antes de usarlo en producción.

### Reservas y salas

| Método | Ruta | Acceso | Uso |
| --- | --- | --- | --- |
| `POST` | `/reservations/book` | Banda | Crear reserva; el cuerpo contiene `bandId`, `roomId`, `date`, `startTime`, `duration`, `attendees` y opcionalmente `rentedGear`. |
| `POST` | `/reservations/demo` | Banda; solo entorno no productivo | Crear o recuperar una reserva 3D; cuerpo opcional `{ "roomId": "sala_estudio_a" }` o `{ "roomId": "sala_orquesta_e" }`. |
| `GET` | `/reservations/all` | Administración | Consultar reservas operativas. |
| `GET` | `/reservations/room/:roomId?date=YYYY-MM-DD` | Público | Consultar ocupación de una sala y, opcionalmente, de una fecha. |
| `GET` | `/reservations/band/:bandId` | Banda propietaria | Consultar reservas de la banda autenticada. |
| `GET` | `/reservations/:reservationId` | Banda propietaria | Consultar una reserva. |
| `PATCH` | `/reservations/:reservationId/layout` | Banda propietaria | Guardar la distribución 3D de instrumentos tras confirmar el anticipo. |

### Pagos Stripe

| Método | Ruta | Acceso | Uso |
| --- | --- | --- | --- |
| `POST` | `/payments/checkout` | Banda propietaria | Crear Stripe Checkout; cuerpo `{ "reservationId", "paymentType": "deposit" \| "balance" }`. |
| `GET` | `/payments/verify/:reservationId/:sessionId` | Banda propietaria | Verificar la sesión Stripe al regresar del checkout. |
| `POST` | `/payments/webhook` | Stripe; firma requerida | Procesar eventos de Stripe con el cuerpo HTTP sin modificar. |

También está disponible `GET /api/health` para comprobar el estado del servicio. Las fotos cargadas se sirven bajo `/uploads`.

El catálogo incluye la **Sala E · Orquesta** (`sala_orquesta_e`), con capacidad de hasta 100 músicos y personalización 3D disponible después de confirmar el anticipo. En el modo de demostración, la escena presenta la fotografía real de la sala como entorno y los instrumentos registrados con sus fotografías; permite moverlos y guardar el layout. Cada banda puede tener hasta 100 integrantes registrados.

## Pagos y seguridad

El pago con tarjeta usa Stripe Checkout alojado: GrooveSpace no recibe ni almacena números de tarjeta ni códigos de seguridad. La API comprueba la propiedad de la reserva, importe, moneda, estado y firma del webhook antes de marcar un pago como confirmado. Una reserva pendiente de anticipo se mantiene hasta 35 minutos; el saldo debe liquidarse al menos 24 horas antes de la sesión.

Se aplican controles de validación, autenticación por rol, límite de intentos en registro/login, límites de cuerpo, cabeceras HTTP y validación de webhook como medidas de defensa inspiradas en OWASP y PCI DSS. Esto no constituye una auditoría ni certificación de cumplimiento. Antes de producción, configura HTTPS, secretos fuertes y persistentes, credenciales individuales, Stripe en modo adecuado y pruebas de webhook en staging; no uses las credenciales predeterminadas locales en un despliegue.

La selección de dominio de correo es una validación de lista permitida almacenada en MongoDB, con opciones iniciales `gmail.com`, `hotmail.com` y `outlook.com`. Este control se alinea con prácticas de configuración segura (OWASP A05), pero OWASP A05 no es un estándar específico de direcciones de correo.

Usa Stripe en modo prueba hasta validar en staging el pago correcto, cancelación, expiración, liquidación del saldo, recepción de webhooks y bloqueo/liberación de horarios. Una redirección exitosa del navegador por sí sola no confirma el pago.
