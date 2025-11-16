# Tinto de Verano Tracker - Architecture Guide

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND                                  │
│                    Ember.js SPA (Port 4200)                      │
│                                                                   │
│  (Components, Routes, Templates, Services)                       │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           │ HTTP Requests
                           │ (REST API)
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                      API GATEWAY LAYER                           │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  mu-identifier (Port 80)                                 │   │
│  │  - Session management (MU_SESSION_ID cookie)             │   │
│  │  - User authentication/authorization                     │   │
│  │  - Routes to dispatcher                                  │   │
│  └────────────────┬─────────────────────────────────────────┘   │
│                   │                                              │
└───────────────────┼──────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                   ROUTING LAYER                                  │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  mu-dispatcher (Port 80)                                 │   │
│  │  - Routes requests to appropriate services               │   │
│  │  - Rules-based routing (config/dispatcher/dispatcher.ex) │   │
│  │                                                           │   │
│  │  Routing Rules:                                          │   │
│  │  POST   /session          → session-service             │   │
│  │  GET    /me               → session-service             │   │
│  │  GET    /groups/:id       → groups-service              │   │
│  │  POST   /groups/:id/join  → groups-service              │   │
│  │  GET    /me/counter       → counter-service             │   │
│  │  POST   /me/counter/*     → counter-service             │   │
│  │  GET    /groups/:id/lb    → leaderboard-service         │   │
│  └────────────────┬─────────────────────────────────────────┘   │
│                   │                                              │
└───────────────────┼──────────────────────────────────────────────┘
                    │
        ┌───────────┼───────────┬──────────────┐
        │           │           │              │
        ▼           ▼           ▼              ▼
   ┌────────┐  ┌────────┐  ┌────────┐   ┌────────┐
   │Session │  │Groups  │  │Counter │   │Leader- │
   │Service │  │Service │  │Service │   │board   │
   │        │  │        │  │        │   │Service │
   └───┬────┘  └───┬────┘  └───┬────┘   └───┬────┘
       │           │           │            │
       └───────────┼───────────┴────────────┘
                   │
                   │ SPARQL Queries
                   │ (via mu-cl-resources)
                   ▼
┌─────────────────────────────────────────────────────────────────┐
│               DATA ACCESS LAYER                                  │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  mu-cl-resources (Port 3000)                             │   │
│  │  - CRUD resource layer                                   │   │
│  │  - Translates JSON-API to SPARQL                         │   │
│  │  - Configuration: config/resources/                      │   │
│  │    - domain.json (model definitions)                     │   │
│  │    - domain.lisp (advanced mappings)                     │   │
│  │    - repository.lisp (custom queries)                    │   │
│  └────────────────┬─────────────────────────────────────────┘   │
│                   │                                              │
└───────────────────┼──────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│              DATABASE LAYER (RDF Triple Store)                  │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Virtuoso (Port 8890)                                    │   │
│  │  - RDF Triple Store                                      │   │
│  │  - SPARQL endpoint                                       │   │
│  │  - Configuration: config/virtuoso/virtuoso.ini           │   │
│  │                                                           │   │
│  │  Data Graphs:                                            │   │
│  │  - http://mu.semte.ch/graphs/users/{uuid}               │   │
│  │  - http://mu.semte.ch/graphs/groups/{uuid}              │   │
│  │  - http://mu.semte.ch/graphs/system                      │   │
│  └────────────────┬─────────────────────────────────────────┘   │
│                   │                                              │
│  ┌────────────────▼─────────────────────────────────────────┐   │
│  │  Persistent Volume: ./data/db/                           │   │
│  │  - Stores all RDF data                                   │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│              AUXILIARY SERVICES                                  │
│                                                                   │
│  ┌──────────────────────────┐   ┌──────────────────────────┐   │
│  │ mu-migrations-service    │   │ mu-delta-notifier        │   │
│  │ (Data Initialization)    │   │ (Change Notifications)   │   │
│  │                          │   │                          │   │
│  │ - Runs migration files   │   │ - Subscribes to changes  │   │
│  │ - Sets up initial data   │   │ - Notifies services      │   │
│  │ - config/migrations/     │   │ - config/delta/          │   │
│  └──────────────────────────┘   └──────────────────────────┘   │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## Layer Breakdown

### 1. **Frontend Layer** (Ember.js)
- **Port**: 4200
- **Responsibility**: User Interface
- **Communication**: REST API calls to `/me`, `/groups`, `/groups/{id}/join`, `/me/counter`, `/groups/{id}/leaderboard`
- **Files to Create**:
  - `app/` - Ember app structure
  - `app/routes/` - Route handlers
  - `app/components/` - UI components
  - `app/services/` - Service layer for API calls
  - `app/templates/` - Handlebars templates

### 2. **API Gateway Layer** (mu-identifier)
- **Port**: 80 (reverse proxy)
- **Container**: `semtech/mu-identifier:1.10.3`
- **Responsibility**:
  - Entry point for all requests
  - Session cookie management (`MU_SESSION_ID`)
  - Basic authentication/authorization
  - Adds `MU_SESSION_ID` header to all requests
  - Routes to dispatcher

**Key Concepts**:
- Every request gets a `MU_SESSION_ID` from the identifier
- This session ID is used to identify the current user
- Environment: `SESSION_COOKIE_SECURE: "on"` for HTTPS

### 3. **Routing Layer** (mu-dispatcher)
- **Port**: 80 (internal, behind identifier)
- **Container**: `semtech/mu-dispatcher:2.1.0-beta.2`
- **Config File**: `config/dispatcher/dispatcher.ex`
- **Responsibility**:
  - Route rules based on HTTP method + path
  - Forward requests to appropriate microservices
  - Handle 404s and error responses

**File**: `config/dispatcher/dispatcher.ex` (Elixir-based routing)

Example routing rules:
```elixir
match "/session@post" do
  forward conn, [], "http://session-service:4000"
end

match "/me@get" do
  forward conn, [], "http://session-service:4000"
end

match "/groups/:id/join@post" do
  forward conn, [], "http://groups-service:4000"
end
```

### 4. **Microservices Layer**

Each service is a Node.js application that:
- Listens on a specific port (4000, 4001, 4002, etc.)
- Receives HTTP requests forwarded by dispatcher
- Executes business logic
- Makes SPARQL queries to Virtuoso

**Services to Create**:

#### a) **Session Service**
- **Endpoints**: `POST /session`, `GET /me`
- **Port**: 4000
- **Responsibility**:
  - Mock user authentication
  - Return current user info
  - Create/manage sessions

#### b) **Groups Service**
- **Endpoints**: `GET /groups/:id`, `POST /groups/:id/join`
- **Port**: 4001
- **Responsibility**:
  - Manage group information
  - Handle group membership
  - List groups and members

#### c) **Counter Service**
- **Endpoints**: `GET /me/counter?period=YYYY-Www`, `POST /me/counter/increment`, `POST /me/counter/decrement`
- **Port**: 4002
- **Responsibility**:
  - Track weekly drink counts
  - Increment/decrement counters
  - Query historical data

#### d) **Leaderboard Service**
- **Endpoints**: `GET /groups/:id/leaderboard?period=YYYY-Www`
- **Port**: 4003
- **Responsibility**:
  - Aggregate drink counts
  - Generate rankings per group
  - Calculate statistics

### 5. **Data Access Layer** (mu-cl-resources)
- **Port**: 3000
- **Container**: `semtech/mu-cl-resources:1.26.0`
- **Configuration Files**:
  - `config/resources/domain.json` - JSON schema definitions
  - `config/resources/domain.lisp` - Advanced Lisp mappings
  - `config/resources/repository.lisp` - Custom query logic

**Responsibility**:
- Converts microservice requests to SPARQL queries
- Provides JSON-API endpoint
- Manages RDF resource creation/updates
- Translates between REST and RDF

### 6. **Database Layer** (Virtuoso RDF Store)
- **Port**: 8890
- **Container**: `redpencil/virtuoso:1.2.1`
- **Environment**: `SPARQL_UPDATE: "true"` (allows write operations)
- **Configuration**: `config/virtuoso/virtuoso.ini`
- **Volume**: `./data/db/` (persistent storage)

**RDF Graphs Used**:
- `http://mu.semte.ch/graphs/users/{uuid}` - User data and counters
- `http://mu.semte.ch/graphs/groups/{uuid}` - Group data and memberships
- `http://mu.semte.ch/graphs/system` - System-wide data

**Data Model (RDF)**:
```turtle
# User (schema:Person)
<http://example.com/users/{uuid}>
  a schema:Person ;
  schema:name "John Doe" ;
  schema:email "john@example.com" ;
  schema:memberOf <http://example.com/groups/{groupUuid}> .

# Group (schema:Organization)
<http://example.com/groups/{uuid}>
  a schema:Organization ;
  schema:name "Weekend Warriors" ;
  ext:status "active" ;
  schema:member <http://example.com/users/{userUuid}> .

# Weekly Count (ext:WeeklyCount)
<http://example.com/weekly-counts/{uuid}>
  a ext:WeeklyCount ;
  ext:user <http://example.com/users/{uuid}> ;
  ext:period "2025-W45" ;
  ext:count 7 .
```

### 7. **Auxiliary Services**

#### a) **mu-migrations-service**
- **Port**: 3001
- **Container**: `semtech/mu-migrations-service:0.9.0`
- **Config**: `config/migrations/`
- **Responsibility**:
  - Runs SQL/SPARQL migration files on startup
  - Initializes database schema
  - Seeds initial data

#### b) **mu-delta-notifier**
- **Port**: 3002
- **Container**: `semtech/mu-delta-notifier:0.4.0`
- **Config**: `config/delta/`
- **Responsibility**:
  - Watches for changes in Virtuoso
  - Publishes change notifications to other services
  - Enables reactive data updates

#### c) **sparql-parser** (database service)
- **Port**: 8889
- **Container**: `semtech/sparql-parser:0.0.15`
- **Config**: `config/authorization/`
- **Responsibility**:
  - Authorization layer for SPARQL queries
  - Validates permissions before accessing data

## Data Flow Examples

### Example 1: User Login
```
1. Frontend POST /session
   └─> identifier (adds MU_SESSION_ID)
       └─> dispatcher (routes to session-service)
           └─> session-service (logic)
               └─> mu-cl-resources (SPARQL query)
                   └─> Virtuoso (RDF store)
                       └─ Returns user data
```

### Example 2: Join Group
```
1. Frontend POST /groups/{groupId}/join
   └─> identifier
       └─> dispatcher
           └─> groups-service
               └─> mu-cl-resources
                   └─> Virtuoso
                       └─ Creates schema:memberOf relationship
```

### Example 3: Increment Counter
```
1. Frontend POST /me/counter/increment
   └─> identifier
       └─> dispatcher
           └─> counter-service
               └─> mu-cl-resources
                   └─> Virtuoso
                       └─ Updates ext:WeeklyCount.ext:count += 1
```

## Project Directory Structure

```
/home/deivid/Desktop/onboarding/getting-started/
├── docker-compose.yml              # Container orchestration
├── docker-compose.dev.yml          # Development overrides
├── ARCHITECTURE.md                 # This file
├── config/
│   ├── dispatcher/
│   │   └── dispatcher.ex           # Routing rules (to create)
│   ├── resources/
│   │   ├── domain.json             # Resource definitions (to create)
│   │   ├── domain.lisp             # LISP mappings (to create)
│   │   └── repository.lisp         # Custom queries (to create)
│   ├── migrations/
│   │   └── *.sparql                # Migration files (to create)
│   ├── delta/
│   │   └── config.json             # Delta notifier config (to create)
│   ├── authorization/
│   │   └── config.lisp             # Authorization rules (to create)
│   └── virtuoso/
│       └── virtuoso.ini            # Virtuoso configuration (to create)
├── data/
│   └── db/                         # Virtuoso data volume (created at runtime)
├── services/                       # Microservices (to create)
│   ├── session-service/
│   │   └── app.js
│   ├── groups-service/
│   │   └── app.js
│   ├── counter-service/
│   │   └── app.js
│   └── leaderboard-service/
│       └── app.js
└── frontend/                       # Ember.js app (to create)
    ├── app/
    ├── public/
    └── ember-cli-build.js
```

## Learning Objectives

As you build this project, you'll learn:

1. **mu.semte.ch Stack**:
   - How identifier manages sessions
   - Routing with dispatcher
   - Resource abstraction with mu-cl-resources
   - SPARQL query patterns

2. **Microservices Architecture**:
   - Service separation of concerns
   - Inter-service communication
   - Service discovery

3. **RDF & Semantic Web**:
   - Triple stores and RDF data model
   - SPARQL queries (SELECT, INSERT, DELETE)
   - Graph-based data relationships

4. **Containerization**:
   - Docker Compose orchestration
   - Service networking
   - Volume management

5. **Ember.js**:
   - Component-driven UI
   - API service layer
   - Routing and templates

## Next Steps

1. **Create dispatcher routing rules** (`config/dispatcher/dispatcher.ex`)
2. **Define RDF data models** (`config/resources/domain.json`)
3. **Create microservices** (Node.js apps for each service)
4. **Set up SPARQL migrations** (initial data and schema)
5. **Build Ember.js frontend**
6. **Test end-to-end flow**

Good luck learning the stack! 🍷

