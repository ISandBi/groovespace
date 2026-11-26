# Especificación de Requisitos de Software (ERS)

## 1. Control del documento

| Campo | Valor |
|---|---|
| Producto | GrooveSpace |
| Tipo de documento | Especificación de Requisitos de Software |
| Versión | 1.0 |
| Estado | Línea base descriptiva de la implementación revisada |
| Idioma | Español |
| Alcance | Aplicación web, API, persistencia e integraciones actualmente presentes |

Esta ERS describe el comportamiento existente de GrooveSpace; no supone que
funciones no implementadas formen parte del producto. Los requisitos funcionales
identificados con `RF` y los no funcionales con `RNF` se basan en la interfaz,
la API, los modelos y la configuración del repositorio. Los valores que no están
definidos por la implementación se señalan expresamente como pendientes de
acuerdo.

## 2. Propósito y audiencia

El documento establece qué ofrece el sistema, quién lo utiliza, cómo se
procesan sus operaciones principales y bajo qué restricciones. Está dirigido a
responsables de producto, operación del estudio, desarrollo, QA y despliegue.

Sirve como referencia para:

- comprender los flujos de registro, reserva, pago, administración, ingeniería
  y QA;
- derivar pruebas de aceptación y regresión;
- identificar dependencias y reglas que afectan la operación;
- separar capacidades implementadas de capacidades aún no definidas.

Los diagramas complementarios están en [DIAGRAMAS.md](./DIAGRAMAS.md).

## 3. Alcance del producto

GrooveSpace es una aplicación web para consultar salas de ensayo y grabación,
registrar bandas, reservar horarios, gestionar anticipos y saldos mediante
Stripe, y permitir que operación e ingeniería consulten información relacionada
con las sesiones. Incluye además una visualización 3D de distribución de
instrumentos y un monitor de actividad QA habilitable únicamente fuera de
producción.

El producto está compuesto por:

1. **Frontend**: SPA desarrollada con React y Vite. Proporciona el catálogo, los
   formularios y los paneles de cada tipo de usuario.
2. **API**: servicio Node.js/Express bajo `/api`, responsable de validar las
   solicitudes, autenticar roles y ejecutar las operaciones de negocio.
3. **Persistencia**: MongoDB accedido mediante Mongoose. Almacena bandas,
   reservas, bloques de ocupación, dominios permitidos y eventos QA.
4. **Servicios externos**: Stripe Checkout y sus webhooks. Las imágenes se
   guardan en disco del servidor y se publican bajo `/uploads`.

### 3.1 Dentro del alcance

- Catálogo de cinco salas y cuatro artículos de backline.
- Registro e inicio de sesión de bandas.
- Perfil de banda, integrantes, instrumentos, invitaciones y selección opcional
  de ingeniero.
- Consulta de disponibilidad y creación de reservas.
- Bloqueo de sala e ingeniero, cálculo de precios y expiración de apartados.
- Cobro de anticipo y saldo mediante Stripe Checkout.
- Consulta de reserva, personalización 3D habilitada y demostración 3D de
  desarrollo.
- Panel operativo para staff y agenda para ingeniería.
- Monitor QA con eventos persistidos y transmisión SSE.

### 3.2 Fuera del alcance implementado o no especificado

- Reembolsos, cancelación de reservas por el cliente, reprogramación y
  liquidación en efectivo.
- Verificación de correo, recuperación de contraseña y gestión de varias
  cuentas de staff.
- Inventario de salas administrable desde el panel: el catálogo actual está
  definido en código.
- Facturación fiscal, notificaciones por correo/SMS, calendario externo y
  aplicación móvil nativa.
- Gestión de reembolsos o conciliación automática con Stripe.
- SLA de disponibilidad, metas de rendimiento, RPO/RTO y políticas de respaldo.
- Un SIEM certificado o monitoreo de infraestructura.

## 4. Convenciones y términos

| Término | Definición |
|---|---|
| Banda | Cuenta propietaria del perfil y de las reservas. La autenticación se realiza con correo y contraseña. |
| Representante | Persona que opera la cuenta autenticada de una banda. El sistema no define subroles dentro de la banda. |
| Integrante invitado | Persona que se agrega a una banda con un enlace de invitación; no obtiene cuenta ni token de acceso. |
| Staff | Usuario administrativo autenticado que consulta la operación y puede eliminar una banda. |
| Ingeniero | Perfil de ingeniería configurado en el backend que consulta sus sesiones confirmadas. |
| Anticipo | Primer pago requerido para confirmar el apartado; corresponde al 50 % redondeado hacia arriba del total. |
| Saldo | Parte restante del total, pagadera al menos 24 horas antes del inicio de la sesión. |
| Apartado pendiente | Reserva en `deposit_pending`, con un plazo máximo de 35 minutos para iniciar y confirmar el anticipo. |
| Bloque / slot | Intervalo de 15 minutos utilizado para impedir ocupaciones simultáneas. |
| Backline | Equipo musical que puede agregarse al costo de la sesión. |
| Demo | Reserva técnica gratuita, disponible solo fuera de producción para probar la distribución 3D. |
| QA | Monitor de actividad de pruebas, habilitable solo fuera de producción mediante token independiente. |
| MXN | Moneda usada por el catálogo y por Stripe Checkout. |

## 5. Usuarios y características

### 5.1 Visitante

Puede abrir la aplicación, explorar el catálogo, consultar ocupación pública de
una sala, consultar las opciones de dominio de correo y perfiles de ingeniería,
registrar una banda, iniciar sesión o aceptar una invitación. Para crear una
reserva necesita una sesión de banda.

### 5.2 Representante de banda

Puede gestionar el perfil de su propia banda, solicitar un ingeniero, administrar
integrantes e instrumentos, consultar su historial y reservar salas. Solo puede
acceder a perfiles, reservas, pagos y distribuciones asociados a su propio
identificador de banda.

### 5.3 Integrante invitado

Puede consultar una invitación vigente e ingresar nombre e instrumento o rol.
La acción agrega esos datos al perfil de la banda sin crear credenciales,
sesión ni permisos de representante.

### 5.4 Staff

Puede autenticarse en el panel operativo, consultar bandas y reservas, ver
métricas calculadas sobre pagos y sesiones futuras, consultar la distribución
de sesiones por ingeniero y eliminar una banda con sus datos locales asociados.

### 5.5 Ingeniero

Puede autenticarse con un perfil de ingeniería y consultar las reservas futuras
confirmadas asignadas a ese perfil. El acceso es de consulta; no se implementa
edición de reservas desde esta interfaz.

### 5.6 Evaluador QA

Puede habilitar el monitor con el token QA configurado para el entorno,
consultar eventos y abrir otra pestaña de GrooveSpace para ejecutar pruebas
etiquetadas. Este acceso no está disponible en producción.

### 5.7 Stripe

Sistema externo que aloja el Checkout y comunica el resultado del pago mediante
la sesión de Checkout y webhooks firmados.

## 6. Entorno operativo y dependencias

| Elemento | Descripción de la implementación |
|---|---|
| Frontend | React, React DOM, Vite y Three.js para la escena 3D. |
| Backend | Node.js, Express, Mongoose, CORS y Multer. |
| Base de datos | MongoDB. URI configurable por `MONGO_URI`; por defecto se usa una base local `groovespace`. |
| API | Puerto `5000` de forma predeterminada; URL del frontend configurable mediante `FRONTEND_URL`. |
| URL de API del frontend | `VITE_API_URL`; por defecto `http://localhost:5000/api`. |
| Pagos | API de Stripe, Checkout hospedado y webhook en `/api/payments/webhook`. |
| Archivos | Directorio `src/uploads/` del backend, expuesto como `/uploads`. |
| Navegador | Navegador moderno con soporte para React, `fetch`, almacenamiento de sesión, SSE y WebGL para la vista 3D. |

Para desplegar en producción se deben configurar claves independientes y
persistentes para bandas, staff e ingeniería, credenciales de staff e
ingeniería, conexión a MongoDB, Stripe y el origen del frontend. QA debe
permanecer deshabilitado. Las credenciales y secretos son configuración de
entorno, no datos que deban almacenarse en este documento.

## 7. Supuestos y restricciones

1. Una banda representa una sola cuenta autenticable, aunque puede contener
   varios integrantes registrados.
2. Las salas, sus precios, capacidades, opciones de personalización y el equipo
   de renta provienen de configuración estática del backend. La interfaz
   mantiene también una representación del catálogo.
3. Los montos del catálogo y los registros de reserva son números enteros en
   MXN. Al crear una sesión de Stripe, el backend convierte el importe a
   unidades menores de moneda.
4. El horario operativo usa el desplazamiento fijo `-06:00` para calcular
   anticipación y fecha límite de pago. No hay un selector de zona horaria en la
   interfaz.
5. La autenticación de banda vence en 30 días; los tokens de staff e ingeniería
   vencen en 8 horas. La aplicación conserva sesiones de banda temporalmente en
   `sessionStorage`.
6. La disponibilidad que muestra el navegador es orientativa; la API vuelve a
   validar colisiones al crear la reserva.
7. El almacenamiento de imágenes es local al servidor. No se describe una
   solución distribuida de archivos compartidos entre instancias.
8. La transmisión SSE de QA se distribuye en memoria de proceso; para que los
   eventos en vivo coincidan con el proceso que recibe las solicitudes, la
   implementación requiere una sola instancia de backend.
9. No se define precio de impuestos, comisión, política de cancelación,
   devolución, cierre del estudio ni reglas de días festivos.

## 8. Requisitos funcionales

Los requisitos siguientes describen el sistema actual. Los identificadores
permiten referenciarlos en casos de prueba.

### 8.1 Catálogo y acceso general

| ID | Requisito |
|---|---|
| RF-001 | El sistema deberá presentar una pantalla de bienvenida y permitir al visitante entrar al catálogo. La aplicación conserva en la sesión del navegador que ya se mostró la introducción. |
| RF-002 | El sistema deberá mostrar cinco opciones de sala con nombre, precio por hora y capacidad máxima. El catálogo base es: Estudio A ($350, 6 personas), Ensayo B ($220, 4), Production C ($400, 3), Live D ($500, 8) y Orquesta E ($650, 100). |
| RF-003 | El sistema deberá marcar Estudio A y Orquesta E como salas personalizables en 3D. |
| RF-004 | El sistema deberá permitir consultar ocupación de una sala sin iniciar sesión, opcionalmente filtrada por fecha. La respuesta excluye demostraciones y estados `expired`/`refunded`. Cuando se consulta por fecha, la API también convierte apartados pendientes con más de 35 minutos en `expired`; la consulta sin fecha no ejecuta esa limpieza por fecha. |
| RF-005 | El sistema deberá ofrecer acceso de banda, invitación, administración, ingeniería y QA mediante las rutas de interfaz configuradas. |
| RF-006 | El sistema deberá responder a `GET /api/health` con un estado de servicio activo. Este endpoint informa la disponibilidad del proceso HTTP, no verifica por sí mismo la conexión a MongoDB o Stripe. |

### 8.2 Registro, autenticación y perfil de banda

| ID | Requisito |
|---|---|
| RF-010 | El sistema deberá permitir registrar una banda con nombre, nombre de líder, correo, contraseña, logotipo e instrumentos con nombre y fotografía. |
| RF-011 | El correo deberá tener formato válido y el dominio deberá estar habilitado en `BandEmailDomain`. Si la colección no tiene los dominios iniciales, la API deberá insertar `gmail.com`, `hotmail.com` y `outlook.com` antes de devolver los habilitados. |
| RF-012 | La contraseña de banda deberá tener al menos 10 caracteres. Se almacenará como hash con salt; no deberá devolverse en las respuestas del perfil. |
| RF-013 | El nombre de banda y el correo deberán ser únicos según las restricciones de la colección. El correo se normalizará a minúsculas y se recortarán espacios en los campos definidos para ello. |
| RF-014 | El registro deberá requerir logotipo y al menos un instrumento con foto. La interfaz permite agregar hasta 12 instrumentos y requiere correspondencia entre cada instrumento y su archivo. |
| RF-015 | El registro y el inicio de sesión deberán devolver un token de banda para las operaciones autenticadas. El token identifica una sola banda y vence a los 30 días. |
| RF-016 | El sistema deberá validar que un perfil de ingeniería seleccionado exista entre los perfiles configurados cuando la banda solicite ingeniero. |
| RF-017 | La banda autenticada deberá poder consultar su propio perfil, sus reservas y los perfiles públicos de ingeniería. |
| RF-018 | La banda autenticada deberá poder actualizar nombre, líder y configuración opcional de ingeniería únicamente sobre su propio perfil. El backend deberá rechazar el acceso a otro identificador de banda. |
| RF-019 | La banda autenticada deberá poder agregar instrumentos con nombre y fotografía. La API limita la suma a 12 instrumentos en esta operación. |
| RF-020 | La banda autenticada deberá poder quitar integrantes de su propio perfil. |
| RF-021 | El sistema no deberá incluir en las respuestas normales del perfil el hash del token de invitación ni su expiración; tampoco deberá exponer hash o salt de contraseña. |

### 8.3 Integrantes e invitaciones

| ID | Requisito |
|---|---|
| RF-030 | La banda autenticada deberá poder crear o renovar una invitación. La invitación tendrá expiración de 30 días y el backend almacenará su hash, no el token en texto plano. |
| RF-031 | Un visitante con un token de invitación deberá poder consultar el nombre de la banda si el token existe y no ha expirado. |
| RF-032 | Un visitante deberá poder aceptar una invitación enviando nombre e instrumento/rol. La API deberá rechazar campos vacíos, integrantes duplicados por nombre (ignorando mayúsculas/minúsculas), invitaciones expiradas y bandas que alcancen 100 integrantes. |
| RF-033 | Una invitación no autenticará al integrante ni le concederá autorización para reservar, editar el perfil u operar la cuenta de banda. |

### 8.4 Disponibilidad y creación de reservas

| ID | Requisito |
|---|---|
| RF-040 | La interfaz deberá permitir seleccionar sala, fecha, hora de inicio, duración, cantidad de asistentes y artículos de backline disponibles. |
| RF-041 | La API deberá resolver la sala contra el catálogo del backend y aceptar únicamente duraciones enteras de 1 a 4 horas. |
| RF-042 | La API deberá aceptar de 1 a la capacidad de la sala asistentes. |
| RF-043 | La fecha deberá estar en formato `YYYY-MM-DD`; la hora en formato `HH:MM`, con minutos divisibles entre 15. La sesión deberá estar en el futuro y terminar antes de medianoche. |
| RF-044 | El inicio deberá tener al menos 24 horas de anticipación. El sistema calcula `balanceDueAt` como 24 horas antes de iniciar y rechaza reservas cuyo vencimiento del saldo ya haya llegado. |
| RF-045 | La API deberá ignorar los totales enviados por el cliente y calcular el costo con el precio de sala y el precio de cada artículo autorizado, multiplicados por la duración. Los artículos repetidos deberán contarse una sola vez. |
| RF-046 | El sistema deberá calcular el anticipo como `ceil(total / 2)` y el saldo como `total - anticipo`. |
| RF-047 | El representante solo podrá crear reservas en nombre de la banda identificada por su token. |
| RF-048 | Antes de reservar, el backend deberá invalidar apartados pendientes de más de 35 minutos y retirar bloques expirados o pertenecientes a demostraciones conforme a la lógica vigente. |
| RF-049 | El sistema deberá rechazar reservas con traslape de sala y deberá impedir simultaneidad del ingeniero asignado. Los bloqueos se materializan en intervalos de 15 minutos y la base de datos impone unicidad para sala y hora y para ingeniero y hora. |
| RF-050 | Una reserva real nueva deberá iniciar en `deposit_pending` y crear sus bloques con expiración de 35 minutos. Si la inserción de bloques encuentra duplicidad, la API deberá retirar los bloques parciales, marcar la reserva expirada y responder conflicto. |
| RF-051 | La API deberá permitir consultar una reserva individual y el historial de la banda solo al propietario autenticado. |
| RF-052 | La API deberá permitir a staff consultar el conjunto de reservas operativas, excluyendo demostraciones. |
| RF-053 | La consulta pública de disponibilidad deberá mostrar fecha, hora, duración, estado de pago y fecha de creación necesarios para presentar la ocupación, sin revelar datos personales de la banda. |

### 8.5 Backline y salas

| ID | Requisito |
|---|---|
| RF-060 | El sistema deberá ofrecer los artículos configurados: Gibson Les Paul Standard ($80/h), Fender Jazz Bass ($70/h), Marshall JCM800 Combo ($100/h) y Platillos Zildjian K Custom ($120/h). |
| RF-061 | La API deberá rechazar identificadores de backline que no estén en el catálogo, y no deberá confiar en precio o nombre proporcionados por el navegador. |
| RF-062 | La capacidad, precio, nombre y disponibilidad de personalización de cada sala deberán validarse en el backend usando su catálogo. |

### 8.6 Pagos y estado financiero

| ID | Requisito |
|---|---|
| RF-070 | El backend deberá crear una sesión Stripe Checkout únicamente para una reserva existente y perteneciente a la banda autenticada. |
| RF-071 | Se deberá aceptar `deposit` solo para una reserva `deposit_pending` y `balance` solo para una reserva `deposit_paid`. Las demostraciones no aceptarán pagos. |
| RF-072 | El importe del Checkout deberá derivarse del importe pendiente almacenado en la reserva; deberá ser entero positivo y seguro. El Checkout usará MXN y modo de pago con tarjeta. |
| RF-073 | Antes de iniciar un nuevo Checkout para un mismo concepto de pago, el backend deberá intentar expirar la sesión previa que siga abierta. |
| RF-074 | El sistema deberá permitir que el usuario regrese desde Stripe y solicitar verificación autenticada de la sesión. La redirección del navegador, por sí sola, no confirmará el pago. |
| RF-075 | El backend deberá confirmar un pago solo si Stripe indica estado pagado, modo de pago, moneda MXN, metadatos válidos, relación entre reserva y sesión, importe esperado y estado de reserva permitido. |
| RF-076 | Al confirmar el anticipo, el estado deberá cambiar de `deposit_pending` a `deposit_paid` y se retirará la expiración de los bloques. Al confirmar el saldo, cambiará de `deposit_paid` a `paid`. |
| RF-077 | El webhook deberá verificar la firma HMAC de Stripe y rechazar timestamps con más de 300 segundos de diferencia respecto al reloj del servidor. Deberá procesar eventos de Checkout completado, pago asíncrono exitoso, expiración y pago asíncrono fallido. |
| RF-078 | Si vence o falla el Checkout del anticipo mientras el apartado sigue pendiente y corresponde a esa sesión, la reserva deberá pasar a `expired` y se liberarán sus bloques. |
| RF-079 | El panel operativo deberá calcular lo cobrado como total para reservas pagadas, anticipo para reservas con `deposit_paid` y cero para otros estados. También deberá sumar el saldo pendiente de reservas `deposit_paid`. |
| RF-080 | El sistema no deberá procesar reembolsos. El estado `refunded` está definido en el modelo, pero no existe un flujo de reembolso implementado en la API. |

### 8.7 Confirmación y personalización 3D

| ID | Requisito |
|---|---|
| RF-090 | Fuera de producción, la banda autenticada podrá solicitar una reserva demo solo para una sala configurable (Estudio A u Orquesta E) y si tiene instrumentos registrados. La implementación crea una sesión de una hora a las 12:00, siete días después de la fecha actual. |
| RF-091 | Una demostración deberá ser gratuita, no deberá crear bloques de ocupación y no deberá aparecer en las consultas de operación ni en la agenda de ingeniería. Sus asistentes se calculan como el menor valor entre integrantes más uno y la capacidad de la sala. Si ya existe una demostración confirmada de esa banda y sala, podrá devolverse la existente. |
| RF-092 | Para reservas reales, la distribución se podrá guardar únicamente cuando el estado sea `deposit_paid` o `paid`. |
| RF-093 | La distribución deberá contener como máximo 12 elementos; cada elemento deberá incluir instrumento de la banda, nombre, coordenadas numéricas finitas `x` y `z`. El backend acepta `x` entre -7 y 7 y `z` entre -5 y 5. |
| RF-094 | La banda solo podrá guardar una distribución para sus propias reservas. La API deberá rechazar instrumentos que no pertenezcan a la banda. |
| RF-095 | La interfaz deberá representar instrumentos y sala en Three.js, permitir arrastrar los instrumentos y enviar las coordenadas al backend para persistencia. |

### 8.8 Administración

| ID | Requisito |
|---|---|
| RF-100 | Staff deberá autenticarse con credenciales configuradas para el entorno y recibir un token con vigencia de 8 horas. |
| RF-101 | El panel deberá consultar y mostrar el directorio de bandas, reservas operativas, perfiles de ingeniería, sesiones futuras, cobros calculados y saldos pendientes. |
| RF-102 | Staff podrá eliminar una banda. El backend deberá eliminar la banda, sus reservas, sus bloques de ocupación y los archivos de logotipo e instrumentos asociados. |
| RF-103 | Antes de eliminar, el backend deberá tratar de expirar Checkouts abiertos de la banda y bloquear la operación si encuentra un Checkout completado cuyo pago no ha finalizado. No realizará reembolsos ni eliminará información almacenada en Stripe. |
| RF-104 | Si MongoDB admite transacciones, el borrado de datos persistidos deberá ejecutarse en una transacción. En una instancia standalone se permite el borrado secuencial definido por la implementación y se deberá informar un error si este falla. |
| RF-105 | La operación de eliminación deberá requerir autorización de staff y confirmación explícita desde la interfaz, dado que es irreversible. |

### 8.9 Ingeniería

| ID | Requisito |
|---|---|
| RF-110 | El ingeniero deberá autenticarse seleccionando uno de los perfiles configurados y proporcionando las credenciales de ese perfil. |
| RF-111 | El token de ingeniería deberá tener vigencia de 8 horas y limitar las consultas al identificador de ingeniero autenticado. |
| RF-112 | La agenda deberá mostrar reservas desde la fecha actual en adelante, asignadas al ingeniero, no demo y con estado `deposit_paid` o `paid`. |
| RF-113 | La agenda deberá presentar fecha, hora, duración, sala, banda, cantidad de asistentes y backline. |

### 8.10 Monitor QA y auditoría de pruebas

| ID | Requisito |
|---|---|
| RF-120 | El monitor QA solo deberá habilitarse si el entorno no es producción, `QA_MONITORING_ENABLED` es `true` y `QA_INGEST_TOKEN` tiene al menos 32 caracteres. |
| RF-121 | El monitor deberá exigir token QA válido para consultar eventos, abrir el flujo SSE o enviar eventos de interfaz. |
| RF-122 | El panel deberá mostrar hasta 100 eventos y permitir consulta incremental mediante fecha ISO `after`. El valor predeterminado de la API es 50. |
| RF-123 | Al conectar el flujo SSE, el backend deberá enviar hasta 25 eventos recientes y después eventos nuevos mientras la conexión permanezca abierta. |
| RF-124 | La interfaz deberá poder registrar `ui_navigation` y `ui_copy`, con ruta saneada e identificador opaco de sesión. El texto del portapapeles no deberá leerse ni guardarse. |
| RF-125 | El backend deberá auditar solicitudes API solo si la solicitud incluye `X-QA-Token` válido y QA está habilitado. Las rutas `/qa/events` no se registran mediante esta auditoría de solicitudes. No deberá almacenar cuerpos de solicitud ni contraseñas. |
| RF-126 | El sistema deberá almacenar valores de IP e identificadores de actor como hashes HMAC y eliminar eventos QA automáticamente después de 30 días. |
| RF-127 | El monitor deberá clasificar severidad y registrar método, ruta saneada, estado HTTP y duración. En QA, podrá generar alertas heurísticas al llegar a 180 solicitudes por minuto en una sesión o al acumular 8 respuestas 401/403/404 o rutas sospechosas en cinco minutos. Estas señales no son detección concluyente de intrusión. |
| RF-128 | El panel podrá abrir GrooveSpace en una segunda pestaña y transmitir la sesión QA usando mensajería `postMessage` del mismo origen; el token no deberá colocarse en la URL. |

## 9. Reglas de negocio

| ID | Regla |
|---|---|
| RN-001 | Una cuenta de banda puede tener hasta 100 integrantes. |
| RN-002 | El correo y el nombre de banda deben ser únicos en MongoDB. |
| RN-003 | Una cuenta de banda requiere un dominio habilitado; la selección de dominio en el navegador no sustituye la validación del servidor. |
| RN-004 | Una reserva corresponde a una banda y a una sala del catálogo del backend. |
| RN-005 | Duración permitida: 1–4 horas enteras; asistentes: 1–capacidad de sala; inicio en incrementos de 15 minutos. |
| RN-006 | Ninguna sesión puede cruzar la medianoche. |
| RN-007 | Una sesión real debe reservarse con más de 24 horas de anticipación para que el vencimiento del saldo quede en el futuro. |
| RN-008 | El costo se calcula como `(precio por hora de sala + suma de precios por hora del backline seleccionado) × duración`. |
| RN-009 | El anticipo es `ceil(total / 2)` y el saldo es el remanente; la suma de ambos es igual al total. |
| RN-010 | Una reserva pendiente conserva el horario durante 35 minutos. El anticipo confirmado transforma la ocupación temporal en confirmada. |
| RN-011 | No puede haber dos reservas que ocupen el mismo bloque de sala ni dos sesiones asignadas al mismo ingeniero en el mismo bloque. |
| RN-012 | Las solicitudes concurrentes pueden ser rechazadas por índice único de MongoDB aunque una lectura previa haya mostrado disponibilidad. |
| RN-013 | Solo la banda propietaria puede consultar o modificar su perfil, reserva, pago o distribución. |
| RN-014 | Las invitaciones expiran a los 30 días; emitir una nueva invitación actualiza el token vigente de la banda. |
| RN-015 | Los instrumentos deben pertenecer a la banda para figurar en una distribución 3D guardada. |
| RN-016 | Una demostración es gratuita, no es una ocupación real y no forma parte de las métricas operativas. |
| RN-017 | Las reservas con anticipo pendiente no aparecen en la agenda de ingeniería como sesiones confirmadas. |
| RN-018 | La eliminación de una banda es irreversible para los datos locales y no equivale a cancelación o reembolso en Stripe. |
| RN-019 | El endpoint de webhook y el flujo de QA tienen controles de autorización diferentes: firma de Stripe para pagos y token QA para monitoreo. |

## 10. Ciclo de vida de una reserva

Estados definidos por el modelo:

| Estado | Significado funcional |
|---|---|
| `deposit_pending` | Reserva real creada; anticipo pendiente y bloques sujetos a expiración. |
| `deposit_paid` | Anticipo confirmado; bloques retenidos y saldo pendiente. |
| `paid` | Anticipo y saldo confirmados. |
| `expired` | Apartado vencido o Checkout del anticipo expirado/fallido. |
| `refunded` | Valor admitido por el esquema, pero sin operación de reembolso implementada. |

Transiciones observadas:

```text
Nueva reserva ──> deposit_pending ── pago de anticipo confirmado ──> deposit_paid
                       │                                                │
                       └── vencimiento/fallo del anticipo ──> expired  └── saldo confirmado ──> paid
```

La API solo permite iniciar el pago de anticipo desde `deposit_pending` y el
pago del saldo desde `deposit_paid`. Los pagos se reconcilian consultando Stripe
o recibiendo el webhook; no dependen únicamente del retorno de navegación del
usuario.

## 11. Interfaces externas

### 11.1 Interfaz web

La SPA usa rutas de navegador para seleccionar las experiencias principales:

| Ruta | Función |
|---|---|
| `/` | Bienvenida y catálogo público; permite abrir el flujo de reserva. |
| `/banda` y `/banda/perfil` | Autenticación o perfil de banda. |
| `/invite/:token` | Consulta y aceptación de invitación. |
| `/administracion` y `/administracion/login` | Acceso al panel de staff. |
| `/ingenieria` y `/ingenieria/login` | Acceso a la agenda de ingeniería. |
| `/?payment=...` | Retorno de Stripe o apertura de la demostración. |
| `/qa` | Monitor QA no productivo. |

### 11.2 API HTTP

Las rutas de esta sección son relativas a `/api`. Los endpoints protegidos usan
`Authorization: Bearer <token>` con el token del rol indicado. La API devuelve
JSON salvo respuestas de streaming, estáticos o respuestas sin cuerpo.

#### Bandas

| Método y ruta | Acceso | Propósito |
|---|---|---|
| `POST /bands/register` | Público, multipart | Registrar banda, logotipo e instrumentos. |
| `POST /bands/login` | Público, limitado | Autenticar banda. |
| `GET /bands/engineers` | Público | Devolver perfiles de ingeniería disponibles. |
| `GET /bands/email-domains` | Público | Devolver dominios habilitados. |
| `GET /bands/all` | Staff | Consultar directorio completo. |
| `DELETE /bands/:bandId` | Staff | Eliminar banda y datos locales asociados. |
| `POST /bands/invite` | Banda | Crear o renovar invitación de la propia banda. |
| `GET /bands/invite/:token` | Público | Verificar invitación y obtener nombre de banda. |
| `POST /bands/invite/:token/members` | Público | Incorporar integrante a la banda invitante. |
| `GET /bands/:bandId/profile` | Banda propietaria | Consultar perfil propio. |
| `PATCH /bands/:bandId/profile` | Banda propietaria | Modificar perfil propio. |
| `POST /bands/:bandId/instruments` | Banda propietaria, multipart | Incorporar instrumentos con fotos. |
| `DELETE /bands/:bandId/members/:memberId` | Banda propietaria | Quitar integrante del perfil propio. |

#### Reservas y pagos

| Método y ruta | Acceso | Propósito |
|---|---|---|
| `POST /reservations/book` | Banda | Validar y crear reserva real. |
| `POST /reservations/demo` | Banda; no producción | Crear o recuperar demostración 3D gratuita. |
| `GET /reservations/all` | Staff | Consultar agenda operativa. |
| `GET /reservations/room/:roomId?date=YYYY-MM-DD` | Público | Consultar ocupación no demo de una sala. |
| `GET /reservations/:reservationId` | Banda propietaria | Consultar detalle de reserva propia. |
| `GET /reservations/band/:bandId` | Banda propietaria | Consultar historial propio. |
| `PATCH /reservations/:reservationId/layout` | Banda propietaria | Guardar distribución 3D propia. |
| `POST /payments/checkout` | Banda propietaria | Crear sesión Checkout de anticipo o saldo. |
| `GET /payments/verify/:reservationId/:sessionId` | Banda propietaria | Verificar sesión al regresar de Stripe. |
| `POST /payments/webhook` | Stripe, firma requerida | Aplicar eventos de Checkout. |

#### Staff, ingeniería y QA

| Método y ruta | Acceso | Propósito |
|---|---|---|
| `POST /staff/login` | Público, limitado | Emitir token de staff. |
| `POST /engineers/login` | Público, limitado | Emitir token de ingeniería. |
| `GET /engineers/me/schedule` | Ingeniería | Consultar agenda propia. |
| `GET /qa/events` | Token QA | Consultar eventos persistidos, límite 100 y filtro `after` opcional. |
| `GET /qa/events/stream` | Token QA | Recibir eventos recientes y nuevos por SSE. |
| `POST /qa/events` | Token QA | Ingresar eventos `ui_navigation` o `ui_copy`. |
| `GET /api/health` | Público | Verificar respuesta HTTP de la aplicación. |

### 11.3 Stripe

El backend crea sesiones de Checkout alojadas en Stripe y suministra URL de
éxito y cancelación. Para aceptar un pago, comprueba los datos devueltos por la
API de Stripe y/o un webhook cuya firma se calcula sobre el cuerpo HTTP sin
modificar. La aplicación no recibe ni almacena el número de tarjeta, vencimiento
ni código de seguridad.

### 11.4 Archivos

El registro y la edición de instrumentos reciben imágenes mediante
`multipart/form-data`. Se aceptan extensiones y tipos declarados JPEG, JPG, PNG
o WEBP. Multer limita cada archivo a 10 MB y la solicitud a 13 archivos. Los
archivos se guardan en `src/uploads/` y se sirven mediante `/uploads`. Al
eliminar una banda, se intenta borrar su logotipo e imágenes de instrumentos;
si un archivo no existe, la eliminación continúa, y si hay otros fallos de
archivo, la respuesta los reporta como advertencia.

## 12. Requisitos no funcionales

### 12.1 Seguridad y privacidad

| ID | Requisito |
|---|---|
| RNF-001 | La API deberá limitar solicitudes JSON a 1 MB y permitir únicamente métodos CORS `GET`, `POST`, `PATCH` y `DELETE`. |
| RNF-002 | La API deberá incluir cabeceras contra MIME sniffing, framing, filtración de referrer y permisos del navegador; en producción deberá habilitar HSTS. |
| RNF-003 | Las operaciones protegidas deberán verificar el token firmado, su expiración y el rol antes de consultar o modificar datos. |
| RNF-004 | Las comparaciones de credenciales donde corresponde deberán usar comparación de tiempo constante. Las contraseñas de banda se almacenarán como hash scrypt con salt. |
| RNF-005 | Los límites se mantienen en memoria por IP y ruta: 10 intentos por 15 minutos para login de banda; 5 por 15 minutos para registro de banda y login de staff e ingeniería. QA limita consulta de eventos a 60/minuto, SSE a 10/minuto e ingreso UI a 30/minuto. Al superar el límite, la API responde `429` e incluye `Retry-After`. Estos contadores no se comparten entre instancias. |
| RNF-006 | QA deberá permanecer deshabilitado en producción. Los eventos no deberán incluir contraseñas, cuerpos de solicitud ni texto del portapapeles. |
| RNF-007 | Los valores de IP e identificador de actor usados en QA se deberán pseudonimizar mediante HMAC; los eventos deberán expirar a los 30 días. |
| RNF-008 | Antes de alterar el estado de pago, el backend deberá validar moneda, modo, estado, importe, metadata y asociación de sesión mediante la API de Stripe, o verificar firma y antigüedad cuando el cambio llegue por webhook. |
| RNF-009 | Los secretos deberán inyectarse por configuración de entorno y usar claves persistentes en producción. Las claves temporales generadas automáticamente son solo para desarrollo. |

### 12.2 Integridad y concurrencia

| ID | Requisito |
|---|---|
| RNF-010 | La reserva deberá comprobar colisiones y además depender de índices únicos en `ReservationSlot` para resolver concurrencia entre solicitudes simultáneas. |
| RNF-011 | La API deberá limpiar bloques parcialmente insertados si la inserción de slots falla. |
| RNF-012 | La confirmación de pago deberá ser idempotente respecto a estados ya confirmados y liberar expiraciones únicamente cuando se valida la sesión correspondiente. |
| RNF-013 | La eliminación de banda deberá preservar consistencia entre banda, reservas y slots, usando transacción si la topología de MongoDB la soporta. |

### 12.3 Disponibilidad, rendimiento y escalabilidad

| ID | Requisito |
|---|---|
| RNF-020 | El sistema deberá comunicar fallos de API, base de datos o Stripe mediante respuestas de error y/o mensajes visibles; no deberá considerar confirmada una reserva únicamente por una respuesta de redirección. |
| RNF-021 | El flujo SSE deberá limpiar sus listeners e intervalo de heartbeat al cerrarse el cliente. Envía heartbeat cada 25 segundos. |
| RNF-022 | El catálogo QA en vivo utiliza memoria local de proceso; el escalado horizontal requiere una solución de difusión compartida que no forma parte de la implementación actual. |
| RNF-023 | No hay objetivos numéricos de latencia, volumen concurrente o disponibilidad definidos. Deben acordarse antes de exigirlos como criterio de aceptación de producción. |

### 12.4 Compatibilidad y experiencia de uso

| ID | Requisito |
|---|---|
| RNF-030 | La interfaz deberá ejecutarse en navegadores compatibles con las APIs web utilizadas, y requerirá WebGL para la escena 3D. |
| RNF-031 | La interfaz deberá mostrar errores de validación y estado de carga en los flujos principales de registro, reserva, pago, perfil y paneles autenticados. |
| RNF-032 | El sistema no define una certificación de accesibilidad ni niveles WCAG. La accesibilidad formal debe evaluarse por separado antes de convertirla en requisito contractual. |

### 12.5 Mantenibilidad y configuración

| ID | Requisito |
|---|---|
| RNF-040 | Las URL, credenciales, secretos, configuración de Stripe y URI MongoDB deberán ser configurables mediante variables de entorno. |
| RNF-041 | Los catálogos de salas, backline e ingeniería se mantienen en configuración de código; agregar o cambiar opciones requiere actualizar el backend y, cuando aplique, el frontend. |
| RNF-042 | Los errores HTTP deberán usar códigos 4xx para solicitudes inválidas/no autorizadas y 5xx para fallos del servidor. Las respuestas funcionales de la API se expresan como JSON. |

## 13. Modelo de datos lógico

| Entidad/colección | Datos principales | Relaciones y reglas |
|---|---|---|
| `Band` | Nombre, líder, correo, hash/salt de contraseña, logotipo, integrantes, instrumentos, ingeniero opcional e invitación vigente. | Nombre y correo únicos. Hasta 100 integrantes. Los hashes de credenciales e invitación no se exponen en las respuestas normales. |
| `BandEmailDomain` | Dominio y bandera `enabled`. | Dominio único; sirve como lista permitida del registro. |
| `Reservation` | Banda, sala, fecha/hora/duración, asistentes, backline, layout, ingeniero, total, anticipo, saldo, fecha límite, estado y sesiones Stripe. | Pertenece a una banda. Los valores de sala y backline se validan contra catálogo estático. |
| `ReservationSlot` | Sala, fecha, minuto de inicio, ingeniero opcional, reserva y expiración opcional. | Índice único por sala-fecha-slot y por ingeniero-fecha-slot cuando existe ingeniero. TTL para retirar apartados temporales. |
| `QaEvent` | Tipo, severidad, resumen, descripción, rol, hashes, sesión QA, ruta, método, estado HTTP, duración y fechas. | TTL de 30 días; datos de IP y actor se guardan como hashes. |
| Catálogo de salas | ID, nombre, precio, capacidad y opción 3D. | Configuración estática, no colección MongoDB. |
| Catálogo de ingenieros | ID, nombre, especialidad y clave de credenciales de configuración. | Configuración estática, no colección MongoDB. |
| Catálogo de backline | ID, nombre y precio por hora. | Configuración estática, no colección MongoDB. |

Los integrantes, instrumentos, artículos rentados y elementos del layout se
representan como subdocumentos o datos embebidos; no son colecciones
independientes en el esquema actual.

## 14. Flujos operativos principales

### 14.1 Alta de una banda

1. El visitante consulta dominios permitidos y perfiles de ingeniería.
2. Completa datos de banda, representante, correo, contraseña, logo e
   instrumentos con sus imágenes; puede solicitar ingeniero.
3. La interfaz envía `multipart/form-data`.
4. La API valida campos, dominio, archivos, correspondencia de instrumentos y
   perfil de ingeniería. Rechaza nombre o correo ya registrados.
5. La API guarda imágenes, calcula hash de contraseña, genera invitación y
   persiste la banda.
6. La respuesta contiene perfil público, token de acceso de banda y token de
   invitación; la interfaz muestra el enlace compartible.

### 14.2 Reserva y pago

1. El representante elige sala. Si no tiene sesión, la interfaz solicita
   registro o inicio de sesión.
2. La interfaz consulta ocupación pública de la sala para la fecha elegida.
3. El representante ajusta horario, duración, asistentes y backline.
4. Antes de guardar, la API vuelve a validar entradas, anticipación, capacidad,
   catálogo, precio, colisiones y asignación del ingeniero.
5. La API crea la reserva pendiente e inserta slots de sala e ingeniero.
6. El representante solicita Checkout del anticipo. La API valida propietario,
   estado e importe y crea la sesión Stripe.
7. Stripe procesa el pago. Al volver, el frontend pide verificación; también
   puede llegar un webhook firmado.
8. Una confirmación válida transforma el estado a `deposit_paid` y mantiene los
   slots sin expiración. El representante podrá pagar el saldo antes del límite.
9. Con el anticipo confirmado, la banda puede diseñar y guardar la distribución
   3D en las salas que soportan personalización.

### 14.3 Operación administrativa

1. Staff inicia sesión y obtiene un token temporal.
2. El panel consulta bandas, reservas y perfiles de ingeniería.
3. Las métricas se calculan en el frontend a partir de las reservas recibidas.
4. Para eliminar una banda, staff confirma explícitamente la acción.
5. El backend valida identificador, cierra Checkouts abiertos cuando es posible,
   borra información local asociada y reporta errores de consistencia o de
   archivos.

### 14.4 Monitor QA

1. El evaluador introduce el token QA y el frontend valida acceso consultando la
   API.
2. La interfaz establece flujo SSE y conserva token e identificador opaco solo
   en almacenamiento de sesión del navegador.
3. Al abrir el sitio de prueba, el panel y la pestaña se autentican mediante
   mensajes del mismo origen.
4. Las solicitudes de la pestaña de prueba reciben cabeceras QA; el backend
   registra únicamente solicitudes etiquetadas.
5. La navegación y la acción de copiar se pueden reportar como eventos UI sin
   leer el contenido copiado.

## 15. Respuestas de error y comportamientos límite

- `400`: datos ausentes, formato inválido, sala/artículos inválidos, horario,
  duración, capacidad, distribución o parámetro de consulta inválidos.
- `401`: credenciales o token inválidos/expirados.
- `403`: recurso perteneciente a otra banda, acceso a rol incorrecto o sesión
  ajena.
- `404`: recurso inexistente; la demo también responde como no encontrada en
  producción.
- `409`: conflicto de horario/bloque, estado no apto para pagar o pago aún no
  confirmado.
- `413`: cuerpo HTTP superior al límite configurado.
- `429`: límite de intentos o peticiones QA excedido, según endpoint.
- `503`: configuración de autenticación, Stripe o QA no disponible.
- `500`: fallo interno de persistencia, operación o integración no recuperable.

El frontend consulta disponibilidad para mejorar la experiencia, pero el
resultado definitivo es el de la API al insertar los bloques. Una falla de red
al consultar disponibilidad puede dejar la lista local vacía; esto no debe
interpretarse como garantía de disponibilidad, porque el servidor conserva la
validación final.

## 16. Criterios de aceptación de alto nivel

La línea base funcional se considera verificada cuando se comprueba que:

1. una banda válida puede registrarse e iniciar sesión, y datos inválidos o
   dominios deshabilitados son rechazados;
2. un integrante puede incorporarse con invitación vigente, pero no operar la
   cuenta como banda;
3. una reserva válida calcula el total, anticipo y saldo en el servidor;
4. dos solicitudes concurrentes no pueden ocupar el mismo slot de sala o
   ingeniero;
5. los slots pendientes expiran y un anticipo confirmado los conserva;
6. solo el propietario puede consultar o modificar sus recursos;
7. el backend confirma pagos únicamente mediante verificación válida o webhook
   firmado;
8. la sala 3D guarda solo distribuciones válidas y de instrumentos propios;
9. staff consulta datos operativos y la eliminación quita datos locales sin
   realizar reembolsos en Stripe;
10. la agenda de ingeniería muestra solo sesiones futuras confirmadas asignadas
    al perfil autenticado;
11. QA no se habilita en producción, los eventos se transmiten y expiran según
    la configuración descrita, y no incluyen texto del portapapeles;
12. frontend, API y MongoDB se pueden configurar por separado para el entorno
    de despliegue.

Los casos de prueba concretos deben fijar reloj, datos y respuestas de Stripe
de prueba; los criterios numéricos de rendimiento y disponibilidad quedan fuera
de esta línea base hasta que producto y operación los definan.

## 17. Limitaciones y asuntos pendientes

Esta sección evita interpretar capacidades parciales como requisitos ya
resueltos:

1. **Política de cancelación y reembolso:** no existe flujo para cancelar por
   parte de la banda ni para emitir reembolsos. Aunque el modelo incluye
   `refunded`, no hay transición operativa que la establezca.
2. **Administración financiera:** el panel calcula cifras desde reservas
   locales; no es una conciliación contable con Stripe.
3. **Disponibilidad del API:** `GET /api/health` no comprueba MongoDB, Stripe ni
   almacenamiento de archivos.
4. **Disponibilidad al usuario:** el frontend puede tratar una falla de consulta
   de ocupación como lista vacía. La API evita confirmar un traslape, pero la
   interfaz no necesariamente comunica la causa original de esa falla.
5. **Catálogos duplicados:** las salas se representan tanto en el frontend como
   en el backend; no existe endpoint administrativo para mantenerlos.
6. **Límite de instrumentos en registro:** la interfaz limita el formulario a
   12 y el endpoint de alta posterior valida el límite, pero el controlador de
   registro no aplica explícitamente ese mismo máximo a la carga inicial.
7. **Topología QA:** eventos en vivo se emiten desde memoria de proceso y no se
   distribuyen entre varias instancias.
8. **Almacenamiento de imágenes:** el directorio local requiere persistencia y
   estrategia de respaldo en el despliegue; no se implementa almacenamiento
   compartido de objetos.
9. **Zonas horarias:** los cálculos emplean un desplazamiento fijo; se debe
   acordar comportamiento para cambios de horario y fechas locales antes de
   extender la operación geográfica.
10. **Requisitos de servicio:** no se han especificado SLO/SLA, carga máxima,
    recuperación ante desastres, respaldo/restauración ni retención financiera.
11. **Autorización de invitados:** el enlace agrega datos al perfil, pero no
    identifica ni autentica individualmente a la persona invitada.
12. **Credenciales de staff:** la configuración actual contempla un único juego
    de credenciales compartido, sin cuentas individuales ni auditoría por
    administrador.

Estos asuntos requieren decisión de producto/operación si se desea convertirlos
en requisitos futuros; no se incorporan silenciosamente como comportamiento
existente.

## 18. Trazabilidad de implementación

Las rutas citadas son relativas a la raíz del repositorio.

| Área de requisitos | Componentes de referencia |
|---|---|
| Enrutamiento y sesiones del frontend | [App.jsx](./groovespace-frontend/src/App.jsx), [api.js](./groovespace-frontend/src/api.js) |
| Registro e invitaciones | [AuthScreen.jsx](./groovespace-frontend/src/components/AuthScreen.jsx), [InviteScreen.jsx](./groovespace-frontend/src/components/InviteScreen.jsx), `groovespace-backend/src/controllers/bandController.js` |
| Perfil de banda | [BandProfile.jsx](./groovespace-frontend/src/components/BandProfile.jsx), `groovespace-backend/src/controllers/bandController.js` |
| Reserva, disponibilidad y slots | [BookingScreen.jsx](./groovespace-frontend/src/components/BookingScreen.jsx), `groovespace-backend/src/controllers/reservationController.js`, [ReservationSlot.js](./groovespace-backend/src/models/ReservationSlot.js) |
| Pagos y transiciones | [PaymentReturn.jsx](./groovespace-frontend/src/components/PaymentReturn.jsx), `groovespace-backend/src/controllers/paymentController.js`, [Reservation.js](./groovespace-backend/src/models/Reservation.js) |
| Catálogos | [catalog.js](./groovespace-backend/src/config/catalog.js), `groovespace-backend/src/config/engineers.js`, `groovespace-backend/src/config/bandEmailDomains.js` |
| Personalización 3D | [RoomCustomizer.jsx](./groovespace-frontend/src/components/RoomCustomizer.jsx), `groovespace-backend/src/controllers/reservationController.js` |
| Staff y agenda | [StaffDashboard.jsx](./groovespace-frontend/src/components/StaffDashboard.jsx), [EngineerPanel.jsx](./groovespace-frontend/src/components/EngineerPanel.jsx), `groovespace-backend/src/controllers/staffController.js`, `groovespace-backend/src/controllers/engineerController.js` |
| Monitor y eventos QA | [QaMonitor.jsx](./groovespace-frontend/src/components/QaMonitor.jsx), [QaEvent.js](./groovespace-backend/src/models/QaEvent.js), `groovespace-backend/src/controllers/qaController.js`, `groovespace-backend/src/siem.js` |
| Accesos, carga y limitación | `groovespace-backend/src/middlewares/`, `groovespace-backend/src/routes/`, `groovespace-backend/src/app.js` |
| Contrato HTTP y operación local | [README.md](./groovespace-backend/README.md) |
