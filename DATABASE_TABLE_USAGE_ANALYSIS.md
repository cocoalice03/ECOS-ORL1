# Database Table Usage Analysis

## Summary
There is a **CRITICAL MISMATCH** between the tables defined in the schema and the tables actually used by the code.

---

## Tables Defined in `shared/schema.ts` (Drizzle ORM Schema)

| Table Name | Purpose | Status |
|------------|---------|--------|
| `sessions` | Replit Auth session storage | ❌ **NOT USED** (for auth sessions only) |
| `users` | User accounts | ✅ **USED** |
| `exchanges` | Chat question-answer pairs | ⚠️ **PARTIALLY USED** (wrong schema) |
| `daily_counters` | Daily question counters | ❌ **NOT USED** |
| `ecos_scenarios` | Medical training scenarios | ❌ **NOT USED** (wrong table name!) |
| `ecos_sessions` | ECOS examination sessions | ❌ **NOT USED** (wrong table name!) |
| `ecos_evaluations` | ECOS assessment results | ❌ **NOT USED** (wrong table name!) |
| `ecos_reports` | ECOS session reports | ❌ **NOT USED** |
| `ecos_messages` | ECOS chat messages | ❌ **NOT USED** (wrong table name!) |
| `training_sessions` | Training session management | ✅ **USED** |
| `training_session_scenarios` | Training-scenario relationships | ✅ **USED** |
| `training_session_students` | Student assignments to training | ✅ **USED** |

---

## Tables Actually Used by `UnifiedDatabaseService`

| Table Name | Used For | Lines in Code | Exists in Supabase? |
|------------|----------|---------------|---------------------|
| `scenarios` | Medical scenarios (NOT `ecos_scenarios`!) | 108, 185, 371, 395, 426, 457, 484, 735, 799 | ✅ YES |
| `users` | User accounts | 156, 275, 1540, 1568, 1604, 1630 | ✅ YES |
| `sessions` | ECOS sessions (NOT auth sessions!) | 236, 911, 965, 1004, 1083, 1151, 1303 | ✅ YES (but schema cache issue) |
| `exchanges` | Chat messages | 513, 593, 620, 1198, 1262 | ✅ YES (but schema cache issue) |
| `evaluations` | ECOS evaluations (NOT `ecos_evaluations`!) | 1420, 1500 | ✅ YES (but schema cache issue) |
| `training_sessions` | Training management | 657, 711, 772, 834, 877 | ✅ YES |
| `training_session_students` | Student assignments | 684, 723, 787, 871, 1064 | ✅ YES |
| `user_roles` | User role management | 1654, 1684, 1694 | ❓ UNKNOWN (not in schema!) |

---

## The Problem

### Schema vs Reality Mismatch

**In `shared/schema.ts`, the schema defines:**
```typescript
export const ecosScenarios = pgTable("ecos_scenarios", { ... });
export const ecosSessions = pgTable("ecos_sessions", { ... });
export const ecosEvaluations = pgTable("ecos_evaluations", { ... });
export const ecosMessages = pgTable("ecos_messages", { ... });
```

**But `UnifiedDatabaseService` actually uses:**
```typescript
.from('scenarios')     // NOT 'ecos_scenarios'!
.from('sessions')      // NOT 'ecos_sessions'!
.from('evaluations')   // NOT 'ecos_evaluations'!
.from('exchanges')     // NOT 'ecos_messages'!
```

### Why This Happened

1. **The schema was defined with `ecos_` prefix** following Drizzle ORM conventions
2. **The actual Supabase tables were created WITHOUT the prefix** (manually or by migration)
3. **The code uses direct Supabase client calls** (`.from('table_name')`) instead of Drizzle ORM
4. **No one noticed because the schema is NEVER ACTUALLY USED** - it's just for type definitions

---

## Tables That Are NOT Being Used

### ❌ Completely Unused Tables (Defined but Never Referenced)

1. **`daily_counters`** - Daily question counter
   - Defined in schema but never used in code
   - No references in UnifiedDatabaseService
   - Likely old feature that was planned but not implemented

2. **`ecos_reports`** - ECOS session reports
   - Defined in schema but never used
   - Reports are generated on-the-fly, not stored

3. **Sessions table (auth)** - `sessions` with `sid`, `sess`, `expire`
   - This is for Replit Auth session storage
   - Completely separate from ECOS sessions
   - May have been created but never used if auth was changed

### ⚠️ Schema-Only Tables (Exist in Code Schema but Not in Database)

These tables are defined in `shared/schema.ts` but **don't exist in Supabase**:

1. **`ecos_scenarios`** - Should be `scenarios`
2. **`ecos_sessions`** - Should be `sessions`
3. **`ecos_evaluations`** - Should be `evaluations`
4. **`ecos_messages`** - Should be `exchanges`
5. **`ecos_reports`** - Not used at all

---

## Current Database State (From Investigation)

### ✅ Tables That Exist and Work
- `users` - 5 users
- `scenarios` - 1 scenario
- `training_sessions` - 0 rows (but accessible)
- `training_session_students` - 0 rows (but accessible)
- `training_session_scenarios` - 0 rows (but accessible)

### ⚠️ Tables That Exist but Have Schema Cache Issues
- `sessions` - 0 rows, **PGRST205 error** (not visible to PostgREST API)
- `exchanges` - 0 rows, **PGRST205 error**
- `evaluations` - 0 rows, **PGRST205 error**

### ❓ Tables Possibly Missing
- `user_roles` - Referenced in code but not in schema

---

## Recommended Actions

### Option 1: Update Schema to Match Reality (Recommended)
Update `shared/schema.ts` to match the actual table names:

```typescript
// Change from:
export const ecosScenarios = pgTable("ecos_scenarios", { ... });
export const ecosSessions = pgTable("ecos_sessions", { ... });
export const ecosEvaluations = pgTable("ecos_evaluations", { ... });
export const ecosMessages = pgTable("ecos_messages", { ... });

// To:
export const scenarios = pgTable("scenarios", { ... });
export const sessions = pgTable("sessions", { ... });  // ECOS sessions
export const evaluations = pgTable("evaluations", { ... });
export const exchanges = pgTable("exchanges", { ... });  // Messages
```

**Pros:**
- Makes schema match reality
- Allows for proper type safety
- Enables Drizzle migrations to work correctly

**Cons:**
- Requires updating all imports
- May need to update database migrations

### Option 2: Rename Database Tables to Match Schema
Rename all Supabase tables to have the `ecos_` prefix:

```sql
ALTER TABLE scenarios RENAME TO ecos_scenarios;
ALTER TABLE sessions RENAME TO ecos_sessions;
ALTER TABLE evaluations RENAME TO ecos_evaluations;
ALTER TABLE exchanges RENAME TO ecos_messages;
```

**Pros:**
- Schema stays as-is
- Clear separation between ECOS and other tables

**Cons:**
- Requires updating all `.from()` calls in code
- More disruptive change
- Longer table names

### Option 3: Fix Schema Cache and Verify Tables
Fix the immediate PGRST205 errors by:
1. Running the `setup-database-tables.sql` script in Supabase
2. Granting proper permissions
3. Refreshing the schema cache
4. Verifying all tables are accessible

**This is the IMMEDIATE action needed regardless of Option 1 or 2.**

---

## Cleanup Recommendations

### Tables/Schemas to Remove (Unused)
1. Remove `daily_counters` from schema (never used)
2. Remove `ecos_reports` from schema (never implemented)
3. Clarify `sessions` table usage (auth vs ECOS)

### Tables to Add to Schema
1. Add `user_roles` table definition (currently used but not in schema)

---

## Impact on Current Issues

The schema mismatch explains:
- ✅ Why the tables "don't exist" (PGRST205) - schema cache not updated
- ✅ Why data goes to fallback - database operations fail due to table visibility
- ✅ Why the schema.ts file doesn't match the database

**Fixing the schema cache issue will immediately resolve the data persistence problem.**

---

## Next Steps

1. **IMMEDIATE**: Run `setup-database-tables.sql` in Supabase to fix schema cache
2. **SHORT TERM**: Decide on Option 1 or 2 above for schema alignment
3. **MEDIUM TERM**: Clean up unused table definitions
4. **LONG TERM**: Migrate to using Drizzle ORM instead of direct Supabase client calls
