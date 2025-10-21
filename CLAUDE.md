# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ECOS-ORL is a medical training platform featuring ECOS (Examen Clinique Objectif Structuré) simulations for nursing education. The platform combines a React SPA frontend with Express.js backend, Supabase PostgreSQL database, and AI-powered chat assistance for immersive medical training scenarios.

## Development Commands

### Core Development
```bash
# Development server (runs both client and server)
npm run dev

# TypeScript type checking
npm run check

# Production build
npm run build

# Database schema push
npm run db:push
```

### Testing & Validation
```bash
# Local environment test
npm run test:local

# Health check validation
npm run health:check

# Environment validation
npm run validate:env

# Deployment validation
npm run validate:deployment
```

### Deployment
```bash
# Safe deployment with validation
npm run deploy:safe

# Production deployment
npm run deploy:production

# Pre-deployment checks
npm run pre-deploy

# Post-deployment validation
npm run post-deploy
```

## Architecture Overview

### Database Architecture - CRITICAL

**IMPORTANT**: The codebase has TWO different database schemas that must be understood:

1. **Code Schema** (`shared/schema.ts`): Defines `ecos_sessions`, `ecos_messages`, `ecos_evaluations` tables
2. **Actual Supabase Schema**: Uses `sessions`, `exchanges`, `evaluations` tables

**Current Implementation**: The `UnifiedDatabaseService` has been adapted to bridge this gap:
- Frontend uses string session IDs (e.g., `session_5_1758021134446_gm0k1a8xi`)
- Backend maps string IDs to database integer IDs via `sessions` table
- Messages stored in `exchanges` table with proper session references
- Evaluations stored in `evaluations` table

### Key Database Tables (Actual Supabase)
```sql
sessions          -- ECOS session management (session_id: string, scenario_id: int)
exchanges         -- Chat messages (session_id: int FK, role: varchar, question/response: text)
evaluations       -- Assessment results (session_id: int FK, scores: jsonb, global_score: int)
scenarios         -- Medical scenarios (title, patient_prompt, evaluation_criteria: jsonb)
users             -- User authentication and profiles
training_sessions -- Training modules and assignments
```

### Core Services Architecture

#### UnifiedDatabaseService (`server/services/unified-database.service.ts`)
- **Single point of access** for all database operations
- **Supabase REST API** via `@supabase/supabase-js` client
- **Key Methods**:
  - `createSession(sessionData)` - Store ECOS sessions
  - `getSessionMessages(sessionId)` - Retrieve conversation history
  - `storeSessionMessage(messageData)` - Store chat messages
  - `createEvaluation(evalData)` - Store assessment results
  - `getSessionByStringId(sessionId)` - Map string to DB session

#### Session Flow Architecture
1. **Session Creation** (`/api/ecos/sessions`):
   - Generates string session ID with scenario info
   - Stores in `sessions` table with student email and scenario ID
2. **Message Storage** (`/api/ecos/sessions/:sessionId/messages`):
   - Maps session string ID to database integer ID
   - Stores user and assistant messages in `exchanges` table
3. **Evaluation** (`/api/ecos/sessions/:sessionId/evaluate`):
   - Retrieves messages via `getSessionMessages()`
   - Generates evaluation using AI/heuristics
   - Stores results in `evaluations` table

### Frontend Architecture

#### Core Structure
- **Router**: Wouter for lightweight client-side routing
- **State Management**: TanStack Query for server state
- **UI Framework**: Radix UI primitives with shadcn/ui components
- **Styling**: Tailwind CSS with responsive design
- **Build Tool**: Vite 5.4+ with path aliases configured
  - `@/*` → `client/src/*`
  - `@shared/*` → `shared/*`
  - `@assets/*` → `attached_assets/*`

#### Key Routes
```
/admin              - Administrative interface
/teacher/:email     - Teacher dashboard and scenario management
/student/:email     - Student ECOS examination interface
/chat/:email        - AI chat assistant for learning
/diagnostic         - System health and debugging
```

#### Authentication
- **Simple localStorage-based** authentication
- **Email extraction** with multiple detection strategies
- **Fallback user**: `cherubindavid@gmail.com` for development

### Backend API Architecture

#### Server Configuration
- **Entry Point**: `server/index.ts` with Express setup
- **Development Port**: 5000 (configurable via `PORT` env variable)
- **API Proxy**: In development, Vite proxies `/api` requests to `localhost:5001`
- **Routes**: Defined in `server/routes.ts` with comprehensive endpoint handlers

#### Middleware Stack (Applied in Order)
1. **Request ID Tracking** (`addRequestId`) - Assigns unique ID to each request
2. **Readiness Gate** (`createReadinessGate`) - Blocks requests until services are ready
3. **Rate Limiting** (`generalRateLimit`) - Applied to `/api/*` routes only
4. **Debug Middleware** (`createDebugMiddleware`) - Request/response logging
5. **Circuit Breaker** (`databaseCircuitBreaker`) - Database failure protection
6. **Error Handler** (`errorHandler`) - Centralized error handling with structured responses

#### Key Services
- **VirtualPatientService** (`virtual-patient.service.ts`) - AI-powered patient simulation
- **ConversationMemoryService** (`conversation-memory.service.ts`) - Chat history management
- **PineconeService** (`pinecone.service.ts`) - Vector storage for RAG-based chat
- **OpenAIService** (`openai.service.ts`) - OpenAI API integration for evaluations
- **ScenarioSyncService** (`scenario-sync.service.ts`) - Scenario data synchronization
- **StartupSequencer** (`startup-sequencer.service.ts`) - Orchestrates service initialization
- **Logger** (`logger.service.ts`) - Structured logging with context

#### Critical Endpoints
```
POST /api/ecos/sessions                    - Create new ECOS session
POST /api/ecos/sessions/:id/messages       - Add messages to session
POST /api/ecos/sessions/:id/evaluate       - Evaluate session performance
GET  /api/scenarios                        - Retrieve medical scenarios
GET  /health                              - System health check with DB connectivity
GET  /ready                               - Readiness probe for deployments
GET  /diagnostic                          - Frontend diagnostic interface
```

#### Error Handling Pattern
- **Database errors**: Continue execution with warnings, don't break user flow
- **Session not found**: Return empty arrays, log warnings
- **Evaluation failures**: Use heuristic fallbacks
- **API responses**: Always include structured error codes
- **Circuit Breaker**: Automatic recovery from database failures
- **Request Timeouts**: Configurable timeouts with graceful handling

## Common Development Patterns

### Database Operations
```typescript
// Always use UnifiedDatabaseService
import { unifiedDb } from './services/unified-database.service';

// Session creation with error handling
try {
  const session = await unifiedDb.createSession({
    sessionId: 'session_5_12345_abc',
    studentEmail: 'user@example.com',
    scenarioId: 5
  });
} catch (error) {
  console.warn('Session creation failed:', error.message);
  // Continue execution - don't throw
}

// Message storage pattern
await unifiedDb.storeSessionMessage({
  sessionId: 'session_5_12345_abc',
  role: 'user', // or 'assistant'
  question: userMessage,
  response: aiResponse
});
```

### Frontend API Integration
```typescript
// Use apiRequest from queryClient
import { apiRequest } from "@/lib/queryClient";

// Session creation
const session = await apiRequest('POST', '/api/ecos/sessions', {
  studentEmail: email,
  scenarioId: parseInt(scenarioId)
});

// Evaluation request
const evaluation = await apiRequest('POST', `/api/ecos/sessions/${sessionId}/evaluate?email=${email}`, {
  criteria: {},
  responses: []
});
```

### Component Patterns
```typescript
// Use TanStack Query for server state
const { data: scenarios, isLoading } = useQuery({
  queryKey: ['scenarios'],
  queryFn: async () => apiRequest('GET', '/api/scenarios')
});

// Error boundaries for graceful failures
if (error) {
  return <div>Une erreur est survenue. Veuillez réessayer.</div>;
}
```

## Environment Configuration

### Required Environment Variables
```env
# Database (Supabase)
DATABASE_URL=postgresql://postgres:[password]@db.[project].supabase.co:5432/postgres
SUPABASE_URL=https://[project].supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
SUPABASE_ANON_KEY=your_anon_key

# AI Services
OPENAI_API_KEY=your_openai_key
PINECONE_API_KEY=your_pinecone_key

# Development
NODE_ENV=development
PORT=5000  # Backend server port (Vite proxies to 5001 in dev mode)
```

## Debugging and Troubleshooting

### Health Check System
- **Primary**: `GET /health` - Full system health with database connectivity
- **Ready Check**: `GET /ready` - Deployment readiness validation
- **Diagnostic Panel**: `GET /diagnostic` - Frontend debugging interface
- **Rate Limit Status**: Monitor current rate limiting state via middleware

### Common Issues

#### Database Connection Problems
1. Check environment variables with `npm run validate:env`
2. Verify Supabase project status and connectivity
3. Review `UnifiedDatabaseService` initialization logs

#### Session/Evaluation Failures
1. **Symptom**: "session était vide" errors
   - **Cause**: Session not stored in database or messages not persisted
   - **Fix**: Verify `createSession()` and `storeSessionMessage()` calls
2. **Symptom**: 400 errors on evaluation
   - **Cause**: No messages found for session
   - **Fix**: Check `getSessionMessages()` returns data
3. **Symptom**: Rapport vide / `EVALUATION_NOT_FOUND`
   - **Cause**: Supabase indisponible au moment de l'écriture
   - **Fix**: Le `UnifiedDatabaseService` maintient un cache en mémoire (sessions, messages, évaluations). Après redémarrage, les endpoints lisent automatiquement ces fallbacks mais vérifie que le serveur a bien été relancé après les patchs récents.

#### Frontend Issues
1. **Authentication**: Check localStorage for `userEmail`
2. **Routing**: Verify Wouter route patterns match URL structure
3. **API Calls**: Check network tab for failed requests

### Development Workflow

#### Database Changes
1. Modify `shared/schema.ts` for code schema definitions
2. Use `npm run db:push` to apply changes to Supabase
3. Update `UnifiedDatabaseService` methods if table structure changes
4. Test with `npm run health:check`

#### New Feature Development
1. **Backend**: Add routes to `server/routes.ts` with proper validation
2. **Database**: Add service methods to `UnifiedDatabaseService`
3. **Frontend**: Create components in appropriate directories
4. **Integration**: Use TanStack Query for server state management

#### Testing Changes
```bash
# Full local test suite
npm run test:local

# Manual testing of specific endpoints
curl http://localhost:5000/health
curl http://localhost:5000/api/scenarios
curl -X POST http://localhost:5000/api/ecos/sessions \
  -H "Content-Type: application/json" \
  -d '{"studentEmail": "test@example.com", "scenarioId": 5}'
```

#### Working with Services
```typescript
// Import and use key services
import { virtualPatientService } from './services/virtual-patient.service';
import { conversationMemory } from './services/conversation-memory.service';
import { logger } from './services/logger.service';

// Virtual patient interaction
const response = await virtualPatientService.generateResponse(
  userMessage,
  scenarioPrompt,
  conversationHistory
);

// Conversation memory management
conversationMemory.addMessage(sessionId, { role: 'user', content: message });
const history = conversationMemory.getHistory(sessionId);

// Structured logging
logger.info('Session created', { sessionId, scenarioId, studentEmail });
logger.error('Database operation failed', { error, context });
```

## Project-Specific Notes

### Medical Training Context
- **ECOS**: Standardized clinical examination format
- **Scenarios**: Patient simulation prompts stored with evaluation criteria
- **Student Roles**: Different medical specializations (infirmier, docteur, étudiant)
- **Training Sessions**: Structured learning modules with scenario assignments

### AI Integration
- **Patient Simulation**: VirtualPatientService generates contextual patient responses using OpenAI
- **Conversation Memory**: ConversationMemoryService maintains session context with sliding window
- **Evaluation**: Automated assessment using OpenAI API with structured criteria (server/services/openai.service.ts)
- **Chat Assistant**: RAG-based learning support with Pinecone vector storage for semantic search
- **Prompt Generation**: PromptGenService creates dynamic scenario-specific prompts

### Deployment Architecture
- **Platform**: Vercel serverless with SPA configuration
- **Database**: Supabase PostgreSQL with REST API
- **CDN**: Vercel Edge Network for static asset delivery
- **Functions**: Express.js routes as Vercel serverless functions

This platform is designed for French-speaking medical education with emphasis on clinical examination training and AI-powered learning assistance.
