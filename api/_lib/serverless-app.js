var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// server/services/unified-database.service.ts
import { createClient } from "@supabase/supabase-js";
var _UnifiedDatabaseService, UnifiedDatabaseService, unifiedDb;
var init_unified_database_service = __esm({
  "server/services/unified-database.service.ts"() {
    "use strict";
    _UnifiedDatabaseService = class _UnifiedDatabaseService {
      constructor() {
        this.supabase = null;
        this.isInitialized = false;
        this.initializationPromise = null;
        this.fallbackSessions = /* @__PURE__ */ new Map();
        this.fallbackSessionMessages = /* @__PURE__ */ new Map();
        this.fallbackEvaluations = /* @__PURE__ */ new Map();
        this.ensuredUsers = /* @__PURE__ */ new Set();
        this.startupTime = /* @__PURE__ */ new Date();
        this.metrics = {
          connectionAttempts: 0,
          successfulConnections: 0,
          failedConnections: 0,
          lastConnectionTime: /* @__PURE__ */ new Date(),
          isHealthy: false,
          responseTime: 0
        };
      }
      /**
       * Initialize the database service (called once)
       */
      async initialize() {
        if (this.isInitialized) return;
        if (this.initializationPromise) {
          return this.initializationPromise;
        }
        this.initializationPromise = this._performInitialization();
        return this.initializationPromise;
      }
      async _performInitialization() {
        this.metrics.connectionAttempts++;
        const startTime = Date.now();
        try {
          console.log("\u{1F527} Initializing Unified Database Service...");
          let supabaseUrl = process.env.SUPABASE_URL;
          const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
          if (!supabaseUrl || !supabaseKey) {
            throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
          }
          if (supabaseUrl.startsWith("postgresql://")) {
            const match = supabaseUrl.match(/db\.([^.]+)\.supabase\.co/);
            if (match) {
              const projectId = match[1];
              supabaseUrl = `https://${projectId}.supabase.co`;
              console.log("\u{1F504} Converted to Supabase HTTP URL");
            }
          }
          this.supabase = createClient(supabaseUrl, supabaseKey);
          await this._performHealthCheck();
          this.isInitialized = true;
          this.metrics.successfulConnections++;
          this.metrics.responseTime = Date.now() - startTime;
          this.metrics.isHealthy = true;
          this.metrics.lastConnectionTime = /* @__PURE__ */ new Date();
          console.log("\u2705 Unified Database Service initialized successfully");
        } catch (error) {
          this.metrics.failedConnections++;
          this.metrics.isHealthy = false;
          console.error("\u274C Database service initialization failed:", error.message);
          throw error;
        } finally {
          this.initializationPromise = null;
        }
      }
      async _performHealthCheck() {
        const startTime = Date.now();
        try {
          const { error } = await this.supabase.from("scenarios").select("id").limit(1);
          if (error && !error.message.includes("does not exist")) {
            throw error;
          }
          this.metrics.responseTime = Date.now() - startTime;
          console.log(`\u2705 Health check passed (${this.metrics.responseTime}ms)`);
        } catch (error) {
          console.warn("\u26A0\uFE0F Health check warning:", error.message);
          if (!error.message.includes("does not exist")) {
            throw error;
          }
        }
      }
      /**
       * Get database client (ensures initialization)
       */
      async getClient() {
        await this.initialize();
        if (!this.supabase) {
          throw new Error("Database service not initialized");
        }
        return this.supabase;
      }
      /**
       * Ensure a user record exists before inserting related rows that depend on email FK
       */
      async ensureUserExists(email) {
        if (!email) return;
        const normalizedEmail = email.trim().toLowerCase();
        if (!normalizedEmail || this.ensuredUsers.has(normalizedEmail)) {
          return;
        }
        try {
          const client = await this.getClient();
          const timestamp = (/* @__PURE__ */ new Date()).toISOString();
          const { error } = await client.from("users").upsert([
            {
              email: normalizedEmail,
              updated_at: timestamp
            }
          ], { onConflict: "email" });
          if (error) {
            console.warn(`\u26A0\uFE0F Failed to ensure user ${normalizedEmail}:`, error.message);
            return;
          }
          this.ensuredUsers.add(normalizedEmail);
          console.log(`\u{1F464} Ensured user record exists for ${normalizedEmail}`);
        } catch (error) {
          console.warn(`\u26A0\uFE0F Error ensuring user ${normalizedEmail}:`, error.message);
        }
      }
      /**
       * Get all scenarios
       */
      async getScenarios() {
        try {
          const client = await this.getClient();
          const { data, error } = await client.from("scenarios").select(`
          id,
          title,
          description,
          patient_prompt,
          evaluation_criteria,
          image_url,
          created_by,
          created_at,
          updated_at
        `).order("created_at", { ascending: false });
          if (error) {
            if (error.message.includes("does not exist")) {
              console.log("\u26A0\uFE0F Scenarios table does not exist, returning empty array");
              return [];
            }
            throw error;
          }
          console.log(`\u2705 Retrieved ${data?.length || 0} scenarios`);
          const mappedData = (data || []).map((scenario) => ({
            ...scenario,
            patient_prompt: scenario.patient_prompt || null,
            evaluation_criteria: scenario.evaluation_criteria || null
          }));
          return mappedData;
        } catch (error) {
          console.error("\u274C Error fetching scenarios:", error.message);
          throw error;
        }
      }
      /**
       * Get dashboard statistics
       */
      async getDashboardStats() {
        try {
          const client = await this.getClient();
          const scenarios = await this.getScenarios();
          const totalScenarios = scenarios.length;
          console.log(`\u{1F4CA} Dashboard stats: ${totalScenarios} scenarios found`);
          return {
            totalScenarios,
            activeSessions: 0,
            completedSessions: 0,
            totalStudents: 0
          };
        } catch (error) {
          console.error("\u274C Error fetching dashboard stats:", error.message);
          return {
            totalScenarios: 0,
            activeSessions: 0,
            completedSessions: 0,
            totalStudents: 0
          };
        }
      }
      /**
       * Get students (placeholder for future implementation)
       */
      async getStudents() {
        try {
          const client = await this.getClient();
          return [];
        } catch (error) {
          console.error("\u274C Error fetching students:", error.message);
          return [];
        }
      }
      /**
       * Health check method
       */
      async healthCheck() {
        try {
          await this._performHealthCheck();
          return {
            status: "healthy",
            metrics: { ...this.metrics },
            uptime: Date.now() - this.startupTime.getTime()
          };
        } catch (error) {
          return {
            status: "unhealthy",
            metrics: { ...this.metrics, isHealthy: false },
            uptime: Date.now() - this.startupTime.getTime()
          };
        }
      }
      /**
       * Create a new scenario
       */
      async createScenario(scenarioData) {
        const client = await this.getClient();
        await this.ensureUserExists(scenarioData.createdBy);
        const { data, error } = await client.from("scenarios").insert({
          title: scenarioData.title,
          description: scenarioData.description,
          patient_prompt: scenarioData.patientPrompt,
          evaluation_criteria: scenarioData.evaluationCriteria,
          image_url: scenarioData.imageUrl || null,
          created_by: scenarioData.createdBy
        }).select().single();
        if (error) throw error;
        return data;
      }
      /**
       * Update scenario
       */
      async updateScenario(id, updates) {
        const client = await this.getClient();
        const { data: existingScenario, error: findError } = await client.from("scenarios").select("id, title").eq("id", id).single();
        if (findError) {
          if (findError.code === "PGRST116") {
            console.error(`\u274C Scenario ${id} not found in database`);
            throw new Error(`Scenario with ID ${id} does not exist`);
          }
          console.error(`\u274C Error checking scenario ${id}:`, findError);
          throw findError;
        }
        console.log(`\u2705 Scenario ${id} exists: "${existingScenario.title}"`);
        const updateData = {
          updated_at: (/* @__PURE__ */ new Date()).toISOString()
        };
        if (updates.title) updateData.title = updates.title;
        if (updates.description !== void 0) updateData.description = updates.description;
        if (updates.patientPrompt !== void 0) updateData.patient_prompt = updates.patientPrompt;
        if (updates.evaluationCriteria !== void 0) updateData.evaluation_criteria = updates.evaluationCriteria;
        if (updates.imageUrl !== void 0) updateData.image_url = updates.imageUrl;
        if (updates.pineconeIndex !== void 0) updateData.pinecone_index = updates.pineconeIndex;
        console.log(`\u{1F4CA} Updating scenario ${id} with data:`, updateData);
        const { data, error } = await client.from("scenarios").update(updateData).eq("id", id).select().single();
        if (error) {
          console.error(`\u274C Error updating scenario ${id}:`, error);
          throw error;
        }
        console.log(`\u2705 Scenario ${id} updated successfully:`, data);
        return data;
      }
      /**
       * Update scenario criteria specifically (convenience method)
       */
      async updateScenarioCriteria(id, criteria) {
        console.log(`\u{1F4CA} Updating criteria for scenario ${id}`);
        return this.updateScenario(id, { evaluationCriteria: criteria });
      }
      /**
       * Get available scenario IDs and titles for validation
       */
      async getAvailableScenarioIds() {
        try {
          const client = await this.getClient();
          const { data, error } = await client.from("scenarios").select("id, title").order("id", { ascending: true });
          if (error) {
            if (error.message.includes("does not exist")) {
              console.log("\u26A0\uFE0F Scenarios table does not exist, returning empty array");
              return [];
            }
            throw error;
          }
          console.log(`\u{1F4CB} Available scenarios: ${(data || []).map((s) => `ID ${s.id}: "${s.title}"`).join(", ")}`);
          return data || [];
        } catch (error) {
          console.error("\u274C Error fetching available scenario IDs:", error.message);
          return [];
        }
      }
      /**
       * Delete scenario
       */
      async deleteScenario(id) {
        const client = await this.getClient();
        const { error } = await client.from("scenarios").delete().eq("id", id);
        if (error) throw error;
      }
      /**
       * Store conversation exchange in database
       */
      async storeConversationExchange(exchange) {
        try {
          const client = await this.getClient();
          let sessionDbId = null;
          if (exchange.sessionId) {
            const session = await this.getSessionByStringId(exchange.sessionId);
            sessionDbId = session?.id ?? null;
          }
          const { data, error } = await client.from("exchanges").insert({
            session_id: sessionDbId,
            question: exchange.question,
            response: exchange.response,
            role: "system",
            timestamp: (/* @__PURE__ */ new Date()).toISOString(),
            metadata: {
              email: exchange.email,
              scenarioId: exchange.scenarioId,
              studentRole: exchange.studentRole,
              contextData: exchange.contextData,
              source: "patient_simulator"
            }
          }).select().single();
          if (error) {
            console.error("\u274C Error storing conversation exchange:", error);
            throw error;
          }
          console.log(`\u{1F4BE} Stored conversation exchange for session ${exchange.sessionId}`);
          if (exchange.sessionId) {
            const timestamp = (/* @__PURE__ */ new Date()).toISOString();
            this.addFallbackSessionMessage(exchange.sessionId, {
              role: "user",
              question: exchange.question,
              response: "",
              timestamp,
              isFallback: !sessionDbId
            });
            this.addFallbackSessionMessage(exchange.sessionId, {
              role: "assistant",
              question: "",
              response: exchange.response,
              timestamp,
              isFallback: !sessionDbId
            });
          }
          return data;
        } catch (error) {
          console.error("\u274C Failed to store conversation exchange:", error);
          if (exchange.sessionId) {
            const timestamp = (/* @__PURE__ */ new Date()).toISOString();
            this.addFallbackSessionMessage(exchange.sessionId, {
              role: "user",
              question: exchange.question,
              response: "",
              timestamp,
              isFallback: true
            });
            this.addFallbackSessionMessage(exchange.sessionId, {
              role: "assistant",
              question: "",
              response: exchange.response,
              timestamp,
              isFallback: true
            });
          }
          return null;
        }
      }
      /**
       * Get conversation history for a session
       */
      async getConversationHistory(sessionId, limit = 50) {
        try {
          const client = await this.getClient();
          const session = await this.getSessionByStringId(sessionId);
          if (!session) {
            console.warn(`\u26A0\uFE0F Session ${sessionId} not found, returning empty conversation history`);
            return [];
          }
          const { data, error } = await client.from("exchanges").select("*").eq("session_id", session.id).order("timestamp", { ascending: true }).limit(limit);
          if (error) {
            console.error("\u274C Error fetching conversation history:", error);
            return [];
          }
          console.log(`\u{1F4DA} Retrieved ${data?.length || 0} conversation exchanges for session ${sessionId}`);
          return data || [];
        } catch (error) {
          console.error("\u274C Error fetching conversation history:", error.message);
          return [];
        }
      }
      /**
       * Get recent conversations for a student
       */
      async getStudentConversations(email, limit = 100) {
        try {
          const client = await this.getClient();
          const { data, error } = await client.from("exchanges").select("*").contains("metadata", { email }).order("timestamp", { ascending: false }).limit(limit);
          if (error) throw error;
          console.log(`\u{1F4DA} Retrieved ${data?.length || 0} conversations for student ${email}`);
          return data || [];
        } catch (error) {
          console.error("\u274C Error fetching student conversations:", error.message);
          return [];
        }
      }
      // ====================================
      // TRAINING SESSIONS MANAGEMENT
      // ====================================
      /**
       * Create a new training session
       */
      async createTrainingSession(sessionData) {
        try {
          const client = await this.getClient();
          const { data: trainingSession, error: sessionError } = await client.from("training_sessions").insert({
            title: sessionData.title,
            description: sessionData.description,
            created_by: sessionData.createdBy,
            scenario_ids: sessionData.scenarioIds,
            status: "active",
            start_date: sessionData.startDate || (/* @__PURE__ */ new Date()).toISOString(),
            end_date: sessionData.endDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1e3).toISOString(),
            created_at: (/* @__PURE__ */ new Date()).toISOString(),
            updated_at: (/* @__PURE__ */ new Date()).toISOString()
          }).select().single();
          if (sessionError) throw sessionError;
          if (sessionData.studentEmails && sessionData.studentEmails.length > 0) {
            const studentAssignments = sessionData.studentEmails.map((email) => ({
              training_session_id: trainingSession.id,
              student_email: email.trim().toLowerCase(),
              assigned_at: (/* @__PURE__ */ new Date()).toISOString(),
              status: "assigned"
            }));
            const { error: studentsError } = await client.from("training_session_students").insert(studentAssignments);
            if (studentsError) throw studentsError;
          }
          console.log(`\u2705 Created training session: ${trainingSession.title} with ID: ${trainingSession.id}`);
          return {
            ...trainingSession,
            studentEmails: sessionData.studentEmails,
            scenarioIds: sessionData.scenarioIds
          };
        } catch (error) {
          console.error("\u274C Error creating training session:", error.message);
          throw error;
        }
      }
      /**
       * Get all training sessions for an admin
       */
      async getTrainingSessions(createdBy) {
        try {
          const client = await this.getClient();
          const { data: sessions, error } = await client.from("training_sessions").select("*").eq("created_by", createdBy).order("created_at", { ascending: false });
          if (error) throw error;
          const sessionsWithDetails = await Promise.all(
            (sessions || []).map(async (session) => {
              const { data: students, error: studentsError } = await client.from("training_session_students").select("student_email, assigned_at, status").eq("training_session_id", session.id);
              if (studentsError) {
                console.warn(`Warning: Could not fetch students for session ${session.id}:`, studentsError.message);
              }
              let scenarioDetails = [];
              if (session.scenario_ids && session.scenario_ids.length > 0) {
                const { data: scenarios, error: scenariosError } = await client.from("scenarios").select("id, title, description").in("id", session.scenario_ids);
                if (scenariosError) {
                  console.warn(`Warning: Could not fetch scenarios for session ${session.id}:`, scenariosError.message);
                } else {
                  scenarioDetails = scenarios || [];
                }
              }
              return {
                ...session,
                students: students || [],
                scenarios: scenarioDetails,
                studentCount: (students || []).length,
                scenarioCount: scenarioDetails.length
              };
            })
          );
          console.log(`\u{1F4DA} Retrieved ${sessionsWithDetails.length} training sessions for ${createdBy}`);
          return sessionsWithDetails;
        } catch (error) {
          console.error("\u274C Error fetching training sessions:", error.message);
          return [];
        }
      }
      /**
       * Get a specific training session by ID
       */
      async getTrainingSessionById(id, createdBy) {
        try {
          const client = await this.getClient();
          const { data: session, error } = await client.from("training_sessions").select("*").eq("id", parseInt(id)).eq("created_by", createdBy).single();
          if (error) {
            if (error.code === "PGRST116") {
              return null;
            }
            throw error;
          }
          const { data: students, error: studentsError } = await client.from("training_session_students").select("student_email, assigned_at, status").eq("training_session_id", session.id);
          if (studentsError) {
            console.warn(`Warning: Could not fetch students for session ${id}:`, studentsError.message);
          }
          let scenarioDetails = [];
          if (session.scenario_ids && session.scenario_ids.length > 0) {
            const { data: scenarios, error: scenariosError } = await client.from("scenarios").select("id, title, description").in("id", session.scenario_ids);
            if (scenariosError) {
              console.warn(`Warning: Could not fetch scenarios for session ${id}:`, scenariosError.message);
            } else {
              scenarioDetails = scenarios || [];
            }
          }
          console.log(`\u{1F4DA} Retrieved training session ${id} for ${createdBy}`);
          return {
            ...session,
            students: students || [],
            scenarios: scenarioDetails,
            studentCount: (students || []).length,
            scenarioCount: scenarioDetails.length
          };
        } catch (error) {
          console.error("\u274C Error fetching training session:", error.message);
          throw error;
        }
      }
      /**
       * Update a training session
       */
      async updateTrainingSession(id, updates, createdBy) {
        try {
          const client = await this.getClient();
          console.log(`\u{1F50D} Updating training session - ID: ${id}, createdBy: ${createdBy}, updates:`, JSON.stringify(updates));
          const { data: session, error } = await client.from("training_sessions").update({
            ...updates,
            updated_at: (/* @__PURE__ */ new Date()).toISOString()
          }).eq("id", parseInt(id)).eq("created_by", createdBy).select().single();
          if (error) {
            console.error("\u274C Supabase error updating training session:", error);
            throw error;
          }
          if (!session) {
            console.error("\u274C No training session found with id:", id, "and created_by:", createdBy);
            throw new Error(`Training session ${id} not found or you don't have permission to modify it`);
          }
          console.log(`\u2705 Updated training session ${id}`);
          return session;
        } catch (error) {
          console.error("\u274C Error updating training session:", error.message);
          throw error;
        }
      }
      /**
       * Delete a training session
       */
      async deleteTrainingSession(id, createdBy) {
        try {
          const client = await this.getClient();
          await client.from("training_session_students").delete().eq("training_session_id", parseInt(id));
          const { error } = await client.from("training_sessions").delete().eq("id", parseInt(id)).eq("created_by", createdBy);
          if (error) throw error;
          console.log(`\u2705 Deleted training session ${id}`);
        } catch (error) {
          console.error("\u274C Error deleting training session:", error.message);
          throw error;
        }
      }
      // ====================================
      // ECOS SESSION MANAGEMENT
      // ====================================
      /**
       * Create a new ECOS session in database
       */
      async createSession(sessionData) {
        try {
          const client = await this.getClient();
          await this.ensureUserExists(sessionData.studentEmail);
          const { data, error } = await client.from("sessions").insert({
            session_id: sessionData.sessionId,
            student_email: sessionData.studentEmail,
            scenario_id: sessionData.scenarioId,
            status: sessionData.status || "active",
            start_time: (/* @__PURE__ */ new Date()).toISOString(),
            created_at: (/* @__PURE__ */ new Date()).toISOString(),
            updated_at: (/* @__PURE__ */ new Date()).toISOString()
          }).select().single();
          if (error) {
            console.error("\u274C Error creating ECOS session:", error);
            throw error;
          }
          console.log(`\u2705 Created ECOS session ${sessionData.sessionId} for student ${sessionData.studentEmail}`);
          const record = {
            ...data,
            isFallback: false
          };
          this.fallbackSessions.set(sessionData.sessionId, record);
          return record;
        } catch (error) {
          console.error("\u274C Failed to create ECOS session:", error.message);
          const fallbackRecord = {
            id: `fallback-session-${Date.now()}`,
            session_id: sessionData.sessionId,
            student_email: sessionData.studentEmail,
            scenario_id: sessionData.scenarioId,
            status: sessionData.status || "active",
            start_time: (/* @__PURE__ */ new Date()).toISOString(),
            created_at: (/* @__PURE__ */ new Date()).toISOString(),
            updated_at: (/* @__PURE__ */ new Date()).toISOString(),
            isFallback: true
          };
          this.fallbackSessions.set(sessionData.sessionId, fallbackRecord);
          console.warn(`\u26A0\uFE0F Stored session ${sessionData.sessionId} in fallback memory store`);
          throw error;
        }
      }
      /**
       * Get ECOS session by string session ID
       */
      async getSessionByStringId(sessionId) {
        const fallbackSession = this.fallbackSessions.get(sessionId) || null;
        try {
          const client = await this.getClient();
          const { data, error } = await client.from("sessions").select("*").eq("session_id", sessionId).single();
          if (error) {
            if (error.code === "PGRST116") {
              return fallbackSession;
            }
            throw error;
          }
          const record = {
            ...data,
            isFallback: false
          };
          this.fallbackSessions.set(sessionId, record);
          return record;
        } catch (error) {
          console.error("\u274C Error getting session by string ID:", error.message);
          if (fallbackSession) {
            console.warn(`\u26A0\uFE0F Using fallback session for ${sessionId}`);
          }
          return fallbackSession;
        }
      }
      /**
       * Store message in ECOS session
       */
      async storeSessionMessage(messageData) {
        try {
          const client = await this.getClient();
          const session = await this.getSessionByStringId(messageData.sessionId);
          if (!session) {
            console.warn(`\u26A0\uFE0F Session ${messageData.sessionId} not found, cannot store message`);
            this.addFallbackSessionMessage(messageData.sessionId, {
              role: messageData.role,
              question: messageData.question || messageData.content || "",
              response: messageData.response || "",
              timestamp: (/* @__PURE__ */ new Date()).toISOString(),
              isFallback: true
            });
            return null;
          }
          const timestamp = (/* @__PURE__ */ new Date()).toISOString();
          const { data, error } = await client.from("exchanges").insert({
            session_id: session.id,
            // Use database integer ID
            role: messageData.role,
            question: messageData.question || messageData.content || "",
            response: messageData.response || "",
            timestamp
          }).select().single();
          if (error) {
            console.error("\u274C Error storing session message:", error);
            throw error;
          }
          console.log(`\u{1F4BE} Stored ${messageData.role} message for session ${messageData.sessionId}`);
          this.addFallbackSessionMessage(messageData.sessionId, {
            role: messageData.role,
            question: messageData.question || messageData.content || "",
            response: messageData.response || "",
            timestamp,
            isFallback: false
          });
          return data;
        } catch (error) {
          console.error("\u274C Failed to store session message:", error.message);
          this.addFallbackSessionMessage(messageData.sessionId, {
            role: messageData.role,
            question: messageData.question || messageData.content || "",
            response: messageData.response || "",
            timestamp: (/* @__PURE__ */ new Date()).toISOString(),
            isFallback: true
          });
          return null;
        }
      }
      /**
       * Get messages for an ECOS session
       */
      async getSessionMessages(sessionId, limit = 50) {
        const fallbackMessages = this.fallbackSessionMessages.get(sessionId) || [];
        try {
          const client = await this.getClient();
          const session = await this.getSessionByStringId(sessionId);
          if (!session) {
            console.warn(`\u26A0\uFE0F Session ${sessionId} not found, returning empty messages`);
            return fallbackMessages;
          }
          const { data, error } = await client.from("exchanges").select("*").eq("session_id", session.id).order("timestamp", { ascending: true }).limit(limit);
          if (error) {
            console.error("\u274C Error fetching session messages:", error);
            return fallbackMessages;
          }
          console.log(`\u{1F4DA} Retrieved ${data?.length || 0} messages for session ${sessionId}`);
          const messages = data || [];
          if (messages.length) {
            this.fallbackSessionMessages.set(sessionId, messages);
          }
          return messages;
        } catch (error) {
          console.error("\u274C Error fetching session messages:", error.message);
          return fallbackMessages;
        }
      }
      /**
       * Update ECOS session status
       */
      async updateSessionStatus(sessionId, status) {
        try {
          const client = await this.getClient();
          const { data, error } = await client.from("sessions").update({
            status,
            end_time: status === "completed" ? (/* @__PURE__ */ new Date()).toISOString() : null,
            updated_at: (/* @__PURE__ */ new Date()).toISOString()
          }).eq("session_id", sessionId).select().single();
          if (error) {
            console.error("\u274C Error updating session status:", error);
            throw error;
          }
          console.log(`\u2705 Updated session ${sessionId} status to ${status}`);
          const record = {
            ...data,
            isFallback: false
          };
          this.fallbackSessions.set(sessionId, record);
          return record;
        } catch (error) {
          console.error("\u274C Failed to update session status:", error.message);
          const fallbackSession = this.fallbackSessions.get(sessionId);
          if (fallbackSession) {
            const updatedFallback = {
              ...fallbackSession,
              status,
              updated_at: (/* @__PURE__ */ new Date()).toISOString(),
              end_time: status === "completed" ? (/* @__PURE__ */ new Date()).toISOString() : fallbackSession?.end_time
            };
            this.fallbackSessions.set(sessionId, updatedFallback);
            console.warn(`\u26A0\uFE0F Updated session ${sessionId} status in fallback memory store`);
          }
          throw error;
        }
      }
      /**
       * Create ECOS evaluation
       */
      async createEvaluation(evalData) {
        try {
          const client = await this.getClient();
          await this.ensureUserExists(evalData.studentEmail);
          const session = await this.getSessionByStringId(evalData.sessionId);
          if (!session || session.isFallback) {
            throw new Error(`Session ${evalData.sessionId} not available in primary database`);
          }
          console.log(`\u{1F4E4} Attempting to store evaluation for session ${evalData.sessionId}`);
          const insertPayload = {
            session_id: session.id,
            scenario_id: evalData.scenarioId,
            student_email: evalData.studentEmail,
            scores: evalData.scores,
            global_score: evalData.globalScore,
            strengths: evalData.strengths,
            weaknesses: evalData.weaknesses,
            recommendations: evalData.recommendations,
            feedback: evalData.feedback,
            heuristic: evalData.heuristic,
            llm_score_percent: typeof evalData.llmScorePercent === "number" ? evalData.llmScorePercent : null,
            criteria_details: evalData.criteriaDetails,
            evaluated_at: (/* @__PURE__ */ new Date()).toISOString(),
            created_at: (/* @__PURE__ */ new Date()).toISOString()
          };
          console.log(`\u{1F50D} [DEBUG] Insert payload columns:`, Object.keys(insertPayload));
          console.log(`\u{1F50D} [DEBUG] Session DB ID:`, session.id, `String ID:`, evalData.sessionId);
          const { data, error } = await client.from("evaluations").insert(insertPayload).select().single();
          console.log(`\u{1F50D} [DEBUG] Supabase response - data:`, data ? "EXISTS" : "NULL", `error:`, error ? error.code : "NONE");
          if (error) {
            console.error("\u274C Error creating evaluation:", {
              message: error.message,
              code: error.code,
              details: error.details,
              hint: error.hint
            });
            throw error;
          }
          if (!data) {
            const errorMsg = "Supabase returned null data despite no error - possible schema mismatch";
            console.error(`\u274C ${errorMsg}`);
            throw new Error(errorMsg);
          }
          console.log(`\u2705 Created evaluation for session ${evalData.sessionId} - DB record ID:`, data.id);
          const record = {
            ...data,
            isFallback: false
          };
          this.fallbackEvaluations.set(evalData.sessionId, record);
          return record;
        } catch (error) {
          console.error("\u274C Failed to create evaluation:", {
            message: error?.message,
            code: error?.code,
            details: error?.details,
            hint: error?.hint
          });
          const fallbackSession = this.fallbackSessions.get(evalData.sessionId);
          const fallbackRecord = {
            session_id: fallbackSession?.id ?? null,
            scenario_id: evalData.scenarioId,
            student_email: evalData.studentEmail,
            scores: evalData.scores,
            global_score: evalData.globalScore,
            strengths: evalData.strengths,
            weaknesses: evalData.weaknesses,
            recommendations: evalData.recommendations,
            feedback: evalData.feedback,
            heuristic: evalData.heuristic,
            llm_score_percent: typeof evalData.llmScorePercent === "number" ? evalData.llmScorePercent : null,
            criteria_details: evalData.criteriaDetails,
            evaluated_at: (/* @__PURE__ */ new Date()).toISOString(),
            created_at: (/* @__PURE__ */ new Date()).toISOString(),
            summary: Array.isArray(evalData.feedback) ? evalData.feedback.join(" ") : evalData.feedback || "",
            isFallback: true
          };
          this.fallbackEvaluations.set(evalData.sessionId, fallbackRecord);
          console.warn(`\u26A0\uFE0F Stored evaluation for session ${evalData.sessionId} in fallback memory store`);
          throw error;
        }
      }
      /**
       * Get evaluation for a session
       */
      async getEvaluation(sessionId) {
        const fallbackEvaluation = this.fallbackEvaluations.get(sessionId) || null;
        try {
          const client = await this.getClient();
          const session = await this.getSessionByStringId(sessionId);
          if (!session || session.isFallback) {
            return fallbackEvaluation;
          }
          const { data, error } = await client.from("evaluations").select("*").eq("session_id", session.id).single();
          if (error) {
            if (error.code === "PGRST116") {
              return fallbackEvaluation;
            }
            throw error;
          }
          const record = {
            ...data,
            isFallback: false
          };
          this.fallbackEvaluations.set(sessionId, record);
          return record;
        } catch (error) {
          console.error("\u274C Error getting evaluation:", error.message);
          if (fallbackEvaluation) {
            console.warn(`\u26A0\uFE0F Using fallback evaluation for session ${sessionId}`);
          }
          return fallbackEvaluation;
        }
      }
      /**
       * Firebase Authentication Methods
       */
      /**
       * Get user by Firebase UID
       */
      async getUserByFirebaseUid(firebaseUid) {
        try {
          if (!this.supabase) await this.initialize();
          const { data, error } = await this.supabase.from("users").select("*").eq("firebase_uid", firebaseUid).single();
          if (error) {
            if (error.code === "PGRST116") {
              return null;
            }
            throw error;
          }
          return data;
        } catch (error) {
          console.error("\u274C Error getting user by Firebase UID:", error.message);
          return null;
        }
      }
      /**
       * Get user by email
       */
      async getUserByEmail(email) {
        try {
          if (!this.supabase) await this.initialize();
          const { data, error } = await this.supabase.from("users").select("*").eq("email", email.toLowerCase().trim()).single();
          if (error) {
            if (error.code === "PGRST116") {
              return null;
            }
            throw error;
          }
          return data;
        } catch (error) {
          console.error("\u274C Error getting user by email:", error.message);
          return null;
        }
      }
      /**
       * Create new user
       */
      async createUser(userData) {
        try {
          if (!this.supabase) await this.initialize();
          const { data, error } = await this.supabase.from("users").insert([{
            email: userData.email.toLowerCase().trim(),
            firebase_uid: userData.firebaseUid
          }]).select().single();
          if (error) throw error;
          console.log("\u2705 User created in Supabase:", { id: data.id, email: data.email });
          return data;
        } catch (error) {
          console.error("\u274C Error creating user:", error.message);
          throw new Error("Failed to create user in database");
        }
      }
      /**
       * Update user's Firebase UID
       */
      async updateUserFirebaseUid(userId, firebaseUid) {
        try {
          if (!this.supabase) await this.initialize();
          const { error } = await this.supabase.from("users").update({
            firebase_uid: firebaseUid,
            updated_at: (/* @__PURE__ */ new Date()).toISOString()
          }).eq("id", userId);
          if (error) throw error;
          console.log("\u2705 User Firebase UID updated:", { userId, firebaseUid });
        } catch (error) {
          console.error("\u274C Error updating user Firebase UID:", error.message);
          throw new Error("Failed to update user Firebase UID");
        }
      }
      /**
       * Get user role
       */
      async getUserRole(userId) {
        try {
          if (!this.supabase) await this.initialize();
          const { data, error } = await this.supabase.from("user_roles").select("role").eq("user_id", userId).single();
          if (error) {
            if (error.code === "PGRST116") {
              return "student";
            }
            throw error;
          }
          return data.role;
        } catch (error) {
          console.error("\u274C Error getting user role:", error.message);
          return "student";
        }
      }
      /**
       * Set user role
       */
      async setUserRole(userId, role) {
        try {
          if (!this.supabase) await this.initialize();
          const { error: updateError } = await this.supabase.from("user_roles").update({
            role,
            updated_at: (/* @__PURE__ */ new Date()).toISOString()
          }).eq("user_id", userId);
          if (updateError || updateError?.code === "PGRST116") {
            const { error: insertError } = await this.supabase.from("user_roles").insert([{
              user_id: userId,
              role,
              created_at: (/* @__PURE__ */ new Date()).toISOString(),
              updated_at: (/* @__PURE__ */ new Date()).toISOString()
            }]);
            if (insertError) {
              if (!insertError.message.includes("duplicate")) {
                throw insertError;
              }
            }
          }
          console.log("\u2705 User role set:", { userId, role });
        } catch (error) {
          console.error("\u274C Error setting user role:", error.message);
          throw new Error("Failed to set user role");
        }
      }
      /**
       * Get metrics for monitoring
       */
      getMetrics() {
        return { ...this.metrics };
      }
      /**
       * Check if service is ready
       */
      isReady() {
        return this.isInitialized && this.metrics.isHealthy;
      }
      addFallbackSessionMessage(sessionId, message) {
        if (!sessionId) return;
        const existing = this.fallbackSessionMessages.get(sessionId) || [];
        existing.push({ ...message, sessionId });
        this.fallbackSessionMessages.set(sessionId, existing);
      }
    };
    __name(_UnifiedDatabaseService, "UnifiedDatabaseService");
    UnifiedDatabaseService = _UnifiedDatabaseService;
    unifiedDb = new UnifiedDatabaseService();
  }
});

// server/services/firebase-admin.service.ts
var firebase_admin_service_exports = {};
__export(firebase_admin_service_exports, {
  firebaseAdminService: () => firebaseAdminService
});
var _FirebaseAdminService, FirebaseAdminService, firebaseAdminService;
var init_firebase_admin_service = __esm({
  "server/services/firebase-admin.service.ts"() {
    "use strict";
    _FirebaseAdminService = class _FirebaseAdminService {
      constructor() {
        this.initialized = false;
        this.app = null;
        this.initializationPromise = null;
        this.firebaseAdmin = null;
        this.firebaseAuth = null;
      }
      /**
       * Lazy load Firebase Admin modules
       */
      async loadFirebaseModules() {
        if (this.firebaseAdmin && this.firebaseAuth) {
          return;
        }
        try {
          this.firebaseAdmin = await import("firebase-admin/app");
          this.firebaseAuth = await import("firebase-admin/auth");
          console.log("\u2705 Firebase Admin modules loaded successfully");
        } catch (error) {
          console.error("\u274C Failed to load Firebase Admin modules:", error);
          throw new Error("Firebase Admin SDK not available in this environment");
        }
      }
      /**
       * Initialize Firebase Admin SDK (lazy initialization)
       */
      async initialize() {
        if (this.initializationPromise) {
          return this.initializationPromise;
        }
        if (this.initialized) {
          return;
        }
        this.initializationPromise = (async () => {
          try {
            console.log("\u{1F525} Initializing Firebase Admin SDK...");
            await this.loadFirebaseModules();
            const projectId = process.env.FIREBASE_PROJECT_ID;
            const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
            const privateKey = process.env.FIREBASE_PRIVATE_KEY;
            if (!projectId || !clientEmail || !privateKey) {
              throw new Error("Missing Firebase Admin SDK credentials in environment variables");
            }
            const formattedPrivateKey = privateKey.replace(/\\n/g, "\n");
            const existingApps = this.firebaseAdmin.getApps();
            if (existingApps.length === 0) {
              this.app = this.firebaseAdmin.initializeApp({
                credential: this.firebaseAdmin.cert({
                  projectId,
                  clientEmail,
                  privateKey: formattedPrivateKey
                })
              });
            } else {
              this.app = existingApps[0];
            }
            this.initialized = true;
            console.log("\u2705 Firebase Admin SDK initialized successfully");
          } catch (error) {
            console.error("\u274C Failed to initialize Firebase Admin SDK:", error);
            this.initializationPromise = null;
            throw error;
          }
        })();
        return this.initializationPromise;
      }
      /**
       * Verify Firebase ID token
       * @param idToken - Firebase ID token from client
       * @returns Decoded token with user info
       */
      async verifyIdToken(idToken) {
        await this.initialize();
        try {
          const auth = this.firebaseAuth.getAuth();
          const decodedToken = await auth.verifyIdToken(idToken);
          console.log("\u2705 Firebase ID token verified:", { uid: decodedToken.uid, email: decodedToken.email });
          return decodedToken;
        } catch (error) {
          console.error("\u274C Firebase ID token verification failed:", error);
          throw new Error("Invalid or expired Firebase ID token");
        }
      }
      /**
       * Get user by email
       * @param email - User email
       * @returns Firebase user record
       */
      async getUserByEmail(email) {
        await this.initialize();
        try {
          const auth = this.firebaseAuth.getAuth();
          const user = await auth.getUserByEmail(email);
          return user;
        } catch (error) {
          if (error.code === "auth/user-not-found") {
            return null;
          }
          console.error("\u274C Error fetching user by email:", error);
          throw error;
        }
      }
      /**
       * Get user by UID
       * @param uid - Firebase UID
       * @returns Firebase user record
       */
      async getUserByUid(uid) {
        await this.initialize();
        try {
          const auth = this.firebaseAuth.getAuth();
          const user = await auth.getUser(uid);
          return user;
        } catch (error) {
          if (error.code === "auth/user-not-found") {
            return null;
          }
          console.error("\u274C Error fetching user by UID:", error);
          throw error;
        }
      }
      /**
       * Create a new Firebase user
       * @param email - User email
       * @param password - User password
       * @returns Created user record
       */
      async createUser(email, password) {
        await this.initialize();
        try {
          const auth = this.firebaseAuth.getAuth();
          const user = await auth.createUser({
            email,
            password,
            emailVerified: false
          });
          console.log("\u2705 Firebase user created:", { uid: user.uid, email: user.email });
          return user;
        } catch (error) {
          console.error("\u274C Error creating Firebase user:", error);
          throw error;
        }
      }
      /**
       * Set custom user claims (roles)
       * @param uid - Firebase UID
       * @param claims - Custom claims object (e.g., { role: 'admin' })
       */
      async setCustomClaims(uid, claims) {
        await this.initialize();
        try {
          const auth = this.firebaseAuth.getAuth();
          await auth.setCustomUserClaims(uid, claims);
          console.log("\u2705 Custom claims set for user:", { uid, claims });
        } catch (error) {
          console.error("\u274C Error setting custom claims:", error);
          throw error;
        }
      }
      /**
       * Get custom claims for a user
       * @param uid - Firebase UID
       * @returns Custom claims object
       */
      async getCustomClaims(uid) {
        await this.initialize();
        try {
          const auth = this.firebaseAuth.getAuth();
          const user = await auth.getUser(uid);
          return user.customClaims || {};
        } catch (error) {
          console.error("\u274C Error getting custom claims:", error);
          throw error;
        }
      }
      /**
       * Send password reset email
       * @param email - User email
       */
      async sendPasswordResetEmail(email) {
        await this.initialize();
        try {
          const auth = this.firebaseAuth.getAuth();
          const link = await auth.generatePasswordResetLink(email);
          console.log("\u2705 Password reset link generated for:", email);
          console.log("\u{1F517} Reset link:", link);
        } catch (error) {
          console.error("\u274C Error generating password reset link:", error);
          throw error;
        }
      }
      /**
       * Delete a Firebase user
       * @param uid - Firebase UID
       */
      async deleteUser(uid) {
        await this.initialize();
        try {
          const auth = this.firebaseAuth.getAuth();
          await auth.deleteUser(uid);
          console.log("\u2705 Firebase user deleted:", uid);
        } catch (error) {
          console.error("\u274C Error deleting Firebase user:", error);
          throw error;
        }
      }
      /**
       * Update user email
       * @param uid - Firebase UID
       * @param newEmail - New email address
       */
      async updateUserEmail(uid, newEmail) {
        await this.initialize();
        try {
          const auth = this.firebaseAuth.getAuth();
          await auth.updateUser(uid, { email: newEmail });
          console.log("\u2705 User email updated:", { uid, newEmail });
        } catch (error) {
          console.error("\u274C Error updating user email:", error);
          throw error;
        }
      }
      /**
       * Check if Firebase Admin is initialized
       */
      isInitialized() {
        return this.initialized;
      }
    };
    __name(_FirebaseAdminService, "FirebaseAdminService");
    FirebaseAdminService = _FirebaseAdminService;
    firebaseAdminService = new FirebaseAdminService();
  }
});

// server/services/openai.service.ts
import OpenAI from "openai";
var openai, _OpenAIService, OpenAIService, openaiService;
var init_openai_service = __esm({
  "server/services/openai.service.ts"() {
    "use strict";
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_KEY || ""
    });
    _OpenAIService = class _OpenAIService {
      constructor() {
        this.systemPrompt = `You are an educational assistant for a LearnWorlds learning management system. Speak only in French.
Answer questions about the course content based on the context provided.
Be helpful, precise, and concise. If you don't know the answer based on the provided context, say so clearly. If you don't know the answer based on the provided context, say so clearly.
Do not make up information, NEVER. 

IMPORTANT: At the end of EVERY response, you MUST include this exact link in markdown format:
[Cours d'arthrologie du membre sup\xE9rieur](https://academy.ceerrf.fr/course/arthrologie-du-membre-superieur)

This link must appear at the end of the answer when usefull specially for the first answer.`;
      }
      /**
       * Generates a response for the given question based on relevant content
       */
      async generateResponse(question, relevantContent) {
        try {
          let contextText = "";
          if (relevantContent && typeof relevantContent !== "string" && relevantContent.length > 0) {
            contextText = relevantContent.map((item, index) => {
              const source = item.metadata?.source ? ` (Source: ${item.metadata.source})` : "";
              return `Context ${index + 1}${source}:
${item.content}
`;
            }).join("\n");
          } else if (typeof relevantContent === "string") {
            contextText = relevantContent;
          }
          const userPrompt = `Question: ${question}

Relevant Content:
${contextText}`;
          const response = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
              { role: "system", content: this.systemPrompt },
              { role: "user", content: userPrompt }
            ],
            temperature: 0.5,
            max_tokens: 1e3
          });
          return response.choices[0].message.content || "Je n'ai pas pu g\xE9n\xE9rer une r\xE9ponse. Veuillez r\xE9essayer.";
        } catch (error) {
          console.error("Error generating OpenAI response:", error);
          throw new Error(
            "Impossible de g\xE9n\xE9rer une r\xE9ponse. Service indisponible."
          );
        }
      }
      /**
       * Create a completion with custom system prompt (for ECOS evaluation)
       */
      async createCompletion(params) {
        try {
          const apiParams = {
            model: params.model,
            messages: params.messages
          };
          if (params.temperature !== void 0) apiParams.temperature = params.temperature;
          if (params.max_tokens !== void 0) apiParams.max_tokens = params.max_tokens;
          if (params.max_completion_tokens !== void 0) apiParams.max_completion_tokens = params.max_completion_tokens;
          if (params.reasoning !== void 0) apiParams.reasoning = params.reasoning;
          if (params.text !== void 0) apiParams.text = params.text;
          if (params.response_format !== void 0) apiParams.response_format = params.response_format;
          const response = await openai.chat.completions.create(apiParams);
          return response;
        } catch (error) {
          console.error("Error creating OpenAI completion:", error);
          throw new Error("Impossible de g\xE9n\xE9rer une r\xE9ponse. Service indisponible.");
        }
      }
      /**
       * Convert natural language question to SQL query
       */
      async convertToSQL(question, schema) {
        try {
          console.log("Conversion SQL - Question re\xE7ue:", question);
          console.log("Conversion SQL - Sch\xE9ma fourni:", schema.substring(0, 200) + "...");
          const prompt = `Tu es un expert en bases de donn\xE9es PostgreSQL. Convertis cette question en langage naturel en requ\xEAte SQL valide.

Base de donn\xE9es PostgreSQL avec le sch\xE9ma suivant :
${schema}

Question en fran\xE7ais : ${question}

Instructions importantes :
- G\xE9n\xE8re uniquement une requ\xEAte SELECT (pas d'INSERT, UPDATE, DELETE)
- Utilise la syntaxe PostgreSQL
- Utilise UNIQUEMENT les tables et colonnes list\xE9es dans le sch\xE9ma ci-dessus
- ATTENTION: Dans la table 'exchanges' la colonne utilisateur s'appelle 'utilisateur_email' (PAS 'email')
- ATTENTION: Dans la table 'daily_counters' la colonne utilisateur s'appelle 'utilisateur_email' (PAS 'email')
- Pour les questions sur les utilisateurs connect\xE9s/actifs, utilise la table 'exchanges' avec la colonne 'utilisateur_email'
- Pour les compteurs quotidiens, utilise la table 'daily_counters' avec la colonne 'utilisateur_email'
- Pour les dates, utilise DATE(timestamp) = CURRENT_DATE pour aujourd'hui
- Pour compter les utilisateurs uniques: COUNT(DISTINCT utilisateur_email)
- Inclus les alias de tables si n\xE9cessaire
- R\xE9ponds uniquement avec la requ\xEAte SQL, sans explication ni markdown

Requ\xEAte SQL :`;
          const response = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
              {
                role: "system",
                content: "Tu es un expert en conversion de langage naturel vers SQL. R\xE9ponds uniquement avec la requ\xEAte SQL demand\xE9e, sans formatage markdown."
              },
              { role: "user", content: prompt }
            ],
            max_tokens: 300,
            temperature: 0.1
          });
          let sqlQuery = response.choices[0].message.content?.trim() || "";
          console.log("R\xE9ponse OpenAI brute:", sqlQuery);
          sqlQuery = sqlQuery.replace(/```sql\s*/gi, "").replace(/```\s*/gi, "");
          const sqlMatch = sqlQuery.match(/(SELECT[\s\S]*?)(?:\n\s*$|$)/i);
          if (sqlMatch) {
            sqlQuery = sqlMatch[1].trim();
            console.log("SQL extrait:", sqlQuery);
          }
          sqlQuery = sqlQuery.replace(/;\s*$/, "");
          if (!sqlQuery.toLowerCase().includes("select")) {
            console.log("\xC9chec validation - pas de SELECT trouv\xE9 dans:", sqlQuery);
            throw new Error("Aucune requ\xEAte SELECT valide trouv\xE9e dans la r\xE9ponse");
          }
          if (!sqlQuery.toLowerCase().trim().startsWith("select")) {
            console.log("\xC9chec validation - ne commence pas par SELECT:", sqlQuery);
            throw new Error("La requ\xEAte doit commencer par SELECT");
          }
          console.log("SQL final valid\xE9:", sqlQuery);
          return sqlQuery;
        } catch (error) {
          console.error("Error converting to SQL:", error);
          if (error instanceof Error) {
            throw new Error(`Impossible de convertir la question en requ\xEAte SQL: ${error.message}`);
          }
          throw new Error("Impossible de convertir la question en requ\xEAte SQL");
        }
      }
    };
    __name(_OpenAIService, "OpenAIService");
    OpenAIService = _OpenAIService;
    openaiService = new OpenAIService();
  }
});

// server/services/pinecone.service.ts
var pinecone_service_exports = {};
__export(pinecone_service_exports, {
  PineconeService: () => PineconeService,
  pineconeService: () => pineconeService
});
import { Pinecone as Pinecone2 } from "@pinecone-database/pinecone";
import OpenAI2 from "openai";
var openai2, _PineconeService, PineconeService, pineconeService;
var init_pinecone_service = __esm({
  "server/services/pinecone.service.ts"() {
    "use strict";
    openai2 = new OpenAI2({
      apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_KEY || ""
    });
    _PineconeService = class _PineconeService {
      constructor() {
        this.indexName = "";
        this.namespace = "";
        try {
          const apiKey = process.env.PINECONE_API_KEY;
          this.indexName = process.env.PINECONE_INDEX_NAME || "arthrologie-du-membre-superieur";
          this.namespace = process.env.PINECONE_NAMESPACE || "default";
          if (!apiKey) {
            console.warn("Missing Pinecone API key - running in fallback mode");
            this.pinecone = null;
            this.index = null;
            return;
          }
          this.pinecone = new Pinecone2({
            apiKey
          });
          this.index = this.pinecone.index(this.indexName);
          console.log(`Connected to Pinecone index: ${this.indexName}`);
        } catch (error) {
          console.error("Error initializing Pinecone service:", error);
          console.warn("Running in fallback mode without Pinecone");
          this.pinecone = null;
          this.index = null;
        }
      }
      /**
       * Gets the vector embedding for a text string using OpenAI
       */
      async getEmbedding(text) {
        try {
          const response = await openai2.embeddings.create({
            model: "text-embedding-3-small",
            input: text,
            encoding_format: "float"
          });
          return response.data[0].embedding;
        } catch (error) {
          console.error("Error getting embedding:", error);
          throw new Error("Failed to generate embedding for query");
        }
      }
      /**
       * Search for relevant content based on the question
       */
      async searchRelevantContent(question, topK = 3) {
        try {
          if (!this.pinecone || !this.index) {
            console.warn("Pinecone not available - returning empty results");
            return [];
          }
          const embedding = await this.getEmbedding(question);
          const queryResponse = await this.index.query({
            vector: embedding,
            topK,
            includeMetadata: true
          });
          const results = [];
          for (const match of queryResponse.matches) {
            if (match.metadata && typeof match.metadata.text === "string") {
              results.push({
                content: match.metadata.text,
                metadata: {
                  source: typeof match.metadata.source === "string" ? match.metadata.source : void 0
                }
              });
            }
          }
          return results;
        } catch (error) {
          console.error("Error searching Pinecone:", error);
          return [];
        }
      }
      /**
       * Bulk upsert vectors to Pinecone
       */
      async upsertVectors(vectors) {
        try {
          if (!this.pinecone || !this.index) {
            console.warn("Pinecone not available - skipping upsert");
            return;
          }
          await this.index.upsert(vectors);
          console.log(`Successfully upserted ${vectors.length} vectors to Pinecone`);
        } catch (error) {
          console.error("Error upserting vectors:", error);
          throw new Error("Failed to store vectors in knowledge base");
        }
      }
      /**
       * Get all document sources from Pinecone
       */
      async getAllSources() {
        try {
          if (!this.pinecone || !this.index) {
            console.warn("Pinecone not available - returning empty sources");
            return [];
          }
          const dummyVector = new Array(1536).fill(0);
          const queryResponse = await this.index.query({
            vector: dummyVector,
            topK: 100,
            includeMetadata: true
          });
          const sources = /* @__PURE__ */ new Set();
          queryResponse.matches.forEach((match) => {
            if (match.metadata && match.metadata.source) {
              sources.add(match.metadata.source);
            }
          });
          return Array.from(sources);
        } catch (error) {
          console.error("Error getting sources:", error);
          return [];
        }
      }
      /**
       * Delete all vectors for a specific document
       */
      async deleteDocument(documentTitle) {
        try {
          if (!this.pinecone || !this.index) {
            console.warn("Pinecone not available - skipping delete");
            return;
          }
          const dummyVector = new Array(1536).fill(0);
          const queryResponse = await this.index.query({
            vector: dummyVector,
            topK: 1e3,
            includeMetadata: true,
            filter: { source: documentTitle }
          });
          const idsToDelete = queryResponse.matches.map((match) => match.id);
          if (idsToDelete.length > 0) {
            await this.index.deleteMany(idsToDelete);
            console.log(`Deleted ${idsToDelete.length} vectors for document: ${documentTitle}`);
          }
        } catch (error) {
          console.error("Error deleting document:", error);
          throw new Error("Failed to delete document from knowledge base");
        }
      }
      /**
       * Create a new Pinecone index
       */
      async createIndex(indexName, dimension = 1536) {
        if (!this.pinecone) {
          throw new Error("Pinecone not initialized - please check your API key");
        }
        try {
          console.log(`Attempting to create Pinecone index: ${indexName} with dimension: ${dimension}`);
          const result = await this.pinecone.createIndex({
            name: indexName,
            dimension,
            metric: "cosine",
            spec: {
              serverless: {
                cloud: "aws",
                region: "us-east-1"
              }
            }
          });
          console.log(`Successfully created Pinecone index: ${indexName}`, result);
        } catch (error) {
          console.error("Detailed error creating Pinecone index:", {
            message: error.message,
            status: error.status,
            response: error.response?.data,
            indexName,
            dimension
          });
          if (error.message && error.message.includes("ALREADY_EXISTS")) {
            throw new Error(`L'index "${indexName}" existe d\xE9j\xE0. Veuillez choisir un nom diff\xE9rent ou attendre quelques minutes si vous venez de le supprimer.`);
          } else if (error.status === 403) {
            throw new Error("Permission denied. Please check your Pinecone API key.");
          } else if (error.status === 400) {
            throw new Error(`Invalid index configuration: ${error.message}`);
          } else {
            throw new Error(`Failed to create index: ${error.message || "Unknown error"}`);
          }
        }
      }
      /**
       * List all available Pinecone indexes
       */
      async listIndexes() {
        if (!this.pinecone) {
          console.error("\u274C Pinecone not initialized");
          throw new Error("Pinecone not initialized");
        }
        try {
          console.log("\u{1F4E1} Calling Pinecone listIndexes API...");
          const indexesList = await this.pinecone.listIndexes();
          console.log("\u2705 Pinecone API response received:", JSON.stringify(indexesList, null, 2));
          if (!indexesList || !indexesList.indexes) {
            console.log("\u26A0\uFE0F No indexes found in response or empty response");
            return [];
          }
          console.log("\u{1F4DD} Processing indexes data...");
          const indexes = indexesList.indexes.map((index, idx) => {
            console.log(`Processing index ${idx}:`, JSON.stringify(index, null, 2));
            return {
              name: index.name,
              status: index.status?.ready ? "ready" : "not ready",
              dimension: index.dimension
            };
          });
          console.log("\u2705 Successfully processed indexes:", JSON.stringify(indexes, null, 2));
          return indexes;
        } catch (error) {
          console.error("\u274C Error in listIndexes:", error);
          console.error("Error stack:", error instanceof Error ? error.stack : "No stack trace");
          console.error("Error details:", {
            message: error instanceof Error ? error.message : "Unknown error",
            name: error instanceof Error ? error.name : "Unknown",
            code: error?.code,
            status: error?.status
          });
          throw error;
        }
      }
      /**
       * Switch to a different index
       */
      async switchIndex(indexName) {
        if (!this.pinecone) {
          throw new Error("Pinecone not initialized");
        }
        try {
          this.indexName = indexName;
          this.index = this.pinecone.index(indexName);
          console.log(`Switched to Pinecone index: ${indexName}`);
        } catch (error) {
          console.error("Error switching Pinecone index:", error);
          throw error;
        }
      }
      /**
       * Process PDF content into chunks and upload to Pinecone
       */
      async processPDFContent(content, title, category, chunkSize = 1e3, overlap = 200) {
        if (!this.index) {
          throw new Error("Pinecone not available");
        }
        try {
          const chunks = this.splitIntoChunks(content, chunkSize, overlap);
          const embeddings = await this.getEmbeddingsForChunks(chunks);
          const vectors = chunks.map((chunk, index) => ({
            id: `${title}_chunk_${index}`,
            values: embeddings[index],
            metadata: {
              source: title,
              text: chunk,
              category,
              chunk_index: index,
              total_chunks: chunks.length
            }
          }));
          await this.upsertVectors(vectors);
          console.log(`Processed PDF: ${title} with ${chunks.length} chunks`);
        } catch (error) {
          console.error("Error processing PDF content:", error);
          throw error;
        }
      }
      /**
       * Split text into chunks with overlap
       */
      splitIntoChunks(text, chunkSize, overlap) {
        const chunks = [];
        let start = 0;
        while (start < text.length) {
          const end = Math.min(start + chunkSize, text.length);
          const chunk = text.slice(start, end);
          chunks.push(chunk.trim());
          if (end === text.length) break;
          start = end - overlap;
        }
        return chunks.filter((chunk) => chunk.length > 0);
      }
      /**
       * Get embeddings for multiple text chunks
       */
      async getEmbeddingsForChunks(chunks) {
        const embeddings = [];
        const batchSize = 10;
        for (let i = 0; i < chunks.length; i += batchSize) {
          const batch = chunks.slice(i, i + batchSize);
          const batchEmbeddings = await Promise.all(
            batch.map((chunk) => this.getEmbedding(chunk))
          );
          embeddings.push(...batchEmbeddings);
          if (i + batchSize < chunks.length) {
            await new Promise((resolve) => setTimeout(resolve, 100));
          }
        }
        return embeddings;
      }
      async queryVectors(query, indexName, topK = 5) {
        try {
          if (!this.pinecone) {
            console.warn("Pinecone not available - returning empty results");
            return [];
          }
          const embedding = await this.getEmbedding(query);
          const targetIndex = this.pinecone.index(indexName);
          const queryResponse = await targetIndex.query({
            vector: embedding,
            topK,
            includeMetadata: true
          });
          const results = [];
          for (const match of queryResponse.matches) {
            if (match.metadata && typeof match.metadata.text === "string") {
              results.push({
                content: match.metadata.text,
                metadata: {
                  source: typeof match.metadata.source === "string" ? match.metadata.source : void 0
                }
              });
            }
          }
          return results;
        } catch (error) {
          console.error(`Error querying Pinecone index ${indexName}:`, error);
          return [];
        }
      }
    };
    __name(_PineconeService, "PineconeService");
    PineconeService = _PineconeService;
    pineconeService = new PineconeService();
  }
});

// server/services/promptGen.service.ts
var promptGen_service_exports = {};
__export(promptGen_service_exports, {
  PromptGenService: () => PromptGenService,
  promptGenService: () => promptGenService
});
var _PromptGenService, PromptGenService, promptGenService;
var init_promptGen_service = __esm({
  "server/services/promptGen.service.ts"() {
    "use strict";
    init_openai_service();
    init_pinecone_service();
    _PromptGenService = class _PromptGenService {
      async generatePatientPrompt(teacherInput, contextDocs = []) {
        try {
          let embeddedDocs = [];
          try {
            embeddedDocs = await pineconeService.searchRelevantContent(teacherInput);
          } catch (error) {
            console.log("Pinecone not available, using base prompt generation");
          }
          const allContext = [...contextDocs, ...embeddedDocs].join("\n\n");
          const systemPrompt = `Tu es un expert en cr\xE9ation de sc\xE9narios ECOS (Examen Clinique Objectif Structur\xE9). 
Tu dois cr\xE9er un prompt d\xE9taill\xE9 et r\xE9aliste pour simuler un patient virtuel.

Le prompt doit:
1. D\xE9finir clairement l'identit\xE9 du patient (\xE2ge, sexe, profession, etc.)
2. D\xE9crire les sympt\xF4mes actuels et l'histoire de la maladie
3. Inclure les ant\xE9c\xE9dents m\xE9dicaux pertinents
4. Pr\xE9ciser l'\xE9tat \xE9motionnel et le comportement du patient
5. D\xE9finir ce que le patient sait et ne sait pas sur sa condition
6. Inclure des d\xE9tails sur la personnalit\xE9 du patient
7. Sp\xE9cifier comment le patient doit r\xE9agir aux diff\xE9rents types de questions

Le prompt r\xE9sultant sera utilis\xE9 pour faire jouer le r\xF4le du patient \xE0 une IA lors d'un ECOS avec un \xE9tudiant en m\xE9decine.`;
          const userPrompt = `Cr\xE9e un prompt d\xE9taill\xE9 pour un patient virtuel bas\xE9 sur cette description du sc\xE9nario clinique:

${teacherInput}

${allContext ? `Utilise \xE9galement ces informations contextuelles pour enrichir le sc\xE9nario:
${allContext}` : ""}

Assure-toi que le prompt soit suffisamment d\xE9taill\xE9 pour permettre une interaction r\xE9aliste et p\xE9dagogique de 15-20 minutes.`;
          const response = await openaiService.generateResponse(
            `G\xE9n\xE8re un prompt d\xE9taill\xE9 pour un patient virtuel bas\xE9 sur cette description de sc\xE9nario ECOS:

${teacherInput}

Documents de r\xE9f\xE9rence:
${contextDocs.join("\n\n")}`,
            allContext
          );
          return response;
        } catch (error) {
          console.error("Error generating patient prompt:", error);
          throw new Error("Failed to generate patient prompt");
        }
      }
      async generateEvaluationCriteria(scenarioDescription) {
        try {
          const systemPrompt = `Tu es un expert en \xE9valuation ECOS. Cr\xE9e des crit\xE8res d'\xE9valuation structur\xE9s pour ce sc\xE9nario clinique.

Les crit\xE8res doivent inclure:
1. Communication (\xE9coute, empathie, clart\xE9)
2. Anamn\xE8se (questions pertinentes, organisation)
3. Examen clinique (techniques, syst\xE9matique)
4. Raisonnement clinique (diagnostic diff\xE9rentiel, hypoth\xE8ses)
5. Prise en charge (plan th\xE9rapeutique, suivi)

Chaque crit\xE8re doit avoir:
- Un nom clair
- Une description d\xE9taill\xE9e
- Une \xE9chelle de notation (0-4 points)
- Des indicateurs de performance pour chaque niveau

Retourne le r\xE9sultat en format JSON structur\xE9.`;
          const response = await openaiService.createCompletion({
            model: "gpt-4o",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: `Cr\xE9e des crit\xE8res d'\xE9valuation pour ce sc\xE9nario ECOS:

${scenarioDescription}` }
            ],
            temperature: 0.3,
            max_tokens: 1500
          });
          const criteriaText = response.choices[0].message.content;
          try {
            return JSON.parse(criteriaText);
          } catch {
            return {
              criteria: [
                {
                  name: "Communication",
                  description: "\xC9valuation des comp\xE9tences de communication",
                  maxScore: 4,
                  details: criteriaText
                }
              ]
            };
          }
        } catch (error) {
          console.error("Error generating evaluation criteria:", error);
          throw new Error("Failed to generate evaluation criteria");
        }
      }
    };
    __name(_PromptGenService, "PromptGenService");
    PromptGenService = _PromptGenService;
    promptGenService = new PromptGenService();
  }
});

// server/services/conversation-memory.service.ts
var _ConversationMemoryService, ConversationMemoryService, conversationMemoryService;
var init_conversation_memory_service = __esm({
  "server/services/conversation-memory.service.ts"() {
    "use strict";
    _ConversationMemoryService = class _ConversationMemoryService {
      constructor() {
        this.cache = /* @__PURE__ */ new Map();
        this.CACHE_TTL = 30 * 60 * 1e3;
        // 30 minutes
        this.MAX_HISTORY_MESSAGES = 20;
        this.cleanupInterval = setInterval(() => {
          this.cleanupExpiredSessions();
        }, 5 * 60 * 1e3);
      }
      /**
       * Initialize or retrieve conversation memory
       */
      async initializeConversation(sessionId, studentEmail, scenarioId, patientPrompt) {
        const existing = this.cache.get(sessionId);
        if (existing) {
          existing.lastActivity = /* @__PURE__ */ new Date();
          return existing;
        }
        const memory = {
          sessionId,
          studentEmail,
          scenarioId,
          studentRole: "infirmier",
          // Default to infirmier for ECOS-infirmier platform
          patientPersona: patientPrompt,
          conversationHistory: [],
          lastActivity: /* @__PURE__ */ new Date(),
          medicalContext: {
            symptomsDiscussed: [],
            proceduresPerformed: [],
            questionsAsked: []
          }
        };
        this.cache.set(sessionId, memory);
        console.log(`\u{1F4AD} Initialized conversation memory for session ${sessionId}`);
        return memory;
      }
      /**
       * Add message to conversation history
       */
      addMessage(sessionId, content, role, metadata) {
        const memory = this.cache.get(sessionId);
        if (!memory) {
          console.warn(`\u26A0\uFE0F No memory found for session ${sessionId}`);
          return;
        }
        const message = {
          content,
          role,
          timestamp: /* @__PURE__ */ new Date(),
          metadata
        };
        memory.conversationHistory.push(message);
        memory.lastActivity = /* @__PURE__ */ new Date();
        if (memory.conversationHistory.length > this.MAX_HISTORY_MESSAGES) {
          memory.conversationHistory = memory.conversationHistory.slice(-this.MAX_HISTORY_MESSAGES);
        }
        if (role === "student") {
          this.extractMedicalContext(memory, content);
        }
        console.log(`\u{1F4AD} Added ${role} message to session ${sessionId} memory`);
      }
      /**
       * Detect student role from introduction
       */
      detectStudentRole(content) {
        const lowerContent = content.toLowerCase();
        if (lowerContent.includes("infirmier") || lowerContent.includes("infirmi\xE8re")) {
          return "infirmier";
        }
        if (lowerContent.includes("docteur") || lowerContent.includes("m\xE9decin")) {
          return "docteur";
        }
        return "\xE9tudiant";
      }
      /**
       * Update student role in conversation memory
       */
      updateStudentRole(sessionId, content) {
        const memory = this.cache.get(sessionId);
        if (!memory) return;
        const detectedRole = this.detectStudentRole(content);
        if (detectedRole !== "\xE9tudiant") {
          memory.studentRole = detectedRole;
          console.log(`\u{1F3AD} Detected student role: ${detectedRole} for session ${sessionId}`);
        }
      }
      /**
       * Get conversation memory
       */
      getConversationMemory(sessionId) {
        const memory = this.cache.get(sessionId);
        if (memory) {
          memory.lastActivity = /* @__PURE__ */ new Date();
        }
        return memory || null;
      }
      /**
       * Get conversation context for AI prompt
       */
      getConversationContext(sessionId) {
        const memory = this.cache.get(sessionId);
        if (!memory) {
          return { history: "", role: "infirmier", medicalContext: "" };
        }
        const recentMessages = memory.conversationHistory.slice(-10);
        const history = recentMessages.map(
          (msg) => `${msg.role === "student" ? "\xC9tudiant" : "Patient"}: ${msg.content}`
        ).join("\n");
        const medicalContext = [
          memory.medicalContext?.symptomsDiscussed.length ? `Sympt\xF4mes discut\xE9s: ${memory.medicalContext.symptomsDiscussed.join(", ")}` : "",
          memory.medicalContext?.questionsAsked.length ? `Questions pos\xE9es: ${memory.medicalContext.questionsAsked.join(", ")}` : ""
        ].filter(Boolean).join("\n");
        return {
          history,
          role: memory.studentRole,
          medicalContext
        };
      }
      /**
       * Get conversation history in OpenAI message format
       * Returns array of messages ready to be sent to OpenAI API
       */
      getConversationMessages(sessionId, maxMessages = 10) {
        const memory = this.cache.get(sessionId);
        if (!memory) {
          return [];
        }
        const recentMessages = memory.conversationHistory.slice(-maxMessages);
        return recentMessages.map((msg) => ({
          role: msg.role === "student" ? "user" : "assistant",
          content: msg.content
        }));
      }
      /**
       * Get appropriate addressing for student role
       */
      getStudentAddressing(sessionId) {
        const memory = this.cache.get(sessionId);
        if (!memory) return "infirmier";
        switch (memory.studentRole) {
          case "infirmier":
            return "infirmier";
          case "docteur":
            return "docteur";
          default:
            return "infirmier";
        }
      }
      /**
       * Extract medical context from conversation
       */
      extractMedicalContext(memory, content) {
        const lowerContent = content.toLowerCase();
        const symptomKeywords = ["douleur", "mal", "sympt\xF4me", "fi\xE8vre", "naus\xE9e", "fatigue", "toux"];
        symptomKeywords.forEach((symptom) => {
          if (lowerContent.includes(symptom) && !memory.medicalContext?.symptomsDiscussed.includes(symptom)) {
            memory.medicalContext?.symptomsDiscussed.push(symptom);
          }
        });
        if (lowerContent.includes("?") || lowerContent.startsWith("comment") || lowerContent.startsWith("pourquoi")) {
          const question = content.substring(0, 50) + (content.length > 50 ? "..." : "");
          if (memory.medicalContext && !memory.medicalContext.questionsAsked.includes(question)) {
            memory.medicalContext.questionsAsked.push(question);
          }
        }
      }
      /**
       * Clean up expired sessions
       */
      cleanupExpiredSessions() {
        const now = (/* @__PURE__ */ new Date()).getTime();
        let cleanedCount = 0;
        for (const [sessionId, memory] of this.cache.entries()) {
          const lastActivity = memory.lastActivity.getTime();
          if (now - lastActivity > this.CACHE_TTL) {
            this.cache.delete(sessionId);
            cleanedCount++;
          }
        }
        if (cleanedCount > 0) {
          console.log(`\u{1F9F9} Cleaned up ${cleanedCount} expired conversation sessions`);
        }
      }
      /**
       * Get memory stats for monitoring
       */
      getMemoryStats() {
        let totalMessages = 0;
        let oldestSession = null;
        for (const memory of this.cache.values()) {
          totalMessages += memory.conversationHistory.length;
          if (!oldestSession || memory.lastActivity < oldestSession) {
            oldestSession = memory.lastActivity;
          }
        }
        return {
          activeSessions: this.cache.size,
          totalMessages,
          oldestSession
        };
      }
      /**
       * Clear specific session
       */
      clearSession(sessionId) {
        const result = this.cache.delete(sessionId);
        if (result) {
          console.log(`\u{1F5D1}\uFE0F Cleared conversation memory for session ${sessionId}`);
        }
        return result;
      }
      /**
       * Cleanup service
       */
      destroy() {
        if (this.cleanupInterval) {
          clearInterval(this.cleanupInterval);
        }
        this.cache.clear();
        console.log("\u{1F6D1} Conversation memory service destroyed");
      }
    };
    __name(_ConversationMemoryService, "ConversationMemoryService");
    ConversationMemoryService = _ConversationMemoryService;
    conversationMemoryService = new ConversationMemoryService();
  }
});

// server/services/virtual-patient.service.ts
var virtual_patient_service_exports = {};
__export(virtual_patient_service_exports, {
  VirtualPatientService: () => VirtualPatientService,
  virtualPatientService: () => virtualPatientService
});
import OpenAI3 from "openai";
var openai3, _VirtualPatientService, VirtualPatientService, virtualPatientService;
var init_virtual_patient_service = __esm({
  "server/services/virtual-patient.service.ts"() {
    "use strict";
    init_conversation_memory_service();
    init_unified_database_service();
    openai3 = new OpenAI3({
      apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_KEY || ""
    });
    _VirtualPatientService = class _VirtualPatientService {
      /**
       * Generate virtual patient response using AI
       */
      async generatePatientResponse(sessionId, studentEmail, query, scenarioId) {
        console.log(`\u{1F680} [generatePatientResponse] Starting patient response generation:`, {
          sessionId,
          studentEmail,
          scenarioId,
          queryPreview: query.substring(0, 50) + "..."
        });
        try {
          const memory = await conversationMemoryService.initializeConversation(
            sessionId,
            studentEmail,
            scenarioId || 1
          );
          conversationMemoryService.updateStudentRole(sessionId, query);
          console.log(`\u{1F504} [generatePatientResponse] About to fetch patient prompt for scenario ${scenarioId}`);
          const patientPrompt = await this.getScenarioPatientPrompt(scenarioId);
          const isFallbackPrompt = patientPrompt.includes("Ce prompt g\xE9n\xE9rique doit \xEAtre remplac\xE9");
          const context = conversationMemoryService.getConversationContext(sessionId);
          const addressing = conversationMemoryService.getStudentAddressing(sessionId);
          const systemPrompt = this.buildSystemPrompt(patientPrompt, context, addressing);
          const conversationMessages = conversationMemoryService.getConversationMessages(sessionId, 8);
          const aiResponse = await this.callOpenAI(systemPrompt, query, conversationMessages);
          conversationMemoryService.addMessage(sessionId, query, "student");
          conversationMemoryService.addMessage(sessionId, aiResponse, "patient");
          const medicalContext = this.extractMedicalContext(aiResponse);
          return {
            response: aiResponse,
            addressing: addressing || "\xE9tudiant",
            medicalContext,
            message: isFallbackPrompt ? "AI patient response generated with fallback prompt" : "AI patient response generated with scenario prompt and memory awareness"
          };
        } catch (error) {
          console.error("\u274C Error generating patient response:", error);
          const addressing = conversationMemoryService.getStudentAddressing(sessionId);
          const fallbackMessage = error instanceof Error ? error.message : "Unknown error generating patient response";
          return {
            response: `Excusez-moi ${addressing || ""}, pourriez-vous r\xE9p\xE9ter votre question ? Je n'ai pas bien compris.`,
            addressing: addressing || "\xE9tudiant",
            message: `AI patient fallback response due to error: ${fallbackMessage}`
          };
        }
      }
      /**
       * Get scenario-specific patient prompt from database
       */
      async getScenarioPatientPrompt(scenarioId) {
        console.log(`\u{1F50D} [getScenarioPatientPrompt] Called with scenarioId: ${scenarioId}`);
        if (!scenarioId) {
          console.warn(`\u26A0\uFE0F [getScenarioPatientPrompt] No scenarioId provided, using default prompt`);
          return this.getDefaultPatientPrompt();
        }
        try {
          console.log(`\u{1F504} [getScenarioPatientPrompt] Fetching scenarios from database...`);
          const scenarios = await unifiedDb.getScenarios();
          console.log(`\u{1F4CA} [getScenarioPatientPrompt] Found ${scenarios.length} scenarios in database`);
          const parsedScenarioId = typeof scenarioId === "string" ? parseInt(scenarioId, 10) : scenarioId;
          const normalizedScenarioId = typeof parsedScenarioId === "number" && !Number.isNaN(parsedScenarioId) ? parsedScenarioId : null;
          const scenario = normalizedScenarioId !== null ? scenarios.find((s) => {
            const scenarioDbId = typeof s.id === "string" ? parseInt(s.id, 10) : s.id;
            return !Number.isNaN(scenarioDbId) && scenarioDbId === normalizedScenarioId;
          }) : void 0;
          console.log(`\u{1F50D} [getScenarioPatientPrompt] Scenario ${scenarioId} found:`, scenario ? "YES" : "NO");
          if (scenario?.patient_prompt && scenario.patient_prompt.trim()) {
            console.log(`\u2705 [getScenarioPatientPrompt] Using scenario-specific prompt for scenario ${normalizedScenarioId ?? scenarioId}`);
            console.log(`\u{1F4DD} [getScenarioPatientPrompt] Prompt preview: "${scenario.patient_prompt.substring(0, 100)}..."`);
            return scenario.patient_prompt;
          }
          if (scenario) {
            console.warn(`\u26A0\uFE0F [getScenarioPatientPrompt] Scenario ${normalizedScenarioId ?? scenarioId} exists but has no patient_prompt (${scenario.patient_prompt})`);
          } else {
            console.warn(`\u26A0\uFE0F [getScenarioPatientPrompt] Scenario ${normalizedScenarioId ?? scenarioId} not found in database`);
            console.log(`\u{1F4CB} [getScenarioPatientPrompt] Available scenario IDs:`, scenarios.map((s) => s.id));
          }
          console.warn(`\u26A0\uFE0F [getScenarioPatientPrompt] Using fallback prompt for scenario ${scenarioId}`);
          return this.getDefaultPatientPrompt();
        } catch (error) {
          console.error("\u274C [getScenarioPatientPrompt] Error fetching scenario prompt:", error);
          console.warn("\u26A0\uFE0F [getScenarioPatientPrompt] Using emergency fallback prompt due to database error");
          return this.getDefaultPatientPrompt();
        }
      }
      /**
       * Build comprehensive system prompt for AI
       */
      buildSystemPrompt(patientPrompt, context, addressing) {
        const roleInstruction = this.getRoleInstruction(addressing);
        return `Tu es un patient virtuel dans un exercice de formation m\xE9dicale ECOS (Examen Clinique Objectif Structur\xE9).

PERSONNALIT\xC9 ET CONTEXTE DU PATIENT (\xC0 RESPECTER ABSOLUMENT):
${patientPrompt}

INSTRUCTIONS COMPORTEMENTALES CRITIQUES:
- Parle uniquement en fran\xE7ais
- RESPECTE STRICTEMENT le contexte et les sympt\xF4mes d\xE9crits dans ton prompt de patient
- NE JAMAIS inventer ou mentionner des sympt\xF4mes qui ne sont PAS dans ton contexte
- NE JAMAIS nier des sympt\xF4mes qui SONT explicitement mentionn\xE9s dans ton contexte
- Si ton prompt mentionne des sympt\xF4mes sp\xE9cifiques, tu DOIS les avoir
- Tu es le patient. Ne bascule JAMAIS dans le r\xF4le de l'infirmier ou d'un soignant.
- N'emploie jamais des phrases comme "je suis l\xE0 pour vous aider/\xE9couter" ou toute formulation qui implique que tu prends en charge l'\xE9tudiant.
- ${roleInstruction}
- R\xE9ponds de mani\xE8re r\xE9aliste et coh\xE9rente avec EXACTEMENT tes sympt\xF4mes d\xE9crits
- Sois coop\xE9ratif mais r\xE9aliste (certaines informations peuvent n\xE9cessiter des questions sp\xE9cifiques)
- Exprime tes \xE9motions et pr\xE9occupations comme un vrai patient
- R\xE9f\xE9rence les informations d\xE9j\xE0 \xE9chang\xE9es dans la conversation

CONTEXTE M\xC9DICAL ACTUEL:
${context.medicalContext}

R\xC8GLES D'OR:
1. RESTE FID\xC8LE \xE0 ton prompt de patient - ne jamais en d\xE9vier
2. Si ton contexte mentionne des sympt\xF4mes, tu les as R\xC9ELLEMENT
3. Ne mentionne JAMAIS de sympt\xF4mes non inclus dans ton contexte
4. Utilise l'historique de conversation (messages pr\xE9c\xE9dents) pour maintenir la continuit\xE9
5. Si l'\xE9tudiant a d\xE9j\xE0 pos\xE9 une question similaire, fais r\xE9f\xE9rence \xE0 ta r\xE9ponse pr\xE9c\xE9dente

IMPORTANT: Respecte ton contexte m\xE9dical \xE0 100%. L'historique complet de la conversation t'est fourni dans les messages pr\xE9c\xE9dents - utilise-le pour assurer la coh\xE9rence.`;
      }
      /**
       * Get role-specific instruction
       */
      getRoleInstruction(addressing) {
        console.log(`\u{1F3AD} Generating role instruction for addressing: "${addressing}"`);
        switch (addressing) {
          case "infirmier":
            return `Adresse-toi \xE0 l'infirmier(\xE8re) de mani\xE8re appropri\xE9e. Tu peux demander "Que faites-vous comme soins infirmier?" ou dire "Merci infirmier/infirmi\xE8re" quand c'est appropri\xE9.`;
          case "docteur":
            return `Adresse-toi au docteur de mani\xE8re formelle. Tu peux dire "Docteur, qu'est-ce que j'ai?" ou "Merci docteur" quand c'est appropri\xE9.`;
          default:
            console.log("\u{1F3AD} No specific role detected, defaulting to infirmier addressing for ECOS-infirmier platform");
            return `Adresse-toi \xE0 l'infirmier(\xE8re) de mani\xE8re appropri\xE9e. Tu peux demander "Que faites-vous comme soins infirmier?" ou dire "Merci infirmier/infirmi\xE8re" quand c'est appropri\xE9.`;
        }
      }
      /**
       * Call OpenAI API with conversation history
       */
      async callOpenAI(systemPrompt, query, conversationHistory) {
        const messages = [
          { role: "system", content: systemPrompt },
          ...conversationHistory,
          { role: "user", content: query }
        ];
        console.log(`\u{1F4AC} Sending ${messages.length} messages to OpenAI (1 system + ${conversationHistory.length} history + 1 current)`);
        const response = await openai3.chat.completions.create({
          model: "gpt-4o",
          messages,
          temperature: 0.7,
          // Balanced creativity and coherence
          max_tokens: 300,
          top_p: 0.95,
          // Controlled diversity in responses
          frequency_penalty: 0.5,
          // Reduce repetitive phrases
          presence_penalty: 0.5
          // Encourage introducing new relevant elements
        });
        return response.choices[0]?.message?.content || "Je ne me sens pas bien...";
      }
      /**
       * Extract medical context from AI response
       * NOTE: Symptômes gérés par le LLM + RAG, pas de hardcode
       */
      extractMedicalContext(response) {
        return {
          symptomsRevealed: [],
          // LLM + RAG gèrent les symptômes dynamiquement
          questionsAnswered: [],
          // Pourrait être amélioré avec NLP
          nextSteps: []
          // Pourrait suggérer les prochaines étapes diagnostiques
        };
      }
      /**
       * Default patient prompt - Emergency fallback only
       * This should only be used if database scenarios are missing patient prompts
       */
      getDefaultPatientPrompt() {
        console.warn("\u26A0\uFE0F Using emergency fallback patient prompt - this indicates missing patient_prompt in database");
        return `Tu es un patient virtuel dans un exercice de formation m\xE9dicale ECOS.

CONTEXTE G\xC9N\xC9RAL :
- Tu es un patient qui consulte pour un probl\xE8me de sant\xE9
- Tu ressens des sympt\xF4mes que tu peux d\xE9crire quand on te pose les bonnes questions
- Tu es coop\xE9ratif mais r\xE9aliste dans tes r\xE9ponses
- Tu peux exprimer de l'inqui\xE9tude ou des \xE9motions appropri\xE9es

COMPORTEMENT :
- R\xE9ponds aux questions m\xE9dicales de mani\xE8re coh\xE9rente
- Ne mentionne que les sympt\xF4mes qu'on t'a d\xE9j\xE0 demand\xE9s ou qui sont \xE9vidents
- Sois patient et poli avec le personnel soignant
- Si on te demande des d\xE9tails sp\xE9cifiques, tu peux les fournir graduellement
- Exprime tes pr\xE9occupations de sant\xE9 de mani\xE8re naturelle

IMPORTANT : Ce prompt g\xE9n\xE9rique doit \xEAtre remplac\xE9 par un prompt sp\xE9cifique au sc\xE9nario dans la base de donn\xE9es.`;
      }
      /**
       * Get conversation memory for a session
       */
      getConversationMemory(sessionId) {
        return conversationMemoryService.getConversationMemory(sessionId);
      }
      /**
       * Get memory statistics for monitoring
       */
      getServiceStats() {
        return {
          memoryStats: conversationMemoryService.getMemoryStats(),
          totalSessions: conversationMemoryService.getMemoryStats().activeSessions
        };
      }
      /**
       * Clear specific session data
       */
      clearPatientSession(sessionId) {
        return conversationMemoryService.clearSession(sessionId);
      }
      /**
       * Validate patient simulator input
       */
      validateInput(input) {
        if (!input.sessionId) {
          return { valid: false, error: "Session ID is required" };
        }
        if (!input.email) {
          return { valid: false, error: "Student email is required" };
        }
        if (!input.query || input.query.trim().length === 0) {
          return { valid: false, error: "Query cannot be empty" };
        }
        if (input.query.length > 500) {
          return { valid: false, error: "Query is too long (max 500 characters)" };
        }
        return { valid: true };
      }
    };
    __name(_VirtualPatientService, "VirtualPatientService");
    VirtualPatientService = _VirtualPatientService;
    virtualPatientService = new VirtualPatientService();
  }
});

// server/serverless-app.ts
import express from "express";

// server/routes.ts
import { createServer } from "http";

// node_modules/zod/lib/index.mjs
var util;
(function(util2) {
  util2.assertEqual = (val) => val;
  function assertIs(_arg) {
  }
  __name(assertIs, "assertIs");
  util2.assertIs = assertIs;
  function assertNever(_x) {
    throw new Error();
  }
  __name(assertNever, "assertNever");
  util2.assertNever = assertNever;
  util2.arrayToEnum = (items) => {
    const obj = {};
    for (const item of items) {
      obj[item] = item;
    }
    return obj;
  };
  util2.getValidEnumValues = (obj) => {
    const validKeys = util2.objectKeys(obj).filter((k) => typeof obj[obj[k]] !== "number");
    const filtered = {};
    for (const k of validKeys) {
      filtered[k] = obj[k];
    }
    return util2.objectValues(filtered);
  };
  util2.objectValues = (obj) => {
    return util2.objectKeys(obj).map(function(e) {
      return obj[e];
    });
  };
  util2.objectKeys = typeof Object.keys === "function" ? (obj) => Object.keys(obj) : (object) => {
    const keys = [];
    for (const key in object) {
      if (Object.prototype.hasOwnProperty.call(object, key)) {
        keys.push(key);
      }
    }
    return keys;
  };
  util2.find = (arr, checker) => {
    for (const item of arr) {
      if (checker(item))
        return item;
    }
    return void 0;
  };
  util2.isInteger = typeof Number.isInteger === "function" ? (val) => Number.isInteger(val) : (val) => typeof val === "number" && isFinite(val) && Math.floor(val) === val;
  function joinValues(array, separator = " | ") {
    return array.map((val) => typeof val === "string" ? `'${val}'` : val).join(separator);
  }
  __name(joinValues, "joinValues");
  util2.joinValues = joinValues;
  util2.jsonStringifyReplacer = (_, value) => {
    if (typeof value === "bigint") {
      return value.toString();
    }
    return value;
  };
})(util || (util = {}));
var objectUtil;
(function(objectUtil2) {
  objectUtil2.mergeShapes = (first, second) => {
    return {
      ...first,
      ...second
      // second overwrites first
    };
  };
})(objectUtil || (objectUtil = {}));
var ZodParsedType = util.arrayToEnum([
  "string",
  "nan",
  "number",
  "integer",
  "float",
  "boolean",
  "date",
  "bigint",
  "symbol",
  "function",
  "undefined",
  "null",
  "array",
  "object",
  "unknown",
  "promise",
  "void",
  "never",
  "map",
  "set"
]);
var getParsedType = /* @__PURE__ */ __name((data) => {
  const t = typeof data;
  switch (t) {
    case "undefined":
      return ZodParsedType.undefined;
    case "string":
      return ZodParsedType.string;
    case "number":
      return isNaN(data) ? ZodParsedType.nan : ZodParsedType.number;
    case "boolean":
      return ZodParsedType.boolean;
    case "function":
      return ZodParsedType.function;
    case "bigint":
      return ZodParsedType.bigint;
    case "symbol":
      return ZodParsedType.symbol;
    case "object":
      if (Array.isArray(data)) {
        return ZodParsedType.array;
      }
      if (data === null) {
        return ZodParsedType.null;
      }
      if (data.then && typeof data.then === "function" && data.catch && typeof data.catch === "function") {
        return ZodParsedType.promise;
      }
      if (typeof Map !== "undefined" && data instanceof Map) {
        return ZodParsedType.map;
      }
      if (typeof Set !== "undefined" && data instanceof Set) {
        return ZodParsedType.set;
      }
      if (typeof Date !== "undefined" && data instanceof Date) {
        return ZodParsedType.date;
      }
      return ZodParsedType.object;
    default:
      return ZodParsedType.unknown;
  }
}, "getParsedType");
var ZodIssueCode = util.arrayToEnum([
  "invalid_type",
  "invalid_literal",
  "custom",
  "invalid_union",
  "invalid_union_discriminator",
  "invalid_enum_value",
  "unrecognized_keys",
  "invalid_arguments",
  "invalid_return_type",
  "invalid_date",
  "invalid_string",
  "too_small",
  "too_big",
  "invalid_intersection_types",
  "not_multiple_of",
  "not_finite"
]);
var quotelessJson = /* @__PURE__ */ __name((obj) => {
  const json = JSON.stringify(obj, null, 2);
  return json.replace(/"([^"]+)":/g, "$1:");
}, "quotelessJson");
var _ZodError = class _ZodError extends Error {
  get errors() {
    return this.issues;
  }
  constructor(issues) {
    super();
    this.issues = [];
    this.addIssue = (sub) => {
      this.issues = [...this.issues, sub];
    };
    this.addIssues = (subs = []) => {
      this.issues = [...this.issues, ...subs];
    };
    const actualProto = new.target.prototype;
    if (Object.setPrototypeOf) {
      Object.setPrototypeOf(this, actualProto);
    } else {
      this.__proto__ = actualProto;
    }
    this.name = "ZodError";
    this.issues = issues;
  }
  format(_mapper) {
    const mapper = _mapper || function(issue) {
      return issue.message;
    };
    const fieldErrors = { _errors: [] };
    const processError = /* @__PURE__ */ __name((error) => {
      for (const issue of error.issues) {
        if (issue.code === "invalid_union") {
          issue.unionErrors.map(processError);
        } else if (issue.code === "invalid_return_type") {
          processError(issue.returnTypeError);
        } else if (issue.code === "invalid_arguments") {
          processError(issue.argumentsError);
        } else if (issue.path.length === 0) {
          fieldErrors._errors.push(mapper(issue));
        } else {
          let curr = fieldErrors;
          let i = 0;
          while (i < issue.path.length) {
            const el = issue.path[i];
            const terminal = i === issue.path.length - 1;
            if (!terminal) {
              curr[el] = curr[el] || { _errors: [] };
            } else {
              curr[el] = curr[el] || { _errors: [] };
              curr[el]._errors.push(mapper(issue));
            }
            curr = curr[el];
            i++;
          }
        }
      }
    }, "processError");
    processError(this);
    return fieldErrors;
  }
  static assert(value) {
    if (!(value instanceof _ZodError)) {
      throw new Error(`Not a ZodError: ${value}`);
    }
  }
  toString() {
    return this.message;
  }
  get message() {
    return JSON.stringify(this.issues, util.jsonStringifyReplacer, 2);
  }
  get isEmpty() {
    return this.issues.length === 0;
  }
  flatten(mapper = (issue) => issue.message) {
    const fieldErrors = {};
    const formErrors = [];
    for (const sub of this.issues) {
      if (sub.path.length > 0) {
        fieldErrors[sub.path[0]] = fieldErrors[sub.path[0]] || [];
        fieldErrors[sub.path[0]].push(mapper(sub));
      } else {
        formErrors.push(mapper(sub));
      }
    }
    return { formErrors, fieldErrors };
  }
  get formErrors() {
    return this.flatten();
  }
};
__name(_ZodError, "ZodError");
var ZodError = _ZodError;
ZodError.create = (issues) => {
  const error = new ZodError(issues);
  return error;
};
var errorMap = /* @__PURE__ */ __name((issue, _ctx) => {
  let message;
  switch (issue.code) {
    case ZodIssueCode.invalid_type:
      if (issue.received === ZodParsedType.undefined) {
        message = "Required";
      } else {
        message = `Expected ${issue.expected}, received ${issue.received}`;
      }
      break;
    case ZodIssueCode.invalid_literal:
      message = `Invalid literal value, expected ${JSON.stringify(issue.expected, util.jsonStringifyReplacer)}`;
      break;
    case ZodIssueCode.unrecognized_keys:
      message = `Unrecognized key(s) in object: ${util.joinValues(issue.keys, ", ")}`;
      break;
    case ZodIssueCode.invalid_union:
      message = `Invalid input`;
      break;
    case ZodIssueCode.invalid_union_discriminator:
      message = `Invalid discriminator value. Expected ${util.joinValues(issue.options)}`;
      break;
    case ZodIssueCode.invalid_enum_value:
      message = `Invalid enum value. Expected ${util.joinValues(issue.options)}, received '${issue.received}'`;
      break;
    case ZodIssueCode.invalid_arguments:
      message = `Invalid function arguments`;
      break;
    case ZodIssueCode.invalid_return_type:
      message = `Invalid function return type`;
      break;
    case ZodIssueCode.invalid_date:
      message = `Invalid date`;
      break;
    case ZodIssueCode.invalid_string:
      if (typeof issue.validation === "object") {
        if ("includes" in issue.validation) {
          message = `Invalid input: must include "${issue.validation.includes}"`;
          if (typeof issue.validation.position === "number") {
            message = `${message} at one or more positions greater than or equal to ${issue.validation.position}`;
          }
        } else if ("startsWith" in issue.validation) {
          message = `Invalid input: must start with "${issue.validation.startsWith}"`;
        } else if ("endsWith" in issue.validation) {
          message = `Invalid input: must end with "${issue.validation.endsWith}"`;
        } else {
          util.assertNever(issue.validation);
        }
      } else if (issue.validation !== "regex") {
        message = `Invalid ${issue.validation}`;
      } else {
        message = "Invalid";
      }
      break;
    case ZodIssueCode.too_small:
      if (issue.type === "array")
        message = `Array must contain ${issue.exact ? "exactly" : issue.inclusive ? `at least` : `more than`} ${issue.minimum} element(s)`;
      else if (issue.type === "string")
        message = `String must contain ${issue.exact ? "exactly" : issue.inclusive ? `at least` : `over`} ${issue.minimum} character(s)`;
      else if (issue.type === "number")
        message = `Number must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${issue.minimum}`;
      else if (issue.type === "date")
        message = `Date must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${new Date(Number(issue.minimum))}`;
      else
        message = "Invalid input";
      break;
    case ZodIssueCode.too_big:
      if (issue.type === "array")
        message = `Array must contain ${issue.exact ? `exactly` : issue.inclusive ? `at most` : `less than`} ${issue.maximum} element(s)`;
      else if (issue.type === "string")
        message = `String must contain ${issue.exact ? `exactly` : issue.inclusive ? `at most` : `under`} ${issue.maximum} character(s)`;
      else if (issue.type === "number")
        message = `Number must be ${issue.exact ? `exactly` : issue.inclusive ? `less than or equal to` : `less than`} ${issue.maximum}`;
      else if (issue.type === "bigint")
        message = `BigInt must be ${issue.exact ? `exactly` : issue.inclusive ? `less than or equal to` : `less than`} ${issue.maximum}`;
      else if (issue.type === "date")
        message = `Date must be ${issue.exact ? `exactly` : issue.inclusive ? `smaller than or equal to` : `smaller than`} ${new Date(Number(issue.maximum))}`;
      else
        message = "Invalid input";
      break;
    case ZodIssueCode.custom:
      message = `Invalid input`;
      break;
    case ZodIssueCode.invalid_intersection_types:
      message = `Intersection results could not be merged`;
      break;
    case ZodIssueCode.not_multiple_of:
      message = `Number must be a multiple of ${issue.multipleOf}`;
      break;
    case ZodIssueCode.not_finite:
      message = "Number must be finite";
      break;
    default:
      message = _ctx.defaultError;
      util.assertNever(issue);
  }
  return { message };
}, "errorMap");
var overrideErrorMap = errorMap;
function setErrorMap(map) {
  overrideErrorMap = map;
}
__name(setErrorMap, "setErrorMap");
function getErrorMap() {
  return overrideErrorMap;
}
__name(getErrorMap, "getErrorMap");
var makeIssue = /* @__PURE__ */ __name((params) => {
  const { data, path, errorMaps, issueData } = params;
  const fullPath = [...path, ...issueData.path || []];
  const fullIssue = {
    ...issueData,
    path: fullPath
  };
  if (issueData.message !== void 0) {
    return {
      ...issueData,
      path: fullPath,
      message: issueData.message
    };
  }
  let errorMessage = "";
  const maps = errorMaps.filter((m) => !!m).slice().reverse();
  for (const map of maps) {
    errorMessage = map(fullIssue, { data, defaultError: errorMessage }).message;
  }
  return {
    ...issueData,
    path: fullPath,
    message: errorMessage
  };
}, "makeIssue");
var EMPTY_PATH = [];
function addIssueToContext(ctx, issueData) {
  const overrideMap = getErrorMap();
  const issue = makeIssue({
    issueData,
    data: ctx.data,
    path: ctx.path,
    errorMaps: [
      ctx.common.contextualErrorMap,
      // contextual error map is first priority
      ctx.schemaErrorMap,
      // then schema-bound map if available
      overrideMap,
      // then global override map
      overrideMap === errorMap ? void 0 : errorMap
      // then global default map
    ].filter((x) => !!x)
  });
  ctx.common.issues.push(issue);
}
__name(addIssueToContext, "addIssueToContext");
var _ParseStatus = class _ParseStatus {
  constructor() {
    this.value = "valid";
  }
  dirty() {
    if (this.value === "valid")
      this.value = "dirty";
  }
  abort() {
    if (this.value !== "aborted")
      this.value = "aborted";
  }
  static mergeArray(status, results) {
    const arrayValue = [];
    for (const s of results) {
      if (s.status === "aborted")
        return INVALID;
      if (s.status === "dirty")
        status.dirty();
      arrayValue.push(s.value);
    }
    return { status: status.value, value: arrayValue };
  }
  static async mergeObjectAsync(status, pairs) {
    const syncPairs = [];
    for (const pair of pairs) {
      const key = await pair.key;
      const value = await pair.value;
      syncPairs.push({
        key,
        value
      });
    }
    return _ParseStatus.mergeObjectSync(status, syncPairs);
  }
  static mergeObjectSync(status, pairs) {
    const finalObject = {};
    for (const pair of pairs) {
      const { key, value } = pair;
      if (key.status === "aborted")
        return INVALID;
      if (value.status === "aborted")
        return INVALID;
      if (key.status === "dirty")
        status.dirty();
      if (value.status === "dirty")
        status.dirty();
      if (key.value !== "__proto__" && (typeof value.value !== "undefined" || pair.alwaysSet)) {
        finalObject[key.value] = value.value;
      }
    }
    return { status: status.value, value: finalObject };
  }
};
__name(_ParseStatus, "ParseStatus");
var ParseStatus = _ParseStatus;
var INVALID = Object.freeze({
  status: "aborted"
});
var DIRTY = /* @__PURE__ */ __name((value) => ({ status: "dirty", value }), "DIRTY");
var OK = /* @__PURE__ */ __name((value) => ({ status: "valid", value }), "OK");
var isAborted = /* @__PURE__ */ __name((x) => x.status === "aborted", "isAborted");
var isDirty = /* @__PURE__ */ __name((x) => x.status === "dirty", "isDirty");
var isValid = /* @__PURE__ */ __name((x) => x.status === "valid", "isValid");
var isAsync = /* @__PURE__ */ __name((x) => typeof Promise !== "undefined" && x instanceof Promise, "isAsync");
function __classPrivateFieldGet(receiver, state, kind, f) {
  if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
  if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
  return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
}
__name(__classPrivateFieldGet, "__classPrivateFieldGet");
function __classPrivateFieldSet(receiver, state, value, kind, f) {
  if (kind === "m") throw new TypeError("Private method is not writable");
  if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
  if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
  return kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value), value;
}
__name(__classPrivateFieldSet, "__classPrivateFieldSet");
var errorUtil;
(function(errorUtil2) {
  errorUtil2.errToObj = (message) => typeof message === "string" ? { message } : message || {};
  errorUtil2.toString = (message) => typeof message === "string" ? message : message === null || message === void 0 ? void 0 : message.message;
})(errorUtil || (errorUtil = {}));
var _ZodEnum_cache;
var _ZodNativeEnum_cache;
var _ParseInputLazyPath = class _ParseInputLazyPath {
  constructor(parent, value, path, key) {
    this._cachedPath = [];
    this.parent = parent;
    this.data = value;
    this._path = path;
    this._key = key;
  }
  get path() {
    if (!this._cachedPath.length) {
      if (this._key instanceof Array) {
        this._cachedPath.push(...this._path, ...this._key);
      } else {
        this._cachedPath.push(...this._path, this._key);
      }
    }
    return this._cachedPath;
  }
};
__name(_ParseInputLazyPath, "ParseInputLazyPath");
var ParseInputLazyPath = _ParseInputLazyPath;
var handleResult = /* @__PURE__ */ __name((ctx, result) => {
  if (isValid(result)) {
    return { success: true, data: result.value };
  } else {
    if (!ctx.common.issues.length) {
      throw new Error("Validation failed but no issues detected.");
    }
    return {
      success: false,
      get error() {
        if (this._error)
          return this._error;
        const error = new ZodError(ctx.common.issues);
        this._error = error;
        return this._error;
      }
    };
  }
}, "handleResult");
function processCreateParams(params) {
  if (!params)
    return {};
  const { errorMap: errorMap2, invalid_type_error, required_error, description } = params;
  if (errorMap2 && (invalid_type_error || required_error)) {
    throw new Error(`Can't use "invalid_type_error" or "required_error" in conjunction with custom error map.`);
  }
  if (errorMap2)
    return { errorMap: errorMap2, description };
  const customMap = /* @__PURE__ */ __name((iss, ctx) => {
    var _a, _b;
    const { message } = params;
    if (iss.code === "invalid_enum_value") {
      return { message: message !== null && message !== void 0 ? message : ctx.defaultError };
    }
    if (typeof ctx.data === "undefined") {
      return { message: (_a = message !== null && message !== void 0 ? message : required_error) !== null && _a !== void 0 ? _a : ctx.defaultError };
    }
    if (iss.code !== "invalid_type")
      return { message: ctx.defaultError };
    return { message: (_b = message !== null && message !== void 0 ? message : invalid_type_error) !== null && _b !== void 0 ? _b : ctx.defaultError };
  }, "customMap");
  return { errorMap: customMap, description };
}
__name(processCreateParams, "processCreateParams");
var _ZodType = class _ZodType {
  get description() {
    return this._def.description;
  }
  _getType(input) {
    return getParsedType(input.data);
  }
  _getOrReturnCtx(input, ctx) {
    return ctx || {
      common: input.parent.common,
      data: input.data,
      parsedType: getParsedType(input.data),
      schemaErrorMap: this._def.errorMap,
      path: input.path,
      parent: input.parent
    };
  }
  _processInputParams(input) {
    return {
      status: new ParseStatus(),
      ctx: {
        common: input.parent.common,
        data: input.data,
        parsedType: getParsedType(input.data),
        schemaErrorMap: this._def.errorMap,
        path: input.path,
        parent: input.parent
      }
    };
  }
  _parseSync(input) {
    const result = this._parse(input);
    if (isAsync(result)) {
      throw new Error("Synchronous parse encountered promise.");
    }
    return result;
  }
  _parseAsync(input) {
    const result = this._parse(input);
    return Promise.resolve(result);
  }
  parse(data, params) {
    const result = this.safeParse(data, params);
    if (result.success)
      return result.data;
    throw result.error;
  }
  safeParse(data, params) {
    var _a;
    const ctx = {
      common: {
        issues: [],
        async: (_a = params === null || params === void 0 ? void 0 : params.async) !== null && _a !== void 0 ? _a : false,
        contextualErrorMap: params === null || params === void 0 ? void 0 : params.errorMap
      },
      path: (params === null || params === void 0 ? void 0 : params.path) || [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data,
      parsedType: getParsedType(data)
    };
    const result = this._parseSync({ data, path: ctx.path, parent: ctx });
    return handleResult(ctx, result);
  }
  "~validate"(data) {
    var _a, _b;
    const ctx = {
      common: {
        issues: [],
        async: !!this["~standard"].async
      },
      path: [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data,
      parsedType: getParsedType(data)
    };
    if (!this["~standard"].async) {
      try {
        const result = this._parseSync({ data, path: [], parent: ctx });
        return isValid(result) ? {
          value: result.value
        } : {
          issues: ctx.common.issues
        };
      } catch (err) {
        if ((_b = (_a = err === null || err === void 0 ? void 0 : err.message) === null || _a === void 0 ? void 0 : _a.toLowerCase()) === null || _b === void 0 ? void 0 : _b.includes("encountered")) {
          this["~standard"].async = true;
        }
        ctx.common = {
          issues: [],
          async: true
        };
      }
    }
    return this._parseAsync({ data, path: [], parent: ctx }).then((result) => isValid(result) ? {
      value: result.value
    } : {
      issues: ctx.common.issues
    });
  }
  async parseAsync(data, params) {
    const result = await this.safeParseAsync(data, params);
    if (result.success)
      return result.data;
    throw result.error;
  }
  async safeParseAsync(data, params) {
    const ctx = {
      common: {
        issues: [],
        contextualErrorMap: params === null || params === void 0 ? void 0 : params.errorMap,
        async: true
      },
      path: (params === null || params === void 0 ? void 0 : params.path) || [],
      schemaErrorMap: this._def.errorMap,
      parent: null,
      data,
      parsedType: getParsedType(data)
    };
    const maybeAsyncResult = this._parse({ data, path: ctx.path, parent: ctx });
    const result = await (isAsync(maybeAsyncResult) ? maybeAsyncResult : Promise.resolve(maybeAsyncResult));
    return handleResult(ctx, result);
  }
  refine(check, message) {
    const getIssueProperties = /* @__PURE__ */ __name((val) => {
      if (typeof message === "string" || typeof message === "undefined") {
        return { message };
      } else if (typeof message === "function") {
        return message(val);
      } else {
        return message;
      }
    }, "getIssueProperties");
    return this._refinement((val, ctx) => {
      const result = check(val);
      const setError = /* @__PURE__ */ __name(() => ctx.addIssue({
        code: ZodIssueCode.custom,
        ...getIssueProperties(val)
      }), "setError");
      if (typeof Promise !== "undefined" && result instanceof Promise) {
        return result.then((data) => {
          if (!data) {
            setError();
            return false;
          } else {
            return true;
          }
        });
      }
      if (!result) {
        setError();
        return false;
      } else {
        return true;
      }
    });
  }
  refinement(check, refinementData) {
    return this._refinement((val, ctx) => {
      if (!check(val)) {
        ctx.addIssue(typeof refinementData === "function" ? refinementData(val, ctx) : refinementData);
        return false;
      } else {
        return true;
      }
    });
  }
  _refinement(refinement) {
    return new ZodEffects({
      schema: this,
      typeName: ZodFirstPartyTypeKind.ZodEffects,
      effect: { type: "refinement", refinement }
    });
  }
  superRefine(refinement) {
    return this._refinement(refinement);
  }
  constructor(def) {
    this.spa = this.safeParseAsync;
    this._def = def;
    this.parse = this.parse.bind(this);
    this.safeParse = this.safeParse.bind(this);
    this.parseAsync = this.parseAsync.bind(this);
    this.safeParseAsync = this.safeParseAsync.bind(this);
    this.spa = this.spa.bind(this);
    this.refine = this.refine.bind(this);
    this.refinement = this.refinement.bind(this);
    this.superRefine = this.superRefine.bind(this);
    this.optional = this.optional.bind(this);
    this.nullable = this.nullable.bind(this);
    this.nullish = this.nullish.bind(this);
    this.array = this.array.bind(this);
    this.promise = this.promise.bind(this);
    this.or = this.or.bind(this);
    this.and = this.and.bind(this);
    this.transform = this.transform.bind(this);
    this.brand = this.brand.bind(this);
    this.default = this.default.bind(this);
    this.catch = this.catch.bind(this);
    this.describe = this.describe.bind(this);
    this.pipe = this.pipe.bind(this);
    this.readonly = this.readonly.bind(this);
    this.isNullable = this.isNullable.bind(this);
    this.isOptional = this.isOptional.bind(this);
    this["~standard"] = {
      version: 1,
      vendor: "zod",
      validate: /* @__PURE__ */ __name((data) => this["~validate"](data), "validate")
    };
  }
  optional() {
    return ZodOptional.create(this, this._def);
  }
  nullable() {
    return ZodNullable.create(this, this._def);
  }
  nullish() {
    return this.nullable().optional();
  }
  array() {
    return ZodArray.create(this);
  }
  promise() {
    return ZodPromise.create(this, this._def);
  }
  or(option) {
    return ZodUnion.create([this, option], this._def);
  }
  and(incoming) {
    return ZodIntersection.create(this, incoming, this._def);
  }
  transform(transform) {
    return new ZodEffects({
      ...processCreateParams(this._def),
      schema: this,
      typeName: ZodFirstPartyTypeKind.ZodEffects,
      effect: { type: "transform", transform }
    });
  }
  default(def) {
    const defaultValueFunc = typeof def === "function" ? def : () => def;
    return new ZodDefault({
      ...processCreateParams(this._def),
      innerType: this,
      defaultValue: defaultValueFunc,
      typeName: ZodFirstPartyTypeKind.ZodDefault
    });
  }
  brand() {
    return new ZodBranded({
      typeName: ZodFirstPartyTypeKind.ZodBranded,
      type: this,
      ...processCreateParams(this._def)
    });
  }
  catch(def) {
    const catchValueFunc = typeof def === "function" ? def : () => def;
    return new ZodCatch({
      ...processCreateParams(this._def),
      innerType: this,
      catchValue: catchValueFunc,
      typeName: ZodFirstPartyTypeKind.ZodCatch
    });
  }
  describe(description) {
    const This = this.constructor;
    return new This({
      ...this._def,
      description
    });
  }
  pipe(target) {
    return ZodPipeline.create(this, target);
  }
  readonly() {
    return ZodReadonly.create(this);
  }
  isOptional() {
    return this.safeParse(void 0).success;
  }
  isNullable() {
    return this.safeParse(null).success;
  }
};
__name(_ZodType, "ZodType");
var ZodType = _ZodType;
var cuidRegex = /^c[^\s-]{8,}$/i;
var cuid2Regex = /^[0-9a-z]+$/;
var ulidRegex = /^[0-9A-HJKMNP-TV-Z]{26}$/i;
var uuidRegex = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/i;
var nanoidRegex = /^[a-z0-9_-]{21}$/i;
var jwtRegex = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/;
var durationRegex = /^[-+]?P(?!$)(?:(?:[-+]?\d+Y)|(?:[-+]?\d+[.,]\d+Y$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:(?:[-+]?\d+W)|(?:[-+]?\d+[.,]\d+W$))?(?:(?:[-+]?\d+D)|(?:[-+]?\d+[.,]\d+D$))?(?:T(?=[\d+-])(?:(?:[-+]?\d+H)|(?:[-+]?\d+[.,]\d+H$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:[-+]?\d+(?:[.,]\d+)?S)?)??$/;
var emailRegex = /^(?!\.)(?!.*\.\.)([A-Z0-9_'+\-\.]*)[A-Z0-9_+-]@([A-Z0-9][A-Z0-9\-]*\.)+[A-Z]{2,}$/i;
var _emojiRegex = `^(\\p{Extended_Pictographic}|\\p{Emoji_Component})+$`;
var emojiRegex;
var ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/;
var ipv4CidrRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/(3[0-2]|[12]?[0-9])$/;
var ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;
var ipv6CidrRegex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/;
var base64Regex = /^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/;
var base64urlRegex = /^([0-9a-zA-Z-_]{4})*(([0-9a-zA-Z-_]{2}(==)?)|([0-9a-zA-Z-_]{3}(=)?))?$/;
var dateRegexSource = `((\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-((0[13578]|1[02])-(0[1-9]|[12]\\d|3[01])|(0[469]|11)-(0[1-9]|[12]\\d|30)|(02)-(0[1-9]|1\\d|2[0-8])))`;
var dateRegex = new RegExp(`^${dateRegexSource}$`);
function timeRegexSource(args) {
  let regex = `([01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d`;
  if (args.precision) {
    regex = `${regex}\\.\\d{${args.precision}}`;
  } else if (args.precision == null) {
    regex = `${regex}(\\.\\d+)?`;
  }
  return regex;
}
__name(timeRegexSource, "timeRegexSource");
function timeRegex(args) {
  return new RegExp(`^${timeRegexSource(args)}$`);
}
__name(timeRegex, "timeRegex");
function datetimeRegex(args) {
  let regex = `${dateRegexSource}T${timeRegexSource(args)}`;
  const opts = [];
  opts.push(args.local ? `Z?` : `Z`);
  if (args.offset)
    opts.push(`([+-]\\d{2}:?\\d{2})`);
  regex = `${regex}(${opts.join("|")})`;
  return new RegExp(`^${regex}$`);
}
__name(datetimeRegex, "datetimeRegex");
function isValidIP(ip, version) {
  if ((version === "v4" || !version) && ipv4Regex.test(ip)) {
    return true;
  }
  if ((version === "v6" || !version) && ipv6Regex.test(ip)) {
    return true;
  }
  return false;
}
__name(isValidIP, "isValidIP");
function isValidJWT(jwt2, alg) {
  if (!jwtRegex.test(jwt2))
    return false;
  try {
    const [header] = jwt2.split(".");
    const base64 = header.replace(/-/g, "+").replace(/_/g, "/").padEnd(header.length + (4 - header.length % 4) % 4, "=");
    const decoded = JSON.parse(atob(base64));
    if (typeof decoded !== "object" || decoded === null)
      return false;
    if (!decoded.typ || !decoded.alg)
      return false;
    if (alg && decoded.alg !== alg)
      return false;
    return true;
  } catch (_a) {
    return false;
  }
}
__name(isValidJWT, "isValidJWT");
function isValidCidr(ip, version) {
  if ((version === "v4" || !version) && ipv4CidrRegex.test(ip)) {
    return true;
  }
  if ((version === "v6" || !version) && ipv6CidrRegex.test(ip)) {
    return true;
  }
  return false;
}
__name(isValidCidr, "isValidCidr");
var _ZodString = class _ZodString extends ZodType {
  _parse(input) {
    if (this._def.coerce) {
      input.data = String(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.string) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.string,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    const status = new ParseStatus();
    let ctx = void 0;
    for (const check of this._def.checks) {
      if (check.kind === "min") {
        if (input.data.length < check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            minimum: check.value,
            type: "string",
            inclusive: true,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        if (input.data.length > check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            maximum: check.value,
            type: "string",
            inclusive: true,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "length") {
        const tooBig = input.data.length > check.value;
        const tooSmall = input.data.length < check.value;
        if (tooBig || tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          if (tooBig) {
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_big,
              maximum: check.value,
              type: "string",
              inclusive: true,
              exact: true,
              message: check.message
            });
          } else if (tooSmall) {
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_small,
              minimum: check.value,
              type: "string",
              inclusive: true,
              exact: true,
              message: check.message
            });
          }
          status.dirty();
        }
      } else if (check.kind === "email") {
        if (!emailRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "email",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "emoji") {
        if (!emojiRegex) {
          emojiRegex = new RegExp(_emojiRegex, "u");
        }
        if (!emojiRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "emoji",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "uuid") {
        if (!uuidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "uuid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "nanoid") {
        if (!nanoidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "nanoid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "cuid") {
        if (!cuidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "cuid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "cuid2") {
        if (!cuid2Regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "cuid2",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "ulid") {
        if (!ulidRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "ulid",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "url") {
        try {
          new URL(input.data);
        } catch (_a) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "url",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "regex") {
        check.regex.lastIndex = 0;
        const testResult = check.regex.test(input.data);
        if (!testResult) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "regex",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "trim") {
        input.data = input.data.trim();
      } else if (check.kind === "includes") {
        if (!input.data.includes(check.value, check.position)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: { includes: check.value, position: check.position },
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "toLowerCase") {
        input.data = input.data.toLowerCase();
      } else if (check.kind === "toUpperCase") {
        input.data = input.data.toUpperCase();
      } else if (check.kind === "startsWith") {
        if (!input.data.startsWith(check.value)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: { startsWith: check.value },
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "endsWith") {
        if (!input.data.endsWith(check.value)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: { endsWith: check.value },
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "datetime") {
        const regex = datetimeRegex(check);
        if (!regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: "datetime",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "date") {
        const regex = dateRegex;
        if (!regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: "date",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "time") {
        const regex = timeRegex(check);
        if (!regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_string,
            validation: "time",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "duration") {
        if (!durationRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "duration",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "ip") {
        if (!isValidIP(input.data, check.version)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "ip",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "jwt") {
        if (!isValidJWT(input.data, check.alg)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "jwt",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "cidr") {
        if (!isValidCidr(input.data, check.version)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "cidr",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "base64") {
        if (!base64Regex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "base64",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "base64url") {
        if (!base64urlRegex.test(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            validation: "base64url",
            code: ZodIssueCode.invalid_string,
            message: check.message
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return { status: status.value, value: input.data };
  }
  _regex(regex, validation, message) {
    return this.refinement((data) => regex.test(data), {
      validation,
      code: ZodIssueCode.invalid_string,
      ...errorUtil.errToObj(message)
    });
  }
  _addCheck(check) {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  email(message) {
    return this._addCheck({ kind: "email", ...errorUtil.errToObj(message) });
  }
  url(message) {
    return this._addCheck({ kind: "url", ...errorUtil.errToObj(message) });
  }
  emoji(message) {
    return this._addCheck({ kind: "emoji", ...errorUtil.errToObj(message) });
  }
  uuid(message) {
    return this._addCheck({ kind: "uuid", ...errorUtil.errToObj(message) });
  }
  nanoid(message) {
    return this._addCheck({ kind: "nanoid", ...errorUtil.errToObj(message) });
  }
  cuid(message) {
    return this._addCheck({ kind: "cuid", ...errorUtil.errToObj(message) });
  }
  cuid2(message) {
    return this._addCheck({ kind: "cuid2", ...errorUtil.errToObj(message) });
  }
  ulid(message) {
    return this._addCheck({ kind: "ulid", ...errorUtil.errToObj(message) });
  }
  base64(message) {
    return this._addCheck({ kind: "base64", ...errorUtil.errToObj(message) });
  }
  base64url(message) {
    return this._addCheck({
      kind: "base64url",
      ...errorUtil.errToObj(message)
    });
  }
  jwt(options) {
    return this._addCheck({ kind: "jwt", ...errorUtil.errToObj(options) });
  }
  ip(options) {
    return this._addCheck({ kind: "ip", ...errorUtil.errToObj(options) });
  }
  cidr(options) {
    return this._addCheck({ kind: "cidr", ...errorUtil.errToObj(options) });
  }
  datetime(options) {
    var _a, _b;
    if (typeof options === "string") {
      return this._addCheck({
        kind: "datetime",
        precision: null,
        offset: false,
        local: false,
        message: options
      });
    }
    return this._addCheck({
      kind: "datetime",
      precision: typeof (options === null || options === void 0 ? void 0 : options.precision) === "undefined" ? null : options === null || options === void 0 ? void 0 : options.precision,
      offset: (_a = options === null || options === void 0 ? void 0 : options.offset) !== null && _a !== void 0 ? _a : false,
      local: (_b = options === null || options === void 0 ? void 0 : options.local) !== null && _b !== void 0 ? _b : false,
      ...errorUtil.errToObj(options === null || options === void 0 ? void 0 : options.message)
    });
  }
  date(message) {
    return this._addCheck({ kind: "date", message });
  }
  time(options) {
    if (typeof options === "string") {
      return this._addCheck({
        kind: "time",
        precision: null,
        message: options
      });
    }
    return this._addCheck({
      kind: "time",
      precision: typeof (options === null || options === void 0 ? void 0 : options.precision) === "undefined" ? null : options === null || options === void 0 ? void 0 : options.precision,
      ...errorUtil.errToObj(options === null || options === void 0 ? void 0 : options.message)
    });
  }
  duration(message) {
    return this._addCheck({ kind: "duration", ...errorUtil.errToObj(message) });
  }
  regex(regex, message) {
    return this._addCheck({
      kind: "regex",
      regex,
      ...errorUtil.errToObj(message)
    });
  }
  includes(value, options) {
    return this._addCheck({
      kind: "includes",
      value,
      position: options === null || options === void 0 ? void 0 : options.position,
      ...errorUtil.errToObj(options === null || options === void 0 ? void 0 : options.message)
    });
  }
  startsWith(value, message) {
    return this._addCheck({
      kind: "startsWith",
      value,
      ...errorUtil.errToObj(message)
    });
  }
  endsWith(value, message) {
    return this._addCheck({
      kind: "endsWith",
      value,
      ...errorUtil.errToObj(message)
    });
  }
  min(minLength, message) {
    return this._addCheck({
      kind: "min",
      value: minLength,
      ...errorUtil.errToObj(message)
    });
  }
  max(maxLength, message) {
    return this._addCheck({
      kind: "max",
      value: maxLength,
      ...errorUtil.errToObj(message)
    });
  }
  length(len, message) {
    return this._addCheck({
      kind: "length",
      value: len,
      ...errorUtil.errToObj(message)
    });
  }
  /**
   * Equivalent to `.min(1)`
   */
  nonempty(message) {
    return this.min(1, errorUtil.errToObj(message));
  }
  trim() {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, { kind: "trim" }]
    });
  }
  toLowerCase() {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, { kind: "toLowerCase" }]
    });
  }
  toUpperCase() {
    return new _ZodString({
      ...this._def,
      checks: [...this._def.checks, { kind: "toUpperCase" }]
    });
  }
  get isDatetime() {
    return !!this._def.checks.find((ch) => ch.kind === "datetime");
  }
  get isDate() {
    return !!this._def.checks.find((ch) => ch.kind === "date");
  }
  get isTime() {
    return !!this._def.checks.find((ch) => ch.kind === "time");
  }
  get isDuration() {
    return !!this._def.checks.find((ch) => ch.kind === "duration");
  }
  get isEmail() {
    return !!this._def.checks.find((ch) => ch.kind === "email");
  }
  get isURL() {
    return !!this._def.checks.find((ch) => ch.kind === "url");
  }
  get isEmoji() {
    return !!this._def.checks.find((ch) => ch.kind === "emoji");
  }
  get isUUID() {
    return !!this._def.checks.find((ch) => ch.kind === "uuid");
  }
  get isNANOID() {
    return !!this._def.checks.find((ch) => ch.kind === "nanoid");
  }
  get isCUID() {
    return !!this._def.checks.find((ch) => ch.kind === "cuid");
  }
  get isCUID2() {
    return !!this._def.checks.find((ch) => ch.kind === "cuid2");
  }
  get isULID() {
    return !!this._def.checks.find((ch) => ch.kind === "ulid");
  }
  get isIP() {
    return !!this._def.checks.find((ch) => ch.kind === "ip");
  }
  get isCIDR() {
    return !!this._def.checks.find((ch) => ch.kind === "cidr");
  }
  get isBase64() {
    return !!this._def.checks.find((ch) => ch.kind === "base64");
  }
  get isBase64url() {
    return !!this._def.checks.find((ch) => ch.kind === "base64url");
  }
  get minLength() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min;
  }
  get maxLength() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max;
  }
};
__name(_ZodString, "ZodString");
var ZodString = _ZodString;
ZodString.create = (params) => {
  var _a;
  return new ZodString({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodString,
    coerce: (_a = params === null || params === void 0 ? void 0 : params.coerce) !== null && _a !== void 0 ? _a : false,
    ...processCreateParams(params)
  });
};
function floatSafeRemainder(val, step) {
  const valDecCount = (val.toString().split(".")[1] || "").length;
  const stepDecCount = (step.toString().split(".")[1] || "").length;
  const decCount = valDecCount > stepDecCount ? valDecCount : stepDecCount;
  const valInt = parseInt(val.toFixed(decCount).replace(".", ""));
  const stepInt = parseInt(step.toFixed(decCount).replace(".", ""));
  return valInt % stepInt / Math.pow(10, decCount);
}
__name(floatSafeRemainder, "floatSafeRemainder");
var _ZodNumber = class _ZodNumber extends ZodType {
  constructor() {
    super(...arguments);
    this.min = this.gte;
    this.max = this.lte;
    this.step = this.multipleOf;
  }
  _parse(input) {
    if (this._def.coerce) {
      input.data = Number(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.number) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.number,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    let ctx = void 0;
    const status = new ParseStatus();
    for (const check of this._def.checks) {
      if (check.kind === "int") {
        if (!util.isInteger(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_type,
            expected: "integer",
            received: "float",
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "min") {
        const tooSmall = check.inclusive ? input.data < check.value : input.data <= check.value;
        if (tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            minimum: check.value,
            type: "number",
            inclusive: check.inclusive,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        const tooBig = check.inclusive ? input.data > check.value : input.data >= check.value;
        if (tooBig) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            maximum: check.value,
            type: "number",
            inclusive: check.inclusive,
            exact: false,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "multipleOf") {
        if (floatSafeRemainder(input.data, check.value) !== 0) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.not_multiple_of,
            multipleOf: check.value,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "finite") {
        if (!Number.isFinite(input.data)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.not_finite,
            message: check.message
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return { status: status.value, value: input.data };
  }
  gte(value, message) {
    return this.setLimit("min", value, true, errorUtil.toString(message));
  }
  gt(value, message) {
    return this.setLimit("min", value, false, errorUtil.toString(message));
  }
  lte(value, message) {
    return this.setLimit("max", value, true, errorUtil.toString(message));
  }
  lt(value, message) {
    return this.setLimit("max", value, false, errorUtil.toString(message));
  }
  setLimit(kind, value, inclusive, message) {
    return new _ZodNumber({
      ...this._def,
      checks: [
        ...this._def.checks,
        {
          kind,
          value,
          inclusive,
          message: errorUtil.toString(message)
        }
      ]
    });
  }
  _addCheck(check) {
    return new _ZodNumber({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  int(message) {
    return this._addCheck({
      kind: "int",
      message: errorUtil.toString(message)
    });
  }
  positive(message) {
    return this._addCheck({
      kind: "min",
      value: 0,
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  negative(message) {
    return this._addCheck({
      kind: "max",
      value: 0,
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  nonpositive(message) {
    return this._addCheck({
      kind: "max",
      value: 0,
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  nonnegative(message) {
    return this._addCheck({
      kind: "min",
      value: 0,
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  multipleOf(value, message) {
    return this._addCheck({
      kind: "multipleOf",
      value,
      message: errorUtil.toString(message)
    });
  }
  finite(message) {
    return this._addCheck({
      kind: "finite",
      message: errorUtil.toString(message)
    });
  }
  safe(message) {
    return this._addCheck({
      kind: "min",
      inclusive: true,
      value: Number.MIN_SAFE_INTEGER,
      message: errorUtil.toString(message)
    })._addCheck({
      kind: "max",
      inclusive: true,
      value: Number.MAX_SAFE_INTEGER,
      message: errorUtil.toString(message)
    });
  }
  get minValue() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min;
  }
  get maxValue() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max;
  }
  get isInt() {
    return !!this._def.checks.find((ch) => ch.kind === "int" || ch.kind === "multipleOf" && util.isInteger(ch.value));
  }
  get isFinite() {
    let max = null, min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "finite" || ch.kind === "int" || ch.kind === "multipleOf") {
        return true;
      } else if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      } else if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return Number.isFinite(min) && Number.isFinite(max);
  }
};
__name(_ZodNumber, "ZodNumber");
var ZodNumber = _ZodNumber;
ZodNumber.create = (params) => {
  return new ZodNumber({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodNumber,
    coerce: (params === null || params === void 0 ? void 0 : params.coerce) || false,
    ...processCreateParams(params)
  });
};
var _ZodBigInt = class _ZodBigInt extends ZodType {
  constructor() {
    super(...arguments);
    this.min = this.gte;
    this.max = this.lte;
  }
  _parse(input) {
    if (this._def.coerce) {
      try {
        input.data = BigInt(input.data);
      } catch (_a) {
        return this._getInvalidInput(input);
      }
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.bigint) {
      return this._getInvalidInput(input);
    }
    let ctx = void 0;
    const status = new ParseStatus();
    for (const check of this._def.checks) {
      if (check.kind === "min") {
        const tooSmall = check.inclusive ? input.data < check.value : input.data <= check.value;
        if (tooSmall) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            type: "bigint",
            minimum: check.value,
            inclusive: check.inclusive,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        const tooBig = check.inclusive ? input.data > check.value : input.data >= check.value;
        if (tooBig) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            type: "bigint",
            maximum: check.value,
            inclusive: check.inclusive,
            message: check.message
          });
          status.dirty();
        }
      } else if (check.kind === "multipleOf") {
        if (input.data % check.value !== BigInt(0)) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.not_multiple_of,
            multipleOf: check.value,
            message: check.message
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return { status: status.value, value: input.data };
  }
  _getInvalidInput(input) {
    const ctx = this._getOrReturnCtx(input);
    addIssueToContext(ctx, {
      code: ZodIssueCode.invalid_type,
      expected: ZodParsedType.bigint,
      received: ctx.parsedType
    });
    return INVALID;
  }
  gte(value, message) {
    return this.setLimit("min", value, true, errorUtil.toString(message));
  }
  gt(value, message) {
    return this.setLimit("min", value, false, errorUtil.toString(message));
  }
  lte(value, message) {
    return this.setLimit("max", value, true, errorUtil.toString(message));
  }
  lt(value, message) {
    return this.setLimit("max", value, false, errorUtil.toString(message));
  }
  setLimit(kind, value, inclusive, message) {
    return new _ZodBigInt({
      ...this._def,
      checks: [
        ...this._def.checks,
        {
          kind,
          value,
          inclusive,
          message: errorUtil.toString(message)
        }
      ]
    });
  }
  _addCheck(check) {
    return new _ZodBigInt({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  positive(message) {
    return this._addCheck({
      kind: "min",
      value: BigInt(0),
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  negative(message) {
    return this._addCheck({
      kind: "max",
      value: BigInt(0),
      inclusive: false,
      message: errorUtil.toString(message)
    });
  }
  nonpositive(message) {
    return this._addCheck({
      kind: "max",
      value: BigInt(0),
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  nonnegative(message) {
    return this._addCheck({
      kind: "min",
      value: BigInt(0),
      inclusive: true,
      message: errorUtil.toString(message)
    });
  }
  multipleOf(value, message) {
    return this._addCheck({
      kind: "multipleOf",
      value,
      message: errorUtil.toString(message)
    });
  }
  get minValue() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min;
  }
  get maxValue() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max;
  }
};
__name(_ZodBigInt, "ZodBigInt");
var ZodBigInt = _ZodBigInt;
ZodBigInt.create = (params) => {
  var _a;
  return new ZodBigInt({
    checks: [],
    typeName: ZodFirstPartyTypeKind.ZodBigInt,
    coerce: (_a = params === null || params === void 0 ? void 0 : params.coerce) !== null && _a !== void 0 ? _a : false,
    ...processCreateParams(params)
  });
};
var _ZodBoolean = class _ZodBoolean extends ZodType {
  _parse(input) {
    if (this._def.coerce) {
      input.data = Boolean(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.boolean) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.boolean,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
__name(_ZodBoolean, "ZodBoolean");
var ZodBoolean = _ZodBoolean;
ZodBoolean.create = (params) => {
  return new ZodBoolean({
    typeName: ZodFirstPartyTypeKind.ZodBoolean,
    coerce: (params === null || params === void 0 ? void 0 : params.coerce) || false,
    ...processCreateParams(params)
  });
};
var _ZodDate = class _ZodDate extends ZodType {
  _parse(input) {
    if (this._def.coerce) {
      input.data = new Date(input.data);
    }
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.date) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.date,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    if (isNaN(input.data.getTime())) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_date
      });
      return INVALID;
    }
    const status = new ParseStatus();
    let ctx = void 0;
    for (const check of this._def.checks) {
      if (check.kind === "min") {
        if (input.data.getTime() < check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            message: check.message,
            inclusive: true,
            exact: false,
            minimum: check.value,
            type: "date"
          });
          status.dirty();
        }
      } else if (check.kind === "max") {
        if (input.data.getTime() > check.value) {
          ctx = this._getOrReturnCtx(input, ctx);
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            message: check.message,
            inclusive: true,
            exact: false,
            maximum: check.value,
            type: "date"
          });
          status.dirty();
        }
      } else {
        util.assertNever(check);
      }
    }
    return {
      status: status.value,
      value: new Date(input.data.getTime())
    };
  }
  _addCheck(check) {
    return new _ZodDate({
      ...this._def,
      checks: [...this._def.checks, check]
    });
  }
  min(minDate, message) {
    return this._addCheck({
      kind: "min",
      value: minDate.getTime(),
      message: errorUtil.toString(message)
    });
  }
  max(maxDate, message) {
    return this._addCheck({
      kind: "max",
      value: maxDate.getTime(),
      message: errorUtil.toString(message)
    });
  }
  get minDate() {
    let min = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "min") {
        if (min === null || ch.value > min)
          min = ch.value;
      }
    }
    return min != null ? new Date(min) : null;
  }
  get maxDate() {
    let max = null;
    for (const ch of this._def.checks) {
      if (ch.kind === "max") {
        if (max === null || ch.value < max)
          max = ch.value;
      }
    }
    return max != null ? new Date(max) : null;
  }
};
__name(_ZodDate, "ZodDate");
var ZodDate = _ZodDate;
ZodDate.create = (params) => {
  return new ZodDate({
    checks: [],
    coerce: (params === null || params === void 0 ? void 0 : params.coerce) || false,
    typeName: ZodFirstPartyTypeKind.ZodDate,
    ...processCreateParams(params)
  });
};
var _ZodSymbol = class _ZodSymbol extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.symbol) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.symbol,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
__name(_ZodSymbol, "ZodSymbol");
var ZodSymbol = _ZodSymbol;
ZodSymbol.create = (params) => {
  return new ZodSymbol({
    typeName: ZodFirstPartyTypeKind.ZodSymbol,
    ...processCreateParams(params)
  });
};
var _ZodUndefined = class _ZodUndefined extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.undefined) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.undefined,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
__name(_ZodUndefined, "ZodUndefined");
var ZodUndefined = _ZodUndefined;
ZodUndefined.create = (params) => {
  return new ZodUndefined({
    typeName: ZodFirstPartyTypeKind.ZodUndefined,
    ...processCreateParams(params)
  });
};
var _ZodNull = class _ZodNull extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.null) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.null,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
__name(_ZodNull, "ZodNull");
var ZodNull = _ZodNull;
ZodNull.create = (params) => {
  return new ZodNull({
    typeName: ZodFirstPartyTypeKind.ZodNull,
    ...processCreateParams(params)
  });
};
var _ZodAny = class _ZodAny extends ZodType {
  constructor() {
    super(...arguments);
    this._any = true;
  }
  _parse(input) {
    return OK(input.data);
  }
};
__name(_ZodAny, "ZodAny");
var ZodAny = _ZodAny;
ZodAny.create = (params) => {
  return new ZodAny({
    typeName: ZodFirstPartyTypeKind.ZodAny,
    ...processCreateParams(params)
  });
};
var _ZodUnknown = class _ZodUnknown extends ZodType {
  constructor() {
    super(...arguments);
    this._unknown = true;
  }
  _parse(input) {
    return OK(input.data);
  }
};
__name(_ZodUnknown, "ZodUnknown");
var ZodUnknown = _ZodUnknown;
ZodUnknown.create = (params) => {
  return new ZodUnknown({
    typeName: ZodFirstPartyTypeKind.ZodUnknown,
    ...processCreateParams(params)
  });
};
var _ZodNever = class _ZodNever extends ZodType {
  _parse(input) {
    const ctx = this._getOrReturnCtx(input);
    addIssueToContext(ctx, {
      code: ZodIssueCode.invalid_type,
      expected: ZodParsedType.never,
      received: ctx.parsedType
    });
    return INVALID;
  }
};
__name(_ZodNever, "ZodNever");
var ZodNever = _ZodNever;
ZodNever.create = (params) => {
  return new ZodNever({
    typeName: ZodFirstPartyTypeKind.ZodNever,
    ...processCreateParams(params)
  });
};
var _ZodVoid = class _ZodVoid extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.undefined) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.void,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return OK(input.data);
  }
};
__name(_ZodVoid, "ZodVoid");
var ZodVoid = _ZodVoid;
ZodVoid.create = (params) => {
  return new ZodVoid({
    typeName: ZodFirstPartyTypeKind.ZodVoid,
    ...processCreateParams(params)
  });
};
var _ZodArray = class _ZodArray extends ZodType {
  _parse(input) {
    const { ctx, status } = this._processInputParams(input);
    const def = this._def;
    if (ctx.parsedType !== ZodParsedType.array) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.array,
        received: ctx.parsedType
      });
      return INVALID;
    }
    if (def.exactLength !== null) {
      const tooBig = ctx.data.length > def.exactLength.value;
      const tooSmall = ctx.data.length < def.exactLength.value;
      if (tooBig || tooSmall) {
        addIssueToContext(ctx, {
          code: tooBig ? ZodIssueCode.too_big : ZodIssueCode.too_small,
          minimum: tooSmall ? def.exactLength.value : void 0,
          maximum: tooBig ? def.exactLength.value : void 0,
          type: "array",
          inclusive: true,
          exact: true,
          message: def.exactLength.message
        });
        status.dirty();
      }
    }
    if (def.minLength !== null) {
      if (ctx.data.length < def.minLength.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_small,
          minimum: def.minLength.value,
          type: "array",
          inclusive: true,
          exact: false,
          message: def.minLength.message
        });
        status.dirty();
      }
    }
    if (def.maxLength !== null) {
      if (ctx.data.length > def.maxLength.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_big,
          maximum: def.maxLength.value,
          type: "array",
          inclusive: true,
          exact: false,
          message: def.maxLength.message
        });
        status.dirty();
      }
    }
    if (ctx.common.async) {
      return Promise.all([...ctx.data].map((item, i) => {
        return def.type._parseAsync(new ParseInputLazyPath(ctx, item, ctx.path, i));
      })).then((result2) => {
        return ParseStatus.mergeArray(status, result2);
      });
    }
    const result = [...ctx.data].map((item, i) => {
      return def.type._parseSync(new ParseInputLazyPath(ctx, item, ctx.path, i));
    });
    return ParseStatus.mergeArray(status, result);
  }
  get element() {
    return this._def.type;
  }
  min(minLength, message) {
    return new _ZodArray({
      ...this._def,
      minLength: { value: minLength, message: errorUtil.toString(message) }
    });
  }
  max(maxLength, message) {
    return new _ZodArray({
      ...this._def,
      maxLength: { value: maxLength, message: errorUtil.toString(message) }
    });
  }
  length(len, message) {
    return new _ZodArray({
      ...this._def,
      exactLength: { value: len, message: errorUtil.toString(message) }
    });
  }
  nonempty(message) {
    return this.min(1, message);
  }
};
__name(_ZodArray, "ZodArray");
var ZodArray = _ZodArray;
ZodArray.create = (schema, params) => {
  return new ZodArray({
    type: schema,
    minLength: null,
    maxLength: null,
    exactLength: null,
    typeName: ZodFirstPartyTypeKind.ZodArray,
    ...processCreateParams(params)
  });
};
function deepPartialify(schema) {
  if (schema instanceof ZodObject) {
    const newShape = {};
    for (const key in schema.shape) {
      const fieldSchema = schema.shape[key];
      newShape[key] = ZodOptional.create(deepPartialify(fieldSchema));
    }
    return new ZodObject({
      ...schema._def,
      shape: /* @__PURE__ */ __name(() => newShape, "shape")
    });
  } else if (schema instanceof ZodArray) {
    return new ZodArray({
      ...schema._def,
      type: deepPartialify(schema.element)
    });
  } else if (schema instanceof ZodOptional) {
    return ZodOptional.create(deepPartialify(schema.unwrap()));
  } else if (schema instanceof ZodNullable) {
    return ZodNullable.create(deepPartialify(schema.unwrap()));
  } else if (schema instanceof ZodTuple) {
    return ZodTuple.create(schema.items.map((item) => deepPartialify(item)));
  } else {
    return schema;
  }
}
__name(deepPartialify, "deepPartialify");
var _ZodObject = class _ZodObject extends ZodType {
  constructor() {
    super(...arguments);
    this._cached = null;
    this.nonstrict = this.passthrough;
    this.augment = this.extend;
  }
  _getCached() {
    if (this._cached !== null)
      return this._cached;
    const shape = this._def.shape();
    const keys = util.objectKeys(shape);
    return this._cached = { shape, keys };
  }
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.object) {
      const ctx2 = this._getOrReturnCtx(input);
      addIssueToContext(ctx2, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.object,
        received: ctx2.parsedType
      });
      return INVALID;
    }
    const { status, ctx } = this._processInputParams(input);
    const { shape, keys: shapeKeys } = this._getCached();
    const extraKeys = [];
    if (!(this._def.catchall instanceof ZodNever && this._def.unknownKeys === "strip")) {
      for (const key in ctx.data) {
        if (!shapeKeys.includes(key)) {
          extraKeys.push(key);
        }
      }
    }
    const pairs = [];
    for (const key of shapeKeys) {
      const keyValidator = shape[key];
      const value = ctx.data[key];
      pairs.push({
        key: { status: "valid", value: key },
        value: keyValidator._parse(new ParseInputLazyPath(ctx, value, ctx.path, key)),
        alwaysSet: key in ctx.data
      });
    }
    if (this._def.catchall instanceof ZodNever) {
      const unknownKeys = this._def.unknownKeys;
      if (unknownKeys === "passthrough") {
        for (const key of extraKeys) {
          pairs.push({
            key: { status: "valid", value: key },
            value: { status: "valid", value: ctx.data[key] }
          });
        }
      } else if (unknownKeys === "strict") {
        if (extraKeys.length > 0) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.unrecognized_keys,
            keys: extraKeys
          });
          status.dirty();
        }
      } else if (unknownKeys === "strip") ;
      else {
        throw new Error(`Internal ZodObject error: invalid unknownKeys value.`);
      }
    } else {
      const catchall = this._def.catchall;
      for (const key of extraKeys) {
        const value = ctx.data[key];
        pairs.push({
          key: { status: "valid", value: key },
          value: catchall._parse(
            new ParseInputLazyPath(ctx, value, ctx.path, key)
            //, ctx.child(key), value, getParsedType(value)
          ),
          alwaysSet: key in ctx.data
        });
      }
    }
    if (ctx.common.async) {
      return Promise.resolve().then(async () => {
        const syncPairs = [];
        for (const pair of pairs) {
          const key = await pair.key;
          const value = await pair.value;
          syncPairs.push({
            key,
            value,
            alwaysSet: pair.alwaysSet
          });
        }
        return syncPairs;
      }).then((syncPairs) => {
        return ParseStatus.mergeObjectSync(status, syncPairs);
      });
    } else {
      return ParseStatus.mergeObjectSync(status, pairs);
    }
  }
  get shape() {
    return this._def.shape();
  }
  strict(message) {
    errorUtil.errToObj;
    return new _ZodObject({
      ...this._def,
      unknownKeys: "strict",
      ...message !== void 0 ? {
        errorMap: /* @__PURE__ */ __name((issue, ctx) => {
          var _a, _b, _c, _d;
          const defaultError = (_c = (_b = (_a = this._def).errorMap) === null || _b === void 0 ? void 0 : _b.call(_a, issue, ctx).message) !== null && _c !== void 0 ? _c : ctx.defaultError;
          if (issue.code === "unrecognized_keys")
            return {
              message: (_d = errorUtil.errToObj(message).message) !== null && _d !== void 0 ? _d : defaultError
            };
          return {
            message: defaultError
          };
        }, "errorMap")
      } : {}
    });
  }
  strip() {
    return new _ZodObject({
      ...this._def,
      unknownKeys: "strip"
    });
  }
  passthrough() {
    return new _ZodObject({
      ...this._def,
      unknownKeys: "passthrough"
    });
  }
  // const AugmentFactory =
  //   <Def extends ZodObjectDef>(def: Def) =>
  //   <Augmentation extends ZodRawShape>(
  //     augmentation: Augmentation
  //   ): ZodObject<
  //     extendShape<ReturnType<Def["shape"]>, Augmentation>,
  //     Def["unknownKeys"],
  //     Def["catchall"]
  //   > => {
  //     return new ZodObject({
  //       ...def,
  //       shape: () => ({
  //         ...def.shape(),
  //         ...augmentation,
  //       }),
  //     }) as any;
  //   };
  extend(augmentation) {
    return new _ZodObject({
      ...this._def,
      shape: /* @__PURE__ */ __name(() => ({
        ...this._def.shape(),
        ...augmentation
      }), "shape")
    });
  }
  /**
   * Prior to zod@1.0.12 there was a bug in the
   * inferred type of merged objects. Please
   * upgrade if you are experiencing issues.
   */
  merge(merging) {
    const merged = new _ZodObject({
      unknownKeys: merging._def.unknownKeys,
      catchall: merging._def.catchall,
      shape: /* @__PURE__ */ __name(() => ({
        ...this._def.shape(),
        ...merging._def.shape()
      }), "shape"),
      typeName: ZodFirstPartyTypeKind.ZodObject
    });
    return merged;
  }
  // merge<
  //   Incoming extends AnyZodObject,
  //   Augmentation extends Incoming["shape"],
  //   NewOutput extends {
  //     [k in keyof Augmentation | keyof Output]: k extends keyof Augmentation
  //       ? Augmentation[k]["_output"]
  //       : k extends keyof Output
  //       ? Output[k]
  //       : never;
  //   },
  //   NewInput extends {
  //     [k in keyof Augmentation | keyof Input]: k extends keyof Augmentation
  //       ? Augmentation[k]["_input"]
  //       : k extends keyof Input
  //       ? Input[k]
  //       : never;
  //   }
  // >(
  //   merging: Incoming
  // ): ZodObject<
  //   extendShape<T, ReturnType<Incoming["_def"]["shape"]>>,
  //   Incoming["_def"]["unknownKeys"],
  //   Incoming["_def"]["catchall"],
  //   NewOutput,
  //   NewInput
  // > {
  //   const merged: any = new ZodObject({
  //     unknownKeys: merging._def.unknownKeys,
  //     catchall: merging._def.catchall,
  //     shape: () =>
  //       objectUtil.mergeShapes(this._def.shape(), merging._def.shape()),
  //     typeName: ZodFirstPartyTypeKind.ZodObject,
  //   }) as any;
  //   return merged;
  // }
  setKey(key, schema) {
    return this.augment({ [key]: schema });
  }
  // merge<Incoming extends AnyZodObject>(
  //   merging: Incoming
  // ): //ZodObject<T & Incoming["_shape"], UnknownKeys, Catchall> = (merging) => {
  // ZodObject<
  //   extendShape<T, ReturnType<Incoming["_def"]["shape"]>>,
  //   Incoming["_def"]["unknownKeys"],
  //   Incoming["_def"]["catchall"]
  // > {
  //   // const mergedShape = objectUtil.mergeShapes(
  //   //   this._def.shape(),
  //   //   merging._def.shape()
  //   // );
  //   const merged: any = new ZodObject({
  //     unknownKeys: merging._def.unknownKeys,
  //     catchall: merging._def.catchall,
  //     shape: () =>
  //       objectUtil.mergeShapes(this._def.shape(), merging._def.shape()),
  //     typeName: ZodFirstPartyTypeKind.ZodObject,
  //   }) as any;
  //   return merged;
  // }
  catchall(index) {
    return new _ZodObject({
      ...this._def,
      catchall: index
    });
  }
  pick(mask) {
    const shape = {};
    util.objectKeys(mask).forEach((key) => {
      if (mask[key] && this.shape[key]) {
        shape[key] = this.shape[key];
      }
    });
    return new _ZodObject({
      ...this._def,
      shape: /* @__PURE__ */ __name(() => shape, "shape")
    });
  }
  omit(mask) {
    const shape = {};
    util.objectKeys(this.shape).forEach((key) => {
      if (!mask[key]) {
        shape[key] = this.shape[key];
      }
    });
    return new _ZodObject({
      ...this._def,
      shape: /* @__PURE__ */ __name(() => shape, "shape")
    });
  }
  /**
   * @deprecated
   */
  deepPartial() {
    return deepPartialify(this);
  }
  partial(mask) {
    const newShape = {};
    util.objectKeys(this.shape).forEach((key) => {
      const fieldSchema = this.shape[key];
      if (mask && !mask[key]) {
        newShape[key] = fieldSchema;
      } else {
        newShape[key] = fieldSchema.optional();
      }
    });
    return new _ZodObject({
      ...this._def,
      shape: /* @__PURE__ */ __name(() => newShape, "shape")
    });
  }
  required(mask) {
    const newShape = {};
    util.objectKeys(this.shape).forEach((key) => {
      if (mask && !mask[key]) {
        newShape[key] = this.shape[key];
      } else {
        const fieldSchema = this.shape[key];
        let newField = fieldSchema;
        while (newField instanceof ZodOptional) {
          newField = newField._def.innerType;
        }
        newShape[key] = newField;
      }
    });
    return new _ZodObject({
      ...this._def,
      shape: /* @__PURE__ */ __name(() => newShape, "shape")
    });
  }
  keyof() {
    return createZodEnum(util.objectKeys(this.shape));
  }
};
__name(_ZodObject, "ZodObject");
var ZodObject = _ZodObject;
ZodObject.create = (shape, params) => {
  return new ZodObject({
    shape: /* @__PURE__ */ __name(() => shape, "shape"),
    unknownKeys: "strip",
    catchall: ZodNever.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams(params)
  });
};
ZodObject.strictCreate = (shape, params) => {
  return new ZodObject({
    shape: /* @__PURE__ */ __name(() => shape, "shape"),
    unknownKeys: "strict",
    catchall: ZodNever.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams(params)
  });
};
ZodObject.lazycreate = (shape, params) => {
  return new ZodObject({
    shape,
    unknownKeys: "strip",
    catchall: ZodNever.create(),
    typeName: ZodFirstPartyTypeKind.ZodObject,
    ...processCreateParams(params)
  });
};
var _ZodUnion = class _ZodUnion extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const options = this._def.options;
    function handleResults(results) {
      for (const result of results) {
        if (result.result.status === "valid") {
          return result.result;
        }
      }
      for (const result of results) {
        if (result.result.status === "dirty") {
          ctx.common.issues.push(...result.ctx.common.issues);
          return result.result;
        }
      }
      const unionErrors = results.map((result) => new ZodError(result.ctx.common.issues));
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_union,
        unionErrors
      });
      return INVALID;
    }
    __name(handleResults, "handleResults");
    if (ctx.common.async) {
      return Promise.all(options.map(async (option) => {
        const childCtx = {
          ...ctx,
          common: {
            ...ctx.common,
            issues: []
          },
          parent: null
        };
        return {
          result: await option._parseAsync({
            data: ctx.data,
            path: ctx.path,
            parent: childCtx
          }),
          ctx: childCtx
        };
      })).then(handleResults);
    } else {
      let dirty = void 0;
      const issues = [];
      for (const option of options) {
        const childCtx = {
          ...ctx,
          common: {
            ...ctx.common,
            issues: []
          },
          parent: null
        };
        const result = option._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: childCtx
        });
        if (result.status === "valid") {
          return result;
        } else if (result.status === "dirty" && !dirty) {
          dirty = { result, ctx: childCtx };
        }
        if (childCtx.common.issues.length) {
          issues.push(childCtx.common.issues);
        }
      }
      if (dirty) {
        ctx.common.issues.push(...dirty.ctx.common.issues);
        return dirty.result;
      }
      const unionErrors = issues.map((issues2) => new ZodError(issues2));
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_union,
        unionErrors
      });
      return INVALID;
    }
  }
  get options() {
    return this._def.options;
  }
};
__name(_ZodUnion, "ZodUnion");
var ZodUnion = _ZodUnion;
ZodUnion.create = (types, params) => {
  return new ZodUnion({
    options: types,
    typeName: ZodFirstPartyTypeKind.ZodUnion,
    ...processCreateParams(params)
  });
};
var getDiscriminator = /* @__PURE__ */ __name((type) => {
  if (type instanceof ZodLazy) {
    return getDiscriminator(type.schema);
  } else if (type instanceof ZodEffects) {
    return getDiscriminator(type.innerType());
  } else if (type instanceof ZodLiteral) {
    return [type.value];
  } else if (type instanceof ZodEnum) {
    return type.options;
  } else if (type instanceof ZodNativeEnum) {
    return util.objectValues(type.enum);
  } else if (type instanceof ZodDefault) {
    return getDiscriminator(type._def.innerType);
  } else if (type instanceof ZodUndefined) {
    return [void 0];
  } else if (type instanceof ZodNull) {
    return [null];
  } else if (type instanceof ZodOptional) {
    return [void 0, ...getDiscriminator(type.unwrap())];
  } else if (type instanceof ZodNullable) {
    return [null, ...getDiscriminator(type.unwrap())];
  } else if (type instanceof ZodBranded) {
    return getDiscriminator(type.unwrap());
  } else if (type instanceof ZodReadonly) {
    return getDiscriminator(type.unwrap());
  } else if (type instanceof ZodCatch) {
    return getDiscriminator(type._def.innerType);
  } else {
    return [];
  }
}, "getDiscriminator");
var _ZodDiscriminatedUnion = class _ZodDiscriminatedUnion extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.object) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.object,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const discriminator = this.discriminator;
    const discriminatorValue = ctx.data[discriminator];
    const option = this.optionsMap.get(discriminatorValue);
    if (!option) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_union_discriminator,
        options: Array.from(this.optionsMap.keys()),
        path: [discriminator]
      });
      return INVALID;
    }
    if (ctx.common.async) {
      return option._parseAsync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      });
    } else {
      return option._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      });
    }
  }
  get discriminator() {
    return this._def.discriminator;
  }
  get options() {
    return this._def.options;
  }
  get optionsMap() {
    return this._def.optionsMap;
  }
  /**
   * The constructor of the discriminated union schema. Its behaviour is very similar to that of the normal z.union() constructor.
   * However, it only allows a union of objects, all of which need to share a discriminator property. This property must
   * have a different value for each object in the union.
   * @param discriminator the name of the discriminator property
   * @param types an array of object schemas
   * @param params
   */
  static create(discriminator, options, params) {
    const optionsMap = /* @__PURE__ */ new Map();
    for (const type of options) {
      const discriminatorValues = getDiscriminator(type.shape[discriminator]);
      if (!discriminatorValues.length) {
        throw new Error(`A discriminator value for key \`${discriminator}\` could not be extracted from all schema options`);
      }
      for (const value of discriminatorValues) {
        if (optionsMap.has(value)) {
          throw new Error(`Discriminator property ${String(discriminator)} has duplicate value ${String(value)}`);
        }
        optionsMap.set(value, type);
      }
    }
    return new _ZodDiscriminatedUnion({
      typeName: ZodFirstPartyTypeKind.ZodDiscriminatedUnion,
      discriminator,
      options,
      optionsMap,
      ...processCreateParams(params)
    });
  }
};
__name(_ZodDiscriminatedUnion, "ZodDiscriminatedUnion");
var ZodDiscriminatedUnion = _ZodDiscriminatedUnion;
function mergeValues(a, b) {
  const aType = getParsedType(a);
  const bType = getParsedType(b);
  if (a === b) {
    return { valid: true, data: a };
  } else if (aType === ZodParsedType.object && bType === ZodParsedType.object) {
    const bKeys = util.objectKeys(b);
    const sharedKeys = util.objectKeys(a).filter((key) => bKeys.indexOf(key) !== -1);
    const newObj = { ...a, ...b };
    for (const key of sharedKeys) {
      const sharedValue = mergeValues(a[key], b[key]);
      if (!sharedValue.valid) {
        return { valid: false };
      }
      newObj[key] = sharedValue.data;
    }
    return { valid: true, data: newObj };
  } else if (aType === ZodParsedType.array && bType === ZodParsedType.array) {
    if (a.length !== b.length) {
      return { valid: false };
    }
    const newArray = [];
    for (let index = 0; index < a.length; index++) {
      const itemA = a[index];
      const itemB = b[index];
      const sharedValue = mergeValues(itemA, itemB);
      if (!sharedValue.valid) {
        return { valid: false };
      }
      newArray.push(sharedValue.data);
    }
    return { valid: true, data: newArray };
  } else if (aType === ZodParsedType.date && bType === ZodParsedType.date && +a === +b) {
    return { valid: true, data: a };
  } else {
    return { valid: false };
  }
}
__name(mergeValues, "mergeValues");
var _ZodIntersection = class _ZodIntersection extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    const handleParsed = /* @__PURE__ */ __name((parsedLeft, parsedRight) => {
      if (isAborted(parsedLeft) || isAborted(parsedRight)) {
        return INVALID;
      }
      const merged = mergeValues(parsedLeft.value, parsedRight.value);
      if (!merged.valid) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_intersection_types
        });
        return INVALID;
      }
      if (isDirty(parsedLeft) || isDirty(parsedRight)) {
        status.dirty();
      }
      return { status: status.value, value: merged.data };
    }, "handleParsed");
    if (ctx.common.async) {
      return Promise.all([
        this._def.left._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        }),
        this._def.right._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        })
      ]).then(([left, right]) => handleParsed(left, right));
    } else {
      return handleParsed(this._def.left._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      }), this._def.right._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      }));
    }
  }
};
__name(_ZodIntersection, "ZodIntersection");
var ZodIntersection = _ZodIntersection;
ZodIntersection.create = (left, right, params) => {
  return new ZodIntersection({
    left,
    right,
    typeName: ZodFirstPartyTypeKind.ZodIntersection,
    ...processCreateParams(params)
  });
};
var _ZodTuple = class _ZodTuple extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.array) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.array,
        received: ctx.parsedType
      });
      return INVALID;
    }
    if (ctx.data.length < this._def.items.length) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.too_small,
        minimum: this._def.items.length,
        inclusive: true,
        exact: false,
        type: "array"
      });
      return INVALID;
    }
    const rest = this._def.rest;
    if (!rest && ctx.data.length > this._def.items.length) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.too_big,
        maximum: this._def.items.length,
        inclusive: true,
        exact: false,
        type: "array"
      });
      status.dirty();
    }
    const items = [...ctx.data].map((item, itemIndex) => {
      const schema = this._def.items[itemIndex] || this._def.rest;
      if (!schema)
        return null;
      return schema._parse(new ParseInputLazyPath(ctx, item, ctx.path, itemIndex));
    }).filter((x) => !!x);
    if (ctx.common.async) {
      return Promise.all(items).then((results) => {
        return ParseStatus.mergeArray(status, results);
      });
    } else {
      return ParseStatus.mergeArray(status, items);
    }
  }
  get items() {
    return this._def.items;
  }
  rest(rest) {
    return new _ZodTuple({
      ...this._def,
      rest
    });
  }
};
__name(_ZodTuple, "ZodTuple");
var ZodTuple = _ZodTuple;
ZodTuple.create = (schemas, params) => {
  if (!Array.isArray(schemas)) {
    throw new Error("You must pass an array of schemas to z.tuple([ ... ])");
  }
  return new ZodTuple({
    items: schemas,
    typeName: ZodFirstPartyTypeKind.ZodTuple,
    rest: null,
    ...processCreateParams(params)
  });
};
var _ZodRecord = class _ZodRecord extends ZodType {
  get keySchema() {
    return this._def.keyType;
  }
  get valueSchema() {
    return this._def.valueType;
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.object) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.object,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const pairs = [];
    const keyType = this._def.keyType;
    const valueType = this._def.valueType;
    for (const key in ctx.data) {
      pairs.push({
        key: keyType._parse(new ParseInputLazyPath(ctx, key, ctx.path, key)),
        value: valueType._parse(new ParseInputLazyPath(ctx, ctx.data[key], ctx.path, key)),
        alwaysSet: key in ctx.data
      });
    }
    if (ctx.common.async) {
      return ParseStatus.mergeObjectAsync(status, pairs);
    } else {
      return ParseStatus.mergeObjectSync(status, pairs);
    }
  }
  get element() {
    return this._def.valueType;
  }
  static create(first, second, third) {
    if (second instanceof ZodType) {
      return new _ZodRecord({
        keyType: first,
        valueType: second,
        typeName: ZodFirstPartyTypeKind.ZodRecord,
        ...processCreateParams(third)
      });
    }
    return new _ZodRecord({
      keyType: ZodString.create(),
      valueType: first,
      typeName: ZodFirstPartyTypeKind.ZodRecord,
      ...processCreateParams(second)
    });
  }
};
__name(_ZodRecord, "ZodRecord");
var ZodRecord = _ZodRecord;
var _ZodMap = class _ZodMap extends ZodType {
  get keySchema() {
    return this._def.keyType;
  }
  get valueSchema() {
    return this._def.valueType;
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.map) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.map,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const keyType = this._def.keyType;
    const valueType = this._def.valueType;
    const pairs = [...ctx.data.entries()].map(([key, value], index) => {
      return {
        key: keyType._parse(new ParseInputLazyPath(ctx, key, ctx.path, [index, "key"])),
        value: valueType._parse(new ParseInputLazyPath(ctx, value, ctx.path, [index, "value"]))
      };
    });
    if (ctx.common.async) {
      const finalMap = /* @__PURE__ */ new Map();
      return Promise.resolve().then(async () => {
        for (const pair of pairs) {
          const key = await pair.key;
          const value = await pair.value;
          if (key.status === "aborted" || value.status === "aborted") {
            return INVALID;
          }
          if (key.status === "dirty" || value.status === "dirty") {
            status.dirty();
          }
          finalMap.set(key.value, value.value);
        }
        return { status: status.value, value: finalMap };
      });
    } else {
      const finalMap = /* @__PURE__ */ new Map();
      for (const pair of pairs) {
        const key = pair.key;
        const value = pair.value;
        if (key.status === "aborted" || value.status === "aborted") {
          return INVALID;
        }
        if (key.status === "dirty" || value.status === "dirty") {
          status.dirty();
        }
        finalMap.set(key.value, value.value);
      }
      return { status: status.value, value: finalMap };
    }
  }
};
__name(_ZodMap, "ZodMap");
var ZodMap = _ZodMap;
ZodMap.create = (keyType, valueType, params) => {
  return new ZodMap({
    valueType,
    keyType,
    typeName: ZodFirstPartyTypeKind.ZodMap,
    ...processCreateParams(params)
  });
};
var _ZodSet = class _ZodSet extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.set) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.set,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const def = this._def;
    if (def.minSize !== null) {
      if (ctx.data.size < def.minSize.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_small,
          minimum: def.minSize.value,
          type: "set",
          inclusive: true,
          exact: false,
          message: def.minSize.message
        });
        status.dirty();
      }
    }
    if (def.maxSize !== null) {
      if (ctx.data.size > def.maxSize.value) {
        addIssueToContext(ctx, {
          code: ZodIssueCode.too_big,
          maximum: def.maxSize.value,
          type: "set",
          inclusive: true,
          exact: false,
          message: def.maxSize.message
        });
        status.dirty();
      }
    }
    const valueType = this._def.valueType;
    function finalizeSet(elements2) {
      const parsedSet = /* @__PURE__ */ new Set();
      for (const element of elements2) {
        if (element.status === "aborted")
          return INVALID;
        if (element.status === "dirty")
          status.dirty();
        parsedSet.add(element.value);
      }
      return { status: status.value, value: parsedSet };
    }
    __name(finalizeSet, "finalizeSet");
    const elements = [...ctx.data.values()].map((item, i) => valueType._parse(new ParseInputLazyPath(ctx, item, ctx.path, i)));
    if (ctx.common.async) {
      return Promise.all(elements).then((elements2) => finalizeSet(elements2));
    } else {
      return finalizeSet(elements);
    }
  }
  min(minSize, message) {
    return new _ZodSet({
      ...this._def,
      minSize: { value: minSize, message: errorUtil.toString(message) }
    });
  }
  max(maxSize, message) {
    return new _ZodSet({
      ...this._def,
      maxSize: { value: maxSize, message: errorUtil.toString(message) }
    });
  }
  size(size, message) {
    return this.min(size, message).max(size, message);
  }
  nonempty(message) {
    return this.min(1, message);
  }
};
__name(_ZodSet, "ZodSet");
var ZodSet = _ZodSet;
ZodSet.create = (valueType, params) => {
  return new ZodSet({
    valueType,
    minSize: null,
    maxSize: null,
    typeName: ZodFirstPartyTypeKind.ZodSet,
    ...processCreateParams(params)
  });
};
var _ZodFunction = class _ZodFunction extends ZodType {
  constructor() {
    super(...arguments);
    this.validate = this.implement;
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.function) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.function,
        received: ctx.parsedType
      });
      return INVALID;
    }
    function makeArgsIssue(args, error) {
      return makeIssue({
        data: args,
        path: ctx.path,
        errorMaps: [
          ctx.common.contextualErrorMap,
          ctx.schemaErrorMap,
          getErrorMap(),
          errorMap
        ].filter((x) => !!x),
        issueData: {
          code: ZodIssueCode.invalid_arguments,
          argumentsError: error
        }
      });
    }
    __name(makeArgsIssue, "makeArgsIssue");
    function makeReturnsIssue(returns, error) {
      return makeIssue({
        data: returns,
        path: ctx.path,
        errorMaps: [
          ctx.common.contextualErrorMap,
          ctx.schemaErrorMap,
          getErrorMap(),
          errorMap
        ].filter((x) => !!x),
        issueData: {
          code: ZodIssueCode.invalid_return_type,
          returnTypeError: error
        }
      });
    }
    __name(makeReturnsIssue, "makeReturnsIssue");
    const params = { errorMap: ctx.common.contextualErrorMap };
    const fn = ctx.data;
    if (this._def.returns instanceof ZodPromise) {
      const me = this;
      return OK(async function(...args) {
        const error = new ZodError([]);
        const parsedArgs = await me._def.args.parseAsync(args, params).catch((e) => {
          error.addIssue(makeArgsIssue(args, e));
          throw error;
        });
        const result = await Reflect.apply(fn, this, parsedArgs);
        const parsedReturns = await me._def.returns._def.type.parseAsync(result, params).catch((e) => {
          error.addIssue(makeReturnsIssue(result, e));
          throw error;
        });
        return parsedReturns;
      });
    } else {
      const me = this;
      return OK(function(...args) {
        const parsedArgs = me._def.args.safeParse(args, params);
        if (!parsedArgs.success) {
          throw new ZodError([makeArgsIssue(args, parsedArgs.error)]);
        }
        const result = Reflect.apply(fn, this, parsedArgs.data);
        const parsedReturns = me._def.returns.safeParse(result, params);
        if (!parsedReturns.success) {
          throw new ZodError([makeReturnsIssue(result, parsedReturns.error)]);
        }
        return parsedReturns.data;
      });
    }
  }
  parameters() {
    return this._def.args;
  }
  returnType() {
    return this._def.returns;
  }
  args(...items) {
    return new _ZodFunction({
      ...this._def,
      args: ZodTuple.create(items).rest(ZodUnknown.create())
    });
  }
  returns(returnType) {
    return new _ZodFunction({
      ...this._def,
      returns: returnType
    });
  }
  implement(func) {
    const validatedFunc = this.parse(func);
    return validatedFunc;
  }
  strictImplement(func) {
    const validatedFunc = this.parse(func);
    return validatedFunc;
  }
  static create(args, returns, params) {
    return new _ZodFunction({
      args: args ? args : ZodTuple.create([]).rest(ZodUnknown.create()),
      returns: returns || ZodUnknown.create(),
      typeName: ZodFirstPartyTypeKind.ZodFunction,
      ...processCreateParams(params)
    });
  }
};
__name(_ZodFunction, "ZodFunction");
var ZodFunction = _ZodFunction;
var _ZodLazy = class _ZodLazy extends ZodType {
  get schema() {
    return this._def.getter();
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const lazySchema = this._def.getter();
    return lazySchema._parse({ data: ctx.data, path: ctx.path, parent: ctx });
  }
};
__name(_ZodLazy, "ZodLazy");
var ZodLazy = _ZodLazy;
ZodLazy.create = (getter, params) => {
  return new ZodLazy({
    getter,
    typeName: ZodFirstPartyTypeKind.ZodLazy,
    ...processCreateParams(params)
  });
};
var _ZodLiteral = class _ZodLiteral extends ZodType {
  _parse(input) {
    if (input.data !== this._def.value) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        received: ctx.data,
        code: ZodIssueCode.invalid_literal,
        expected: this._def.value
      });
      return INVALID;
    }
    return { status: "valid", value: input.data };
  }
  get value() {
    return this._def.value;
  }
};
__name(_ZodLiteral, "ZodLiteral");
var ZodLiteral = _ZodLiteral;
ZodLiteral.create = (value, params) => {
  return new ZodLiteral({
    value,
    typeName: ZodFirstPartyTypeKind.ZodLiteral,
    ...processCreateParams(params)
  });
};
function createZodEnum(values, params) {
  return new ZodEnum({
    values,
    typeName: ZodFirstPartyTypeKind.ZodEnum,
    ...processCreateParams(params)
  });
}
__name(createZodEnum, "createZodEnum");
var _ZodEnum = class _ZodEnum extends ZodType {
  constructor() {
    super(...arguments);
    _ZodEnum_cache.set(this, void 0);
  }
  _parse(input) {
    if (typeof input.data !== "string") {
      const ctx = this._getOrReturnCtx(input);
      const expectedValues = this._def.values;
      addIssueToContext(ctx, {
        expected: util.joinValues(expectedValues),
        received: ctx.parsedType,
        code: ZodIssueCode.invalid_type
      });
      return INVALID;
    }
    if (!__classPrivateFieldGet(this, _ZodEnum_cache, "f")) {
      __classPrivateFieldSet(this, _ZodEnum_cache, new Set(this._def.values), "f");
    }
    if (!__classPrivateFieldGet(this, _ZodEnum_cache, "f").has(input.data)) {
      const ctx = this._getOrReturnCtx(input);
      const expectedValues = this._def.values;
      addIssueToContext(ctx, {
        received: ctx.data,
        code: ZodIssueCode.invalid_enum_value,
        options: expectedValues
      });
      return INVALID;
    }
    return OK(input.data);
  }
  get options() {
    return this._def.values;
  }
  get enum() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  get Values() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  get Enum() {
    const enumValues = {};
    for (const val of this._def.values) {
      enumValues[val] = val;
    }
    return enumValues;
  }
  extract(values, newDef = this._def) {
    return _ZodEnum.create(values, {
      ...this._def,
      ...newDef
    });
  }
  exclude(values, newDef = this._def) {
    return _ZodEnum.create(this.options.filter((opt) => !values.includes(opt)), {
      ...this._def,
      ...newDef
    });
  }
};
__name(_ZodEnum, "ZodEnum");
var ZodEnum = _ZodEnum;
_ZodEnum_cache = /* @__PURE__ */ new WeakMap();
ZodEnum.create = createZodEnum;
var _ZodNativeEnum = class _ZodNativeEnum extends ZodType {
  constructor() {
    super(...arguments);
    _ZodNativeEnum_cache.set(this, void 0);
  }
  _parse(input) {
    const nativeEnumValues = util.getValidEnumValues(this._def.values);
    const ctx = this._getOrReturnCtx(input);
    if (ctx.parsedType !== ZodParsedType.string && ctx.parsedType !== ZodParsedType.number) {
      const expectedValues = util.objectValues(nativeEnumValues);
      addIssueToContext(ctx, {
        expected: util.joinValues(expectedValues),
        received: ctx.parsedType,
        code: ZodIssueCode.invalid_type
      });
      return INVALID;
    }
    if (!__classPrivateFieldGet(this, _ZodNativeEnum_cache, "f")) {
      __classPrivateFieldSet(this, _ZodNativeEnum_cache, new Set(util.getValidEnumValues(this._def.values)), "f");
    }
    if (!__classPrivateFieldGet(this, _ZodNativeEnum_cache, "f").has(input.data)) {
      const expectedValues = util.objectValues(nativeEnumValues);
      addIssueToContext(ctx, {
        received: ctx.data,
        code: ZodIssueCode.invalid_enum_value,
        options: expectedValues
      });
      return INVALID;
    }
    return OK(input.data);
  }
  get enum() {
    return this._def.values;
  }
};
__name(_ZodNativeEnum, "ZodNativeEnum");
var ZodNativeEnum = _ZodNativeEnum;
_ZodNativeEnum_cache = /* @__PURE__ */ new WeakMap();
ZodNativeEnum.create = (values, params) => {
  return new ZodNativeEnum({
    values,
    typeName: ZodFirstPartyTypeKind.ZodNativeEnum,
    ...processCreateParams(params)
  });
};
var _ZodPromise = class _ZodPromise extends ZodType {
  unwrap() {
    return this._def.type;
  }
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    if (ctx.parsedType !== ZodParsedType.promise && ctx.common.async === false) {
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.promise,
        received: ctx.parsedType
      });
      return INVALID;
    }
    const promisified = ctx.parsedType === ZodParsedType.promise ? ctx.data : Promise.resolve(ctx.data);
    return OK(promisified.then((data) => {
      return this._def.type.parseAsync(data, {
        path: ctx.path,
        errorMap: ctx.common.contextualErrorMap
      });
    }));
  }
};
__name(_ZodPromise, "ZodPromise");
var ZodPromise = _ZodPromise;
ZodPromise.create = (schema, params) => {
  return new ZodPromise({
    type: schema,
    typeName: ZodFirstPartyTypeKind.ZodPromise,
    ...processCreateParams(params)
  });
};
var _ZodEffects = class _ZodEffects extends ZodType {
  innerType() {
    return this._def.schema;
  }
  sourceType() {
    return this._def.schema._def.typeName === ZodFirstPartyTypeKind.ZodEffects ? this._def.schema.sourceType() : this._def.schema;
  }
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    const effect = this._def.effect || null;
    const checkCtx = {
      addIssue: /* @__PURE__ */ __name((arg) => {
        addIssueToContext(ctx, arg);
        if (arg.fatal) {
          status.abort();
        } else {
          status.dirty();
        }
      }, "addIssue"),
      get path() {
        return ctx.path;
      }
    };
    checkCtx.addIssue = checkCtx.addIssue.bind(checkCtx);
    if (effect.type === "preprocess") {
      const processed = effect.transform(ctx.data, checkCtx);
      if (ctx.common.async) {
        return Promise.resolve(processed).then(async (processed2) => {
          if (status.value === "aborted")
            return INVALID;
          const result = await this._def.schema._parseAsync({
            data: processed2,
            path: ctx.path,
            parent: ctx
          });
          if (result.status === "aborted")
            return INVALID;
          if (result.status === "dirty")
            return DIRTY(result.value);
          if (status.value === "dirty")
            return DIRTY(result.value);
          return result;
        });
      } else {
        if (status.value === "aborted")
          return INVALID;
        const result = this._def.schema._parseSync({
          data: processed,
          path: ctx.path,
          parent: ctx
        });
        if (result.status === "aborted")
          return INVALID;
        if (result.status === "dirty")
          return DIRTY(result.value);
        if (status.value === "dirty")
          return DIRTY(result.value);
        return result;
      }
    }
    if (effect.type === "refinement") {
      const executeRefinement = /* @__PURE__ */ __name((acc) => {
        const result = effect.refinement(acc, checkCtx);
        if (ctx.common.async) {
          return Promise.resolve(result);
        }
        if (result instanceof Promise) {
          throw new Error("Async refinement encountered during synchronous parse operation. Use .parseAsync instead.");
        }
        return acc;
      }, "executeRefinement");
      if (ctx.common.async === false) {
        const inner = this._def.schema._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (inner.status === "aborted")
          return INVALID;
        if (inner.status === "dirty")
          status.dirty();
        executeRefinement(inner.value);
        return { status: status.value, value: inner.value };
      } else {
        return this._def.schema._parseAsync({ data: ctx.data, path: ctx.path, parent: ctx }).then((inner) => {
          if (inner.status === "aborted")
            return INVALID;
          if (inner.status === "dirty")
            status.dirty();
          return executeRefinement(inner.value).then(() => {
            return { status: status.value, value: inner.value };
          });
        });
      }
    }
    if (effect.type === "transform") {
      if (ctx.common.async === false) {
        const base = this._def.schema._parseSync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (!isValid(base))
          return base;
        const result = effect.transform(base.value, checkCtx);
        if (result instanceof Promise) {
          throw new Error(`Asynchronous transform encountered during synchronous parse operation. Use .parseAsync instead.`);
        }
        return { status: status.value, value: result };
      } else {
        return this._def.schema._parseAsync({ data: ctx.data, path: ctx.path, parent: ctx }).then((base) => {
          if (!isValid(base))
            return base;
          return Promise.resolve(effect.transform(base.value, checkCtx)).then((result) => ({ status: status.value, value: result }));
        });
      }
    }
    util.assertNever(effect);
  }
};
__name(_ZodEffects, "ZodEffects");
var ZodEffects = _ZodEffects;
ZodEffects.create = (schema, effect, params) => {
  return new ZodEffects({
    schema,
    typeName: ZodFirstPartyTypeKind.ZodEffects,
    effect,
    ...processCreateParams(params)
  });
};
ZodEffects.createWithPreprocess = (preprocess, schema, params) => {
  return new ZodEffects({
    schema,
    effect: { type: "preprocess", transform: preprocess },
    typeName: ZodFirstPartyTypeKind.ZodEffects,
    ...processCreateParams(params)
  });
};
var _ZodOptional = class _ZodOptional extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType === ZodParsedType.undefined) {
      return OK(void 0);
    }
    return this._def.innerType._parse(input);
  }
  unwrap() {
    return this._def.innerType;
  }
};
__name(_ZodOptional, "ZodOptional");
var ZodOptional = _ZodOptional;
ZodOptional.create = (type, params) => {
  return new ZodOptional({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodOptional,
    ...processCreateParams(params)
  });
};
var _ZodNullable = class _ZodNullable extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType === ZodParsedType.null) {
      return OK(null);
    }
    return this._def.innerType._parse(input);
  }
  unwrap() {
    return this._def.innerType;
  }
};
__name(_ZodNullable, "ZodNullable");
var ZodNullable = _ZodNullable;
ZodNullable.create = (type, params) => {
  return new ZodNullable({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodNullable,
    ...processCreateParams(params)
  });
};
var _ZodDefault = class _ZodDefault extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    let data = ctx.data;
    if (ctx.parsedType === ZodParsedType.undefined) {
      data = this._def.defaultValue();
    }
    return this._def.innerType._parse({
      data,
      path: ctx.path,
      parent: ctx
    });
  }
  removeDefault() {
    return this._def.innerType;
  }
};
__name(_ZodDefault, "ZodDefault");
var ZodDefault = _ZodDefault;
ZodDefault.create = (type, params) => {
  return new ZodDefault({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodDefault,
    defaultValue: typeof params.default === "function" ? params.default : () => params.default,
    ...processCreateParams(params)
  });
};
var _ZodCatch = class _ZodCatch extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const newCtx = {
      ...ctx,
      common: {
        ...ctx.common,
        issues: []
      }
    };
    const result = this._def.innerType._parse({
      data: newCtx.data,
      path: newCtx.path,
      parent: {
        ...newCtx
      }
    });
    if (isAsync(result)) {
      return result.then((result2) => {
        return {
          status: "valid",
          value: result2.status === "valid" ? result2.value : this._def.catchValue({
            get error() {
              return new ZodError(newCtx.common.issues);
            },
            input: newCtx.data
          })
        };
      });
    } else {
      return {
        status: "valid",
        value: result.status === "valid" ? result.value : this._def.catchValue({
          get error() {
            return new ZodError(newCtx.common.issues);
          },
          input: newCtx.data
        })
      };
    }
  }
  removeCatch() {
    return this._def.innerType;
  }
};
__name(_ZodCatch, "ZodCatch");
var ZodCatch = _ZodCatch;
ZodCatch.create = (type, params) => {
  return new ZodCatch({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodCatch,
    catchValue: typeof params.catch === "function" ? params.catch : () => params.catch,
    ...processCreateParams(params)
  });
};
var _ZodNaN = class _ZodNaN extends ZodType {
  _parse(input) {
    const parsedType = this._getType(input);
    if (parsedType !== ZodParsedType.nan) {
      const ctx = this._getOrReturnCtx(input);
      addIssueToContext(ctx, {
        code: ZodIssueCode.invalid_type,
        expected: ZodParsedType.nan,
        received: ctx.parsedType
      });
      return INVALID;
    }
    return { status: "valid", value: input.data };
  }
};
__name(_ZodNaN, "ZodNaN");
var ZodNaN = _ZodNaN;
ZodNaN.create = (params) => {
  return new ZodNaN({
    typeName: ZodFirstPartyTypeKind.ZodNaN,
    ...processCreateParams(params)
  });
};
var BRAND = Symbol("zod_brand");
var _ZodBranded = class _ZodBranded extends ZodType {
  _parse(input) {
    const { ctx } = this._processInputParams(input);
    const data = ctx.data;
    return this._def.type._parse({
      data,
      path: ctx.path,
      parent: ctx
    });
  }
  unwrap() {
    return this._def.type;
  }
};
__name(_ZodBranded, "ZodBranded");
var ZodBranded = _ZodBranded;
var _ZodPipeline = class _ZodPipeline extends ZodType {
  _parse(input) {
    const { status, ctx } = this._processInputParams(input);
    if (ctx.common.async) {
      const handleAsync = /* @__PURE__ */ __name(async () => {
        const inResult = await this._def.in._parseAsync({
          data: ctx.data,
          path: ctx.path,
          parent: ctx
        });
        if (inResult.status === "aborted")
          return INVALID;
        if (inResult.status === "dirty") {
          status.dirty();
          return DIRTY(inResult.value);
        } else {
          return this._def.out._parseAsync({
            data: inResult.value,
            path: ctx.path,
            parent: ctx
          });
        }
      }, "handleAsync");
      return handleAsync();
    } else {
      const inResult = this._def.in._parseSync({
        data: ctx.data,
        path: ctx.path,
        parent: ctx
      });
      if (inResult.status === "aborted")
        return INVALID;
      if (inResult.status === "dirty") {
        status.dirty();
        return {
          status: "dirty",
          value: inResult.value
        };
      } else {
        return this._def.out._parseSync({
          data: inResult.value,
          path: ctx.path,
          parent: ctx
        });
      }
    }
  }
  static create(a, b) {
    return new _ZodPipeline({
      in: a,
      out: b,
      typeName: ZodFirstPartyTypeKind.ZodPipeline
    });
  }
};
__name(_ZodPipeline, "ZodPipeline");
var ZodPipeline = _ZodPipeline;
var _ZodReadonly = class _ZodReadonly extends ZodType {
  _parse(input) {
    const result = this._def.innerType._parse(input);
    const freeze = /* @__PURE__ */ __name((data) => {
      if (isValid(data)) {
        data.value = Object.freeze(data.value);
      }
      return data;
    }, "freeze");
    return isAsync(result) ? result.then((data) => freeze(data)) : freeze(result);
  }
  unwrap() {
    return this._def.innerType;
  }
};
__name(_ZodReadonly, "ZodReadonly");
var ZodReadonly = _ZodReadonly;
ZodReadonly.create = (type, params) => {
  return new ZodReadonly({
    innerType: type,
    typeName: ZodFirstPartyTypeKind.ZodReadonly,
    ...processCreateParams(params)
  });
};
function cleanParams(params, data) {
  const p = typeof params === "function" ? params(data) : typeof params === "string" ? { message: params } : params;
  const p2 = typeof p === "string" ? { message: p } : p;
  return p2;
}
__name(cleanParams, "cleanParams");
function custom(check, _params = {}, fatal) {
  if (check)
    return ZodAny.create().superRefine((data, ctx) => {
      var _a, _b;
      const r = check(data);
      if (r instanceof Promise) {
        return r.then((r2) => {
          var _a2, _b2;
          if (!r2) {
            const params = cleanParams(_params, data);
            const _fatal = (_b2 = (_a2 = params.fatal) !== null && _a2 !== void 0 ? _a2 : fatal) !== null && _b2 !== void 0 ? _b2 : true;
            ctx.addIssue({ code: "custom", ...params, fatal: _fatal });
          }
        });
      }
      if (!r) {
        const params = cleanParams(_params, data);
        const _fatal = (_b = (_a = params.fatal) !== null && _a !== void 0 ? _a : fatal) !== null && _b !== void 0 ? _b : true;
        ctx.addIssue({ code: "custom", ...params, fatal: _fatal });
      }
      return;
    });
  return ZodAny.create();
}
__name(custom, "custom");
var late = {
  object: ZodObject.lazycreate
};
var ZodFirstPartyTypeKind;
(function(ZodFirstPartyTypeKind2) {
  ZodFirstPartyTypeKind2["ZodString"] = "ZodString";
  ZodFirstPartyTypeKind2["ZodNumber"] = "ZodNumber";
  ZodFirstPartyTypeKind2["ZodNaN"] = "ZodNaN";
  ZodFirstPartyTypeKind2["ZodBigInt"] = "ZodBigInt";
  ZodFirstPartyTypeKind2["ZodBoolean"] = "ZodBoolean";
  ZodFirstPartyTypeKind2["ZodDate"] = "ZodDate";
  ZodFirstPartyTypeKind2["ZodSymbol"] = "ZodSymbol";
  ZodFirstPartyTypeKind2["ZodUndefined"] = "ZodUndefined";
  ZodFirstPartyTypeKind2["ZodNull"] = "ZodNull";
  ZodFirstPartyTypeKind2["ZodAny"] = "ZodAny";
  ZodFirstPartyTypeKind2["ZodUnknown"] = "ZodUnknown";
  ZodFirstPartyTypeKind2["ZodNever"] = "ZodNever";
  ZodFirstPartyTypeKind2["ZodVoid"] = "ZodVoid";
  ZodFirstPartyTypeKind2["ZodArray"] = "ZodArray";
  ZodFirstPartyTypeKind2["ZodObject"] = "ZodObject";
  ZodFirstPartyTypeKind2["ZodUnion"] = "ZodUnion";
  ZodFirstPartyTypeKind2["ZodDiscriminatedUnion"] = "ZodDiscriminatedUnion";
  ZodFirstPartyTypeKind2["ZodIntersection"] = "ZodIntersection";
  ZodFirstPartyTypeKind2["ZodTuple"] = "ZodTuple";
  ZodFirstPartyTypeKind2["ZodRecord"] = "ZodRecord";
  ZodFirstPartyTypeKind2["ZodMap"] = "ZodMap";
  ZodFirstPartyTypeKind2["ZodSet"] = "ZodSet";
  ZodFirstPartyTypeKind2["ZodFunction"] = "ZodFunction";
  ZodFirstPartyTypeKind2["ZodLazy"] = "ZodLazy";
  ZodFirstPartyTypeKind2["ZodLiteral"] = "ZodLiteral";
  ZodFirstPartyTypeKind2["ZodEnum"] = "ZodEnum";
  ZodFirstPartyTypeKind2["ZodEffects"] = "ZodEffects";
  ZodFirstPartyTypeKind2["ZodNativeEnum"] = "ZodNativeEnum";
  ZodFirstPartyTypeKind2["ZodOptional"] = "ZodOptional";
  ZodFirstPartyTypeKind2["ZodNullable"] = "ZodNullable";
  ZodFirstPartyTypeKind2["ZodDefault"] = "ZodDefault";
  ZodFirstPartyTypeKind2["ZodCatch"] = "ZodCatch";
  ZodFirstPartyTypeKind2["ZodPromise"] = "ZodPromise";
  ZodFirstPartyTypeKind2["ZodBranded"] = "ZodBranded";
  ZodFirstPartyTypeKind2["ZodPipeline"] = "ZodPipeline";
  ZodFirstPartyTypeKind2["ZodReadonly"] = "ZodReadonly";
})(ZodFirstPartyTypeKind || (ZodFirstPartyTypeKind = {}));
var instanceOfType = /* @__PURE__ */ __name((cls, params = {
  message: `Input not instance of ${cls.name}`
}) => custom((data) => data instanceof cls, params), "instanceOfType");
var stringType = ZodString.create;
var numberType = ZodNumber.create;
var nanType = ZodNaN.create;
var bigIntType = ZodBigInt.create;
var booleanType = ZodBoolean.create;
var dateType = ZodDate.create;
var symbolType = ZodSymbol.create;
var undefinedType = ZodUndefined.create;
var nullType = ZodNull.create;
var anyType = ZodAny.create;
var unknownType = ZodUnknown.create;
var neverType = ZodNever.create;
var voidType = ZodVoid.create;
var arrayType = ZodArray.create;
var objectType = ZodObject.create;
var strictObjectType = ZodObject.strictCreate;
var unionType = ZodUnion.create;
var discriminatedUnionType = ZodDiscriminatedUnion.create;
var intersectionType = ZodIntersection.create;
var tupleType = ZodTuple.create;
var recordType = ZodRecord.create;
var mapType = ZodMap.create;
var setType = ZodSet.create;
var functionType = ZodFunction.create;
var lazyType = ZodLazy.create;
var literalType = ZodLiteral.create;
var enumType = ZodEnum.create;
var nativeEnumType = ZodNativeEnum.create;
var promiseType = ZodPromise.create;
var effectsType = ZodEffects.create;
var optionalType = ZodOptional.create;
var nullableType = ZodNullable.create;
var preprocessType = ZodEffects.createWithPreprocess;
var pipelineType = ZodPipeline.create;
var ostring = /* @__PURE__ */ __name(() => stringType().optional(), "ostring");
var onumber = /* @__PURE__ */ __name(() => numberType().optional(), "onumber");
var oboolean = /* @__PURE__ */ __name(() => booleanType().optional(), "oboolean");
var coerce = {
  string: /* @__PURE__ */ __name((arg) => ZodString.create({ ...arg, coerce: true }), "string"),
  number: /* @__PURE__ */ __name((arg) => ZodNumber.create({ ...arg, coerce: true }), "number"),
  boolean: /* @__PURE__ */ __name((arg) => ZodBoolean.create({
    ...arg,
    coerce: true
  }), "boolean"),
  bigint: /* @__PURE__ */ __name((arg) => ZodBigInt.create({ ...arg, coerce: true }), "bigint"),
  date: /* @__PURE__ */ __name((arg) => ZodDate.create({ ...arg, coerce: true }), "date")
};
var NEVER = INVALID;
var z = /* @__PURE__ */ Object.freeze({
  __proto__: null,
  defaultErrorMap: errorMap,
  setErrorMap,
  getErrorMap,
  makeIssue,
  EMPTY_PATH,
  addIssueToContext,
  ParseStatus,
  INVALID,
  DIRTY,
  OK,
  isAborted,
  isDirty,
  isValid,
  isAsync,
  get util() {
    return util;
  },
  get objectUtil() {
    return objectUtil;
  },
  ZodParsedType,
  getParsedType,
  ZodType,
  datetimeRegex,
  ZodString,
  ZodNumber,
  ZodBigInt,
  ZodBoolean,
  ZodDate,
  ZodSymbol,
  ZodUndefined,
  ZodNull,
  ZodAny,
  ZodUnknown,
  ZodNever,
  ZodVoid,
  ZodArray,
  ZodObject,
  ZodUnion,
  ZodDiscriminatedUnion,
  ZodIntersection,
  ZodTuple,
  ZodRecord,
  ZodMap,
  ZodSet,
  ZodFunction,
  ZodLazy,
  ZodLiteral,
  ZodEnum,
  ZodNativeEnum,
  ZodPromise,
  ZodEffects,
  ZodTransformer: ZodEffects,
  ZodOptional,
  ZodNullable,
  ZodDefault,
  ZodCatch,
  ZodNaN,
  BRAND,
  ZodBranded,
  ZodPipeline,
  ZodReadonly,
  custom,
  Schema: ZodType,
  ZodSchema: ZodType,
  late,
  get ZodFirstPartyTypeKind() {
    return ZodFirstPartyTypeKind;
  },
  coerce,
  any: anyType,
  array: arrayType,
  bigint: bigIntType,
  boolean: booleanType,
  date: dateType,
  discriminatedUnion: discriminatedUnionType,
  effect: effectsType,
  "enum": enumType,
  "function": functionType,
  "instanceof": instanceOfType,
  intersection: intersectionType,
  lazy: lazyType,
  literal: literalType,
  map: mapType,
  nan: nanType,
  nativeEnum: nativeEnumType,
  never: neverType,
  "null": nullType,
  nullable: nullableType,
  number: numberType,
  object: objectType,
  oboolean,
  onumber,
  optional: optionalType,
  ostring,
  pipeline: pipelineType,
  preprocess: preprocessType,
  promise: promiseType,
  record: recordType,
  set: setType,
  strictObject: strictObjectType,
  string: stringType,
  symbol: symbolType,
  transformer: effectsType,
  tuple: tupleType,
  "undefined": undefinedType,
  union: unionType,
  unknown: unknownType,
  "void": voidType,
  NEVER,
  ZodIssueCode,
  quotelessJson,
  ZodError
});

// server/routes.ts
init_unified_database_service();

// server/services/scenario-sync.service.ts
init_unified_database_service();
import { Pinecone } from "@pinecone-database/pinecone";
var _ScenarioSyncService = class _ScenarioSyncService {
  constructor() {
    if (!process.env.PINECONE_API_KEY) {
      console.warn("\u26A0\uFE0F  PINECONE_API_KEY not provided, Pinecone features will be disabled");
      this.pinecone = null;
      this.pineconeEnabled = false;
      this.indexName = "";
      this.namespace = "";
      return;
    }
    this.pineconeEnabled = true;
    this.pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY
    });
    this.indexName = process.env.PINECONE_INDEX_NAME || "arthrologie-du-membre-superieur";
    this.namespace = process.env.PINECONE_NAMESPACE || "default";
  }
  async syncScenariosFromPinecone() {
    if (!this.pineconeEnabled || !this.pinecone) {
      console.log("\u26A0\uFE0F Pinecone not enabled, skipping sync");
      return;
    }
    try {
      await unifiedDb.initialize();
      const index = this.pinecone.index(this.indexName);
      const queryResponse = await index.namespace(this.namespace).query({
        vector: new Array(1536).fill(0),
        // OpenAI embeddings dimension
        topK: 100,
        // Get up to 100 scenarios
        includeMetadata: true,
        includeValues: false
      });
      if (!queryResponse.matches || queryResponse.matches.length === 0) {
        console.log("\u{1F4ED} No scenarios found in Pinecone");
        return;
      }
      console.log(`\u{1F4CB} Found ${queryResponse.matches.length} scenarios in Pinecone`);
      for (const match of queryResponse.matches) {
        if (!match.metadata) continue;
        const metadata = match.metadata;
        if (!metadata.title || !metadata.description || !metadata.patientPrompt) {
          console.log(`\u26A0\uFE0F Skipping scenario ${match.id} - missing essential fields`);
          continue;
        }
        try {
          await unifiedDb.initialize();
          await unifiedDb.createScenario({
            title: metadata.title,
            description: metadata.description,
            patientPrompt: metadata.patientPrompt,
            evaluationCriteria: metadata.evaluationCriteria || {},
            imageUrl: metadata.imageUrl,
            createdBy: metadata.createdBy || "system"
          });
          console.log(`\u2705 Created scenario: ${metadata.title}`);
        } catch (error) {
          if (error.message?.includes("duplicate")) {
            console.log(`\u26A0\uFE0F Scenario already exists: ${metadata.title}`);
          } else {
            console.error(`\u274C Error creating scenario ${metadata.title}:`, error.message);
          }
        }
      }
      console.log("\u2705 Scenario synchronization completed");
    } catch (error) {
      console.error("\u274C Error syncing scenarios from Pinecone:", error);
      throw error;
    }
  }
  async getAvailableScenarios() {
    try {
      await unifiedDb.initialize();
      return await unifiedDb.getScenarios();
    } catch (error) {
      console.error("\u274C Error fetching scenarios from Supabase:", error);
      throw error;
    }
  }
  async getScenarioById(id) {
    try {
      await unifiedDb.initialize();
      const scenarios = await unifiedDb.getScenarios();
      return scenarios.find((s) => s.id === id) || null;
    } catch (error) {
      console.error("\u274C Error fetching scenario by ID from Supabase:", error);
      throw error;
    }
  }
};
__name(_ScenarioSyncService, "ScenarioSyncService");
var ScenarioSyncService = _ScenarioSyncService;
var scenarioSyncService = new ScenarioSyncService();

// server/middleware/auth.middleware.ts
import jwt from "jsonwebtoken";
var _AuthenticationService = class _AuthenticationService {
  constructor() {
    this.jwtSecret = process.env.JWT_SECRET || "development-secret-key-change-in-production";
    if (this.jwtSecret === "development-secret-key-change-in-production" && process.env.NODE_ENV === "production") {
      console.error("\u274C SECURITY WARNING: JWT_SECRET not set in production! This is a security risk!");
    }
    const adminEmailsEnv = process.env.ADMIN_EMAILS;
    if (adminEmailsEnv) {
      this.adminEmails = new Set(
        adminEmailsEnv.split(",").map((email) => email.trim().toLowerCase()).filter((email) => this.isValidEmail(email))
      );
      console.log(`\u2705 Loaded ${this.adminEmails.size} admin emails from environment`);
    } else {
      this.adminEmails = /* @__PURE__ */ new Set();
      console.error("\u274C No admin emails configured! Set ADMIN_EMAILS environment variable.");
    }
  }
  isValidEmail(email) {
    const emailRegex2 = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex2.test(email);
  }
  generateToken(email) {
    if (!this.isValidEmail(email)) {
      throw new Error("Invalid email format");
    }
    const payload = {
      email: email.toLowerCase().trim(),
      isAdmin: this.isAdmin(email)
    };
    return jwt.sign(payload, this.jwtSecret, {
      expiresIn: "24h",
      issuer: "ecos-app",
      audience: "ecos-users"
    });
  }
  verifyToken(token) {
    try {
      const decoded = jwt.verify(token, this.jwtSecret, {
        issuer: "ecos-app",
        audience: "ecos-users"
      });
      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error("Token expired");
      } else if (error instanceof jwt.JsonWebTokenError) {
        throw new Error("Invalid token");
      } else {
        throw new Error("Token verification failed");
      }
    }
  }
  isAdmin(email) {
    if (!email || typeof email !== "string") {
      return false;
    }
    return this.adminEmails.has(email.toLowerCase().trim());
  }
  getAdminEmails() {
    return Array.from(this.adminEmails);
  }
};
__name(_AuthenticationService, "AuthenticationService");
var AuthenticationService = _AuthenticationService;
var authService = new AuthenticationService();
var authenticateToken = /* @__PURE__ */ __name((req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) {
    return res.status(401).json({
      error: "Access token required",
      code: "TOKEN_MISSING"
    });
  }
  try {
    const user = authService.verifyToken(token);
    req.user = user;
    next();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown authentication error";
    return res.status(403).json({
      error: errorMessage,
      code: "TOKEN_INVALID"
    });
  }
}, "authenticateToken");
var isAdminAuthorized = /* @__PURE__ */ __name((email) => {
  if (!email || typeof email !== "string") {
    return false;
  }
  const normalizedEmail = email.toLowerCase().trim();
  const hardcodedAdmins = ["cherubindavid@gmail.com", "colombemadoungou@gmail.com"];
  if (hardcodedAdmins.includes(normalizedEmail)) {
    return true;
  }
  return authService.isAdmin(email);
}, "isAdminAuthorized");

// server/middleware/firebase-auth.middleware.ts
init_firebase_admin_service();
init_unified_database_service();
var verifyFirebaseToken = /* @__PURE__ */ __name(async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        error: "No Firebase ID token provided",
        code: "FIREBASE_TOKEN_MISSING"
      });
    }
    const idToken = authHeader.split("Bearer ")[1];
    const decodedToken = await firebaseAdminService.verifyIdToken(idToken);
    if (!decodedToken.email) {
      return res.status(400).json({
        error: "Firebase user has no email",
        code: "FIREBASE_EMAIL_MISSING"
      });
    }
    const { user, role } = await getOrCreateSupabaseUser(
      decodedToken.uid,
      decodedToken.email
    );
    req.firebaseUser = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      role,
      emailVerified: decodedToken.email_verified || false
    };
    const jwtToken = authService.generateToken(decodedToken.email);
    req.jwtToken = jwtToken;
    console.log("\u2705 Firebase user authenticated:", {
      uid: decodedToken.uid,
      email: decodedToken.email,
      role
    });
    next();
  } catch (error) {
    console.error("\u274C Firebase token verification failed:", error.message);
    return res.status(403).json({
      error: error.message || "Firebase authentication failed",
      code: "FIREBASE_AUTH_FAILED"
    });
  }
}, "verifyFirebaseToken");
async function getOrCreateSupabaseUser(firebaseUid, email) {
  try {
    const existingUser = await unifiedDb.getUserByFirebaseUid(firebaseUid);
    if (existingUser) {
      const role = await unifiedDb.getUserRole(existingUser.id);
      console.log("\u2705 Found existing Supabase user:", {
        id: existingUser.id,
        email: existingUser.email,
        role
      });
      return { user: existingUser, role };
    }
    const userByEmail = await unifiedDb.getUserByEmail(email);
    if (userByEmail) {
      await unifiedDb.updateUserFirebaseUid(userByEmail.id, firebaseUid);
      const role = await unifiedDb.getUserRole(userByEmail.id);
      console.log("\u2705 Linked existing Supabase user to Firebase:", {
        id: userByEmail.id,
        email: userByEmail.email,
        firebaseUid,
        role
      });
      return { user: userByEmail, role };
    }
    const newUser = await unifiedDb.createUser({
      email,
      firebaseUid,
      firstName: null,
      lastName: null,
      profileImageUrl: null
    });
    await unifiedDb.setUserRole(newUser.id, "student");
    console.log("\u2705 Created new Supabase user from Firebase:", {
      id: newUser.id,
      email: newUser.email,
      firebaseUid,
      role: "student"
    });
    return { user: newUser, role: "student" };
  } catch (error) {
    console.error("\u274C Error getting/creating Supabase user:", error);
    throw new Error("Failed to sync user with database");
  }
}
__name(getOrCreateSupabaseUser, "getOrCreateSupabaseUser");

// server/middleware/validation.middleware.ts
var validateRequest = /* @__PURE__ */ __name((schema, target = "body") => {
  return (req, res, next) => {
    try {
      let dataToValidate;
      switch (target) {
        case "body":
          dataToValidate = req.body;
          break;
        case "query":
          dataToValidate = req.query;
          break;
        case "params":
          dataToValidate = req.params;
          break;
        default:
          dataToValidate = req.body;
      }
      const validatedData = schema.parse(dataToValidate);
      if (target === "body") {
        req.validatedBody = validatedData;
      } else if (target === "query") {
        req.validatedQuery = validatedData;
      } else if (target === "params") {
        req.validatedParams = validatedData;
      }
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: "Validation failed",
          code: "VALIDATION_ERROR",
          details: error.errors.map((err) => ({
            path: err.path.join("."),
            message: err.message,
            code: err.code
          }))
        });
      }
      console.error("Unexpected validation error:", error);
      return res.status(500).json({
        error: "Internal validation error",
        code: "VALIDATION_INTERNAL_ERROR"
      });
    }
  };
}, "validateRequest");
var emailSchema = z.object({
  email: z.string().email("Invalid email format").min(5, "Email must be at least 5 characters").max(255, "Email must not exceed 255 characters").transform((email) => email.toLowerCase().trim())
});
var loginSchema = z.object({
  email: z.string().email("Invalid email format").min(5, "Email must be at least 5 characters").transform((email) => email.toLowerCase().trim()),
  password: z.string().min(1, "Password is required").optional()
  // Optional during transition period
});
var createEcosSessionSchema = z.object({
  scenarioId: z.string().min(1, "Scenario ID is required").max(255, "Scenario ID too long"),
  studentEmail: z.string().email("Invalid student email format").transform((email) => email.toLowerCase().trim()).optional()
});
var ecosMessageSchema = z.object({
  message: z.string().min(1, "Message content is required").max(1e4, "Message too long (max 10,000 characters)"),
  role: z.enum(["user", "assistant", "system"]).default("user"),
  type: z.enum(["text", "image", "file"]).default("text")
});
var ecosEvaluationSchema = z.object({
  criteria: z.record(z.string(), z.number().min(0).max(100)).optional().default({}),
  responses: z.array(z.string()).optional().default([]),
  notes: z.string().max(5e3, "Notes too long (max 5,000 characters)").optional()
});
var createStudentSchema = z.object({
  email: z.string().email("Invalid email format").min(5, "Email must be at least 5 characters").max(255, "Email must not exceed 255 characters").transform((email) => email.toLowerCase().trim()),
  name: z.string().min(2, "Name must be at least 2 characters").max(100, "Name must not exceed 100 characters").optional(),
  role: z.enum(["student", "teacher"]).default("student")
});
var emailQuerySchema = z.object({
  email: z.string().email("Invalid email format").transform((email) => email.toLowerCase().trim())
});
var paginationQuerySchema = z.object({
  page: z.string().regex(/^\d+$/, "Page must be a number").transform((val) => parseInt(val, 10)).refine((val) => val > 0, "Page must be greater than 0").default("1"),
  limit: z.string().regex(/^\d+$/, "Limit must be a number").transform((val) => parseInt(val, 10)).refine((val) => val > 0 && val <= 100, "Limit must be between 1 and 100").default("20")
});
var sessionIdParamSchema = z.object({
  sessionId: z.string().min(1, "Session ID is required").regex(/^session_\d+_[a-z0-9]+$/, "Invalid session ID format")
});
var userIdParamSchema = z.object({
  userId: z.string().min(1, "User ID is required").max(255, "User ID too long")
});
var scenarioQuerySchema = z.object({
  category: z.string().max(50, "Category too long").optional(),
  difficulty: z.enum(["beginner", "intermediate", "advanced", "expert"]).optional(),
  tags: z.string().transform((str) => str.split(",").map((tag) => tag.trim()).filter(Boolean)).optional()
});
var createTrainingSessionSchema = z.object({
  email: z.string().email("Valid email is required"),
  title: z.string().min(3, "Title must be at least 3 characters").max(200, "Title too long"),
  description: z.string().max(1e3, "Description too long").optional(),
  scenarioIds: z.array(z.union([z.string(), z.number()])).min(1, "At least one scenario is required").max(10, "Too many scenarios (max 10)").transform((ids) => ids.map((id) => typeof id === "number" ? id : parseInt(id.toString()))),
  studentEmails: z.array(z.string().email()).optional().default([]).refine((emails) => emails.length >= 0, "Student emails must be valid")
});
var validateEmailQuery = validateRequest(emailQuerySchema, "query");
var validateEmailBody = validateRequest(emailSchema, "body");
var validateLogin = validateRequest(loginSchema, "body");
var validateCreateStudent = validateRequest(createStudentSchema, "body");
var validateCreateEcosSession = validateRequest(createEcosSessionSchema, "body");
var validateEcosMessage = validateRequest(ecosMessageSchema, "body");
var validateEcosEvaluation = validateRequest(ecosEvaluationSchema, "body");
var validateSessionIdParam = validateRequest(sessionIdParamSchema, "params");
var validatePaginationQuery = validateRequest(paginationQuerySchema, "query");
var validateScenarioQuery = validateRequest(scenarioQuerySchema, "query");
var validateCreateTrainingSession = validateRequest(createTrainingSessionSchema, "body");
var validateRequestSize = /* @__PURE__ */ __name((maxSizeBytes = 1024 * 1024) => {
  return (req, res, next) => {
    const contentLength = req.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > maxSizeBytes) {
      return res.status(413).json({
        error: "Request too large",
        code: "REQUEST_TOO_LARGE",
        maxSize: `${Math.round(maxSizeBytes / 1024)}KB`
      });
    }
    next();
  };
}, "validateRequestSize");
var validateContentType = /* @__PURE__ */ __name((allowedTypes = ["application/json"]) => {
  return (req, res, next) => {
    const contentType = req.get("content-type");
    if (req.method !== "GET" && req.method !== "DELETE" && !contentType) {
      return res.status(400).json({
        error: "Content-Type header required",
        code: "CONTENT_TYPE_REQUIRED"
      });
    }
    if (contentType && !allowedTypes.some((type) => contentType.includes(type))) {
      return res.status(415).json({
        error: "Unsupported media type",
        code: "UNSUPPORTED_MEDIA_TYPE",
        allowedTypes
      });
    }
    next();
  };
}, "validateContentType");

// server/middleware/rate-limit.middleware.ts
var _InMemoryRateLimiter = class _InMemoryRateLimiter {
  constructor() {
    this.requests = /* @__PURE__ */ new Map();
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1e3);
  }
  cleanup() {
    const now = Date.now();
    for (const [key, info] of this.requests) {
      if (now > info.resetTime) {
        this.requests.delete(key);
      }
    }
  }
  hit(key, windowMs) {
    const now = Date.now();
    const existing = this.requests.get(key);
    if (!existing || now > existing.resetTime) {
      const resetTime = now + windowMs;
      this.requests.set(key, {
        count: 1,
        resetTime,
        firstRequest: now
      });
      return { count: 1, resetTime, exceeded: false };
    }
    existing.count++;
    this.requests.set(key, existing);
    return {
      count: existing.count,
      resetTime: existing.resetTime,
      exceeded: false
      // Will be determined by the rate limiter
    };
  }
  reset(key) {
    this.requests.delete(key);
  }
  getStats() {
    const memoryUsage = process.memoryUsage();
    return {
      totalKeys: this.requests.size,
      memoryUsage: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`
    };
  }
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.requests.clear();
  }
};
__name(_InMemoryRateLimiter, "InMemoryRateLimiter");
var InMemoryRateLimiter = _InMemoryRateLimiter;
var globalRateLimiter = new InMemoryRateLimiter();
var _RateLimiter = class _RateLimiter {
  constructor(config) {
    this.config = {
      windowMs: config.windowMs,
      maxRequests: config.maxRequests,
      message: config.message || "Too many requests, please try again later",
      standardHeaders: config.standardHeaders ?? true,
      legacyHeaders: config.legacyHeaders ?? false,
      skipSuccessfulRequests: config.skipSuccessfulRequests ?? false,
      skipFailedRequests: config.skipFailedRequests ?? false,
      keyGenerator: config.keyGenerator || this.defaultKeyGenerator
    };
  }
  defaultKeyGenerator(req) {
    const forwarded = req.headers["x-forwarded-for"];
    const ip = forwarded ? forwarded.split(",")[0].trim() : req.ip || req.connection.remoteAddress || "unknown";
    return `rate_limit:${ip}`;
  }
  middleware() {
    return (req, res, next) => {
      const key = this.config.keyGenerator(req);
      const result = globalRateLimiter.hit(key, this.config.windowMs);
      const isExceeded = result.count > this.config.maxRequests;
      const resetTimeSeconds = Math.ceil((result.resetTime - Date.now()) / 1e3);
      if (this.config.standardHeaders) {
        res.set({
          "RateLimit-Limit": this.config.maxRequests.toString(),
          "RateLimit-Remaining": Math.max(0, this.config.maxRequests - result.count).toString(),
          "RateLimit-Reset": new Date(result.resetTime).toISOString()
        });
      }
      if (this.config.legacyHeaders) {
        res.set({
          "X-RateLimit-Limit": this.config.maxRequests.toString(),
          "X-RateLimit-Remaining": Math.max(0, this.config.maxRequests - result.count).toString(),
          "X-RateLimit-Reset": Math.ceil(result.resetTime / 1e3).toString()
        });
      }
      if (isExceeded) {
        res.set("Retry-After", resetTimeSeconds.toString());
        return res.status(429).json({
          error: this.config.message,
          code: "RATE_LIMIT_EXCEEDED",
          retryAfter: resetTimeSeconds,
          limit: this.config.maxRequests,
          windowMs: this.config.windowMs,
          resetTime: new Date(result.resetTime).toISOString()
        });
      }
      next();
    };
  }
  reset(req) {
    const key = this.config.keyGenerator(req);
    globalRateLimiter.reset(key);
  }
};
__name(_RateLimiter, "RateLimiter");
var RateLimiter = _RateLimiter;
var authRateLimit = new RateLimiter({
  windowMs: 15 * 60 * 1e3,
  // 15 minutes
  maxRequests: process.env.NODE_ENV === "production" ? 5 : 50,
  // More lenient in development
  message: "Too many authentication attempts, please try again later",
  skipSuccessfulRequests: true
  // Only count failed attempts
});
var firebaseAuthRateLimit = new RateLimiter({
  windowMs: 1 * 60 * 1e3,
  // 1 minute (shorter window for development)
  maxRequests: process.env.NODE_ENV === "production" ? 20 : 1e3,
  // Very lenient in development
  message: "Too many Firebase authentication requests, please try again later",
  skipSuccessfulRequests: true
  // Only count failed attempts in development
});
var apiRateLimit = new RateLimiter({
  windowMs: 1 * 60 * 1e3,
  // 1 minute
  maxRequests: 60,
  // 60 requests per minute
  message: "API rate limit exceeded, please slow down"
});
var generalRateLimit = new RateLimiter({
  windowMs: 1 * 60 * 1e3,
  // 1 minute
  maxRequests: 100,
  // 100 requests per minute
  message: "Rate limit exceeded, please try again later"
});
var strictRateLimit = new RateLimiter({
  windowMs: 1 * 60 * 1e3,
  // 1 minute
  maxRequests: 10,
  // 10 requests per minute
  message: "Rate limit exceeded for this operation"
});
var ecosEvaluationRateLimit = new RateLimiter({
  windowMs: 1 * 60 * 1e3,
  // 1 minute
  maxRequests: 10,
  // 10 evaluations per minute per session/email combo
  message: "Rate limit exceeded for this evaluation",
  keyGenerator: /* @__PURE__ */ __name((req) => {
    const email = (req.query.email || "").toLowerCase() || "unknown";
    const sessionId = req.params?.sessionId || "unknown";
    return `ecos_eval:${email}:${sessionId}`;
  }, "keyGenerator")
});
var emailBasedRateLimit = new RateLimiter({
  windowMs: 5 * 60 * 1e3,
  // 5 minutes
  maxRequests: 30,
  // 30 requests per 5 minutes per email
  message: "Too many requests for this email address",
  keyGenerator: /* @__PURE__ */ __name((req) => {
    const email = req.query.email || req.body?.email || "unknown";
    return `email_rate_limit:${email.toLowerCase()}`;
  }, "keyGenerator")
});
var ecosSessionRateLimit = new RateLimiter({
  windowMs: 10 * 60 * 1e3,
  // 10 minutes
  maxRequests: 20,
  // 20 ECOS operations per 10 minutes
  message: "Too many ECOS operations, please wait before creating more sessions",
  keyGenerator: /* @__PURE__ */ __name((req) => {
    const email = req.query.email || req.body?.email || req.ip || "unknown";
    return `ecos_rate_limit:${email.toLowerCase()}`;
  }, "keyGenerator")
});

// server/middleware/circuit-breaker.middleware.ts
var _CircuitBreakerError = class _CircuitBreakerError extends Error {
  constructor(message, state) {
    super(message);
    this.state = state;
    this.name = "CircuitBreakerError";
  }
};
__name(_CircuitBreakerError, "CircuitBreakerError");
var CircuitBreakerError = _CircuitBreakerError;
var _DatabaseCircuitBreaker = class _DatabaseCircuitBreaker {
  constructor(options = {}) {
    this.state = "CLOSED" /* CLOSED */;
    this.failureCount = 0;
    this.lastFailureTime = 0;
    this.lastSuccessTime = Date.now();
    this.requestCount = 0;
    this.options = {
      failureThreshold: 10,
      // Reasonable threshold - not too aggressive
      recoveryTimeMs: 6e4,
      // 1 minute recovery time for proper database recovery
      monitoringPeriodMs: 3e5,
      // 5 minutes monitoring window for stability
      expectedFailureRate: 0.5,
      // 50% failure rate threshold - reasonable for database issues
      ...options
    };
    this.startupGracePeriod = 6e4;
    this.startupTime = Date.now();
  }
  async execute(operation, fallback) {
    if (Date.now() - this.startupTime < this.startupGracePeriod) {
      try {
        return await operation();
      } catch (error) {
        console.log("\u26A0\uFE0F Startup grace period - ignoring failure for circuit breaker");
        throw error;
      }
    }
    if (this.state === "OPEN" /* OPEN */) {
      if (this.shouldAttemptReset()) {
        this.state = "HALF_OPEN" /* HALF_OPEN */;
        console.log("Circuit breaker moved to HALF_OPEN state - attempting recovery");
      } else {
        if (fallback) {
          console.log("Circuit breaker OPEN - using fallback");
          return await fallback();
        }
        throw new CircuitBreakerError(
          `Circuit breaker is OPEN. Service unavailable. Will retry after ${Math.ceil((this.lastFailureTime + this.options.recoveryTimeMs - Date.now()) / 1e3)}s`,
          this.state
        );
      }
    }
    this.requestCount++;
    try {
      const result = await this.executeWithTimeout(operation, 1e4);
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      if (fallback && this.state === "OPEN" /* OPEN */) {
        console.log("Circuit breaker opened due to failure - using fallback");
        return await fallback();
      }
      throw error;
    }
  }
  async executeWithTimeout(operation, timeoutMs) {
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error("Operation timeout")), timeoutMs);
    });
    return Promise.race([operation(), timeoutPromise]);
  }
  onSuccess() {
    this.failureCount = 0;
    this.lastSuccessTime = Date.now();
    if (this.state === "HALF_OPEN" /* HALF_OPEN */) {
      console.log("Circuit breaker recovered - moving to CLOSED state");
      this.state = "CLOSED" /* CLOSED */;
    }
  }
  onFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    if (this.state === "HALF_OPEN" /* HALF_OPEN */) {
      console.log("Circuit breaker failure during recovery - moving back to OPEN state");
      this.state = "OPEN" /* OPEN */;
      return;
    }
    if (this.shouldOpenCircuit()) {
      console.log(`Circuit breaker opening due to ${this.failureCount} failures`);
      this.state = "OPEN" /* OPEN */;
    }
  }
  shouldOpenCircuit() {
    if (this.failureCount >= this.options.failureThreshold) {
      return true;
    }
    const now = Date.now();
    const timeSinceLastSuccess = now - this.lastSuccessTime;
    if (timeSinceLastSuccess > this.options.monitoringPeriodMs && this.requestCount > 10) {
      const failureRate = this.failureCount / this.requestCount;
      return failureRate > this.options.expectedFailureRate;
    }
    return false;
  }
  shouldAttemptReset() {
    const now = Date.now();
    return now - this.lastFailureTime >= this.options.recoveryTimeMs;
  }
  getStatus() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      requestCount: this.requestCount,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      nextRetryTime: this.state === "OPEN" /* OPEN */ ? this.lastFailureTime + this.options.recoveryTimeMs : null
    };
  }
  reset() {
    this.state = "CLOSED" /* CLOSED */;
    this.failureCount = 0;
    this.requestCount = 0;
    this.lastSuccessTime = Date.now();
    console.log("Circuit breaker manually reset");
  }
};
__name(_DatabaseCircuitBreaker, "DatabaseCircuitBreaker");
var DatabaseCircuitBreaker = _DatabaseCircuitBreaker;
var databaseCircuitBreaker = new DatabaseCircuitBreaker({
  failureThreshold: 10,
  // Not too aggressive - allow some transient failures
  recoveryTimeMs: 6e4,
  // 1 minute recovery time for proper database recovery
  monitoringPeriodMs: 3e5,
  // 5 minutes monitoring window for better stability
  expectedFailureRate: 0.5
  // 50% failure rate before opening - reasonable for database issues
});

// server/services/logger.service.ts
var _Logger = class _Logger {
  constructor(serviceName = "app") {
    this.service = serviceName;
    this.isDevelopment = process.env.NODE_ENV !== "production";
  }
  formatLog(level, message, context) {
    return {
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      level,
      message,
      context,
      service: this.service,
      requestId: this.getCurrentRequestId()
    };
  }
  getCurrentRequestId() {
    return void 0;
  }
  log(level, message, context) {
    const entry = this.formatLog(level, message, context);
    if (this.isDevelopment) {
      const emoji = this.getLevelEmoji(level);
      const coloredLevel = this.getColoredLevel(level);
      if (context && Object.keys(context).length > 0) {
        console.log(`${emoji} ${coloredLevel} [${this.service}] ${message}`, context);
      } else {
        console.log(`${emoji} ${coloredLevel} [${this.service}] ${message}`);
      }
    } else {
      console.log(JSON.stringify(entry));
    }
  }
  getLevelEmoji(level) {
    switch (level) {
      case "error" /* ERROR */:
        return "\u274C";
      case "warn" /* WARN */:
        return "\u26A0\uFE0F";
      case "info" /* INFO */:
        return "\u2705";
      case "debug" /* DEBUG */:
        return "\u{1F50D}";
      case "trace" /* TRACE */:
        return "\u{1F4DD}";
      default:
        return "\u2139\uFE0F";
    }
  }
  getColoredLevel(level) {
    return level.toUpperCase();
  }
  error(message, context) {
    this.log("error" /* ERROR */, message, context);
  }
  warn(message, context) {
    this.log("warn" /* WARN */, message, context);
  }
  info(message, context) {
    this.log("info" /* INFO */, message, context);
  }
  debug(message, context) {
    if (this.isDevelopment) {
      this.log("debug" /* DEBUG */, message, context);
    }
  }
  trace(message, context) {
    if (this.isDevelopment) {
      this.log("trace" /* TRACE */, message, context);
    }
  }
  // Database operation logging
  database(operation, duration, context) {
    const logContext = {
      operation,
      duration: duration ? `${duration}ms` : void 0,
      ...context
    };
    this.info(`Database ${operation}`, logContext);
  }
  // HTTP request logging
  request(method, path, statusCode, duration, context) {
    const logContext = {
      method,
      path,
      statusCode,
      duration: duration ? `${duration}ms` : void 0,
      ...context
    };
    if (statusCode && statusCode >= 400) {
      this.error(`HTTP ${method} ${path}`, logContext);
    } else {
      this.info(`HTTP ${method} ${path}`, logContext);
    }
  }
  // Service initialization logging
  service(serviceName, status, duration, context) {
    const logContext = {
      service: serviceName,
      status,
      duration: duration ? `${duration}ms` : void 0,
      ...context
    };
    switch (status) {
      case "starting":
        this.info(`Service ${serviceName} starting`, logContext);
        break;
      case "ready":
        this.info(`Service ${serviceName} ready`, logContext);
        break;
      case "error":
        this.error(`Service ${serviceName} failed`, logContext);
        break;
    }
  }
};
__name(_Logger, "Logger");
var Logger = _Logger;
var logger = new Logger("ecos-app");
var dbLogger = new Logger("database");
var authLogger = new Logger("auth");
var apiLogger = new Logger("api");

// server/middleware/error-handler.middleware.ts
var _APIError = class _APIError extends Error {
  constructor(message, statusCode = 500, code = "INTERNAL_ERROR" /* INTERNAL_ERROR */, details) {
    super(message);
    this.name = "APIError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.timestamp = /* @__PURE__ */ new Date();
  }
  toJSON() {
    return {
      error: this.message,
      code: this.code,
      statusCode: this.statusCode,
      details: this.details,
      timestamp: this.timestamp.toISOString(),
      requestId: this.requestId
    };
  }
  // Factory methods for common errors
  static badRequest(message, details) {
    return new _APIError(message, 400, "INVALID_REQUEST" /* INVALID_REQUEST */, details);
  }
  static unauthorized(message = "Authentication required") {
    return new _APIError(message, 401, "AUTH_REQUIRED" /* AUTH_REQUIRED */);
  }
  static forbidden(message = "Permission denied") {
    return new _APIError(message, 403, "PERMISSION_DENIED" /* PERMISSION_DENIED */);
  }
  static notFound(message = "Resource not found") {
    return new _APIError(message, 404, "RESOURCE_NOT_FOUND" /* RESOURCE_NOT_FOUND */);
  }
  static validationError(message, details) {
    return new _APIError(message, 400, "VALIDATION_ERROR" /* VALIDATION_ERROR */, details);
  }
  static databaseError(message) {
    return new _APIError(message, 503, "DATABASE_ERROR" /* DATABASE_ERROR */);
  }
  static circuitBreakerOpen(message) {
    return new _APIError(message, 503, "CIRCUIT_BREAKER_OPEN" /* CIRCUIT_BREAKER_OPEN */);
  }
  static rateLimitExceeded(message) {
    return new _APIError(message, 429, "RATE_LIMIT_EXCEEDED" /* RATE_LIMIT_EXCEEDED */);
  }
  static internal(message = "Internal server error") {
    return new _APIError(message, 500, "INTERNAL_ERROR" /* INTERNAL_ERROR */);
  }
  static sessionNotFound(message = "Session not found") {
    return new _APIError(message, 404, "SESSION_NOT_FOUND" /* SESSION_NOT_FOUND */);
  }
  static scenarioNotFound(message = "Scenario not found") {
    return new _APIError(message, 404, "SCENARIO_NOT_FOUND" /* SCENARIO_NOT_FOUND */);
  }
  static evaluationFailed(message = "Evaluation failed") {
    return new _APIError(message, 422, "EVALUATION_FAILED" /* EVALUATION_FAILED */);
  }
  static externalServiceError(message, details) {
    return new _APIError(message, 503, "EXTERNAL_SERVICE_ERROR" /* EXTERNAL_SERVICE_ERROR */, details);
  }
};
__name(_APIError, "APIError");
var APIError = _APIError;
var _ErrorHandler = class _ErrorHandler {
  constructor() {
    this.isDevelopment = process.env.NODE_ENV !== "production";
    this.correlationIdHeader = "x-correlation-id";
  }
  // Request ID generation middleware
  addRequestId() {
    return (req, res, next) => {
      const requestId = req.headers[this.correlationIdHeader] || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      req.requestId = requestId;
      res.setHeader(this.correlationIdHeader, requestId);
      next();
    };
  }
  // Main error handler middleware
  handleError() {
    return (error, req, res, next) => {
      const requestId = req.requestId;
      let apiError;
      if (error instanceof APIError) {
        apiError = error;
      } else if (error instanceof z.ZodError) {
        apiError = this.handleZodError(error);
      } else if (error instanceof CircuitBreakerError) {
        apiError = this.handleCircuitBreakerError(error);
      } else if (error.name === "ValidationError") {
        apiError = APIError.validationError(error.message);
      } else if (error.code === "ECONNREFUSED" || error.code === "ENOTFOUND") {
        apiError = APIError.databaseError("Database connection failed");
      } else if (error.statusCode || error.status) {
        const statusCode = error.statusCode || error.status;
        const code = this.mapStatusCodeToErrorCode(statusCode);
        apiError = new APIError(error.message || "Request failed", statusCode, code);
      } else {
        apiError = APIError.internal(
          this.isDevelopment ? error.message : "An unexpected error occurred"
        );
      }
      apiError.requestId = requestId;
      this.logError(error, req, apiError);
      const response = {
        error: apiError.message,
        code: apiError.code,
        statusCode: apiError.statusCode,
        timestamp: apiError.timestamp.toISOString(),
        path: req.path,
        method: req.method,
        requestId: apiError.requestId,
        details: apiError.details
      };
      if (this.isDevelopment && error.stack) {
        response.stack = error.stack;
      }
      res.status(apiError.statusCode).json(response);
    };
  }
  // Handle unhandled promise rejections
  setupGlobalHandlers() {
    process.on("unhandledRejection", (reason, promise) => {
      logger.error("Unhandled Promise Rejection", { reason, promise: promise.toString() });
      if (process.env.NODE_ENV === "production") {
        logger.error("Shutting down due to unhandled promise rejection");
        process.exit(1);
      }
    });
    process.on("uncaughtException", (error) => {
      logger.error("Uncaught Exception", { error: error.message, stack: error.stack });
      process.exit(1);
    });
  }
  // Async wrapper to catch promise rejections
  asyncHandler(fn) {
    return (req, res, next) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  }
  handleZodError(error) {
    const details = error.errors.map((err) => ({
      field: err.path.join("."),
      message: err.message,
      value: err.path.length > 0 ? err.path.reduce((obj, key) => obj?.[key], error) : void 0,
      constraint: err.code
    }));
    return APIError.validationError("Request validation failed", details);
  }
  handleCircuitBreakerError(error) {
    return APIError.circuitBreakerOpen(error.message);
  }
  mapStatusCodeToErrorCode(statusCode) {
    switch (statusCode) {
      case 400:
        return "INVALID_REQUEST" /* INVALID_REQUEST */;
      case 401:
        return "AUTH_REQUIRED" /* AUTH_REQUIRED */;
      case 403:
        return "PERMISSION_DENIED" /* PERMISSION_DENIED */;
      case 404:
        return "RESOURCE_NOT_FOUND" /* RESOURCE_NOT_FOUND */;
      case 429:
        return "RATE_LIMIT_EXCEEDED" /* RATE_LIMIT_EXCEEDED */;
      case 503:
        return "DATABASE_UNAVAILABLE" /* DATABASE_UNAVAILABLE */;
      default:
        return "INTERNAL_ERROR" /* INTERNAL_ERROR */;
    }
  }
  logError(originalError, req, apiError) {
    const logData = {
      requestId: apiError.requestId,
      method: req.method,
      path: req.path,
      userAgent: req.headers["user-agent"],
      ip: req.ip,
      error: {
        message: apiError.message,
        code: apiError.code,
        statusCode: apiError.statusCode,
        stack: this.isDevelopment ? originalError.stack : void 0
      },
      query: req.query,
      body: this.sanitizeBody(req.body)
    };
    if (apiError.statusCode >= 500) {
      logger.error("API Error - Server", logData);
    } else if (apiError.statusCode >= 400) {
      logger.warn("API Error - Client", logData);
    }
  }
  sanitizeBody(body) {
    if (!body || typeof body !== "object") return body;
    const sanitized = { ...body };
    const sensitiveFields = ["password", "token", "apiKey", "secret", "auth"];
    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = "[REDACTED]";
      }
    }
    return sanitized;
  }
  // 404 handler for undefined routes
  notFoundHandler() {
    return (req, res, next) => {
      const error = APIError.notFound(`Route ${req.method} ${req.path} not found`);
      next(error);
    };
  }
  // Health check for error handling system
  healthCheck() {
    return (req, res) => {
      res.status(200).json({
        errorHandler: {
          status: "healthy",
          environment: this.isDevelopment ? "development" : "production",
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        }
      });
    };
  }
};
__name(_ErrorHandler, "ErrorHandler");
var ErrorHandler = _ErrorHandler;
var errorHandler = new ErrorHandler();
var asyncHandler = errorHandler.asyncHandler.bind(errorHandler);
var addRequestId = errorHandler.addRequestId.bind(errorHandler);
var handleError = errorHandler.handleError.bind(errorHandler);
var notFoundHandler = errorHandler.notFoundHandler.bind(errorHandler);

// server/routes.ts
init_openai_service();
async function registerRoutes(app) {
  const httpServer = createServer(app);
  const inMemoryUsers = /* @__PURE__ */ new Map();
  async function findOrCreateStudent(email) {
    try {
      try {
        if (inMemoryUsers.has(email)) {
          const user = inMemoryUsers.get(email);
          return { userId: user.userId, isNewUser: false };
        }
        const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        inMemoryUsers.set(email, { userId, createdAt: /* @__PURE__ */ new Date() });
        return { userId, isNewUser: true };
      } catch (dbError) {
        console.log("Database not available, using in-memory storage");
        if (inMemoryUsers.has(email)) {
          const user = inMemoryUsers.get(email);
          return { userId: user.userId, isNewUser: false };
        }
        const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        inMemoryUsers.set(email, { userId, createdAt: /* @__PURE__ */ new Date() });
        return { userId, isNewUser: true };
      }
    } catch (error) {
      console.error("Error in findOrCreateStudent:", error);
      throw error;
    }
  }
  __name(findOrCreateStudent, "findOrCreateStudent");
  app.get("/api/health", (req, res) => {
    res.status(200).json({
      status: "healthy",
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      service: "ecos-api",
      version: "1.0.0"
    });
  });
  app.get("/api/teacher/auth-check", (req, res) => {
    const { email } = req.query;
    const adminEmails = ["cherubindavid@gmail.com", "colombemadoungou@gmail.com"];
    const emailStr = typeof email === "string" ? email.trim().toLowerCase() : "";
    if (!emailStr) {
      return res.status(400).json({ message: "Email required" });
    }
    if (!adminEmails.includes(emailStr)) {
      return res.status(403).json({ message: "Not authorized as teacher" });
    }
    res.status(200).json({
      message: "Teacher authentication successful",
      email,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
  });
  app.post("/api/auth/login", authRateLimit.middleware(), validateContentType(), validateRequestSize(), validateLogin, async (req, res) => {
    try {
      const { email, password } = req.validatedBody || req.body;
      if (!isAdminAuthorized(email)) {
        return res.status(401).json({
          error: "Invalid credentials",
          code: "INVALID_CREDENTIALS"
        });
      }
      const token = authService.generateToken(email);
      res.status(200).json({
        message: "Login successful",
        token,
        user: {
          email,
          isAdmin: true
        }
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({
        error: "Login failed",
        code: "LOGIN_FAILED"
      });
    }
  });
  app.post("/api/auth/verify", authenticateToken, async (req, res) => {
    res.status(200).json({
      message: "Token valid",
      user: req.user
    });
  });
  app.get("/api/auth/profile", authenticateToken, async (req, res) => {
    res.status(200).json({
      user: req.user,
      adminEmails: authService.getAdminEmails()
    });
  });
  app.get("/api/auth/check-admin", asyncHandler(async (req, res) => {
    const email = req.query.email;
    if (!email) {
      throw APIError.badRequest("Email parameter required");
    }
    const isAdmin = authService.isAdmin(email);
    res.status(200).json({
      isAdmin,
      email: email.toLowerCase().trim()
    });
  }));
  app.post("/api/auth/firebase-login", firebaseAuthRateLimit.middleware(), async (req, res) => {
    try {
      const firebaseReq = req;
      await new Promise((resolve, reject) => {
        verifyFirebaseToken(firebaseReq, res, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      res.status(200).json({
        user: {
          uid: firebaseReq.firebaseUser.uid,
          email: firebaseReq.firebaseUser.email,
          role: firebaseReq.firebaseUser.role,
          emailVerified: firebaseReq.firebaseUser.emailVerified
        },
        jwtToken: firebaseReq.jwtToken,
        message: "Firebase authentication successful"
      });
    } catch (error) {
      console.error("\u274C Firebase login error:", error);
      res.status(403).json({
        error: error.message || "Firebase authentication failed",
        code: "FIREBASE_LOGIN_FAILED"
      });
    }
  });
  app.post("/api/auth/firebase-register", firebaseAuthRateLimit.middleware(), validateContentType(), validateRequestSize(), async (req, res) => {
    try {
      const { email, password, firstName, lastName } = req.body;
      if (!email || !password) {
        return res.status(400).json({
          error: "Email and password are required",
          code: "MISSING_CREDENTIALS"
        });
      }
      const emailRegex2 = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex2.test(email)) {
        return res.status(400).json({
          error: "Invalid email format",
          code: "INVALID_EMAIL"
        });
      }
      if (password.length < 6) {
        return res.status(400).json({
          error: "Password must be at least 6 characters",
          code: "WEAK_PASSWORD"
        });
      }
      const { firebaseAdminService: firebaseAdminService2 } = await Promise.resolve().then(() => (init_firebase_admin_service(), firebase_admin_service_exports));
      const existingUser = await firebaseAdminService2.getUserByEmail(email);
      if (existingUser) {
        return res.status(409).json({
          error: "Email already in use",
          code: "EMAIL_IN_USE"
        });
      }
      const firebaseUser = await firebaseAdminService2.createUser(email, password);
      const supabaseUser = await unifiedDb.createUser({
        email,
        firebaseUid: firebaseUser.uid,
        firstName: firstName || null,
        lastName: lastName || null,
        profileImageUrl: null
      });
      await unifiedDb.setUserRole(supabaseUser.id, "student");
      const jwtToken = authService.generateToken(email);
      res.status(201).json({
        user: {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          role: "student",
          emailVerified: false
        },
        jwtToken,
        message: "User registered successfully"
      });
    } catch (error) {
      console.error("\u274C Firebase registration error:", error);
      res.status(500).json({
        error: error.message || "Registration failed",
        code: "REGISTRATION_FAILED"
      });
    }
  });
  app.post("/api/admin/sync-scenarios", asyncHandler(async (req, res) => {
    const { email } = req.query;
    if (!email || !isAdminAuthorized(email)) {
      throw APIError.forbidden("Acc\xE8s non autoris\xE9");
    }
    await scenarioSyncService.syncScenariosFromPinecone();
    res.status(200).json({ message: "Synchronisation des sc\xE9narios termin\xE9e avec succ\xE8s" });
  }));
  app.get("/api/admin/test-db", async (req, res) => {
    const { email } = req.query;
    if (!email || !isAdminAuthorized(email)) {
      return res.status(403).json({ message: "Acc\xE8s non autoris\xE9" });
    }
    try {
      console.log("\u{1F527} Testing database connection via unified service...");
      await unifiedDb.initialize();
      const scenarios = await unifiedDb.getScenarios();
      res.status(200).json({
        connected: true,
        scenarios,
        count: scenarios.length,
        message: `Connexion Supabase r\xE9ussie - ${scenarios.length} sc\xE9narios trouv\xE9s`
      });
    } catch (error) {
      console.error("Error connecting to Supabase:", error);
      res.status(500).json({
        message: "Erreur de connexion \xE0 la base de donn\xE9es Supabase",
        error: error.message,
        connected: false
      });
    }
  });
  app.get("/api/student/available-scenarios", async (req, res) => {
    try {
      console.log("\u{1F527} Fetching student scenarios from database only...");
      const scenarios = await scenarioSyncService.getAvailableScenarios();
      res.status(200).json({
        scenarios,
        connected: true,
        source: "database"
      });
    } catch (error) {
      console.error("Error fetching student scenarios:", error);
      res.status(500).json({
        message: "Erreur de connexion \xE0 la base de donn\xE9es",
        error: error.message,
        connected: false
      });
    }
  });
  app.get("/api/teacher/scenarios", async (req, res) => {
    const { email } = req.query;
    const adminEmails = ["cherubindavid@gmail.com", "colombemadoungou@gmail.com"];
    const emailStr = typeof email === "string" ? email.trim().toLowerCase() : "";
    if (!emailStr || !adminEmails.includes(emailStr)) {
      if (emailStr && !adminEmails.includes(emailStr)) {
        console.log("\u26A0\uFE0F [SILENT-REJECT] Non-admin email attempted access:", emailStr);
      }
      return res.status(403).json({ message: "Acc\xE8s non autoris\xE9" });
    }
    console.log("\u2705 [ADMIN-ACCESS] Authorized admin email:", emailStr);
    try {
      console.log("\u{1F527} Fetching teacher scenarios using unified database...");
      const scenarios = await unifiedDb.getScenarios();
      res.status(200).json({
        scenarios,
        connected: true,
        source: "unified-database"
      });
    } catch (error) {
      console.error("Error fetching teacher scenarios:", error);
      res.status(200).json({
        scenarios: [],
        connected: false,
        source: "error-fallback",
        message: "Service temporarily unavailable",
        error: error.message
      });
    }
  });
  app.get("/api/ecos/scenarios", async (req, res) => {
    try {
      console.log("\u{1F527} Fetching scenarios via /api/ecos/scenarios using unified database...");
      const scenarios = await unifiedDb.getScenarios();
      res.status(200).json({
        scenarios,
        connected: true,
        source: "unified-database-ecos-endpoint"
      });
    } catch (error) {
      console.error("Error fetching scenarios via /api/ecos/scenarios:", error);
      res.status(200).json({
        scenarios: [],
        connected: false,
        source: "error-fallback-ecos-endpoint",
        message: "Service temporarily unavailable",
        error: error.message
      });
    }
  });
  app.post("/api/ecos/scenarios", async (req, res) => {
    const { email, title, description, patientPrompt, evaluationCriteria, pineconeIndex } = req.body;
    if (!email || !isAdminAuthorized(email)) {
      return res.status(403).json({ message: "Acc\xE8s non autoris\xE9" });
    }
    if (!title || !description) {
      return res.status(400).json({ message: "Titre et description requis" });
    }
    try {
      let parsedCriteria = null;
      if (evaluationCriteria) {
        try {
          if (typeof evaluationCriteria === "string") {
            parsedCriteria = JSON.parse(evaluationCriteria);
          } else if (typeof evaluationCriteria === "object") {
            parsedCriteria = evaluationCriteria;
          }
          if (!parsedCriteria || typeof parsedCriteria !== "object") {
            throw new Error("Evaluation criteria must be a valid object");
          }
        } catch (parseError) {
          return res.status(400).json({
            message: "Format JSON invalide pour les crit\xE8res d'\xE9valuation",
            error: parseError.message
          });
        }
      }
      await unifiedDb.initialize();
      const newScenario = await unifiedDb.createScenario({
        title,
        description,
        patientPrompt: patientPrompt || null,
        evaluationCriteria: parsedCriteria,
        imageUrl: null,
        createdBy: email
      });
      res.status(200).json({
        message: "Sc\xE9nario cr\xE9\xE9 avec succ\xE8s",
        scenario: newScenario
      });
    } catch (error) {
      console.error("Error creating scenario:", error);
      res.status(500).json({
        message: "Erreur lors de la cr\xE9ation du sc\xE9nario",
        error: error.message
      });
    }
  });
  app.put("/api/ecos/scenarios/:id", async (req, res) => {
    const { id } = req.params;
    const { email, title, description, patientPrompt, evaluationCriteria, pineconeIndex } = req.body;
    if (!email || !isAdminAuthorized(email)) {
      return res.status(403).json({ message: "Acc\xE8s non autoris\xE9" });
    }
    try {
      let parsedCriteria = null;
      if (evaluationCriteria) {
        try {
          if (typeof evaluationCriteria === "string") {
            parsedCriteria = JSON.parse(evaluationCriteria);
          } else if (typeof evaluationCriteria === "object") {
            parsedCriteria = evaluationCriteria;
          }
          if (!parsedCriteria || typeof parsedCriteria !== "object") {
            throw new Error("Evaluation criteria must be a valid object");
          }
        } catch (parseError) {
          return res.status(400).json({
            message: "Format JSON invalide pour les crit\xE8res d'\xE9valuation",
            error: parseError.message
          });
        }
      }
      await unifiedDb.initialize();
      const updatedScenario = await unifiedDb.updateScenario(id, {
        title,
        description,
        patientPrompt: patientPrompt || null,
        evaluationCriteria: parsedCriteria,
        pineconeIndex: pineconeIndex || null
      });
      res.status(200).json({
        message: "Sc\xE9nario modifi\xE9 avec succ\xE8s",
        scenario: updatedScenario
      });
    } catch (error) {
      console.error("Error updating scenario:", error);
      res.status(500).json({
        message: "Erreur lors de la modification du sc\xE9nario",
        error: error.message
      });
    }
  });
  app.delete("/api/ecos/scenarios/:id", async (req, res) => {
    const { id } = req.params;
    const { email } = req.query;
    if (!email || !isAdminAuthorized(email)) {
      return res.status(403).json({ message: "Acc\xE8s non autoris\xE9" });
    }
    try {
      await unifiedDb.initialize();
      await unifiedDb.deleteScenario(id);
      res.status(200).json({
        message: "Sc\xE9nario supprim\xE9 avec succ\xE8s"
      });
    } catch (error) {
      console.error("Error deleting scenario:", error);
      res.status(500).json({
        message: "Erreur lors de la suppression du sc\xE9nario",
        error: error.message
      });
    }
  });
  app.post("/api/ecos/generate-criteria", async (req, res) => {
    const { email, scenarioDescription } = req.body;
    if (!email || !isAdminAuthorized(email)) {
      return res.status(403).json({ message: "Acc\xE8s non autoris\xE9" });
    }
    if (!scenarioDescription) {
      return res.status(400).json({ message: "Description du sc\xE9nario requise" });
    }
    try {
      const { promptGenService: promptGenService2 } = await Promise.resolve().then(() => (init_promptGen_service(), promptGen_service_exports));
      const criteria = await promptGenService2.generateEvaluationCriteria(scenarioDescription);
      res.status(200).json({
        message: "Crit\xE8res d'\xE9valuation g\xE9n\xE9r\xE9s avec succ\xE8s",
        criteria
      });
    } catch (error) {
      console.error("Error generating evaluation criteria:", error);
      res.status(500).json({
        message: "Erreur lors de la g\xE9n\xE9ration des crit\xE8res d'\xE9valuation",
        error: error.message
      });
    }
  });
  app.post("/api/teacher/generate-criteria", async (req, res) => {
    const { email, textCriteria, scenarioId } = req.body;
    if (!email || !isAdminAuthorized(email)) {
      return res.status(403).json({ message: "Acc\xE8s non autoris\xE9" });
    }
    if (!textCriteria) {
      return res.status(400).json({ message: "Description des crit\xE8res d'\xE9valuation requise" });
    }
    try {
      console.log(`\u{1F504} Generating criteria for teacher ${email}`);
      console.log(`\u{1F4DD} Text criteria: ${textCriteria.substring(0, 100)}...`);
      const { promptGenService: promptGenService2 } = await Promise.resolve().then(() => (init_promptGen_service(), promptGen_service_exports));
      const generatedCriteria = await promptGenService2.generateEvaluationCriteria(textCriteria);
      console.log("\u2705 Generated criteria:", generatedCriteria);
      if (scenarioId) {
        console.log(`\u{1F4CA} Updating scenario ${scenarioId} with generated criteria`);
        try {
          await unifiedDb.initialize();
          const updatedScenario = await unifiedDb.updateScenario(scenarioId, {
            evaluationCriteria: generatedCriteria
          });
          console.log(`\u2705 Scenario ${scenarioId} updated successfully`);
          res.status(200).json({
            message: "Crit\xE8res d'\xE9valuation g\xE9n\xE9r\xE9s et synchronis\xE9s avec succ\xE8s",
            criteria: generatedCriteria,
            scenarioUpdated: true,
            scenarioId,
            scenarioTitle: updatedScenario.title
          });
        } catch (updateError) {
          console.error(`\u274C Failed to update scenario ${scenarioId}:`, updateError.message);
          res.status(200).json({
            message: "Crit\xE8res d'\xE9valuation g\xE9n\xE9r\xE9s avec succ\xE8s, mais la synchronisation avec la base de donn\xE9es a \xE9chou\xE9",
            criteria: generatedCriteria,
            scenarioUpdated: false,
            error: updateError.message,
            warning: `Le sc\xE9nario ${scenarioId} n'existe pas ou n'a pas pu \xEAtre mis \xE0 jour`
          });
        }
      } else {
        res.status(200).json({
          message: "Crit\xE8res d'\xE9valuation g\xE9n\xE9r\xE9s avec succ\xE8s",
          criteria: generatedCriteria,
          scenarioUpdated: false
        });
      }
    } catch (error) {
      console.error("Error in teacher generate-criteria:", error);
      res.status(500).json({
        message: "Erreur lors de la g\xE9n\xE9ration des crit\xE8res d'\xE9valuation",
        error: error.message,
        details: process.env.NODE_ENV === "development" ? error.stack : void 0
      });
    }
  });
  app.post("/api/teacher/update-pinecone-index", async (req, res) => {
    const { email, scenarioId, pineconeIndex } = req.body;
    if (!email || !isAdminAuthorized(email)) {
      return res.status(403).json({ message: "Acc\xE8s non autoris\xE9" });
    }
    if (!scenarioId) {
      return res.status(400).json({ message: "ID du sc\xE9nario requis" });
    }
    if (!pineconeIndex) {
      return res.status(400).json({ message: "Index Pinecone requis" });
    }
    try {
      console.log(`\u{1F504} Updating Pinecone index for scenario ${scenarioId} to ${pineconeIndex}`);
      await unifiedDb.initialize();
      const updatedScenario = await unifiedDb.updateScenario(scenarioId, {
        pineconeIndex
      });
      console.log(`\u2705 Scenario ${scenarioId} Pinecone index updated successfully`);
      res.status(200).json({
        message: "Index Pinecone synchronis\xE9 avec succ\xE8s",
        scenarioId,
        pineconeIndex,
        scenarioTitle: updatedScenario.title,
        success: true
      });
    } catch (error) {
      console.error(`\u274C Failed to update Pinecone index for scenario ${scenarioId}:`, error.message);
      res.status(500).json({
        message: "Erreur lors de la synchronisation de l'index Pinecone",
        error: error.message,
        scenarioId,
        pineconeIndex,
        success: false
      });
    }
  });
  app.get("/api/teacher/dashboard", async (req, res) => {
    const { email } = req.query;
    const adminEmails = ["cherubindavid@gmail.com", "colombemadoungou@gmail.com"];
    const emailStr = typeof email === "string" ? email.trim().toLowerCase() : "";
    if (!emailStr || !adminEmails.includes(emailStr)) {
      return res.status(403).json({ message: "Acc\xE8s non autoris\xE9" });
    }
    try {
      console.log("\u{1F527} Fetching teacher dashboard using unified database...");
      const stats = await unifiedDb.getDashboardStats();
      res.status(200).json(stats);
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      res.status(200).json({
        totalScenarios: 0,
        activeSessions: 0,
        completedSessions: 0,
        totalStudents: 0,
        message: "Service temporarily unavailable"
      });
    }
  });
  app.get("/api/admin/indexes", async (req, res) => {
    const { email } = req.query;
    if (!email || !isAdminAuthorized(email)) {
      return res.status(403).json({ message: "Acc\xE8s non autoris\xE9" });
    }
    try {
      const { pineconeService: pineconeService2 } = await Promise.resolve().then(() => (init_pinecone_service(), pinecone_service_exports));
      console.log("\u{1F504} Fetching Pinecone indexes...");
      const indexes = await pineconeService2.listIndexes();
      console.log("\u2705 Indexes fetched successfully:", indexes);
      res.status(200).json({
        indexes,
        message: "Index r\xE9cup\xE9r\xE9s avec succ\xE8s"
      });
    } catch (error) {
      console.error("Error fetching indexes:", error);
      res.status(500).json({
        message: "Erreur lors de la r\xE9cup\xE9ration des index Pinecone",
        error: error.message
      });
    }
  });
  app.post("/api/student", validateContentType(), validateRequestSize(), validateCreateStudent, async (req, res) => {
    const schema = z.object({
      email: z.string().email("Format d'email invalide")
    });
    try {
      const { email } = schema.parse(req.body);
      const { userId, isNewUser } = await findOrCreateStudent(email);
      res.status(200).json({
        message: "Compte \xE9tudiant trait\xE9 avec succ\xE8s",
        userId,
        isNewUser
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Donn\xE9es invalides", errors: error.errors });
      }
      console.error("Error in /api/student:", error);
      res.status(500).json({ message: "Erreur interne du serveur" });
    }
  });
  app.post("/api/student/auto-register", validateContentType(), validateRequestSize(), async (req, res) => {
    const schema = z.object({
      email: z.string().email("Format d'email invalide")
    });
    try {
      const { email } = schema.parse(req.body);
      console.log("\u{1F680} Auto-registering student:", email);
      const { userId, isNewUser } = await findOrCreateStudent(email);
      res.status(200).json({
        message: "Auto-registration successful",
        userId,
        isNewUser,
        email
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid email format", errors: error.errors });
      }
      console.error("Error in /api/student/auto-register:", error);
      res.status(500).json({ message: "Auto-registration failed" });
    }
  });
  app.post("/api/session/start", async (req, res) => {
    return res.status(501).json({
      message: "Fonctionnalit\xE9 temporairement d\xE9sactiv\xE9e",
      details: "Cette fonctionnalit\xE9 sera r\xE9activ\xE9e une fois la base de donn\xE9es connect\xE9e"
    });
  });
  app.get("/api/student/scenarios", async (req, res) => {
    const schema = z.object({
      email: z.string().email()
    });
    try {
      const { email } = schema.parse(req.query);
      try {
        const scenarios = await scenarioSyncService.getAvailableScenarios();
        res.status(200).json({
          scenarios,
          training_sessions: [],
          source: "database"
        });
      } catch (dbError) {
        console.error("Database error:", dbError);
        res.status(200).json({
          scenarios: [],
          training_sessions: [],
          source: "database",
          error: "Database connection issue"
        });
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Donn\xE9es invalides", errors: error.errors });
      }
      console.error("Error in /api/student/scenarios:", error);
      res.status(500).json({ message: "Erreur interne du serveur" });
    }
  });
  app.get("/api/admin/health", async (req, res) => {
    try {
      const healthResult = await unifiedDb.healthCheck();
      res.status(200).json({
        status: "healthy",
        message: "Database connection is working.",
        metrics: healthResult.metrics,
        uptime: healthResult.uptime
      });
    } catch (error) {
      console.error("Health check failed:", error);
      res.status(500).json({
        status: "unhealthy",
        message: "Database connection failed",
        error: error.message
      });
    }
  });
  app.get("/api/teacher/students", async (req, res) => {
    const { email } = req.query;
    const adminEmails = ["cherubindavid@gmail.com", "colombemadoungou@gmail.com"];
    const emailStr = typeof email === "string" ? email.trim().toLowerCase() : "";
    if (!emailStr || !adminEmails.includes(emailStr)) {
      return res.status(403).json({ message: "Acc\xE8s non autoris\xE9" });
    }
    try {
      console.log("\u{1F527} Fetching teacher students using unified database...");
      const students = await unifiedDb.getStudents();
      res.status(200).json({
        students,
        message: "Student list retrieved successfully",
        connected: true
      });
    } catch (error) {
      console.error("Error fetching teacher students:", error);
      res.status(200).json({
        students: [],
        message: "Service temporarily unavailable",
        connected: false,
        error: error.message
      });
    }
  });
  app.put("/api/training-sessions/:id", ecosSessionRateLimit.middleware(), validateContentType(), validateRequestSize(), async (req, res) => {
    try {
      const { id } = req.params;
      const { email, ...updates } = req.body;
      if (!email) {
        return res.status(400).json({
          error: "Email is required",
          code: "MISSING_EMAIL"
        });
      }
      const adminEmails = ["cherubindavid@gmail.com", "colombemadoungou@gmail.com"];
      const emailStr = typeof email === "string" ? email.trim().toLowerCase() : "";
      if (!adminEmails.includes(emailStr)) {
        return res.status(403).json({
          message: "Acc\xE8s non autoris\xE9 - fonction r\xE9serv\xE9e aux administrateurs"
        });
      }
      console.log(`\u{1F504} Updating training session ${id} for admin: ${email}`);
      const updatedSession = await unifiedDb.updateTrainingSession(id, updates, emailStr);
      res.status(200).json({
        trainingSession: updatedSession,
        message: "Training session updated successfully",
        success: true
      });
    } catch (error) {
      console.error("Error updating training session:", error);
      res.status(500).json({
        error: "Failed to update training session",
        code: "TRAINING_SESSION_UPDATE_FAILED"
      });
    }
  });
  app.delete("/api/training-sessions/:id", ecosSessionRateLimit.middleware(), async (req, res) => {
    try {
      const { id } = req.params;
      const { email } = req.query;
      if (!email) {
        return res.status(400).json({
          error: "Email is required",
          code: "MISSING_EMAIL"
        });
      }
      const adminEmails = ["cherubindavid@gmail.com", "colombemadoungou@gmail.com"];
      const emailStr = typeof email === "string" ? email.trim().toLowerCase() : "";
      if (!adminEmails.includes(emailStr)) {
        return res.status(403).json({
          message: "Acc\xE8s non autoris\xE9 - fonction r\xE9serv\xE9e aux administrateurs"
        });
      }
      console.log(`\u{1F504} Deleting training session ${id} for admin: ${email}`);
      await unifiedDb.deleteTrainingSession(id, emailStr);
      res.status(200).json({
        message: "Training session deleted successfully",
        success: true
      });
    } catch (error) {
      console.error("Error deleting training session:", error);
      res.status(500).json({
        error: "Failed to delete training session",
        code: "TRAINING_SESSION_DELETE_FAILED"
      });
    }
  });
  app.get("/api/training-sessions", ecosSessionRateLimit.middleware(), async (req, res) => {
    try {
      const { email } = req.query;
      if (!email) {
        return res.status(400).json({
          error: "Email is required",
          code: "MISSING_EMAIL"
        });
      }
      const adminEmails = ["cherubindavid@gmail.com", "colombemadoungou@gmail.com"];
      const emailStr = typeof email === "string" ? email.trim().toLowerCase() : "";
      if (!adminEmails.includes(emailStr)) {
        return res.status(403).json({
          message: "Acc\xE8s non autoris\xE9 - fonction r\xE9serv\xE9e aux administrateurs"
        });
      }
      console.log(`\u{1F504} Fetching training sessions for admin: ${email}`);
      const trainingSessions = await unifiedDb.getTrainingSessions(emailStr);
      res.status(200).json({
        trainingSessions,
        message: "Training sessions retrieved successfully",
        count: trainingSessions.length
      });
    } catch (error) {
      console.error("Error fetching training sessions:", error);
      res.status(500).json({
        error: "Failed to fetch training sessions",
        code: "TRAINING_SESSIONS_FETCH_FAILED"
      });
    }
  });
  app.get("/api/training-sessions/:id", ecosSessionRateLimit.middleware(), async (req, res) => {
    try {
      const { id } = req.params;
      const { email } = req.query;
      if (!email) {
        return res.status(400).json({
          error: "Email is required",
          code: "MISSING_EMAIL"
        });
      }
      const adminEmails = ["cherubindavid@gmail.com", "colombemadoungou@gmail.com"];
      const emailStr = typeof email === "string" ? email.trim().toLowerCase() : "";
      if (!adminEmails.includes(emailStr)) {
        return res.status(403).json({
          message: "Acc\xE8s non autoris\xE9 - fonction r\xE9serv\xE9e aux administrateurs"
        });
      }
      console.log(`\u{1F504} Fetching training session ${id} for admin: ${email}`);
      const trainingSession = await unifiedDb.getTrainingSessionById(id, emailStr);
      if (!trainingSession) {
        return res.status(404).json({
          error: "Training session not found",
          code: "TRAINING_SESSION_NOT_FOUND"
        });
      }
      res.status(200).json({
        trainingSession,
        message: "Training session details retrieved successfully"
      });
    } catch (error) {
      console.error("Error fetching training session details:", error);
      res.status(500).json({
        error: "Failed to fetch training session details",
        code: "TRAINING_SESSION_DETAILS_FAILED"
      });
    }
  });
  app.post("/api/training-sessions", ecosSessionRateLimit.middleware(), validateContentType(), validateRequestSize(), validateCreateTrainingSession, async (req, res) => {
    try {
      const { email } = req.body;
      const { title, description, scenarioIds, studentEmails } = req.body;
      const adminEmails = ["cherubindavid@gmail.com", "colombemadoungou@gmail.com"];
      const emailStr = typeof email === "string" ? email.trim().toLowerCase() : "";
      if (!adminEmails.includes(emailStr)) {
        return res.status(403).json({
          message: "Acc\xE8s non autoris\xE9 - fonction r\xE9serv\xE9e aux administrateurs"
        });
      }
      console.log(`\u{1F504} Creating training session for admin: ${email}`);
      console.log(`\u{1F4DD} Session details:`, { title, description, scenarioIds, studentEmails });
      const newTrainingSession = await unifiedDb.createTrainingSession({
        title,
        description,
        createdBy: emailStr,
        scenarioIds: scenarioIds || [],
        studentEmails: studentEmails || []
      });
      res.status(201).json({
        trainingSession: newTrainingSession,
        message: "Training session created successfully",
        success: true
      });
    } catch (error) {
      console.error("Error creating training session:", error);
      res.status(500).json({
        error: "Failed to create training session",
        code: "TRAINING_SESSION_CREATE_FAILED"
      });
    }
  });
  app.get("/api/ecos/sessions", async (req, res) => {
    try {
      const { email } = req.query;
      if (!email) {
        return res.status(400).json({
          error: "Email is required",
          code: "MISSING_EMAIL"
        });
      }
      res.status(200).json({
        sessions: [],
        message: "Sessions retrieved successfully"
      });
    } catch (error) {
      console.error("Error getting ECOS sessions:", error);
      res.status(500).json({
        error: "Failed to get ECOS sessions",
        code: "SESSIONS_GET_FAILED"
      });
    }
  });
  app.post("/api/ecos/sessions", ecosSessionRateLimit.middleware(), validateContentType(), validateRequestSize(), validateCreateEcosSession, async (req, res) => {
    try {
      const { studentEmail, scenarioId } = req.validatedBody || req.body;
      if (!studentEmail || !scenarioId) {
        return res.status(400).json({
          error: "StudentEmail and scenarioId are required",
          code: "MISSING_REQUIRED_FIELDS"
        });
      }
      const sessionId = `session_${scenarioId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      try {
        const sessionData = await unifiedDb.createSession({
          sessionId,
          studentEmail,
          scenarioId: parseInt(scenarioId),
          status: "active"
        });
        console.log("\u2705 Created and stored ECOS session:", sessionId, "in database");
      } catch (dbError) {
        console.error("\u274C Failed to store session in database:", dbError.message);
        console.warn("\u26A0\uFE0F Session created in memory only due to database error");
      }
      res.status(201).json({
        sessionId,
        scenarioId: parseInt(scenarioId),
        studentEmail,
        status: "active",
        startTime: /* @__PURE__ */ new Date(),
        message: "ECOS session created successfully"
      });
    } catch (error) {
      console.error("Error creating ECOS session:", error);
      res.status(500).json({
        error: "Failed to create ECOS session",
        code: "SESSION_CREATE_FAILED"
      });
    }
  });
  app.get("/api/ecos/sessions/:sessionId", async (req, res) => {
    try {
      const { sessionId } = req.params;
      const { email } = req.query;
      if (!email) {
        return res.status(400).json({
          error: "Email is required",
          code: "MISSING_EMAIL"
        });
      }
      try {
        let scenarioId = null;
        if (sessionId.startsWith("session_")) {
          const parts = sessionId.split("_");
          if (parts.length >= 2 && !isNaN(parseInt(parts[1]))) {
            scenarioId = parseInt(parts[1]);
          }
        }
        if (!scenarioId) {
          return res.status(400).json({
            error: "Invalid session ID format - cannot extract scenario ID",
            code: "INVALID_SESSION_ID"
          });
        }
        const scenarios = await unifiedDb.getScenarios();
        const scenario = scenarios.find((s) => s.id === scenarioId);
        if (!scenario) {
          return res.status(404).json({
            error: `Scenario ${scenarioId} not found in database`,
            code: "SCENARIO_NOT_FOUND"
          });
        }
        const cleanEvaluationCriteria = /* @__PURE__ */ __name((criteria) => {
          if (!criteria) return null;
          if (criteria.evaluation_criteria && Array.isArray(criteria.evaluation_criteria)) {
            console.log("\u2705 Using clean evaluation_criteria array format");
            return criteria.evaluation_criteria;
          }
          if (Array.isArray(criteria) || typeof criteria === "object" && !criteria.generatedText) {
            console.log("\u2705 Using existing clean criteria format");
            return criteria;
          }
          if (criteria.generatedText && typeof criteria.generatedText === "string") {
            try {
              console.log("\u{1F504} Parsing generatedText to extract evaluation criteria");
              const parsed = JSON.parse(criteria.generatedText.replace(/```json\n?|\n?```/g, ""));
              return parsed.evaluation_criteria || parsed;
            } catch (e) {
              console.warn("\u274C Failed to parse generatedText criteria, using original format");
              return criteria;
            }
          }
          return criteria;
        }, "cleanEvaluationCriteria");
        return res.status(200).json({
          session: {
            id: sessionId,
            status: "active",
            startTime: /* @__PURE__ */ new Date(),
            studentEmail: email,
            scenario: {
              id: scenario.id,
              title: scenario.title,
              description: scenario.description,
              patient_prompt: scenario.patient_prompt,
              evaluation_criteria: cleanEvaluationCriteria(scenario.evaluation_criteria)
            }
          },
          messages: [],
          totalMessages: 0,
          note: "Session with complete scenario data from database"
        });
      } catch (dbError) {
        console.error("\u274C Database error retrieving scenario:", dbError);
        return res.status(500).json({
          error: "Database error - unable to retrieve scenario data",
          code: "DATABASE_ERROR",
          details: process.env.NODE_ENV === "development" ? dbError.message : "Internal server error"
        });
      }
    } catch (error) {
      console.error("Error getting ECOS session:", error);
      res.status(500).json({
        error: "Failed to get ECOS session",
        code: "SESSION_GET_FAILED"
      });
    }
  });
  app.put("/api/ecos/sessions/:sessionId", validateContentType(), validateRequestSize(), async (req, res) => {
    try {
      const { sessionId } = req.params;
      const { email, status } = req.body;
      if (!email) {
        return res.status(400).json({
          error: "Email is required",
          code: "MISSING_EMAIL"
        });
      }
      if (!status) {
        return res.status(400).json({
          error: "Status is required",
          code: "MISSING_STATUS"
        });
      }
      console.log(`\u{1F4DD} Updating session ${sessionId} status to ${status} for ${email}`);
      try {
        console.log(`Session ${sessionId} marked as ${status}`);
      } catch (dbError) {
        console.warn("Database not available, session update not persisted");
      }
      res.status(200).json({
        sessionId,
        status,
        updatedAt: /* @__PURE__ */ new Date(),
        message: "Session updated successfully"
      });
    } catch (error) {
      console.error("Error updating ECOS session:", error);
      res.status(500).json({
        error: "Failed to update ECOS session",
        code: "SESSION_UPDATE_FAILED"
      });
    }
  });
  app.post("/api/ecos/sessions/:sessionId/messages", apiRateLimit.middleware(), validateContentType(), validateRequestSize(), validateEcosMessage, async (req, res) => {
    const { email } = req.query;
    if (!email) {
      return res.status(400).json({ message: "Email requis" });
    }
    try {
      const { sessionId } = req.params;
      const { email: email2 } = req.query;
      const { message, role, type } = req.validatedBody || req.body;
      const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      try {
        await unifiedDb.storeSessionMessage({
          sessionId,
          role: role || "user",
          question: message,
          response: "",
          content: message
        });
        console.log("\u2705 Stored user message in database for session:", sessionId);
      } catch (dbError) {
        console.warn("\u26A0\uFE0F Failed to store user message:", dbError.message);
      }
      const aiResponseContent = `I understand your message: "${message}". How can I assist you further in this medical scenario?`;
      const aiResponse = {
        id: `msg_ai_${Date.now()}`,
        sessionId,
        content: aiResponseContent,
        role: "assistant",
        type: "text",
        senderEmail: "system@ecos.ai",
        createdAt: /* @__PURE__ */ new Date()
      };
      try {
        await unifiedDb.storeSessionMessage({
          sessionId,
          role: "assistant",
          question: "",
          response: aiResponseContent,
          content: aiResponseContent
        });
        console.log("\u2705 Stored AI response in database for session:", sessionId);
      } catch (dbError) {
        console.warn("\u26A0\uFE0F Failed to store AI response:", dbError.message);
      }
      res.status(201).json({
        userMessage: {
          id: messageId,
          sessionId,
          content: message,
          role: role || "user",
          type: type || "text",
          senderEmail: email2,
          createdAt: /* @__PURE__ */ new Date()
        },
        aiResponse,
        message: "Message added to session successfully"
      });
    } catch (error) {
      console.error("Error adding message to ECOS session:", error);
      res.status(500).json({
        error: "Failed to add message to session",
        code: "MESSAGE_ADD_FAILED"
      });
    }
  });
  const slugifyId = /* @__PURE__ */ __name((value, fallback) => {
    if (!value) return fallback;
    return value.toString().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "") || fallback;
  }, "slugifyId");
  const normalizeText = /* @__PURE__ */ __name((value) => {
    return value ? value.toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() : "";
  }, "normalizeText");
  const extractRelevantExcerpts = /* @__PURE__ */ __name((messages, maxExcerpts = 3) => {
    if (!Array.isArray(messages) || messages.length === 0) {
      return [];
    }
    const excerpts = [];
    const totalMessages = messages.length;
    if (totalMessages <= maxExcerpts) {
      excerpts.push(...messages);
    } else {
      const indices = [
        0,
        // First exchange
        Math.floor(totalMessages / 2),
        // Middle
        totalMessages - 1
        // Last exchange
      ].slice(0, maxExcerpts);
      indices.forEach((index) => {
        if (messages[index]) {
          excerpts.push(messages[index]);
        }
      });
    }
    return excerpts.map((msg) => ({
      role: msg.role === "user" ? "\xC9tudiant" : "Patient",
      rawRole: msg.role,
      excerpt: (msg.question || msg.response || msg.content || "").toString().slice(0, 220),
      timestamp: msg.timestamp || msg.created_at || msg.updated_at || null
    }));
  }, "extractRelevantExcerpts");
  app.post("/api/ecos/sessions/:sessionId/evaluate", ecosEvaluationRateLimit.middleware(), validateContentType(), validateRequestSize(), validateEcosEvaluation, async (req, res) => {
    const { email } = req.query;
    if (!email) {
      return res.status(400).json({ message: "Email requis" });
    }
    try {
      const { sessionId } = req.params;
      const { criteria, responses } = req.validatedBody || req.body;
      const scenarioIdMatch = sessionId.match(/^session_(\d+)_/);
      const scenarioId = scenarioIdMatch ? parseInt(scenarioIdMatch[1]) : null;
      const scenarios = await unifiedDb.getScenarios();
      const scenario = scenarioId ? scenarios.find((s) => s.id === scenarioId) : null;
      console.log("\u{1F50D} [TRACE] Loaded scenario:", scenario?.id, scenario?.title);
      console.log("\u{1F50D} [TRACE] Scenario has evaluation_criteria?", !!scenario?.evaluation_criteria);
      const dbCriteria = scenario?.evaluation_criteria || null;
      const messages = await unifiedDb.getSessionMessages(sessionId, 50);
      if (!messages || messages.length === 0) {
        return res.status(400).json({
          error: "Pas assez d'\xE9changes pour une \xE9valuation - la session \xE9tait vide",
          code: "INSUFFICIENT_CONTENT",
          sessionId,
          messagesFound: messages?.length || 0
        });
      }
      const transcript = messages.map((msg, idx) => {
        const content = msg.question || msg.response || msg.content || "";
        const role = msg.role === "user" ? "\xC9tudiant" : "Patient";
        return `${role}: ${content.toString().trim()}`;
      }).join("\n---\n");
      console.log(`\u{1F4CA} Building evaluation from ${messages.length} messages for session ${sessionId}`);
      console.log(`\u{1F4DD} Transcript preview:`, transcript.substring(0, 200) + "...");
      const normalizeCriteria = /* @__PURE__ */ __name((raw) => {
        try {
          if (!raw) return [];
          if (raw.evaluation_criteria && Array.isArray(raw.evaluation_criteria)) {
            return raw.evaluation_criteria.map((c, i) => ({
              id: (c.id || c.key || c.name || c.label || `crit_${i}`).toString().toLowerCase().replace(/\s+/g, "_"),
              name: c.name || c.label || c.id || `Crit\xE8re ${i + 1}`,
              description: c.description || "",
              maxScore: typeof c.maxScore === "number" ? c.maxScore : 4,
              weight: typeof c.weight === "number" ? c.weight : typeof c.poids === "number" ? c.poids : null,
              indicators: Array.isArray(c.indicators) ? c.indicators.map((ind) => ind.description || ind.name || ind).filter(Boolean) : Array.isArray(c.elements) ? c.elements.map((el) => typeof el === "string" ? el : el.description || el.name || "").filter(Boolean) : c.description ? [c.description] : []
            }));
          }
          if (Array.isArray(raw)) {
            return raw.map((c, i) => ({
              id: (c.id || c.key || c.name || c.label || `crit_${i}`).toString().toLowerCase().replace(/\s+/g, "_"),
              name: c.name || c.label || c.id || `Crit\xE8re ${i + 1}`,
              description: c.description || "",
              maxScore: typeof c.maxScore === "number" ? c.maxScore : 4,
              weight: typeof c.weight === "number" ? c.weight : typeof c.poids === "number" ? c.poids : null,
              indicators: Array.isArray(c.indicators) ? c.indicators.map((ind) => ind.description || ind.name || ind).filter(Boolean) : Array.isArray(c.elements) ? c.elements.map((el) => typeof el === "string" ? el : el.description || el.name || "").filter(Boolean) : c.description ? [c.description] : []
            }));
          }
          if (raw.categories && Array.isArray(raw.categories)) {
            return raw.categories.map((category, i) => {
              const baseId = (category.id || category.name || `category_${i}`).toString().toLowerCase().replace(/\s+/g, "_");
              const indicators = Array.isArray(category.indicators) ? category.indicators.map((ind) => ind.description || ind.name || "").filter(Boolean) : [];
              return {
                id: baseId,
                name: category.name || category.id || `Cat\xE9gorie ${i + 1}`,
                description: indicators.length ? indicators.join(" ; ") : category.description || "",
                maxScore: typeof category.maxScore === "number" ? category.maxScore : 4,
                weight: typeof category.weight === "number" ? category.weight : typeof category.poids === "number" ? category.poids : null,
                indicators
              };
            });
          }
          if (raw.criteria && Array.isArray(raw.criteria)) {
            return raw.criteria.map((c, i) => ({
              id: (c.id || c.key || c.name || c.label || `crit_${i}`).toString().toLowerCase().replace(/\s+/g, "_"),
              name: c.name || c.label || c.id || `Crit\xE8re ${i + 1}`,
              description: c.description || "",
              maxScore: typeof c.maxScore === "number" ? c.maxScore : 4,
              weight: typeof c.weight === "number" ? c.weight : typeof c.poids === "number" ? c.poids : null,
              indicators: Array.isArray(c.indicators) ? c.indicators.map((ind) => ind.description || ind.name || ind).filter(Boolean) : Array.isArray(c.elements) ? c.elements.map((el) => typeof el === "string" ? el : el.description || el.name || "").filter(Boolean) : c.description ? [c.description] : []
            }));
          }
          if (typeof raw === "object") {
            return Object.keys(raw).map((k, i) => {
              const value = raw[k];
              const indicators = Array.isArray(value?.indicators) ? value.indicators.map((ind) => ind.description || ind.name || ind).filter(Boolean) : Array.isArray(value?.elements) ? value.elements.map((el) => typeof el === "string" ? el : el.description || el.name || "").filter(Boolean) : [];
              const weight = typeof value?.weight === "number" ? value.weight : typeof value?.poids === "number" ? value.poids : null;
              return {
                id: k.toLowerCase().replace(/\s+/g, "_"),
                name: k.charAt(0).toUpperCase() + k.slice(1).replace(/_/g, " "),
                description: typeof value === "string" ? value : value?.description || "",
                maxScore: 4,
                weight,
                indicators
              };
            });
          }
          return [];
        } catch {
          return [];
        }
      }, "normalizeCriteria");
      console.log("\u{1F50D} [TRACE] dbCriteria type:", typeof dbCriteria);
      console.log("\u{1F50D} [TRACE] dbCriteria is null?", dbCriteria === null);
      console.log("\u{1F50D} [TRACE] dbCriteria is array?", Array.isArray(dbCriteria));
      if (dbCriteria && typeof dbCriteria === "object") {
        console.log("\u{1F50D} [TRACE] dbCriteria keys:", Object.keys(dbCriteria));
        console.log("\u{1F50D} [TRACE] dbCriteria sample:", JSON.stringify(dbCriteria).substring(0, 500));
      } else {
        console.log("\u{1F50D} [TRACE] dbCriteria value:", dbCriteria);
      }
      const criteriaList = normalizeCriteria(dbCriteria);
      console.log("\u{1F50D} [TRACE] criteriaList length:", criteriaList.length);
      if (criteriaList.length > 0) {
        console.log("\u{1F50D} [TRACE] First criterion:", JSON.stringify(criteriaList[0], null, 2));
        console.log("\u{1F50D} [TRACE] First criterion indicators:", criteriaList[0].indicators);
      } else {
        console.log("\u{1F50D} [TRACE] criteriaList is EMPTY - will use fallback");
      }
      const fallbackCriteria = [
        { id: "communication", name: "Communication", maxScore: 4 },
        { id: "clinical_reasoning", name: "Raisonnement Clinique", maxScore: 4 },
        { id: "empathy", name: "Empathie", maxScore: 4 },
        { id: "professionalism", name: "Professionnalisme", maxScore: 4 }
      ];
      const usedCriteria = criteriaList.length > 0 ? criteriaList : fallbackCriteria;
      console.log("\u{1F50D} [TRACE] Using criteriaList or fallback?", criteriaList.length > 0 ? "criteriaList" : "FALLBACK");
      console.log("\u{1F50D} [TRACE] usedCriteria length:", usedCriteria.length);
      console.log("\u{1F50D} [TRACE] usedCriteria[0]:", JSON.stringify(usedCriteria[0], null, 2));
      const systemPrompt = `Tu es un examinateur ECOS. \xC9value la performance de l'\xE9tudiant en te basant UNIQUEMENT sur la transcription fournie.

Consignes :
- Pour CHAQUE crit\xE8re, v\xE9rifie si l'\xE9tudiant a abord\xE9 les indicateurs sp\xE9cifiques list\xE9s
- Attribue une note enti\xE8re de 0 \xE0 4 bas\xE9e sur la couverture des indicateurs :
  * 0 = aucun indicateur trait\xE9
  * 1 = abord\xE9 superficiellement (< 25% des indicateurs)
  * 2 = partiellement trait\xE9 (25-50% des indicateurs)
  * 3 = bien trait\xE9 (50-75% des indicateurs)
  * 4 = ma\xEEtris\xE9 (> 75% des indicateurs avec qualit\xE9)
- Pour chaque crit\xE8re, identifie 2-3 points forts, 2-3 points faibles, 2-3 actions d'am\xE9lioration
- Justifie chaque note en citant des exemples pr\xE9cis de la transcription
- Fournis une synth\xE8se globale avec forces majeures, faiblesses prioritaires, recommandations actionnables

IMPORTANT: Base-toi sur les indicateurs sp\xE9cifiques fournis pour chaque crit\xE8re. Ne te contente pas de notions g\xE9n\xE9riques.

R\xE9ponds UNIQUEMENT en JSON valide sans texte avant/apr\xE8s.

Format JSON attendu :
{
  "criteria": [
    {
      "id": "crit_id",
      "name": "Nom du crit\xE8re",
      "score": number,
      "maxScore": 4,
      "strengths": ["point fort 1 avec r\xE9f\xE9rence \xE0 la transcription", "point fort 2", ...],
      "weaknesses": ["faiblesse 1 avec exemple", "faiblesse 2", ...],
      "actions": ["recommandation 1 actionnable", "recommandation 2", ...],
      "justification": "Justification d\xE9taill\xE9e citant des passages de la transcription"
    }
  ],
  "overall": {
    "strengths": ["force majeure 1", "force majeure 2", ...],
    "weaknesses": ["faiblesse prioritaire 1", "faiblesse prioritaire 2", ...],
    "recommendations": ["recommandation 1", "recommandation 2", "recommandation 3"],
    "summary": "Synth\xE8se en 2-3 phrases r\xE9sumant la performance globale"
  },
  "overall_score_percent": number
}`;
      const rubricText = usedCriteria.map((c) => {
        const indicatorsList = c.indicators && c.indicators.length > 0 ? `
  Indicateurs \xE0 \xE9valuer:
${c.indicators.map((ind) => `  * ${ind}`).join("\n")}` : "";
        const weight = c.weight ? ` (pond\xE9ration: ${c.weight}%)` : "";
        return `- ${c.name} (id: ${c.id})${weight} \u2014 max ${c.maxScore}${indicatorsList}`;
      }).join("\n\n");
      const userPrompt = `Sc\xE9nario: ${scenario?.title || "Inconnu"}

Crit\xE8res d'\xE9valuation:
${rubricText}

Transcription de la session:
${transcript}`;
      let llmJson = null;
      try {
        const completion = await openaiService.createCompletion({
          model: "gpt-4o",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ],
          temperature: 0.3,
          max_completion_tokens: 2e3,
          response_format: { type: "json_object" }
        });
        const content = completion.choices?.[0]?.message?.content || "{}";
        const cleanedContent = content.replace(/```json\s*\n?|```\s*$/g, "").trim();
        llmJson = JSON.parse(cleanedContent);
      } catch (err) {
        console.warn("\u26A0\uFE0F LLM evaluation parsing failed, using heuristic fallback. Error:", err.message);
      }
      const evaluationId = `eval_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const criteriaResults = llmJson?.criteria && Array.isArray(llmJson.criteria) ? llmJson.criteria : [];
      const clamp = /* @__PURE__ */ __name((n) => Math.max(0, Math.min(4, Math.round(Number(n) || 0))), "clamp");
      const toArray = /* @__PURE__ */ __name((value) => {
        if (!value) return [];
        if (Array.isArray(value)) return value.map((entry) => (entry ?? "").toString()).filter((entry) => entry.trim().length > 0);
        return [value.toString()].filter(Boolean);
      }, "toArray");
      const conversationExcerpts = extractRelevantExcerpts(messages, 3);
      const weightValues = usedCriteria.map((criterion) => {
        const weight = Number(criterion.weight);
        return Number.isFinite(weight) && weight > 0 ? weight : 1;
      });
      const weightSum = weightValues.reduce((sum, w) => sum + w, 0) || usedCriteria.length;
      const combinedCriteria = usedCriteria.map((criterion, index) => {
        const criterionId = criterion.id;
        const llmMatch = criteriaResults.find((entry) => {
          const entryId = (entry.id || "").toString().toLowerCase();
          const entryName = (entry.name || "").toString().toLowerCase();
          return entryId === criterionId || entryName === criterion.name.toLowerCase();
        }) || null;
        const llmScore = clamp(llmMatch?.score ?? llmMatch?.note ?? 2);
        const maxScore = typeof llmMatch?.maxScore === "number" ? llmMatch.maxScore : 4;
        const finalScore = llmScore;
        return {
          id: criterionId,
          name: criterion.name,
          description: criterion.description || "",
          indicators: criterion.indicators || [],
          weight: Math.round(weightValues[index] / weightSum * 1e4) / 100,
          // pourcentage arrondi à 2 décimales
          rawWeight: weightValues[index],
          maxScore,
          score: finalScore,
          rawScore: llmScore,
          strengths: toArray(llmMatch?.strengths),
          weaknesses: toArray(llmMatch?.weaknesses),
          actions: toArray(llmMatch?.actions || llmMatch?.recommendations),
          justification: (llmMatch?.justification || "").toString(),
          // Add conversation excerpts as evidence instead of keyword matching
          evidence: conversationExcerpts
        };
      });
      const weightedTotal = combinedCriteria.reduce((sum, criterion) => {
        return sum + criterion.score / criterion.maxScore * (criterion.rawWeight || 1);
      }, 0);
      const weightedPercent = Math.round(weightedTotal / weightSum * 100);
      const llmOverallPercent = typeof llmJson?.overall_score_percent === "number" ? Math.round(llmJson.overall_score_percent) : null;
      const overallScorePercent = llmOverallPercent ?? weightedPercent;
      const uniqueList = /* @__PURE__ */ __name((list, limit = 3) => {
        const seen = /* @__PURE__ */ new Set();
        const result = [];
        for (const item of list) {
          const trimmed = item.trim();
          if (!trimmed || seen.has(trimmed)) continue;
          seen.add(trimmed);
          result.push(trimmed);
          if (result.length >= limit) break;
        }
        return result;
      }, "uniqueList");
      const overallSection = llmJson?.overall || {};
      const aggregatedStrengths = uniqueList([
        ...toArray(overallSection.strengths || llmJson?.strengths),
        ...combinedCriteria.flatMap((criterion) => criterion.strengths)
      ]);
      const aggregatedWeaknesses = uniqueList([
        ...toArray(overallSection.weaknesses || llmJson?.weaknesses),
        ...combinedCriteria.flatMap((criterion) => criterion.weaknesses)
      ]);
      const aggregatedRecommendations = uniqueList([
        ...toArray(overallSection.recommendations || llmJson?.recommendations),
        ...combinedCriteria.flatMap((criterion) => criterion.actions)
      ]);
      const summaryText = (overallSection.summary || overallSection.comment || llmJson?.summary || "").toString();
      const evaluation = {
        overall_score: overallScorePercent,
        criteria_scores: combinedCriteria.reduce((acc, c) => {
          acc[c.id] = Math.round(c.score / c.maxScore * 100);
          return acc;
        }, {}),
        scores: combinedCriteria.reduce((acc, c) => {
          acc[c.id] = c.score;
          return acc;
        }, {}),
        criteria: combinedCriteria,
        feedback: aggregatedStrengths,
        recommendations: aggregatedRecommendations,
        weaknesses: aggregatedWeaknesses,
        summary: summaryText,
        llmScorePercent: llmOverallPercent ?? weightedPercent,
        weightedScorePercent: weightedPercent
      };
      try {
        await unifiedDb.createEvaluation({
          sessionId,
          scenarioId,
          studentEmail: email,
          scores: evaluation.scores,
          globalScore: overallScorePercent,
          strengths: Array.isArray(evaluation.feedback) ? evaluation.feedback : [],
          weaknesses: Array.isArray(evaluation.weaknesses) ? evaluation.weaknesses : [],
          recommendations: Array.isArray(evaluation.recommendations) ? evaluation.recommendations : [],
          feedback: `\xC9valuation automatique - Score IA: ${overallScorePercent}%`,
          llmScorePercent: evaluation.llmScorePercent,
          criteriaDetails: evaluation.criteria
        });
        console.log(`\u2705 Stored evaluation for session ${sessionId} in database`);
      } catch (dbError) {
        console.error(`\u274C Failed to store evaluation in database:`, {
          message: dbError?.message,
          code: dbError?.code,
          details: dbError?.details,
          hint: dbError?.hint,
          sessionId,
          studentEmail: email
        });
        return res.status(500).json({
          error: "Failed to store evaluation in database",
          code: "EVALUATION_STORAGE_FAILED",
          details: process.env.NODE_ENV === "development" ? dbError?.message : void 0,
          evaluation
          // Still return the computed evaluation
        });
      }
      res.status(200).json({
        evaluationId,
        sessionId,
        evaluation,
        message: "Session evaluated and stored successfully"
      });
    } catch (error) {
      console.error("Error evaluating ECOS session:", error);
      res.status(500).json({
        error: "Failed to evaluate session",
        code: "EVALUATION_FAILED"
      });
    }
  });
  app.get("/api/ecos/sessions/:sessionId/report", async (req, res) => {
    const { email } = req.query;
    if (!email) {
      return res.status(400).json({ message: "Email requis" });
    }
    try {
      const { sessionId } = req.params;
      const evaluationRecord = await unifiedDb.getEvaluation(sessionId);
      if (!evaluationRecord) {
        return res.status(404).json({
          error: "Aucune \xE9valuation enregistr\xE9e pour cette session",
          code: "EVALUATION_NOT_FOUND"
        });
      }
      const scenarioIdMatch = sessionId.match(/^session_(\d+)_/);
      const scenarioId = scenarioIdMatch ? parseInt(scenarioIdMatch[1]) : null;
      let scenarioTitle = "Sc\xE9nario inconnu";
      let evaluationCriteria = null;
      if (scenarioId) {
        try {
          const scenarios = await unifiedDb.getScenarios();
          const scenario = scenarios.find((s) => s.id === scenarioId);
          if (scenario) {
            scenarioTitle = scenario.title;
            evaluationCriteria = scenario.evaluation_criteria || null;
          }
        } catch (dbError) {
          console.warn("\u26A0\uFE0F Could not load scenario for evaluation report:", dbError.message);
        }
      }
      const messages = await unifiedDb.getSessionMessages(sessionId, 100);
      const storedScores = evaluationRecord.scores || {};
      const storedCriteriaDetails = Array.isArray(evaluationRecord.criteria_details) ? evaluationRecord.criteria_details : null;
      const criteria = Object.keys(storedScores).map((key) => {
        const scoreValue = Number(storedScores[key] ?? 0);
        const storedDetail = storedCriteriaDetails?.find((detail) => (detail.id || "").toString() === key);
        const name = storedDetail?.name || key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
        const weight = typeof storedDetail?.weight === "number" ? storedDetail.weight : null;
        const evidence = storedDetail?.evidence || [];
        return {
          id: key,
          name,
          score: scoreValue,
          percent: Math.round(scoreValue / (storedDetail?.maxScore || 4) * 100),
          maxScore: storedDetail?.maxScore || 4,
          weight,
          strengths: Array.isArray(storedDetail?.strengths) ? storedDetail.strengths : [],
          weaknesses: Array.isArray(storedDetail?.weaknesses) ? storedDetail.weaknesses : [],
          actions: Array.isArray(storedDetail?.actions) ? storedDetail.actions : [],
          justification: storedDetail?.justification || "",
          indicators: Array.isArray(storedDetail?.indicators) ? storedDetail.indicators : [],
          evidence
          // Conversation excerpts as justification
        };
      });
      const overallScore = Number(evaluationRecord.global_score ?? 0);
      const summary = evaluationRecord.summary || `\xC9valuation du sc\xE9nario "${scenarioTitle}" bas\xE9e sur ${messages.length} \xE9change${messages.length > 1 ? "s" : ""} patient/infirmier.`;
      res.status(200).json({
        report: {
          sessionId,
          scenarioTitle,
          overallScore,
          criteria,
          strengths: evaluationRecord.strengths || [],
          weaknesses: evaluationRecord.weaknesses || [],
          recommendations: evaluationRecord.recommendations || [],
          feedback: evaluationRecord.feedback || null,
          transcriptMessageCount: messages.length,
          summary,
          generatedAt: evaluationRecord.evaluated_at || evaluationRecord.created_at || (/* @__PURE__ */ new Date()).toISOString()
        },
        message: "Evaluation report generated successfully"
      });
    } catch (error) {
      console.error("Error generating ECOS session report:", error);
      res.status(500).json({
        error: "Failed to generate evaluation report",
        code: "EVALUATION_REPORT_FAILED"
      });
    }
  });
  function extractScenarioIdFromSessionId(sessionId) {
    if (!sessionId || typeof sessionId !== "string") return null;
    const match = sessionId.match(/^session_(\d+)_/);
    if (match && match[1]) {
      const parsed = parseInt(match[1], 10);
      return Number.isNaN(parsed) || parsed <= 0 ? null : parsed;
    }
    return null;
  }
  __name(extractScenarioIdFromSessionId, "extractScenarioIdFromSessionId");
  app.post("/api/ecos/patient-simulator", apiRateLimit.middleware(), validateContentType(), validateRequestSize(), async (req, res) => {
    try {
      const { email, sessionId, query, scenarioId: providedScenarioId } = req.body;
      let resolvedScenarioId = providedScenarioId;
      if (!resolvedScenarioId && sessionId) {
        resolvedScenarioId = extractScenarioIdFromSessionId(sessionId);
        if (resolvedScenarioId) {
          console.log(`\u{1F504} [patient-simulator] Extracted scenarioId ${resolvedScenarioId} from sessionId: ${sessionId}`);
        }
      }
      console.log("\u{1F504} [patient-simulator] Received request:", {
        email,
        sessionId,
        providedScenarioId,
        resolvedScenarioId,
        hasQuery: !!query,
        queryLength: query?.length || 0,
        scenarioIdType: typeof resolvedScenarioId,
        scenarioIdValue: resolvedScenarioId,
        extractionUsed: !providedScenarioId && !!resolvedScenarioId
      });
      const { virtualPatientService: virtualPatientService2 } = await Promise.resolve().then(() => (init_virtual_patient_service(), virtual_patient_service_exports));
      const validation = virtualPatientService2.validateInput({
        sessionId,
        email,
        query,
        scenarioId: resolvedScenarioId
      });
      if (!validation.valid) {
        return res.status(400).json({
          error: validation.error,
          code: "INVALID_INPUT"
        });
      }
      console.log(`\u{1F916} AI Patient simulator query from ${email} in session ${sessionId}:`, {
        query: query.substring(0, 100) + (query.length > 100 ? "..." : ""),
        resolvedScenarioId,
        extractionUsed: !providedScenarioId && !!resolvedScenarioId
      });
      if (resolvedScenarioId) {
        try {
          const scenarios = await unifiedDb.getScenarios();
          const scenario = scenarios.find((s) => s.id === parseInt(resolvedScenarioId.toString(), 10));
          if (!scenario) {
            return res.status(404).json({
              error: `Scenario ${resolvedScenarioId} not found`,
              code: "SCENARIO_NOT_FOUND"
            });
          }
          console.log(`\u2705 Using scenario: "${scenario.title}" (ID: ${resolvedScenarioId}) ${!providedScenarioId ? "[EXTRACTED from sessionId]" : "[PROVIDED directly]"}`);
        } catch (error) {
          console.error("\u274C Error validating scenario:", error);
          return res.status(500).json({
            error: "Failed to validate scenario",
            code: "SCENARIO_VALIDATION_FAILED"
          });
        }
      }
      if (!resolvedScenarioId) {
        console.warn("\u26A0\uFE0F [patient-simulator] No scenarioId provided or extractable - patient will use generic fallback prompt instead of scenario-specific prompt");
        console.warn("\u26A0\uFE0F [patient-simulator] SessionId pattern for extraction:", sessionId);
      }
      console.log(`\u{1F680} [patient-simulator] Calling virtualPatientService.generatePatientResponse with resolved scenarioId: ${resolvedScenarioId}`);
      const patientResponse = await virtualPatientService2.generatePatientResponse(
        sessionId,
        email,
        query,
        resolvedScenarioId
      );
      try {
        const memory = virtualPatientService2.getConversationMemory?.(sessionId);
        await unifiedDb.storeConversationExchange({
          email,
          question: query,
          response: patientResponse.response,
          sessionId,
          scenarioId: resolvedScenarioId,
          studentRole: patientResponse.addressing,
          contextData: {
            medicalContext: patientResponse.medicalContext,
            timestamp: (/* @__PURE__ */ new Date()).toISOString(),
            responseMetadata: {
              aiGenerated: true,
              memoryUsed: !!memory,
              conversationLength: memory?.conversationHistory?.length || 0
            }
          }
        });
        await unifiedDb.storeSessionMessage({
          sessionId,
          role: "user",
          question: query,
          response: ""
        });
        await unifiedDb.storeSessionMessage({
          sessionId,
          role: "assistant",
          question: "",
          response: patientResponse.response,
          content: patientResponse.response
        });
      } catch (storageError) {
        console.warn("\u26A0\uFE0F Failed to store conversation exchange:", storageError);
      }
      res.status(200).json({
        response: patientResponse.response,
        sessionId,
        timestamp: /* @__PURE__ */ new Date(),
        addressing: patientResponse.addressing,
        medicalContext: patientResponse.medicalContext,
        message: "AI patient response generated with memory and role awareness"
      });
    } catch (error) {
      console.error("\u274C Error in AI patient simulator:", error);
      res.status(500).json({
        error: "Failed to generate AI patient response",
        code: "AI_PATIENT_SIMULATOR_FAILED",
        details: process.env.NODE_ENV === "development" ? error.message : "Internal server error"
      });
    }
  });
  return httpServer;
}
__name(registerRoutes, "registerRoutes");

// server/diagnostic-endpoint.ts
function addDiagnosticRoutes(app) {
  app.get("/api/diagnostic/auth-check", async (req, res) => {
    try {
      const { email } = req.query;
      const ADMIN_EMAILS = authService.getAdminEmails();
      const authInfo = {
        receivedEmail: email,
        emailType: typeof email,
        emailString: String(email || ""),
        emailLowerCase: String(email || "").toLowerCase(),
        adminEmails: ADMIN_EMAILS,
        isAuthorized: authService.isAdmin(String(email || "")),
        includes: ADMIN_EMAILS.includes(String(email || "").toLowerCase()),
        query: req.query,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      };
      res.json(authInfo);
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
    }
  });
  app.get("/api/diagnostic/auth-test", async (req, res) => {
    try {
      const { email } = req.query;
      const ADMIN_EMAILS = authService.getAdminEmails();
      const result = {
        inputEmail: email,
        emailType: typeof email,
        isString: typeof email === "string",
        normalizedEmail: typeof email === "string" ? email.toLowerCase().trim() : null,
        adminEmails: ADMIN_EMAILS,
        normalizedAdminEmails: ADMIN_EMAILS.map((e) => e.toLowerCase().trim()),
        isAuthorized: authService.isAdmin(email),
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      };
      res.json(result);
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
    }
  });
  app.get("/api/diagnostic/health", async (req, res) => {
    try {
      const health = {
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        status: "healthy",
        checks: {
          memory: process.memoryUsage(),
          uptime: process.uptime(),
          platform: process.platform,
          nodeVersion: process.version,
          env: {
            NODE_ENV: process.env.NODE_ENV,
            hasOpenAI: !!process.env.OPENAI_API_KEY,
            hasPinecone: !!process.env.PINECONE_API_KEY
          }
        }
      };
      res.json(health);
    } catch (error) {
      res.status(500).json({
        status: "unhealthy",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
  app.get("/api/diagnostic/routes", async (req, res) => {
    try {
      const routes = [];
      app._router.stack.forEach((middleware) => {
        if (middleware.route) {
          routes.push({
            path: middleware.route.path,
            methods: Object.keys(middleware.route.methods)
          });
        } else if (middleware.name === "router") {
          middleware.handle.stack.forEach((handler) => {
            if (handler.route) {
              routes.push({
                path: handler.route.path,
                methods: Object.keys(handler.route.methods)
              });
            }
          });
        }
      });
      res.json({ routes });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });
}
__name(addDiagnosticRoutes, "addDiagnosticRoutes");

// server/debug.middleware.ts
function createDebugMiddleware() {
  if (process.env.NODE_ENV !== "development") {
    return (req, res, next) => next();
  }
  return (req, res, next) => {
    apiLogger.request(req.method, req.path, void 0, void 0, {
      query: req.query,
      bodyKeys: req.body ? Object.keys(req.body) : void 0
    });
    const originalSend = res.send;
    res.send = function(data) {
      if (res.statusCode >= 400) {
        apiLogger.error(`Error response ${res.statusCode} for ${req.method} ${req.path}`, {
          statusCode: res.statusCode,
          method: req.method,
          path: req.path,
          responseData: typeof data === "object" ? data : { message: data }
        });
      }
      return originalSend.call(this, data);
    };
    next();
  };
}
__name(createDebugMiddleware, "createDebugMiddleware");
function createDatabaseErrorHandler() {
  return (error, req, res, next) => {
    if (error.code === "CONNECTION_LOST" || error.code === "PROTOCOL_CONNECTION_LOST") {
      apiLogger.error("Database connection lost", {
        errorCode: error.code,
        message: error.message,
        path: req.path,
        method: req.method
      });
      return res.status(503).json({
        error: "Database connection lost",
        message: "The database connection was lost. Please try again.",
        code: error.code
      });
    }
    if (error.message && error.message.includes("WebSocket")) {
      apiLogger.error("WebSocket database error", {
        message: error.message,
        path: req.path,
        method: req.method
      });
      return res.status(503).json({
        error: "Database WebSocket error",
        message: "WebSocket connection to database failed. Please try again.",
        details: error.message
      });
    }
    next(error);
  };
}
__name(createDatabaseErrorHandler, "createDatabaseErrorHandler");

// server/monitoring/performance-monitor.ts
var _PerformanceMonitor = class _PerformanceMonitor {
  constructor(config) {
    this.metrics = [];
    this.requestMetrics = [];
    this.databaseMetrics = [];
    this.systemMetrics = [];
    this.alertLastFired = /* @__PURE__ */ new Map();
    this.metricsCleanupInterval = null;
    this.systemMetricsInterval = null;
    this.config = {
      enableRequestTracking: true,
      enableDatabaseTracking: true,
      enableSystemMetrics: true,
      metricsRetentionHours: 24,
      enableConsoleLogging: process.env.NODE_ENV !== "production",
      enableWebhooks: false,
      alertConfigs: [
        {
          metric: "request_duration_p95",
          threshold: 2e3,
          // 2 seconds
          operator: "gt",
          enabled: true,
          cooldown: 10
          // 10 minutes
        },
        {
          metric: "error_rate_5min",
          threshold: 5,
          // 5%
          operator: "gt",
          enabled: true,
          cooldown: 5
          // 5 minutes
        },
        {
          metric: "memory_usage_percent",
          threshold: 85,
          // 85%
          operator: "gt",
          enabled: true,
          cooldown: 15
          // 15 minutes
        }
      ],
      ...config
    };
    this.startBackgroundTasks();
  }
  /**
   * Start background monitoring tasks
   */
  startBackgroundTasks() {
    this.metricsCleanupInterval = setInterval(() => {
      this.cleanupOldMetrics();
    }, 5 * 60 * 1e3);
    if (this.config.enableSystemMetrics) {
      this.systemMetricsInterval = setInterval(() => {
        this.collectSystemMetrics();
      }, 30 * 1e3);
    }
  }
  /**
   * Record a custom performance metric
   */
  recordMetric(name, value, unit, tags) {
    const metric = {
      name,
      value,
      unit,
      timestamp: /* @__PURE__ */ new Date(),
      tags
    };
    this.metrics.push(metric);
    if (this.config.enableConsoleLogging) {
      console.log(`\u{1F4CA} Metric: ${name} = ${value}${unit}`, tags ? `(${JSON.stringify(tags)})` : "");
    }
    this.checkAlerts();
  }
  /**
   * Record request performance metrics
   */
  recordRequest(request) {
    if (!this.config.enableRequestTracking) return;
    const requestMetric = {
      ...request,
      timestamp: /* @__PURE__ */ new Date()
    };
    this.requestMetrics.push(requestMetric);
    this.recordMetric("request_duration", request.duration, "ms", {
      method: request.method,
      path: request.path,
      status: request.statusCode.toString()
    });
    if (request.statusCode >= 400) {
      this.recordMetric("request_error", 1, "count", {
        method: request.method,
        path: request.path,
        status: request.statusCode.toString()
      });
    }
  }
  /**
   * Record database query performance
   */
  recordDatabaseQuery(query) {
    if (!this.config.enableDatabaseTracking) return;
    const dbMetric = {
      ...query,
      timestamp: /* @__PURE__ */ new Date()
    };
    this.databaseMetrics.push(dbMetric);
    this.recordMetric("db_query_duration", query.duration, "ms", {
      success: query.success.toString(),
      affected_rows: query.rowsAffected?.toString() || "0"
    });
    if (!query.success) {
      this.recordMetric("db_query_error", 1, "count");
    }
  }
  /**
   * Collect system performance metrics
   */
  collectSystemMetrics() {
    const memUsage = process.memoryUsage();
    const used = Math.round(memUsage.heapUsed / 1024 / 1024);
    const total = Math.round(memUsage.heapTotal / 1024 / 1024);
    const percent = Math.round(used / total * 100);
    const systemMetric = {
      memoryUsage: {
        used,
        total,
        percent
      },
      uptime: process.uptime(),
      timestamp: /* @__PURE__ */ new Date()
    };
    this.systemMetrics.push(systemMetric);
    this.recordMetric("memory_usage_mb", used, "bytes");
    this.recordMetric("memory_usage_percent", percent, "percent");
    this.recordMetric("uptime_seconds", systemMetric.uptime, "count");
  }
  /**
   * Calculate percentile from array of values
   */
  calculatePercentile(values, percentile) {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil(percentile / 100 * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }
  /**
   * Get request performance statistics
   */
  getRequestStats(minutes = 60) {
    const cutoff = new Date(Date.now() - minutes * 60 * 1e3);
    const recentRequests = this.requestMetrics.filter((r) => r.timestamp > cutoff);
    if (recentRequests.length === 0) {
      return {
        totalRequests: 0,
        errorRate: 0,
        averageResponseTime: 0,
        p50ResponseTime: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0,
        statusCodeDistribution: {}
      };
    }
    const durations = recentRequests.map((r) => r.duration);
    const errors = recentRequests.filter((r) => r.statusCode >= 400).length;
    const statusCodes = {};
    recentRequests.forEach((r) => {
      const status = r.statusCode.toString();
      statusCodes[status] = (statusCodes[status] || 0) + 1;
    });
    return {
      totalRequests: recentRequests.length,
      errorRate: errors / recentRequests.length * 100,
      averageResponseTime: durations.reduce((sum, d) => sum + d, 0) / durations.length,
      p50ResponseTime: this.calculatePercentile(durations, 50),
      p95ResponseTime: this.calculatePercentile(durations, 95),
      p99ResponseTime: this.calculatePercentile(durations, 99),
      statusCodeDistribution: statusCodes
    };
  }
  /**
   * Get database performance statistics
   */
  getDatabaseStats(minutes = 60) {
    const cutoff = new Date(Date.now() - minutes * 60 * 1e3);
    const recentQueries = this.databaseMetrics.filter((q) => q.timestamp > cutoff);
    if (recentQueries.length === 0) {
      return {
        totalQueries: 0,
        errorRate: 0,
        averageQueryTime: 0,
        p95QueryTime: 0,
        slowQueries: []
      };
    }
    const durations = recentQueries.map((q) => q.duration);
    const errors = recentQueries.filter((q) => !q.success).length;
    const slowQueries = recentQueries.filter((q) => q.duration > 1e3).sort((a, b) => b.duration - a.duration).slice(0, 10);
    return {
      totalQueries: recentQueries.length,
      errorRate: errors / recentQueries.length * 100,
      averageQueryTime: durations.reduce((sum, d) => sum + d, 0) / durations.length,
      p95QueryTime: this.calculatePercentile(durations, 95),
      slowQueries
    };
  }
  /**
   * Get current system status
   */
  getSystemStatus() {
    const latest = this.systemMetrics[this.systemMetrics.length - 1];
    const requestStats = this.getRequestStats(60);
    const databaseStats = this.getDatabaseStats(60);
    const healthy = requestStats.errorRate < 10 && // Error rate under 10%
    requestStats.p95ResponseTime < 5e3 && // P95 under 5 seconds
    databaseStats.errorRate < 5 && // DB error rate under 5%
    (latest?.memoryUsage.percent || 0) < 90;
    return {
      healthy,
      uptime: latest?.uptime || process.uptime(),
      memory: latest?.memoryUsage || { used: 0, total: 0, percent: 0 },
      requestStats,
      databaseStats,
      alertsTriggered: this.alertLastFired.size,
      timestamp: /* @__PURE__ */ new Date()
    };
  }
  /**
   * Check if any alerts should be triggered
   */
  checkAlerts() {
    const now = /* @__PURE__ */ new Date();
    for (const alertConfig of this.config.alertConfigs) {
      if (!alertConfig.enabled) continue;
      const lastFired = this.alertLastFired.get(alertConfig.metric);
      if (lastFired && now.getTime() - lastFired.getTime() < alertConfig.cooldown * 60 * 1e3) {
        continue;
      }
      let currentValue = null;
      switch (alertConfig.metric) {
        case "request_duration_p95":
          currentValue = this.getRequestStats(5).p95ResponseTime;
          break;
        case "error_rate_5min":
          currentValue = this.getRequestStats(5).errorRate;
          break;
        case "memory_usage_percent":
          const latest = this.systemMetrics[this.systemMetrics.length - 1];
          currentValue = latest?.memoryUsage.percent || 0;
          break;
      }
      if (currentValue !== null && this.shouldTriggerAlert(currentValue, alertConfig)) {
        this.triggerAlert(alertConfig.metric, currentValue, alertConfig.threshold);
        this.alertLastFired.set(alertConfig.metric, now);
      }
    }
  }
  /**
   * Check if alert should be triggered based on configuration
   */
  shouldTriggerAlert(value, config) {
    switch (config.operator) {
      case "gt":
        return value > config.threshold;
      case "lt":
        return value < config.threshold;
      case "eq":
        return value === config.threshold;
      default:
        return false;
    }
  }
  /**
   * Trigger an alert
   */
  triggerAlert(metric, currentValue, threshold) {
    const alertMessage = `\u{1F6A8} ALERT: ${metric} = ${currentValue} (threshold: ${threshold})`;
    console.error(alertMessage);
  }
  /**
   * Clean up old metrics to prevent memory leaks
   */
  cleanupOldMetrics() {
    const cutoff = new Date(Date.now() - this.config.metricsRetentionHours * 60 * 60 * 1e3);
    const initialCounts = {
      metrics: this.metrics.length,
      requests: this.requestMetrics.length,
      database: this.databaseMetrics.length,
      system: this.systemMetrics.length
    };
    this.metrics = this.metrics.filter((m) => m.timestamp > cutoff);
    this.requestMetrics = this.requestMetrics.filter((r) => r.timestamp > cutoff);
    this.databaseMetrics = this.databaseMetrics.filter((d) => d.timestamp > cutoff);
    this.systemMetrics = this.systemMetrics.filter((s) => s.timestamp > cutoff);
    if (this.config.enableConsoleLogging) {
      const cleaned = {
        metrics: initialCounts.metrics - this.metrics.length,
        requests: initialCounts.requests - this.requestMetrics.length,
        database: initialCounts.database - this.databaseMetrics.length,
        system: initialCounts.system - this.systemMetrics.length
      };
      console.log("\u{1F9F9} Cleaned up old metrics:", cleaned);
    }
  }
  /**
   * Generate monitoring report
   */
  generateReport() {
    const status = this.getSystemStatus();
    return `
# ECOS Performance Monitoring Report
Generated: ${status.timestamp.toISOString()}

## System Health: ${status.healthy ? "\u2705 HEALTHY" : "\u274C UNHEALTHY"}

### System Metrics
- Uptime: ${Math.round(status.uptime / 3600)}h ${Math.round(status.uptime % 3600 / 60)}m
- Memory Usage: ${status.memory.used}MB / ${status.memory.total}MB (${status.memory.percent}%)

### Request Performance (Last 60 minutes)
- Total Requests: ${status.requestStats.totalRequests}
- Error Rate: ${status.requestStats.errorRate.toFixed(2)}%
- Average Response Time: ${status.requestStats.averageResponseTime.toFixed(0)}ms
- P95 Response Time: ${status.requestStats.p95ResponseTime.toFixed(0)}ms
- P99 Response Time: ${status.requestStats.p99ResponseTime.toFixed(0)}ms

### Database Performance (Last 60 minutes)
- Total Queries: ${status.databaseStats.totalQueries}
- Error Rate: ${status.databaseStats.errorRate.toFixed(2)}%
- Average Query Time: ${status.databaseStats.averageQueryTime.toFixed(0)}ms
- P95 Query Time: ${status.databaseStats.p95QueryTime.toFixed(0)}ms
- Slow Queries: ${status.databaseStats.slowQueries.length}

### Alerts
- Active Alerts: ${status.alertsTriggered}

## Status Code Distribution
${Object.entries(status.requestStats.statusCodeDistribution).map(([code, count]) => `- ${code}: ${count}`).join("\n")}
    `.trim();
  }
  /**
   * Graceful shutdown
   */
  shutdown() {
    if (this.metricsCleanupInterval) {
      clearInterval(this.metricsCleanupInterval);
    }
    if (this.systemMetricsInterval) {
      clearInterval(this.systemMetricsInterval);
    }
    console.log("\u{1F4CA} Performance monitoring shutdown complete");
  }
};
__name(_PerformanceMonitor, "PerformanceMonitor");
var PerformanceMonitor = _PerformanceMonitor;
var performanceMonitor = new PerformanceMonitor();
process.on("SIGTERM", () => performanceMonitor.shutdown());
process.on("SIGINT", () => performanceMonitor.shutdown());

// server/middleware/monitoring.middleware.ts
function generateRequestId() {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
__name(generateRequestId, "generateRequestId");
function createMonitoringMiddleware() {
  return (req, res, next) => {
    req.startTime = Date.now();
    req.requestId = generateRequestId();
    res.setHeader("X-Request-ID", req.requestId);
    let responseSize = 0;
    let capturedResponse = void 0;
    const originalSend = res.send;
    const originalJson = res.json;
    res.send = function(body) {
      if (body) {
        responseSize = Buffer.byteLength(body, "utf8");
        capturedResponse = body;
      }
      return originalSend.call(this, body);
    };
    res.json = function(obj) {
      if (obj) {
        const jsonString = JSON.stringify(obj);
        responseSize = Buffer.byteLength(jsonString, "utf8");
        capturedResponse = obj;
      }
      return originalJson.call(this, obj);
    };
    res.on("finish", () => {
      const duration = Date.now() - (req.startTime || Date.now());
      performanceMonitor.recordRequest({
        method: req.method,
        path: req.route?.path || req.path,
        statusCode: res.statusCode,
        duration,
        userAgent: req.get("User-Agent"),
        responseSize,
        errorMessage: res.statusCode >= 400 ? capturedResponse?.error || capturedResponse?.message : void 0
      });
      if (duration > 2e3) {
        console.warn(`\u{1F40C} Slow request detected: ${req.method} ${req.path} took ${duration}ms`);
      }
      if (res.statusCode >= 400) {
        console.error(`\u274C Error request: ${req.method} ${req.path} - ${res.statusCode} in ${duration}ms`);
      }
    });
    res.on("error", (error) => {
      const duration = Date.now() - (req.startTime || Date.now());
      performanceMonitor.recordRequest({
        method: req.method,
        path: req.route?.path || req.path,
        statusCode: 500,
        duration,
        userAgent: req.get("User-Agent"),
        errorMessage: error.message
      });
    });
    next();
  };
}
__name(createMonitoringMiddleware, "createMonitoringMiddleware");
function createMonitoringRoutes() {
  return {
    // Health check endpoint with detailed metrics
    healthCheck: /* @__PURE__ */ __name(async (req, res) => {
      try {
        const status = performanceMonitor.getSystemStatus();
        res.status(status.healthy ? 200 : 503).json({
          status: status.healthy ? "healthy" : "unhealthy",
          timestamp: status.timestamp,
          uptime: status.uptime,
          memory: status.memory,
          requestStats: {
            total: status.requestStats.totalRequests,
            errorRate: parseFloat(status.requestStats.errorRate.toFixed(2)),
            avgResponseTime: Math.round(status.requestStats.averageResponseTime),
            p95ResponseTime: Math.round(status.requestStats.p95ResponseTime)
          },
          databaseStats: {
            total: status.databaseStats.totalQueries,
            errorRate: parseFloat(status.databaseStats.errorRate.toFixed(2)),
            avgQueryTime: Math.round(status.databaseStats.averageQueryTime),
            p95QueryTime: Math.round(status.databaseStats.p95QueryTime)
          },
          environment: process.env.NODE_ENV || "unknown"
        });
      } catch (error) {
        res.status(500).json({
          status: "error",
          message: "Health check failed",
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }, "healthCheck"),
    // Detailed metrics endpoint
    metrics: /* @__PURE__ */ __name(async (req, res) => {
      try {
        const minutes = parseInt(req.query.minutes) || 60;
        const requestStats = performanceMonitor.getRequestStats(minutes);
        const databaseStats = performanceMonitor.getDatabaseStats(minutes);
        const systemStatus = performanceMonitor.getSystemStatus();
        res.json({
          timeframe: `${minutes} minutes`,
          timestamp: /* @__PURE__ */ new Date(),
          requests: {
            total: requestStats.totalRequests,
            errorRate: parseFloat(requestStats.errorRate.toFixed(2)),
            responseTime: {
              average: Math.round(requestStats.averageResponseTime),
              p50: Math.round(requestStats.p50ResponseTime),
              p95: Math.round(requestStats.p95ResponseTime),
              p99: Math.round(requestStats.p99ResponseTime)
            },
            statusCodes: requestStats.statusCodeDistribution
          },
          database: {
            total: databaseStats.totalQueries,
            errorRate: parseFloat(databaseStats.errorRate.toFixed(2)),
            queryTime: {
              average: Math.round(databaseStats.averageQueryTime),
              p95: Math.round(databaseStats.p95QueryTime)
            },
            slowQueries: databaseStats.slowQueries.length
          },
          system: {
            uptime: systemStatus.uptime,
            memory: systemStatus.memory,
            healthy: systemStatus.healthy
          }
        });
      } catch (error) {
        res.status(500).json({
          error: "Metrics collection failed",
          message: error instanceof Error ? error.message : String(error)
        });
      }
    }, "metrics"),
    // Performance report endpoint
    report: /* @__PURE__ */ __name(async (req, res) => {
      try {
        const report = performanceMonitor.generateReport();
        res.setHeader("Content-Type", "text/plain");
        res.send(report);
      } catch (error) {
        res.status(500).json({
          error: "Report generation failed",
          message: error instanceof Error ? error.message : String(error)
        });
      }
    }, "report"),
    // Custom metric recording endpoint (for client-side metrics)
    recordMetric: /* @__PURE__ */ __name(async (req, res) => {
      try {
        const { name, value, unit, tags } = req.body;
        if (!name || typeof value !== "number" || !unit) {
          return res.status(400).json({
            error: "Invalid metric data",
            message: "name, value, and unit are required"
          });
        }
        performanceMonitor.recordMetric(name, value, unit, tags);
        res.json({
          success: true,
          message: "Metric recorded successfully"
        });
      } catch (error) {
        res.status(500).json({
          error: "Failed to record metric",
          message: error instanceof Error ? error.message : String(error)
        });
      }
    }, "recordMetric")
  };
}
__name(createMonitoringRoutes, "createMonitoringRoutes");
function createErrorTrackingMiddleware() {
  return (error, req, res, next) => {
    performanceMonitor.recordMetric("application_error", 1, "count", {
      path: req.path,
      method: req.method,
      errorType: error.constructor.name,
      statusCode: (error.status || error.statusCode || 500).toString()
    });
    console.error("\u{1F6A8} Application Error:", {
      message: error.message,
      stack: error.stack,
      url: req.url,
      method: req.method,
      userAgent: req.get("User-Agent"),
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
    next(error);
  };
}
__name(createErrorTrackingMiddleware, "createErrorTrackingMiddleware");

// server/serverless-app.ts
var _ServerlessApplication = class _ServerlessApplication {
  constructor(config) {
    this.app = null;
    this.initialized = false;
    this.initializationPromise = null;
    this.config = {
      environment: process.env.NODE_ENV || "production",
      enableDebug: process.env.NODE_ENV !== "production",
      maxResponseTime: 25e3,
      // 25s for Vercel timeout buffer
      enableHealthChecks: true,
      ...config
    };
  }
  validateEnvironment() {
    const required = ["DATABASE_URL"];
    const optional = ["OPENAI_API_KEY", "PINECONE_API_KEY"];
    const missing = required.filter((v) => !process.env[v]);
    if (missing.length > 0) {
      console.error(`\u274C Missing critical environment variables: ${missing.join(", ")}`);
    }
    const optionalMissing = optional.filter((v) => !process.env[v]);
    if (optionalMissing.length > 0) {
      console.warn(`\u26A0\uFE0F Missing optional environment variables: ${optionalMissing.join(", ")}`);
    }
    return { isValid: missing.length === 0, missing };
  }
  setupMiddleware(app) {
    app.use(express.json({ limit: "10mb" }));
    app.use(express.urlencoded({ extended: false, limit: "10mb" }));
    app.use(createMonitoringMiddleware());
    app.use((req, res, next) => {
      const sensitivePaths = [
        "/.env",
        "/package.json",
        "/.replit",
        "/server",
        "/shared",
        "/scripts",
        "/node_modules",
        "/.git",
        "/dist/index.js"
      ];
      if (sensitivePaths.some((path) => req.path.startsWith(path))) {
        return res.status(404).json({ error: "Not Found" });
      }
      next();
    });
    if (this.config.enableDebug) {
      app.use(createDebugMiddleware());
    }
    app.use(createDatabaseErrorHandler());
    app.use((req, res, next) => {
      const timeout = setTimeout(() => {
        if (!res.headersSent) {
          res.status(504).json({
            error: "Request timeout",
            message: "The request took too long to process"
          });
        }
      }, this.config.maxResponseTime);
      res.on("finish", () => clearTimeout(timeout));
      next();
    });
  }
  setupHealthChecks(app) {
    if (!this.config.enableHealthChecks) return;
    const monitoringRoutes = createMonitoringRoutes();
    app.get("/health", monitoringRoutes.healthCheck);
    app.get("/ready", (req, res) => {
      res.status(200).json({
        status: "ready",
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        initialized: this.initialized,
        environment: this.config.environment
      });
    });
    app.get("/live", (req, res) => {
      res.status(200).json({
        status: "alive",
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        pid: process.pid,
        uptime: process.uptime()
      });
    });
    app.get("/metrics", monitoringRoutes.metrics);
    app.get("/report", monitoringRoutes.report);
    app.post("/metrics", monitoringRoutes.recordMetric);
  }
  setupErrorHandling(app) {
    app.use(createErrorTrackingMiddleware());
    app.use("*", (req, res) => {
      res.status(404).json({
        error: "Not Found",
        message: `Route ${req.method} ${req.originalUrl} not found`,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
    });
    app.use((err, req, res, next) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      const errorId = Math.random().toString(36).substr(2, 9);
      console.error(`[${errorId}] Serverless Error [${status}]:`, {
        message,
        stack: err.stack,
        url: req.url,
        method: req.method,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
      res.status(status).json({
        error: this.config.environment === "production" ? "Internal Server Error" : message,
        message: this.config.environment === "production" ? "An error occurred processing your request" : message,
        errorId,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
    });
  }
  async initializeApplication() {
    if (this.initialized && this.app) {
      return this.app;
    }
    console.log(`\u{1F680} Initializing ECOS serverless application (${this.config.environment})`);
    const { isValid: isValid2, missing } = this.validateEnvironment();
    if (!isValid2) {
      throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
    }
    const app = express();
    this.setupMiddleware(app);
    this.setupHealthChecks(app);
    if (this.config.enableDebug) {
      addDiagnosticRoutes(app);
    }
    try {
      await registerRoutes(app);
      console.log("\u2705 API routes registered successfully");
    } catch (error) {
      console.error("\u274C Failed to register routes:", error);
      throw error;
    }
    this.setupErrorHandling(app);
    this.app = app;
    this.initialized = true;
    console.log("\u2705 ECOS serverless application initialized successfully");
    return app;
  }
  async getApplication() {
    if (this.initializationPromise) {
      return this.initializationPromise;
    }
    if (this.initialized && this.app) {
      return this.app;
    }
    this.initializationPromise = this.initializeApplication();
    return this.initializationPromise;
  }
  async handleRequest(req, res) {
    try {
      const app = await this.getApplication();
      return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error("Request handling timeout"));
        }, this.config.maxResponseTime);
        app(req, res, (err) => {
          clearTimeout(timeoutId);
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });
    } catch (error) {
      console.error("Critical serverless handler error:", error);
      if (!res.headersSent) {
        res.status(500).json({
          error: "Internal Server Error",
          message: "Application initialization failed",
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        });
      }
    }
  }
};
__name(_ServerlessApplication, "ServerlessApplication");
var ServerlessApplication = _ServerlessApplication;
var serverlessApp = new ServerlessApplication();
export {
  ServerlessApplication,
  serverlessApp
};
//# sourceMappingURL=serverless-app.js.map
