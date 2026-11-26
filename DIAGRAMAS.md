# Diagramas UML de GrooveSpace

Los diagramas describen el sistema implementado en `groovespace-frontend` y
`groovespace-backend`. Se pueden visualizar en visores compatibles con Mermaid.

## Diagrama de casos de uso

El límite del sistema incluye la aplicación web y su API. Stripe es un sistema
externo; la invitación permite que un integrante se una sin iniciar sesión.

```mermaid
flowchart LR
  visitante[Visitante]
  representante[Representante de banda]
  integrante[Integrante invitado]
  staff[Personal administrativo]
  ingeniero[Ingeniero]
  evaluador[Evaluador QA]
  stripe[Stripe]

  subgraph GS["GrooveSpace · aplicación web y API"]
    catalogo((Explorar catálogo<br/>de salas))
    disponibilidad((Consultar disponibilidad))
    registro((Registrar banda))
    loginBanda((Iniciar sesión<br/>de banda))
    perfil((Gestionar perfil,<br/>instrumentos e ingeniero))
    invitar((Crear invitación))
    unirse((Unirse a una banda))
    reservar((Reservar sala y<br/>seleccionar backline))
    anticipo((Pagar anticipo))
    saldo((Liquidar saldo))
    consultar((Consultar reservas<br/>e historial))
    layout((Personalizar y guardar<br/>distribución 3D))
    demo((Probar sala 3D<br/>sin pago))
    loginStaff((Iniciar sesión<br/>administrativo))
    operar((Consultar operación,<br/>bandas y reservas))
    eliminar((Eliminar banda y<br/>datos asociados))
    loginIng((Iniciar sesión<br/>de ingeniería))
    agenda((Consultar agenda<br/>de sesiones))
    qa((Conectar monitor QA<br/>y ver eventos en vivo))
    auditar((Registrar actividad<br/>QA de interfaz y API))
  end

  visitante --> catalogo
  visitante --> disponibilidad
  visitante --> registro
  visitante --> loginBanda
  integrante --> unirse

  representante --> catalogo
  representante --> loginBanda
  representante --> perfil
  representante --> invitar
  representante --> reservar
  representante --> consultar
  representante --> anticipo
  representante --> saldo
  representante --> layout
  representante --> demo

  reservar -.->|«include»| disponibilidad

  stripe --> anticipo
  stripe --> saldo

  staff --> loginStaff
  staff --> operar
  staff --> eliminar

  ingeniero --> loginIng
  ingeniero --> agenda

  evaluador --> qa
  evaluador --> auditar
```

## Diagrama de clases del dominio

`Member`, `Instrument` y `RentedGear` representan subdocumentos embebidos en
MongoDB; `Room` y `EngineerProfile` provienen de configuración estática, no de
colecciones. `ReservationSlot` materializa los bloques de 15 minutos usados
para evitar traslapes.

```mermaid
classDiagram
  class Band {
    +ObjectId id
    +String name
    +String leaderName
    +String email
    -String passwordHash
    -String passwordSalt
    +String logoPath
    +Boolean requiresEngineer
    +String engineerId
    -String inviteTokenHash
    +Date inviteExpiresAt
  }

  class Member {
    +String name
    +String instrument
  }

  class Instrument {
    +ObjectId id
    +String name
    +String photoPath
  }

  class BandEmailDomain {
    +String domain
    +Boolean enabled
  }

  class Reservation {
    +ObjectId id
    +ObjectId bandId
    +String roomId
    +String roomName
    +String date
    +String startTime
    +Number duration
    +Number attendees
    +String engineerId
    +Number totalPrice
    +Number depositAmount
    +Number balanceAmount
    +Date balanceDueAt
    +Boolean isDemo
    +PaymentStatus paymentStatus
    +String stripeCheckoutSessionId
    +String stripeDepositSessionId
    +String stripeBalanceSessionId
  }

  class RoomLayoutItem {
    +String instrumentId
    +String name
    +Number x
    +Number z
  }

  class RentedGear {
    +String id
    +String name
    +Number price
  }

  class ReservationSlot {
    +String roomId
    +String date
    +Number slotStart
    +String engineerId
    +ObjectId reservationId
    +Date expiresAt
  }

  class Room {
    +String id
    +String name
    +Number price
    +Number capacity
    +Boolean customizable
  }

  class EngineerProfile {
    +String id
    +String name
    +String specialty
  }

  class QaEvent {
    +ObjectId id
    +String eventType
    +String severity
    +String summary
    +String description
    +String actorRole
    +String actorHash
    +String ipHash
    +String qaSessionId
    +String method
    +String route
    +Number statusCode
    +Number durationMs
    +Date createdAt
  }

  class PaymentStatus {
    <<enumeration>>
    deposit_pending
    deposit_paid
    paid
    expired
    refunded
  }

  class StripeCheckoutSession {
    <<external>>
    +String id
    +String status
    +String payment_status
    +Number amount_total
    +String currency
    +create()
    +expire()
    +verify()
  }

  Band "1" *-- "0..100" Member : integrantes
  Band "1" *-- "0..12" Instrument : instrumentos
  Band "1" --> "0..*" Reservation : reservas
  Reservation "1" *-- "0..*" RoomLayoutItem : distribución
  Reservation "1" *-- "0..*" RentedGear : renta
  Reservation "1" --> "0..*" ReservationSlot : bloques ocupados
  Reservation --> Room : roomId
  Band ..> BandEmailDomain : valida dominio al registrar
  Band ..> EngineerProfile : asignación opcional
  Reservation ..> EngineerProfile : agenda opcional
  Reservation --> PaymentStatus : estado
  Reservation ..> StripeCheckoutSession : pagos y confirmación
```

## Diagrama de clases de la arquitectura

Las flechas de dependencia muestran el flujo principal: pantallas React usan el
cliente HTTP; las rutas Express aplican autenticación antes de delegar en
controladores, que operan sobre modelos Mongoose o integraciones externas.

```mermaid
classDiagram
  namespace Frontend_React {
    class App {
      +renderRoutes()
      +manageSessions()
    }
    class AuthScreen {
      +registerBand()
      +loginBand()
    }
    class InviteScreen {
      +inspectInvite()
      +joinBand()
    }
    class BookingScreen {
      +loadAvailability()
      +createReservation()
      +startDepositCheckout()
    }
    class BandProfile {
      +loadProfile()
      +saveProfile()
      +manageMembersAndInstruments()
    }
    class PaymentReturn {
      +verifyPayment()
      +payBalance()
    }
    class RoomCustomizer {
      +renderThreeScene()
      +saveLayout()
    }
    class StaffDashboard {
      +loadOperations()
      +deleteBand()
    }
    class StaffLogin {
      +login()
    }
    class EngineerLogin {
      +login()
    }
    class EngineerPanel {
      +loadSchedule()
    }
    class IntroScreen
    class QaMonitor {
      +connect()
      +readEventStream()
      +openTestApp()
    }
  }

  namespace API_HTTP {
    class ApiClient {
      +readApiResponse()
      +installQaRequestTagging()
    }
  }

  namespace Backend_Express {
    class BackendApp {
      +configureMiddleware()
      +mountRoutes()
    }
    class BandRoutes
    class ReservationRoutes
    class PaymentRoutes
    class StaffRoutes
    class EngineerRoutes
    class QaRoutes
    class BandAuth
    class StaffAuth
    class EngineerAuth
    class QaAuth
    class UploadMiddleware
    class RateLimit
    class BandController
    class ReservationController
    class PaymentController
    class StaffController
    class EngineerController
    class QaController
    class Siem {
      +auditApiRequest()
      +recordEvent()
      +hashValue()
    }
  }

  namespace Persistence_MongoDB {
    class BandModel
    class ReservationModel
    class ReservationSlotModel
    class BandEmailDomainModel
    class QaEventModel
    class MongoDB
  }

  namespace Integrations {
    class StripeAPI
    class UploadStorage
    class RoomCatalog
    class EngineerCatalog
  }

  App --> AuthScreen
  App --> InviteScreen
  App --> BookingScreen
  App --> BandProfile
  App --> PaymentReturn
  App --> StaffLogin
  App --> StaffDashboard
  App --> EngineerLogin
  App --> EngineerPanel
  App --> IntroScreen
  App --> QaMonitor
  PaymentReturn --> RoomCustomizer

  AuthScreen ..> ApiClient
  BookingScreen ..> ApiClient
  BandProfile ..> ApiClient
  PaymentReturn ..> ApiClient
  RoomCustomizer ..> ApiClient
  StaffDashboard ..> ApiClient
  EngineerPanel ..> ApiClient
  QaMonitor ..> ApiClient

  ApiClient --> BackendApp : HTTP /api
  BackendApp --> BandRoutes
  BackendApp --> ReservationRoutes
  BackendApp --> PaymentRoutes
  BackendApp --> StaffRoutes
  BackendApp --> EngineerRoutes
  BackendApp --> QaRoutes
  BackendApp ..> PaymentController : webhook firmado

  BandRoutes ..> BandAuth
  BandRoutes ..> StaffAuth
  BandRoutes ..> UploadMiddleware
  BandRoutes ..> RateLimit
  ReservationRoutes ..> BandAuth
  ReservationRoutes ..> StaffAuth
  PaymentRoutes ..> BandAuth
  StaffRoutes ..> StaffController
  StaffRoutes ..> RateLimit
  EngineerRoutes ..> EngineerAuth
  EngineerRoutes ..> RateLimit
  QaRoutes ..> QaAuth
  QaRoutes ..> RateLimit

  BandRoutes --> BandController
  ReservationRoutes --> ReservationController
  PaymentRoutes --> PaymentController
  EngineerRoutes --> EngineerController
  QaRoutes --> QaController

  BandController ..> BandModel
  BandController ..> ReservationModel
  BandController ..> ReservationSlotModel
  BandController ..> BandEmailDomainModel
  BandController ..> StripeAPI
  BandController ..> UploadStorage
  BandController ..> EngineerCatalog
  ReservationController ..> BandModel
  ReservationController ..> ReservationModel
  ReservationController ..> ReservationSlotModel
  ReservationController ..> RoomCatalog
  PaymentController ..> ReservationModel
  PaymentController ..> ReservationSlotModel
  PaymentController ..> StripeAPI
  StaffController ..> StaffAuth
  EngineerController ..> ReservationModel
  EngineerController ..> EngineerCatalog
  QaController ..> QaEventModel
  QaController ..> Siem
  Siem ..> QaEventModel
  BackendApp ..> Siem

  BandModel --> MongoDB
  ReservationModel --> MongoDB
  ReservationSlotModel --> MongoDB
  BandEmailDomainModel --> MongoDB
  QaEventModel --> MongoDB
```

### Alcance y reglas representadas

- Los pagos reales usan Stripe Checkout; el backend confirma el resultado por
  verificación de sesión o webhook firmado. El navegador no confirma por sí solo
  un pago.
- Una reserva bloquea intervalos de sala y, si aplica, del ingeniero. Los
  intervalos pendientes expiran; un anticipo confirmado conserva los bloques.
- La personalización 3D está disponible para salas configurables cuando la
  reserva ya tiene anticipo confirmado o se creó como demostración de desarrollo.
- El monitor QA está deshabilitado en producción. Los eventos persistidos tienen
  retención TTL de 30 días.
