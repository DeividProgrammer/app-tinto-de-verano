# Tinto de Verano Tracker - Step-by-Step Development Guide

## Overview
This guide breaks down the entire project into sequential steps, from infrastructure setup to full-stack deployment. Each step builds on the previous one and is designed to be completed independently before moving forward.

---

## **PHASE 1: Infrastructure & Configuration** (Steps 1-4)

### Step 1: Update Docker Compose with Microservices
**Goal**: Add the 4 microservices to your docker-compose.yml  
**Time**: 15 min  
**Skills**: Docker, YAML

**What you'll do**:
1. Open `docker-compose.yml`
2. Add 4 new service definitions after the `triplestore` service:
   - `session-service` (Port 4000, Node.js)
   - `groups-service` (Port 4001, Node.js)
   - `counter-service` (Port 4002, Node.js)
   - `leaderboard-service` (Port 4003, Node.js)

**Each service should**:
- Use a generic Node.js image or build from `services/{name}/Dockerfile`
- Mount the service directory as a volume
- Link to the `triplestore` service
- Set environment variables:
  - `MU_SPARQL_ENDPOINT=http://triplestore:8890/sparql`
  - `MU_RESOURCE_ENDPOINT=http://resource:3000`

**Example for session-service**:
```yaml
session-service:
  build: ./services/session-service
  ports:
    - "4000:4000"
  links:
    - triplestore:database
  environment:
    NODE_ENV: development
    MU_SPARQL_ENDPOINT: http://triplestore:8890/sparql
    MU_RESOURCE_ENDPOINT: http://resource:3000
  volumes:
    - ./services/session-service:/app
```

**Deliverable**: Updated `docker-compose.yml` with all 4 services

---

### Step 2: Configure mu-dispatcher Routing Rules
**Goal**: Define how requests route to each service  
**Time**: 20 min  
**Skills**: Elixir (basic), URL pattern matching

**What you'll do**:
1. Edit `config/dispatcher/dispatcher.ex` (currently empty)
2. Add routing rules for each endpoint:

**Endpoints to route**:
```
POST   /session            → session-service:4000
GET    /me                 → session-service:4000
GET    /groups/:id         → groups-service:4001
POST   /groups/:id/join    → groups-service:4001
GET    /me/counter         → counter-service:4002
POST   /me/counter/increment → counter-service:4002
POST   /me/counter/decrement → counter-service:4002
GET    /groups/:id/leaderboard → leaderboard-service:4003
```

**Elixir syntax**:
```elixir
defmodule Dispatcher do
  def match(pattern, method) do
    # Returns the service URL to forward to
  end
end
```

**Deliverable**: Complete `config/dispatcher/dispatcher.ex` with all routes

---

### Step 3: Define RDF Data Model (domain.json)
**Goal**: Tell mu-cl-resources about your data schema  
**Time**: 30 min  
**Skills**: JSON, RDF/Semantic Web concepts

**What you'll do**:
1. Edit `config/resources/domain.json`
2. Define 3 resource types:

**Resources to define**:

**a) Person (User)**
```json
{
  "name": "person",
  "rdfType": "schema:Person",
  "attributes": [
    { "name": "name", "predicate": "schema:name" },
    { "name": "email", "predicate": "schema:email" }
  ],
  "relationships": [
    { "name": "memberOf", "predicate": "schema:memberOf" }
  ]
}
```

**b) Organization (Group)**
```json
{
  "name": "organization",
  "rdfType": "schema:Organization",
  "attributes": [
    { "name": "name", "predicate": "schema:name" },
    { "name": "status", "predicate": "ext:status" }
  ],
  "relationships": [
    { "name": "member", "predicate": "schema:member" }
  ]
}
```

**c) WeeklyCount**
```json
{
  "name": "weeklyCount",
  "rdfType": "ext:WeeklyCount",
  "attributes": [
    { "name": "period", "predicate": "ext:period" },
    { "name": "count", "predicate": "ext:count" }
  ],
  "relationships": [
    { "name": "user", "predicate": "ext:user" }
  ]
}
```

**Deliverable**: Complete `config/resources/domain.json` with all 3 resources

---

### Step 4: Create SPARQL Migration Files
**Goal**: Initialize the database with schema and seed data  
**Time**: 25 min  
**Skills**: SPARQL INSERT/SELECT

**What you'll do**:
1. Create migration files in `config/migrations/`:
   - `001_create_seed_data.sparql`

2. Define INSERT queries to create initial data:

**Migration content**:
```sparql
PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
PREFIX schema: <http://schema.org/>
PREFIX ext: <http://example.com/ext/>

INSERT DATA {
  GRAPH <http://mu.semte.ch/graphs/system> {
    # Create seed users
    <http://example.com/users/user-1>
      a schema:Person ;
      mu:uuid "user-1" ;
      schema:name "Alice" ;
      schema:email "alice@example.com" .

    <http://example.com/users/user-2>
      a schema:Person ;
      mu:uuid "user-2" ;
      schema:name "Bob" ;
      schema:email "bob@example.com" .

    # Create seed groups
    <http://example.com/groups/group-1>
      a schema:Organization ;
      mu:uuid "group-1" ;
      schema:name "Weekend Warriors" ;
      ext:status "active" .

    # Create memberships
    <http://example.com/users/user-1> schema:memberOf <http://example.com/groups/group-1> .
    <http://example.com/groups/group-1> schema:member <http://example.com/users/user-1> .
  }
}
```

**Deliverable**: `config/migrations/001_create_seed_data.sparql`

---

## **PHASE 2: Microservices Development** (Steps 5-8)

### Step 5: Build Session Service
**Goal**: Handle user authentication and session management  
**Time**: 45 min  
**Skills**: Node.js, Express, REST APIs

**What you'll do**:
1. Create `services/session-service/` directory structure:
   ```
   services/session-service/
   ├── Dockerfile
   ├── package.json
   ├── app.js
   ├── routes/
   │   └── session.js
   └── utils/
       └── sparql.js
   ```

2. Implement 2 endpoints:
   - **POST /session** - Mock login (create session, return user)
   - **GET /me** - Get current user from session

3. Key logic:
   - Read `MU_SESSION_ID` from request header
   - Query Virtuoso for user data by session ID
   - Return JSON-API formatted response

**Example structure**:
```javascript
// app.js
const express = require('express');
const app = express();

app.get('/me', async (req, res) => {
  const sessionId = req.headers['mu-session-id'];
  // Query Virtuoso for user
  // Return user data
});

app.post('/session', async (req, res) => {
  // Create new user/session
  // Return session ID and user
});
```

**Deliverable**: Complete `services/session-service/` with both endpoints working

---

### Step 6: Build Groups Service
**Goal**: Manage groups and memberships  
**Time**: 50 min  
**Skills**: Node.js, SPARQL queries, RDF relationships

**What you'll do**:
1. Create `services/groups-service/` with structure similar to Step 5

2. Implement 2 endpoints:
   - **GET /groups/:id** - Fetch group info and members
   - **POST /groups/:id/join** - Add current user to group

3. Key logic:
   - Query group by UUID
   - List all members in group
   - Create `schema:memberOf` relationship

**SPARQL queries needed**:
```sparql
# Get group by ID
SELECT ?group ?name ?status WHERE {
  GRAPH ?g { ?group a schema:Organization ; mu:uuid "group-id" ; ... }
}

# Get group members
SELECT ?user ?name WHERE {
  ?group schema:member ?user .
  ?user schema:name ?name .
}

# Add user to group
INSERT DATA {
  ?user schema:memberOf ?group .
  ?group schema:member ?user .
}
```

**Deliverable**: Complete `services/groups-service/` with both endpoints working

---

### Step 7: Build Counter Service
**Goal**: Track weekly drink counts  
**Time**: 50 min  
**Skills**: Node.js, SPARQL INSERT/UPDATE, temporal data

**What you'll do**:
1. Create `services/counter-service/` with Express setup

2. Implement 3 endpoints:
   - **GET /me/counter?period=YYYY-Www** - Get count for week
   - **POST /me/counter/increment** - Add 1 drink
   - **POST /me/counter/decrement** - Remove 1 drink

3. Key logic:
   - Generate ISO week format (e.g., "2025-W45")
   - Create `ext:WeeklyCount` record if doesn't exist
   - Increment/decrement `ext:count` property

**SPARQL patterns**:
```sparql
# Get or create weekly count
SELECT ?count WHERE {
  ?weeklyCount a ext:WeeklyCount ;
    ext:user ?user ;
    ext:period "2025-W45" ;
    ext:count ?count .
}

# Increment count
INSERT DATA {
  ?weeklyCount ext:count 8 .
}
DELETE DATA {
  ?weeklyCount ext:count 7 .
}
```

**Deliverable**: Complete `services/counter-service/` with all 3 endpoints

---

### Step 8: Build Leaderboard Service
**Goal**: Aggregate rankings by group  
**Time**: 45 min  
**Skills**: Node.js, SPARQL aggregation queries

**What you'll do**:
1. Create `services/leaderboard-service/`

2. Implement 1 endpoint:
   - **GET /groups/:id/leaderboard?period=YYYY-Www** - Return ranked users

3. Key logic:
   - Query all members of group
   - Get their `ext:WeeklyCount` for given period
   - Sort by count (descending)
   - Return as array with rank

**SPARQL query**:
```sparql
SELECT ?user ?name ?count WHERE {
  ?group mu:uuid "group-id" ;
    schema:member ?user .
  ?user schema:name ?name .
  
  ?weeklyCount a ext:WeeklyCount ;
    ext:user ?user ;
    ext:period "2025-W45" ;
    ext:count ?count .
}
ORDER BY DESC(?count)
```

**Deliverable**: Complete `services/leaderboard-service/` with leaderboard endpoint

---

## **PHASE 3: Frontend Development** (Steps 9-12)

### Step 9: Setup Ember.js Project
**Goal**: Initialize Ember SPA structure  
**Time**: 20 min  
**Skills**: Ember CLI, Node package management

**What you'll do**:
1. Create frontend folder: `mkdir frontend`
2. Initialize Ember app (or create basic structure if not using full Ember):
   ```bash
   cd frontend
   ember new . --skip-git
   ```
3. Or create minimal structure:
   ```
   frontend/
   ├── package.json
   ├── app.js
   ├── index.html
   └── src/
       ├── components/
       ├── routes/
       ├── services/
       └── styles/
   ```

**Deliverable**: Basic Ember project structure with `package.json`

---

### Step 10: Create API Service Layer
**Goal**: Abstract HTTP calls to backend  
**Time**: 30 min  
**Skills**: Ember Services, async/await, fetch API

**What you'll do**:
1. Create `frontend/app/services/api.js` (or `app/services/backend.js`)

2. Implement methods for each endpoint:
   ```javascript
   async getMe() { }
   async createSession(username) { }
   async joinGroup(groupId) { }
   async getGroup(groupId) { }
   async getCounter(period) { }
   async incrementCounter() { }
   async decrementCounter() { }
   async getLeaderboard(groupId, period) { }
   ```

3. Each method should:
   - Make HTTP request to backend (http://localhost/api/...)
   - Handle cookies for MU_SESSION_ID
   - Return parsed JSON

**Example**:
```javascript
async getMe() {
  const response = await fetch('http://localhost/me', {
    method: 'GET',
    credentials: 'include' // Send cookies
  });
  return response.json();
}
```

**Deliverable**: Complete `frontend/app/services/api.js` with all 8 methods

---

### Step 11: Build UI Components
**Goal**: Create user-facing screens  
**Time**: 90 min  
**Skills**: Ember Components, Handlebars templates, CSS

**What you'll do**:
Create 5 main components:

**a) Login Component** (`app/components/login.hbs`)
- Form with username input
- "Login" button
- Calls `api.createSession()`

**b) Dashboard Component** (`app/components/dashboard.hbs`)
- Shows current user (name, email)
- Shows current week's count
- Buttons: +1, -1 drinks
- Link to groups

**c) Groups Component** (`app/components/groups-list.hbs`)
- List of available groups
- "Join" button for each
- Shows member count

**d) Group Detail Component** (`app/components/group-detail.hbs`)
- Group name, members list
- Leaderboard for current week
- Period selector (different weeks)

**e) Leaderboard Component** (`app/components/leaderboard.hbs`)
- Ranked list of users
- Rank, name, drink count
- Week/period display

**Deliverable**: All 5 components with basic styling and functionality

---

### Step 12: Create Routes & Navigation
**Goal**: Connect components with Ember routing  
**Time**: 30 min  
**Skills**: Ember routing, template hierarchy

**What you'll do**:
1. Create route structure:
   ```
   routes/
   ├── index.js          (login page)
   ├── dashboard.js      (main dashboard)
   ├── groups.js         (groups list)
   ├── group.js          (group detail)
   └── leaderboard.js    (leaderboard view)
   ```

2. Define routes in `app/router.js`:
   ```javascript
   Router.map(function() {
     this.route('dashboard');
     this.route('groups');
     this.route('group', { path: '/groups/:id' });
     this.route('leaderboard', { path: '/groups/:id/leaderboard' });
   });
   ```

3. Create main template with navigation

**Deliverable**: Working Ember routes with navigation between all pages

---

## **PHASE 4: Integration & Testing** (Steps 13-15)

### Step 13: Start All Services
**Goal**: Run the complete stack  
**Time**: 15 min  
**Skills**: Docker Compose, troubleshooting

**What you'll do**:
1. Start Docker Compose:
   ```bash
   docker-compose up -d
   ```

2. Verify services are running:
   ```bash
   docker-compose ps
   ```

3. Check logs for errors:
   ```bash
   docker-compose logs -f session-service
   docker-compose logs -f dispatcher
   docker-compose logs -f triplestore
   ```

4. Test endpoints manually:
   ```bash
   curl http://localhost/me
   curl -X POST http://localhost/session
   ```

**Deliverable**: All services running, basic connectivity working

---

### Step 14: End-to-End Testing
**Goal**: Verify full request flows  
**Time**: 60 min  
**Skills**: API testing, debugging

**Test flows**:

**Flow 1: Login → View Dashboard**
1. POST /session (get session ID)
2. GET /me (verify user data)
3. GET /me/counter?period=2025-W45 (get count)

**Flow 2: Join Group**
1. POST /groups/group-1/join (join group)
2. GET /groups/group-1 (verify membership)
3. GET /groups/group-1/leaderboard (see in leaderboard)

**Flow 3: Increment Counter**
1. POST /me/counter/increment (add drink)
2. GET /me/counter (verify count increased)
3. GET /groups/group-1/leaderboard (verify ranking changed)

**Tools**: Postman, curl, browser console

**Deliverable**: All flows tested and working

---

### Step 15: Frontend Integration Testing
**Goal**: Verify UI works with backend  
**Time**: 60 min  
**Skills**: Ember debugging, network debugging

**What you'll do**:
1. Start frontend: `cd frontend && npm start` (port 4200)
2. Test each user action:
   - Login flow
   - View dashboard
   - Join a group
   - Increment/decrement counter
   - View leaderboard
   - Navigate between pages

3. Fix any bugs in:
   - API calls (CORS, headers, paths)
   - Data formatting (JSON-API vs plain JSON)
   - State management
   - UI rendering

**Deliverable**: Fully functional end-to-end user flows in browser

---

## **PHASE 5: Polish & Deployment** (Steps 16-18)

### Step 16: Improve Error Handling & Validation
**Goal**: Handle edge cases gracefully  
**Time**: 40 min

**What to add**:
- Error messages for failed API calls
- Input validation (empty fields, invalid formats)
- Loading states (spinners while fetching)
- Network retry logic
- Fallback UI for empty states

**Deliverable**: Robust error handling throughout app

---

### Step 17: Add Persistence & State Management
**Goal**: Maintain user state across page reloads  
**Time**: 30 min

**What to implement**:
- Store user session in localStorage
- Auto-login if session exists
- Cache group/leaderboard data
- Clear state on logout

**Deliverable**: App state persists across sessions

---

### Step 18: Deploy & Documentation
**Goal**: Get app ready for production  
**Time**: 45 min

**What to do**:
- Build frontend for production
- Document setup instructions
- Create README with run commands
- Add environment configuration
- Test in clean environment

**Deliverable**: Production-ready Tinto de Verano Tracker 🍷

---

## Execution Summary

**Total Time**: ~12-15 hours of work

**By Phase**:
- Phase 1 (Infrastructure): 1.5 hours
- Phase 2 (Microservices): 3.5 hours
- Phase 3 (Frontend): 4 hours
- Phase 4 (Integration): 2 hours
- Phase 5 (Polish): 1.5 hours

**Recommended Pace**:
- Week 1: Phases 1-2 (infrastructure + services)
- Week 2: Phase 3 (frontend)
- Week 3: Phases 4-5 (integration, testing, polish)

---

## Tips for Success

1. **Test as you go** - Don't wait until the end to test each service
2. **Read docs** - Check mu.semte.ch documentation for detailed config
3. **Use logging** - Add console.log to debug SPARQL queries
4. **Start simple** - Use mock data before integrating with database
5. **Iterate** - Build MVP first, then add features
6. **Take breaks** - Microservices architecture is complex; pace yourself!

Good luck! 🚀

