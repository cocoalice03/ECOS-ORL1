# ECOS Medical Training Platform

## Overview

ECOS is a sophisticated medical training application featuring an interactive examination simulation system (ECOS - Examen Clinique Objectif Structuré). The platform combines a modern React Single Page Application (SPA) frontend with a robust Express.js backend, Supabase PostgreSQL database, and is deployed on Vercel's serverless infrastructure.

## 🏗️ Architecture Overview

### Single Page Application (SPA) Architecture

The frontend is built as a React SPA using modern web technologies:

#### Core Architecture Files
- **Entry Point**: `client/index.html` → `client/src/main.tsx` → `client/src/App.tsx`
- **Main Component**: `client/src/App.tsx` - Central routing and authentication logic
- **Application Bootstrap**: `client/src/main.tsx` - React root initialization with email detection
- **Build Configuration**: `vite.config.ts` - Vite configuration with proxy settings

#### Technology Stack
- **Framework**: React 18 with TypeScript for type safety
- **Routing**: Wouter (lightweight React router) for client-side navigation
  - Routes: `/admin`, `/teacher/:email`, `/student/:email`, `/chat/:email`, `/diagnostic`
  - Fallback routing to `index.html` for all non-API routes
- **State Management**: TanStack Query (React Query) for server state management
- **UI Components**: Radix UI primitives with shadcn/ui component library
- **Styling**: Tailwind CSS with responsive design and custom theming
- **Build Tool**: Vite 5.4+ for fast development and optimized production builds

#### Authentication System
- **Method**: Simple localStorage-based authentication
- **Implementation**: `client/src/App.tsx` lines 15-21, 96-157
- **Email Detection**: Multiple strategies in `client/src/main.tsx` lines 14-41
- **Fallback User**: `cherubindavid@gmail.com` for development testing

#### Build Configuration
- **Output Directory**: `dist/public/` optimized for Vercel SPA deployment
- **Path Aliases**: `@/` for client code, `@shared/` for shared schemas, `@assets/` for assets
- **Proxy Configuration**: `/api` requests proxied to `localhost:5001` in development

### Backend & Database Integration

- **API Server**: Express.js with TypeScript running on Vercel serverless functions
- **Database**: Supabase PostgreSQL with REST API integration
- **ORM**: Drizzle ORM with type-safe database queries
- **Authentication**: Simple email-based authentication with localStorage
- **File Upload**: Multer for handling medical training assets

### Deployment Infrastructure

- **Platform**: Vercel serverless deployment
- **CDN**: Vercel Edge Network for global content delivery
- **Database Hosting**: Supabase managed PostgreSQL
- **Environment**: Production and development environment separation

## 🚀 Key Features

### Medical Education Platform
- **ECOS Simulation**: Interactive medical examination scenarios
- **Student Assessment**: Real-time evaluation and feedback systems
- **Teacher Dashboard**: Scenario management and student progress tracking
- **Training Sessions**: Structured learning modules with progress tracking

### Technical Features
- **Real-time Chat**: AI-powered assistant for learning support
- **Responsive Design**: Mobile-first approach for all devices
- **Progressive Web App**: Modern web capabilities
- **Performance Monitoring**: Comprehensive health checks and metrics
- **Error Boundaries**: Graceful error handling and recovery

## 📁 Project Structure

```
├── client/                 # React SPA Frontend
│   ├── src/
│   │   ├── components/     # Reusable React components
│   │   │   ├── chat/       # Chat interface components
│   │   │   ├── ecos/       # ECOS-specific components
│   │   │   ├── layout/     # Layout and navigation components
│   │   │   └── ui/         # shadcn/ui component library
│   │   ├── pages/          # Page components (routes)
│   │   ├── lib/            # Utilities and configurations
│   │   ├── hooks/          # Custom React hooks
│   │   └── types/          # TypeScript type definitions
│   ├── public/             # Static assets (images, icons)
│   └── index.html          # SPA entry point
├── server/                 # Express.js Backend
│   ├── services/           # Business logic services
│   ├── middleware/         # Express middleware
│   ├── database/           # Database connection management
│   └── routes.ts           # API route definitions
├── api/                    # Vercel serverless functions
│   ├── index.js           # Main API handler with fallback systems
│   └── scenarios.js       # ECOS scenarios endpoint handler
├── shared/                 # Shared TypeScript schemas
│   └── schema.ts          # Drizzle database schema
├── scripts/               # Deployment and maintenance scripts
└── docs/                  # Documentation files
```

## 🔧 Development Setup

### Prerequisites
- Node.js 18+ with npm
- Supabase account and project
- Vercel account (for deployment)

### Environment Configuration

Create a `.env` file in the root directory:

```env
# Database Configuration
DATABASE_URL=postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres
SUPABASE_URL=https://[project-ref].supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
SUPABASE_ANON_KEY=your_anon_key

# API Keys
OPENAI_API_KEY=your_openai_api_key
PINECONE_API_KEY=your_pinecone_api_key

# Development
NODE_ENV=development
PORT=5000
```

### Installation & Development

```bash
# Install dependencies
npm install

# Start development server (runs both client and server)
npm run dev

# Type checking
npm run check

# Build for production
npm run build

# Database operations
npm run db:push

# Environment validation
npm run validate:env
```

### Development Commands

| Command | Description | Implementation |
|---------|-------------|----------------|
| `npm run dev` | Start development server (client + server) | `NODE_ENV=development tsx server/index.ts` |
| `npm run build` | Build production bundles | `vite build` to `dist/public/` |
| `npm run start` | Start production server | `NODE_ENV=production node dist/index.js` |
| `npm run check` | TypeScript type checking | `tsc` across entire codebase |
| `npm run db:push` | Push database schema changes | `drizzle-kit push` |
| `npm run validate:env` | Validate environment variables | `node scripts/validate-env.js` |
| `npm run deploy:safe` | Safe deployment with validation | `npm run validate:env && npm run check && npm run deploy:production` |

## 🗄️ Database Schema

### Core Tables

The application uses a PostgreSQL database through Supabase with the following main tables:

- **users**: User authentication and profile data
- **sessions**: Session management for authentication
- **exchanges**: Chat conversation history
- **daily_counters**: Usage tracking and limits
- **ecos_scenarios**: Medical examination scenarios
- **ecos_sessions**: Student examination sessions
- **ecos_messages**: Chat messages during examinations
- **ecos_evaluations**: Assessment scores and feedback
- **training_sessions**: Structured training modules
- **training_session_students**: Student-session associations
- **training_session_scenarios**: Scenario-session associations

### Database Connection

#### Primary Database Service
The application uses a **Supabase Client Service** (`server/services/supabase-client.service.ts`) that:
- **Main Implementation**: `SupabaseClientService` class with automatic URL conversion
- **Connection Method**: Supabase REST API via `@supabase/supabase-js` client
- **Health Monitoring**: Continuous connectivity checks against `scenarios` table
- **Error Handling**: Graceful table creation and comprehensive error recovery
- **Fallback Strategy**: Multiple alternative service implementations available

#### Resilient In-Memory Fallbacks
When Supabase is momentarily unavailable, the unified database service automatically mirrors critical ECOS data in memory:
- **Sessions**: `createSession`, `updateSessionStatus` and `getSessionByStringId` maintain a fallback map keyed by `sessionId`
- **Messages & Exchanges**: Stored via `addFallbackSessionMessage`, ensuring `/api/ecos/sessions/:id/report` still has access to transcripts
- **Evaluations**: `createEvaluation` and `getEvaluation` cache the LLM scoring payload so reports and dashboards keep working

The fallback caches are transparently consulted whenever a Supabase query fails or returns no rows, meaning evaluation reports continue to render detailed criteria, strengths, and weaknesses even if persistence is temporarily down. Once Supabase recovers, the cache is refreshed with authoritative rows.

#### Alternative Service Implementations
The project includes multiple database service strategies in `server/services/`:
- `simple-supabase.service.ts` - Basic connection implementation
- `robust-supabase.service.ts` - Enhanced error handling
- `direct-supabase.service.ts` - Direct PostgreSQL connection
- `ipv6-supabase.service.ts` - IPv6-optimized connections
- Additional services for different deployment scenarios

## 🌐 API Architecture

### RESTful Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | System health check with detailed metrics |
| `/api/scenarios` | GET | Retrieve ECOS scenarios |
| `/api/scenarios` | POST | Create new scenario |
| `/api/scenarios/:id` | PUT | Update scenario |
| `/api/scenarios/:id` | DELETE | Delete scenario |
| `/api/sessions` | POST | Start new ECOS session |
| `/api/sessions/:id/messages` | POST | Add message to session |
| `/api/sessions/:id/evaluate` | POST | Submit evaluation |
| `/api/ask` | POST | AI chat endpoint |
| `/api/webhook` | POST | LearnWorlds integration webhook |

### Error Handling

The API implements comprehensive error handling:
- Circuit breaker pattern for database operations
- Rate limiting for API protection
- Request timeout management
- Graceful degradation strategies
- Detailed error logging with request IDs

## 🚀 Vercel Deployment Configuration

### Deployment Structure

The application is configured for Vercel's serverless platform with:

```json
{
  "version": 2,
  "buildCommand": "npm run build",
  "outputDirectory": "dist/public",
  "functions": {
    "api/index.js": {
      "runtime": "@vercel/node@5.3.13",
      "maxDuration": 30
    },
    "api/scenarios.js": {
      "runtime": "@vercel/node@5.3.13", 
      "maxDuration": 30
    }
  }
}
```

### Route Configuration

- **SPA Routes**: All frontend routes redirect to `index.html`
- **API Routes**: `/api/*` routes handled by serverless functions
- **Static Assets**: Optimized caching with CDN distribution
- **CORS Headers**: Configured for cross-origin requests

### Performance Optimizations

- **Serverless Functions**: 30-second timeout with 1GB memory
- **CDN Caching**: Aggressive caching for static assets (1 year)
- **API Caching**: No-cache headers for dynamic content
- **Gzip Compression**: Automatic compression for text assets
- **Tree Shaking**: Dead code elimination in production builds

## 🔒 Security Configuration

### Authentication
- Email-based authentication with localStorage
- Session management through encrypted tokens
- Route protection for sensitive endpoints
- CORS configuration for secure cross-origin requests

### Security Headers
- XSS Protection enabled
- Content Security Policy (CSP)
- Clickjacking protection (X-Frame-Options)
- MIME type validation
- Secure cookie configuration

### Data Protection
- Input validation on all endpoints
- SQL injection prevention through parameterized queries
- File upload restrictions and validation
- Rate limiting to prevent abuse
- Environment variable protection

## 📊 Monitoring & Observability

### Health Checks
- `/health`: Comprehensive system health with database connectivity
- `/ready`: Readiness probe for deployment validation
- `/metrics`: Performance metrics and system statistics
- Circuit breaker status monitoring

### Performance Monitoring
- Request/response time tracking
- Database query performance monitoring
- Error rate tracking with alerting
- Memory and resource utilization monitoring
- Custom business metrics collection

### Logging Strategy
- Structured logging with request IDs
- Error aggregation and alerting
- Performance baseline recording
- Security event logging
- Debug information in development mode

## 🧪 Testing Strategy

### Development Testing
```bash
# Local environment testing
npm run test:local

# Health check validation
npm run health:check

# Deployment validation
npm run validate:deployment

# Environment validation
npm run validate:env
```

### Production Validation
- Automated health checks post-deployment
- Performance baseline validation
- Database connectivity verification
- Error rate monitoring
- User flow testing

## 📝 Documentation Files

### Main Documentation
- **README.md**: This comprehensive project overview
- **DEPLOYMENT-ARCHITECTURE.md**: Detailed deployment and architecture
- **SECURITY-ENHANCEMENT-REPORT.md**: Security implementation details
- **DEPLOYMENT-PLAN.md**: Step-by-step deployment procedures
- **FINAL-SOLUTION.md**: Technical solution documentation
- **URGENT-DATABASE-SETUP.md**: Database configuration guide

### Configuration Files
- **vercel.json**: Vercel deployment configuration
- **vite.config.ts**: Vite build tool configuration
- **drizzle.config.ts**: Database ORM configuration
- **tailwind.config.ts**: CSS framework configuration
- **tsconfig.json**: TypeScript compiler configuration
- **package.json**: Dependencies and script definitions

## 🤝 Contributing

### Development Workflow
1. Set up local development environment
2. Create feature branch from main
3. Implement changes with type safety
4. Run tests and validation scripts
5. Create pull request with documentation updates
6. Deploy to staging for validation
7. Deploy to production after approval

### Code Standards
- TypeScript strict mode enabled
- ESLint for code quality
- Prettier for code formatting
- Conventional commits for version control
- Component-based architecture
- Comprehensive error handling

## 📞 Support & Troubleshooting

### Common Issues
- **Database Connection**: Check environment variables and Supabase status
- **Build Errors**: Verify Node.js version and clean install dependencies
- **Deployment Failures**: Review Vercel logs and validate environment
- **Performance Issues**: Monitor health checks and database queries

### Debug Tools
- Development mode diagnostic panel (`/diagnostic`)
- Health check endpoint (`/health`)
- Performance metrics (`/metrics`)
- Database connection testing scripts
- Environment validation utilities

### Contact & Resources
- Technical Documentation: Available in `/docs` directory
- API Reference: Interactive endpoints through development server
- Performance Monitoring: Built-in health and metrics endpoints
- Issue Tracking: GitHub Issues for bug reports and feature requests

---

**Last Updated**: September 2025  
**Version**: 2.0.0  
**Environment**: Production Ready  
**License**: MIT
