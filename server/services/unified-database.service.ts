import { createClient } from '@supabase/supabase-js';

interface DatabaseMetrics {
  connectionAttempts: number;
  successfulConnections: number;
  failedConnections: number;
  lastConnectionTime: Date;
  isHealthy: boolean;
  responseTime: number;
}

/**
 * Unified Database Service
 * 
 * Single point of access for all database operations.
 * Uses Supabase REST API exclusively for stability.
 * Eliminates connection pooling conflicts and race conditions.
 */
export class UnifiedDatabaseService {
  private supabase: any = null;
  private isInitialized = false;
  private initializationPromise: Promise<void> | null = null;
  private metrics: DatabaseMetrics;
  private startupTime: Date;
  private fallbackSessions = new Map<string, any>();
  private fallbackSessionMessages = new Map<string, any[]>();
  private fallbackEvaluations = new Map<string, any>();
  private ensuredUsers = new Set<string>();
  
  constructor() {
    this.startupTime = new Date();
    this.metrics = {
      connectionAttempts: 0,
      successfulConnections: 0,
      failedConnections: 0,
      lastConnectionTime: new Date(),
      isHealthy: false,
      responseTime: 0
    };
  }

  /**
   * Initialize the database service (called once)
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    if (this.initializationPromise) {
      return this.initializationPromise;
    }
    
    this.initializationPromise = this._performInitialization();
    return this.initializationPromise;
  }

  private async _performInitialization(): Promise<void> {
    this.metrics.connectionAttempts++;
    const startTime = Date.now();
    
    try {
      console.log('🔧 Initializing Unified Database Service...');

      let supabaseUrl = process.env.SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseKey) {
        throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
      }

      // Convert PostgreSQL URL to HTTP URL if needed
      if (supabaseUrl.startsWith('postgresql://')) {
        const match = supabaseUrl.match(/db\.([^.]+)\.supabase\.co/);
        if (match) {
          const projectId = match[1];
          supabaseUrl = `https://${projectId}.supabase.co`;
          console.log('🔄 Converted to Supabase HTTP URL');
        }
      }

      this.supabase = createClient(supabaseUrl, supabaseKey);
      
      // Test connection with health check
      await this._performHealthCheck();
      
      this.isInitialized = true;
      this.metrics.successfulConnections++;
      this.metrics.responseTime = Date.now() - startTime;
      this.metrics.isHealthy = true;
      this.metrics.lastConnectionTime = new Date();
      
      console.log('✅ Unified Database Service initialized successfully');
    } catch (error: any) {
      this.metrics.failedConnections++;
      this.metrics.isHealthy = false;
      console.error('❌ Database service initialization failed:', error.message);
      throw error;
    } finally {
      this.initializationPromise = null;
    }
  }

  private async _performHealthCheck(): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Simple health check query
      const { error } = await this.supabase
        .from('scenarios')
        .select('id')
        .limit(1);
        
      if (error && !error.message.includes('does not exist')) {
        throw error;
      }
      
      this.metrics.responseTime = Date.now() - startTime;
      console.log(`✅ Health check passed (${this.metrics.responseTime}ms)`);
    } catch (error: any) {
      console.warn('⚠️ Health check warning:', error.message);
      // Don't throw for table existence issues
      if (!error.message.includes('does not exist')) {
        throw error;
      }
    }
  }

  /**
   * Get database client (ensures initialization)
   */
  private async getClient(): Promise<any> {
    await this.initialize();
    
    if (!this.supabase) {
      throw new Error('Database service not initialized');
    }
    
    return this.supabase;
  }

  /**
   * Ensure a user record exists before inserting related rows that depend on email FK
   */
  private async ensureUserExists(email: string | null | undefined): Promise<void> {
    if (!email) return;

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || this.ensuredUsers.has(normalizedEmail)) {
      return;
    }

    try {
      const client = await this.getClient();
      const timestamp = new Date().toISOString();

      const { error } = await client
        .from('users')
        .upsert([
          {
            email: normalizedEmail,
            updated_at: timestamp
          }
        ], { onConflict: 'email' });

      if (error) {
        // Duplicate inserts are safe to ignore; anything else should be logged for visibility
        console.warn(`⚠️ Failed to ensure user ${normalizedEmail}:`, error.message);
        return;
      }

      this.ensuredUsers.add(normalizedEmail);
      console.log(`👤 Ensured user record exists for ${normalizedEmail}`);
    } catch (error: any) {
      console.warn(`⚠️ Error ensuring user ${normalizedEmail}:`, error.message);
    }
  }

  /**
   * Get all scenarios
   */
  async getScenarios(): Promise<any[]> {
    try {
      const client = await this.getClient();
      
      const { data, error } = await client
        .from('scenarios')
        .select(`
          id,
          title,
          description,
          patient_prompt,
          evaluation_criteria,
          image_url,
          created_by,
          created_at,
          updated_at
        `)
        .order('created_at', { ascending: false });

      if (error) {
        if (error.message.includes('does not exist')) {
          console.log('⚠️ Scenarios table does not exist, returning empty array');
          return [];
        }
        throw error;
      }

      console.log(`✅ Retrieved ${data?.length || 0} scenarios`);
      
      // Map database column names to expected property names
      const mappedData = (data || []).map(scenario => ({
        ...scenario,
        patient_prompt: scenario.patient_prompt || null,
        evaluation_criteria: scenario.evaluation_criteria || null
      }));
      
      return mappedData;
    } catch (error: any) {
      console.error('❌ Error fetching scenarios:', error.message);
      throw error;
    }
  }

  /**
   * Get dashboard statistics
   */
  async getDashboardStats(): Promise<any> {
    try {
      const client = await this.getClient();

      // Get scenarios count using the same method as getScenarios()
      const scenarios = await this.getScenarios();
      const totalScenarios = scenarios.length;

      // Get real session statistics from database with scenario information
      const { data: allSessions, error: sessionsError } = await client
        .from('sessions')
        .select(`
          id,
          session_id,
          student_email,
          scenario_id,
          status,
          start_time,
          end_time,
          created_at,
          updated_at,
          scenarios (
            id,
            title,
            description
          )
        `)
        .order('created_at', { ascending: false });

      if (sessionsError) {
        console.warn('⚠️ Error fetching sessions for stats:', sessionsError.message);
        // Return partial stats with scenarios count
        return {
          totalScenarios,
          activeSessions: 0,
          completedSessions: 0,
          totalStudents: 0,
          sessions: []
        };
      }

      const sessions = allSessions || [];
      const activeSessions = sessions.filter(s => s.status === 'active' || s.status === 'in_progress').length;
      const completedSessions = sessions.filter(s => s.status === 'completed').length;

      // Count ALL students from users table (not just those with sessions)
      let totalStudents = 0;
      try {
        const { data: users, error: usersError } = await client
          .from('users')
          .select('id, email')
          .neq('role', 'admin'); // Exclude admins from student count

        if (!usersError && users) {
          totalStudents = users.length;
        } else {
          // Fallback: count unique students from sessions only
          const uniqueStudents = new Set(sessions.map(s => s.student_email).filter(Boolean));
          totalStudents = uniqueStudents.size;
        }
      } catch (error: any) {
        console.warn('⚠️ Error counting users, falling back to session-based count');
        const uniqueStudents = new Set(sessions.map(s => s.student_email).filter(Boolean));
        totalStudents = uniqueStudents.size;
      }

      console.log(`📊 Dashboard stats: ${totalScenarios} scenarios, ${activeSessions} active sessions, ${completedSessions} completed, ${totalStudents} students`);

      return {
        totalScenarios,
        activeSessions,
        completedSessions,
        totalStudents,
        sessions: sessions.map(s => ({
          id: s.session_id,
          sessionId: s.session_id,
          studentEmail: s.student_email,
          scenarioId: s.scenario_id,
          scenarioTitle: s.scenarios?.title || 'Scénario inconnu',
          scenarioDescription: s.scenarios?.description || '',
          status: s.status,
          startTime: s.start_time,
          endTime: s.end_time,
          createdAt: s.created_at,
          updatedAt: s.updated_at
        }))
      };
    } catch (error: any) {
      console.error('❌ Error fetching dashboard stats:', error.message);
      return {
        totalScenarios: 0,
        activeSessions: 0,
        completedSessions: 0,
        totalStudents: 0,
        sessions: []
      };
    }
  }

  /**
   * Get students (placeholder for future implementation)
   */
  async getStudents(): Promise<any[]> {
    try {
      const client = await this.getClient();
      
      // For now, return empty array - implement based on your needs
      return [];
    } catch (error: any) {
      console.error('❌ Error fetching students:', error.message);
      return [];
    }
  }

  /**
   * Health check method
   */
  async healthCheck(): Promise<{ status: string; metrics: DatabaseMetrics; uptime: number }> {
    try {
      await this._performHealthCheck();
      
      return {
        status: 'healthy',
        metrics: { ...this.metrics },
        uptime: Date.now() - this.startupTime.getTime()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        metrics: { ...this.metrics, isHealthy: false },
        uptime: Date.now() - this.startupTime.getTime()
      };
    }
  }

  /**
   * Create a new scenario
   */
  async createScenario(scenarioData: any): Promise<any> {
    const client = await this.getClient();

    // Guarantee creator exists to satisfy foreign key constraints on scenarios.created_by
    await this.ensureUserExists(scenarioData.createdBy);
    
    const { data, error } = await client
      .from('scenarios')
      .insert({
        title: scenarioData.title,
        description: scenarioData.description,
        patient_prompt: scenarioData.patientPrompt,
        evaluation_criteria: scenarioData.evaluationCriteria,
        image_url: scenarioData.imageUrl || null,
        created_by: scenarioData.createdBy,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Update scenario
   */
  async updateScenario(id: string, updates: any): Promise<any> {
    const client = await this.getClient();
    
    // First, check if scenario exists
    const { data: existingScenario, error: findError } = await client
      .from('scenarios')
      .select('id, title')
      .eq('id', id)
      .single();

    if (findError) {
      if (findError.code === 'PGRST116') {
        // No rows found
        console.error(`❌ Scenario ${id} not found in database`);
        throw new Error(`Scenario with ID ${id} does not exist`);
      }
      console.error(`❌ Error checking scenario ${id}:`, findError);
      throw findError;
    }

    console.log(`✅ Scenario ${id} exists: "${existingScenario.title}"`);
    
    const updateData: any = {
      updated_at: new Date().toISOString()
    };

    if (updates.title) updateData.title = updates.title;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.patientPrompt !== undefined) updateData.patient_prompt = updates.patientPrompt;
    if (updates.evaluationCriteria !== undefined) updateData.evaluation_criteria = updates.evaluationCriteria;
    if (updates.imageUrl !== undefined) updateData.image_url = updates.imageUrl;
    if (updates.pineconeIndex !== undefined) updateData.pinecone_index = updates.pineconeIndex;

    console.log(`📊 Updating scenario ${id} with data:`, updateData);

    const { data, error } = await client
      .from('scenarios')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error(`❌ Error updating scenario ${id}:`, error);
      throw error;
    }

    console.log(`✅ Scenario ${id} updated successfully:`, data);
    return data;
  }

  /**
   * Update scenario criteria specifically (convenience method)
   */
  async updateScenarioCriteria(id: string, criteria: any): Promise<any> {
    console.log(`📊 Updating criteria for scenario ${id}`);
    return this.updateScenario(id, { evaluationCriteria: criteria });
  }

  /**
   * Get available scenario IDs and titles for validation
   */
  async getAvailableScenarioIds(): Promise<Array<{id: number, title: string}>> {
    try {
      const client = await this.getClient();
      
      const { data, error } = await client
        .from('scenarios')
        .select('id, title')
        .order('id', { ascending: true });

      if (error) {
        if (error.message.includes('does not exist')) {
          console.log('⚠️ Scenarios table does not exist, returning empty array');
          return [];
        }
        throw error;
      }

      console.log(`📋 Available scenarios: ${(data || []).map(s => `ID ${s.id}: "${s.title}"`).join(', ')}`);
      return data || [];
    } catch (error: any) {
      console.error('❌ Error fetching available scenario IDs:', error.message);
      return [];
    }
  }

  /**
   * Delete scenario
   */
  async deleteScenario(id: string): Promise<void> {
    const client = await this.getClient();
    
    const { error } = await client
      .from('scenarios')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  /**
   * Store conversation exchange in database
   */
  async storeConversationExchange(exchange: {
    email: string;
    question: string;
    response: string;
    sessionId?: string;
    scenarioId?: number;
    studentRole?: string;
    contextData?: any;
  }): Promise<any> {
    try {
      const client = await this.getClient();

      let sessionDbId: number | null = null;
      if (exchange.sessionId) {
        const session = await this.getSessionByStringId(exchange.sessionId);
        sessionDbId = session?.id ?? null;
      }

      const { data, error } = await client
        .from('exchanges')
        .insert({
          session_id: sessionDbId,
          question: exchange.question,
          response: exchange.response,
          role: 'system',
          timestamp: new Date().toISOString(),
          metadata: {
            email: exchange.email,
            scenarioId: exchange.scenarioId,
            studentRole: exchange.studentRole,
            contextData: exchange.contextData,
            source: 'patient_simulator'
          }
        })
        .select()
        .single();

      if (error) {
        console.error('❌ Error storing conversation exchange:', error);
        throw error;
      }

      console.log(`💾 Stored conversation exchange for session ${exchange.sessionId}`);
      if (exchange.sessionId) {
        const timestamp = new Date().toISOString();
        this.addFallbackSessionMessage(exchange.sessionId, {
          role: 'user',
          question: exchange.question,
          response: '',
          timestamp,
          isFallback: !sessionDbId
        });
        this.addFallbackSessionMessage(exchange.sessionId, {
          role: 'assistant',
          question: '',
          response: exchange.response,
          timestamp,
          isFallback: !sessionDbId
        });
      }
      return data;
    } catch (error: any) {
      console.error('❌ Failed to store conversation exchange:', error);
      if (exchange.sessionId) {
        const timestamp = new Date().toISOString();
        this.addFallbackSessionMessage(exchange.sessionId, {
          role: 'user',
          question: exchange.question,
          response: '',
          timestamp,
          isFallback: true
        });
        this.addFallbackSessionMessage(exchange.sessionId, {
          role: 'assistant',
          question: '',
          response: exchange.response,
          timestamp,
          isFallback: true
        });
      }
      // Don't throw - conversation storage failure shouldn't break the flow
      return null;
    }
  }

  /**
   * Get conversation history for a session
   */
  async getConversationHistory(sessionId: string, limit: number = 50): Promise<any[]> {
    try {
      const client = await this.getClient();

      const session = await this.getSessionByStringId(sessionId);
      if (!session) {
        console.warn(`⚠️ Session ${sessionId} not found, returning empty conversation history`);
        return [];
      }

      const { data, error } = await client
        .from('exchanges')
        .select('*')
        .eq('session_id', session.id)
        .order('timestamp', { ascending: true })
        .limit(limit);

      if (error) {
        console.error('❌ Error fetching conversation history:', error);
        return [];
      }

      console.log(`📚 Retrieved ${data?.length || 0} conversation exchanges for session ${sessionId}`);
      return data || [];
    } catch (error: any) {
      console.error('❌ Error fetching conversation history:', error.message);
      return [];
    }
  }

  /**
   * Get recent conversations for a student
   */
  async getStudentConversations(email: string, limit: number = 100): Promise<any[]> {
    try {
      const client = await this.getClient();
      
      const { data, error } = await client
        .from('exchanges')
        .select('*')
        .contains('metadata', { email })
        .order('timestamp', { ascending: false })
        .limit(limit);

      if (error) throw error;

      console.log(`📚 Retrieved ${data?.length || 0} conversations for student ${email}`);
      return data || [];
    } catch (error: any) {
      console.error('❌ Error fetching student conversations:', error.message);
      return [];
    }
  }

  // ====================================
  // TRAINING SESSIONS MANAGEMENT
  // ====================================

  /**
   * Create a new training session
   */
  async createTrainingSession(sessionData: {
    title: string;
    description?: string;
    createdBy: string;
    scenarioIds: number[];
    studentEmails: string[];
    startDate?: string;
    endDate?: string;
  }): Promise<any> {
    try {
      const client = await this.getClient();

      // Create the main training session
      const { data: trainingSession, error: sessionError } = await client
        .from('training_sessions')
        .insert({
          title: sessionData.title,
          description: sessionData.description,
          created_by: sessionData.createdBy,
          scenario_ids: sessionData.scenarioIds,
          status: 'active',
          start_date: sessionData.startDate || new Date().toISOString(),
          end_date: sessionData.endDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (sessionError) throw sessionError;

      // Add students to the training session
      if (sessionData.studentEmails && sessionData.studentEmails.length > 0) {
        const studentAssignments = sessionData.studentEmails.map(email => ({
          training_session_id: trainingSession.id,
          student_email: email.trim().toLowerCase(),
          assigned_at: new Date().toISOString(),
          status: 'assigned'
        }));

        const { error: studentsError } = await client
          .from('training_session_students')
          .insert(studentAssignments);

        if (studentsError) throw studentsError;
      }

      console.log(`✅ Created training session: ${trainingSession.title} with ID: ${trainingSession.id}`);
      
      return {
        ...trainingSession,
        studentEmails: sessionData.studentEmails,
        scenarioIds: sessionData.scenarioIds
      };
    } catch (error: any) {
      console.error('❌ Error creating training session:', error.message);
      throw error;
    }
  }

  /**
   * Get all training sessions for an admin
   */
  async getTrainingSessions(createdBy: string): Promise<any[]> {
    try {
      const client = await this.getClient();

      const { data: sessions, error } = await client
        .from('training_sessions')
        .select('*')
        .eq('created_by', createdBy)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get associated students for each session
      const sessionsWithDetails = await Promise.all(
        (sessions || []).map(async (session) => {
          // Get students
          const { data: students, error: studentsError } = await client
            .from('training_session_students')
            .select('student_email, assigned_at, status')
            .eq('training_session_id', session.id);

          if (studentsError) {
            console.warn(`Warning: Could not fetch students for session ${session.id}:`, studentsError.message);
          }

          // Get scenario details
          let scenarioDetails = [];
          if (session.scenario_ids && session.scenario_ids.length > 0) {
            const { data: scenarios, error: scenariosError } = await client
              .from('scenarios')
              .select('id, title, description')
              .in('id', session.scenario_ids);

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

      console.log(`📚 Retrieved ${sessionsWithDetails.length} training sessions for ${createdBy}`);
      return sessionsWithDetails;
    } catch (error: any) {
      console.error('❌ Error fetching training sessions:', error.message);
      return [];
    }
  }

  /**
   * Get a specific training session by ID
   */
  async getTrainingSessionById(id: string, createdBy: string): Promise<any | null> {
    try {
      const client = await this.getClient();

      const { data: session, error } = await client
        .from('training_sessions')
        .select('*')
        .eq('id', parseInt(id))
        .eq('created_by', createdBy)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // Not found
        }
        throw error;
      }

      // Get associated students
      const { data: students, error: studentsError } = await client
        .from('training_session_students')
        .select('student_email, assigned_at, status')
        .eq('training_session_id', session.id);

      if (studentsError) {
        console.warn(`Warning: Could not fetch students for session ${id}:`, studentsError.message);
      }

      // Get scenario details
      let scenarioDetails = [];
      if (session.scenario_ids && session.scenario_ids.length > 0) {
        const { data: scenarios, error: scenariosError } = await client
          .from('scenarios')
          .select('id, title, description')
          .in('id', session.scenario_ids);

        if (scenariosError) {
          console.warn(`Warning: Could not fetch scenarios for session ${id}:`, scenariosError.message);
        } else {
          scenarioDetails = scenarios || [];
        }
      }

      console.log(`📚 Retrieved training session ${id} for ${createdBy}`);
      return {
        ...session,
        students: students || [],
        scenarios: scenarioDetails,
        studentCount: (students || []).length,
        scenarioCount: scenarioDetails.length
      };
    } catch (error: any) {
      console.error('❌ Error fetching training session:', error.message);
      throw error;
    }
  }

  /**
   * Update a training session
   */
  async updateTrainingSession(id: string, updates: any, createdBy: string): Promise<any> {
    try {
      const client = await this.getClient();

      console.log(`🔍 Updating training session - ID: ${id}, createdBy: ${createdBy}, updates:`, JSON.stringify(updates));

      const { data: session, error } = await client
        .from('training_sessions')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', parseInt(id))
        .eq('created_by', createdBy)
        .select()
        .single();

      if (error) {
        console.error('❌ Supabase error updating training session:', error);
        throw error;
      }

      if (!session) {
        console.error('❌ No training session found with id:', id, 'and created_by:', createdBy);
        throw new Error(`Training session ${id} not found or you don't have permission to modify it`);
      }

      console.log(`✅ Updated training session ${id}`);
      return session;
    } catch (error: any) {
      console.error('❌ Error updating training session:', error.message);
      throw error;
    }
  }

  /**
   * Delete a training session
   */
  async deleteTrainingSession(id: string, createdBy: string): Promise<void> {
    try {
      const client = await this.getClient();

      // First delete associated students
      await client
        .from('training_session_students')
        .delete()
        .eq('training_session_id', parseInt(id));

      // Then delete the training session
      const { error } = await client
        .from('training_sessions')
        .delete()
        .eq('id', parseInt(id))
        .eq('created_by', createdBy);

      if (error) throw error;

      console.log(`✅ Deleted training session ${id}`);
    } catch (error: any) {
      console.error('❌ Error deleting training session:', error.message);
      throw error;
    }
  }

  // ====================================
  // ECOS SESSION MANAGEMENT
  // ====================================

  /**
   * Create a new ECOS session in database
   */
  async createSession(sessionData: {
    sessionId: string;
    studentEmail: string;
    scenarioId: number;
    status?: string;
  }): Promise<any> {
    try {
      const client = await this.getClient();

      // Ensure student exists to satisfy sessions.student_email foreign key
      await this.ensureUserExists(sessionData.studentEmail);

      const { data, error } = await client
        .from('sessions')
        .insert({
          session_id: sessionData.sessionId,
          student_email: sessionData.studentEmail,
          scenario_id: sessionData.scenarioId,
          status: sessionData.status || 'active',
          start_time: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        console.error('❌ Error creating ECOS session:', error);
        throw error;
      }

      console.log(`✅ Created ECOS session ${sessionData.sessionId} for student ${sessionData.studentEmail}`);
      const record = {
        ...data,
        isFallback: false
      };
      this.fallbackSessions.set(sessionData.sessionId, record);
      return record;
    } catch (error: any) {
      console.error('❌ Failed to create ECOS session:', error.message);
      const fallbackRecord = {
        id: `fallback-session-${Date.now()}`,
        session_id: sessionData.sessionId,
        student_email: sessionData.studentEmail,
        scenario_id: sessionData.scenarioId,
        status: sessionData.status || 'active',
        start_time: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        isFallback: true
      };
      this.fallbackSessions.set(sessionData.sessionId, fallbackRecord);
      console.warn(`⚠️ Stored session ${sessionData.sessionId} in fallback memory store`);
      throw error;
    }
  }

  /**
   * Get ECOS session by string session ID
   */
  async getSessionByStringId(sessionId: string): Promise<any> {
    const fallbackSession = this.fallbackSessions.get(sessionId) || null;

    try {
      const client = await this.getClient();

      const { data, error } = await client
        .from('sessions')
        .select('*')
        .eq('session_id', sessionId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No rows found
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
    } catch (error: any) {
      console.error('❌ Error getting session by string ID:', error.message);
      if (fallbackSession) {
        console.warn(`⚠️ Using fallback session for ${sessionId}`);
      }
      return fallbackSession;
    }
  }

  /**
   * Get all ECOS sessions for a student (filtered by email)
   * Returns sessions with scenario information for the student history tab
   */
  async getStudentSessions(studentEmail: string): Promise<any[]> {
    try {
      const client = await this.getClient();

      console.log(`🔍 Fetching sessions for student: ${studentEmail}`);

      const { data, error } = await client
        .from('sessions')
        .select(`
          id,
          session_id,
          student_email,
          scenario_id,
          status,
          start_time,
          end_time,
          created_at,
          updated_at,
          scenarios (
            id,
            title,
            description
          )
        `)
        .eq('student_email', studentEmail)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Error fetching student sessions:', error);
        return [];
      }

      console.log(`✅ Found ${data?.length || 0} sessions for student ${studentEmail}`);

      // Format the response to match the expected structure
      return (data || []).map(session => ({
        id: session.session_id,
        sessionId: session.session_id,
        studentEmail: session.student_email,
        scenarioId: session.scenario_id,
        scenarioTitle: session.scenarios?.title || 'Unknown Scenario',
        scenarioDescription: session.scenarios?.description || '',
        status: session.status,
        startTime: session.start_time,
        endTime: session.end_time,
        createdAt: session.created_at,
        updatedAt: session.updated_at
      }));

    } catch (error: any) {
      console.error('❌ Error in getStudentSessions:', error.message);
      return [];
    }
  }

  /**
   * Get all ECOS sessions for a training session (for teacher view)
   * Returns all sessions of all students enrolled in the training session
   */
  async getTrainingSessionSessions(trainingSessionId: number): Promise<any[]> {
    try {
      const client = await this.getClient();

      console.log(`🔍 Fetching all sessions for training session: ${trainingSessionId}`);

      // First, get all students enrolled in this training session
      const { data: enrollments, error: enrollmentError } = await client
        .from('training_session_students')
        .select('student_email')
        .eq('training_session_id', trainingSessionId);

      if (enrollmentError) {
        console.error('❌ Error fetching training session students:', enrollmentError);
        return [];
      }

      if (!enrollments || enrollments.length === 0) {
        console.log(`ℹ️ No students enrolled in training session ${trainingSessionId}`);
        return [];
      }

      const studentEmails = enrollments.map(e => e.student_email);
      console.log(`📚 Found ${studentEmails.length} students in training session`);

      // Get all sessions for these students
      const { data, error } = await client
        .from('sessions')
        .select(`
          id,
          session_id,
          student_email,
          scenario_id,
          status,
          start_time,
          end_time,
          created_at,
          updated_at,
          scenarios (
            id,
            title,
            description
          )
        `)
        .in('student_email', studentEmails)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Error fetching training session sessions:', error);
        return [];
      }

      console.log(`✅ Found ${data?.length || 0} total sessions for training session ${trainingSessionId}`);

      // Format the response to match the expected structure
      return (data || []).map(session => ({
        id: session.session_id,
        sessionId: session.session_id,
        studentEmail: session.student_email,
        scenarioId: session.scenario_id,
        scenarioTitle: session.scenarios?.title || 'Unknown Scenario',
        scenarioDescription: session.scenarios?.description || '',
        status: session.status,
        startTime: session.start_time,
        endTime: session.end_time,
        createdAt: session.created_at,
        updatedAt: session.updated_at
      }));

    } catch (error: any) {
      console.error('❌ Error in getTrainingSessionSessions:', error.message);
      return [];
    }
  }

  /**
   * Update session status (e.g., mark as completed)
   */
  async updateSessionStatus(sessionId: string, status: string): Promise<void> {
    try {
      const client = await this.getClient();

      const updateData: any = {
        status,
        updated_at: new Date().toISOString()
      };

      // Add end_time if status is completed
      if (status === 'completed') {
        updateData.end_time = new Date().toISOString();
      }

      console.log(`📝 Updating session ${sessionId} status to ${status}`);

      const { error } = await client
        .from('sessions')
        .update(updateData)
        .eq('session_id', sessionId);

      if (error) {
        throw new Error(`Failed to update session status: ${error.message}`);
      }

      console.log(`✅ Successfully updated session ${sessionId} to ${status}`);
    } catch (error: any) {
      console.error('❌ Error updating session status:', error.message);
      throw error;
    }
  }

  /**
   * Store message in ECOS session
   */
  async storeSessionMessage(messageData: {
    sessionId: string;
    role: 'user' | 'assistant';
    question?: string;
    response?: string;
    content?: string;
  }): Promise<any> {
    try {
      const client = await this.getClient();

      // First get the session to get the database ID
      const session = await this.getSessionByStringId(messageData.sessionId);
      if (!session) {
        console.warn(`⚠️ [storeSessionMessage] Session ${messageData.sessionId} not found in DB - storing in fallback only`);
        console.warn(`⚠️ [storeSessionMessage] This message will be LOST on server restart!`);
        this.addFallbackSessionMessage(messageData.sessionId, {
          role: messageData.role,
          question: messageData.question || messageData.content || '',
          response: messageData.response || '',
          timestamp: new Date().toISOString(),
          isFallback: true
        });
        return null;
      }

      console.log(`🔍 [storeSessionMessage] Found session in DB - id: ${session.id}, attempting insert...`);

      const timestamp = new Date().toISOString();
      const { data, error } = await client
        .from('exchanges')
        .insert({
          session_id: session.id, // Use database integer ID
          role: messageData.role,
          question: messageData.question || messageData.content || '',
          response: messageData.response || '',
          timestamp
        })
        .select()
        .single();

      if (error) {
        console.error(`❌ [storeSessionMessage] Supabase insert failed for session ${messageData.sessionId}:`, error);
        console.error(`❌ [storeSessionMessage] Error code: ${error.code}, message: ${error.message}`);
        console.error(`❌ [storeSessionMessage] Payload attempted: session_id=${session.id}, role=${messageData.role}`);
        throw error;
      }

      console.log(`✅ [storeSessionMessage] Successfully stored ${messageData.role} message in DB for session ${messageData.sessionId}`);
      this.addFallbackSessionMessage(messageData.sessionId, {
        role: messageData.role,
        question: messageData.question || messageData.content || '',
        response: messageData.response || '',
        timestamp,
        isFallback: false
      });
      return data;
    } catch (error: any) {
      console.error(`❌ [storeSessionMessage] CRITICAL: Failed to store message in DB for session ${messageData.sessionId}`);
      console.error(`❌ [storeSessionMessage] Error: ${error.message}`);
      console.error(`❌ [storeSessionMessage] Stack: ${error.stack}`);
      console.warn(`⚠️ [storeSessionMessage] Storing in fallback memory - data will be LOST on restart`);

      this.addFallbackSessionMessage(messageData.sessionId, {
        role: messageData.role,
        question: messageData.question || messageData.content || '',
        response: messageData.response || '',
        timestamp: new Date().toISOString(),
        isFallback: true
      });

      // Don't throw - message storage failure shouldn't break the flow
      // But log prominently so we know there's an issue
      return null;
    }
  }

  /**
   * Get messages for an ECOS session
   */
  async getSessionMessages(sessionId: string, limit: number = 50): Promise<any[]> {
    const fallbackMessages = this.fallbackSessionMessages.get(sessionId) || [];

    try {
      const client = await this.getClient();

      // First get the session to get the database ID
      const session = await this.getSessionByStringId(sessionId);
      if (!session) {
        console.warn(`⚠️ Session ${sessionId} not found, returning empty messages`);
        return fallbackMessages;
      }

      const { data, error } = await client
        .from('exchanges')
        .select('*')
        .eq('session_id', session.id) // Use database integer ID
        .order('timestamp', { ascending: true })
        .limit(limit);

      if (error) {
        console.error('❌ Error fetching session messages:', error);
        console.warn(`⚠️ Using ${fallbackMessages.length} fallback messages instead`);
        return fallbackMessages;
      }

      const messages = data || [];
      console.log(`📚 Retrieved ${messages.length} messages from DB for session ${sessionId}`);

      // ✅ If DB is empty but we have fallback messages, use fallback
      if (messages.length === 0 && fallbackMessages.length > 0) {
        console.warn(`⚠️ DB returned 0 messages but found ${fallbackMessages.length} fallback messages - using fallback`);
        return fallbackMessages;
      }

      // Store DB messages in fallback for redundancy
      if (messages.length > 0) {
        this.fallbackSessionMessages.set(sessionId, messages);
      }

      return messages.length > 0 ? messages : fallbackMessages;
    } catch (error: any) {
      console.error('❌ Error fetching session messages:', error.message);
      return fallbackMessages;
    }
  }

  /**
   * Update ECOS session status
   */
  async updateSessionStatus(sessionId: string, status: string): Promise<any> {
    try {
      const client = await this.getClient();

      const { data, error } = await client
        .from('sessions')
        .update({
          status: status,
          end_time: status === 'completed' ? new Date().toISOString() : null,
          updated_at: new Date().toISOString()
        })
        .eq('session_id', sessionId)
        .select()
        .single();

      if (error) {
        console.error('❌ Error updating session status:', error);
        throw error;
      }

      console.log(`✅ Updated session ${sessionId} status to ${status}`);
      const record = {
        ...data,
        isFallback: false
      };
      this.fallbackSessions.set(sessionId, record);
      return record;
    } catch (error: any) {
      console.error('❌ Failed to update session status:', error.message);
      const fallbackSession = this.fallbackSessions.get(sessionId);
      if (fallbackSession) {
        const updatedFallback = {
          ...fallbackSession,
          status,
          updated_at: new Date().toISOString(),
          end_time: status === 'completed' ? new Date().toISOString() : fallbackSession?.end_time
        };
        this.fallbackSessions.set(sessionId, updatedFallback);
        console.warn(`⚠️ Updated session ${sessionId} status in fallback memory store`);
      }
      throw error;
    }
  }

  /**
   * Create ECOS evaluation
   */
  async createEvaluation(evalData: {
    sessionId: string;
    scenarioId: number;
    studentEmail: string;
    scores: any;
    globalScore: number;
    strengths: string[];
    weaknesses: string[];
    recommendations: string[];
    feedback?: string;
    heuristic?: any;
    llmScorePercent?: number | null;
    criteriaDetails?: any;
  }): Promise<any> {
    try {
      const client = await this.getClient();

      // Ensure student exists to satisfy evaluations.student_email foreign key
      await this.ensureUserExists(evalData.studentEmail);

      // Get session database ID
      const session = await this.getSessionByStringId(evalData.sessionId);
      if (!session || session.isFallback) {
        throw new Error(`Session ${evalData.sessionId} not available in primary database`);
      }

      console.log(`📤 Attempting to store evaluation for session ${evalData.sessionId}`);

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
        llm_score_percent: typeof evalData.llmScorePercent === 'number' ? evalData.llmScorePercent : null,
        criteria_details: evalData.criteriaDetails,
        evaluated_at: new Date().toISOString(),
        created_at: new Date().toISOString()
      };

      console.log(`🔍 [DEBUG] Insert payload columns:`, Object.keys(insertPayload));
      console.log(`🔍 [DEBUG] Session DB ID:`, session.id, `String ID:`, evalData.sessionId);

      const { data, error } = await client
        .from('evaluations')
        .insert(insertPayload)
        .select()
        .single();

      console.log(`🔍 [DEBUG] Supabase response - data:`, data ? 'EXISTS' : 'NULL', `error:`, error ? error.code : 'NONE');

      if (error) {
        console.error('❌ Error creating evaluation:', {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint
        });
        throw error;
      }

      if (!data) {
        const errorMsg = 'Supabase returned null data despite no error - possible schema mismatch';
        console.error(`❌ ${errorMsg}`);
        throw new Error(errorMsg);
      }

      console.log(`✅ Created evaluation for session ${evalData.sessionId} - DB record ID:`, data.id);
      const record = {
        ...data,
        isFallback: false
      };
      this.fallbackEvaluations.set(evalData.sessionId, record);
      return record;
    } catch (error: any) {
      console.error('❌ Failed to create evaluation:', {
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
        llm_score_percent: typeof evalData.llmScorePercent === 'number' ? evalData.llmScorePercent : null,
        criteria_details: evalData.criteriaDetails,
        evaluated_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        summary: Array.isArray(evalData.feedback)
          ? evalData.feedback.join(' ')
          : (evalData.feedback || ''),
        isFallback: true
      };
      this.fallbackEvaluations.set(evalData.sessionId, fallbackRecord);
      console.warn(`⚠️ Stored evaluation for session ${evalData.sessionId} in fallback memory store`);
      throw error;
    }
  }

  /**
   * Get evaluation for a session
   */
  async getEvaluation(sessionId: string): Promise<any> {
    const fallbackEvaluation = this.fallbackEvaluations.get(sessionId) || null;
    try {
      const client = await this.getClient();

      // Get session database ID
      const session = await this.getSessionByStringId(sessionId);
      if (!session || session.isFallback) {
        return fallbackEvaluation;
      }

      const { data, error } = await client
        .from('evaluations')
        .select('*')
        .eq('session_id', session.id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No evaluation found
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
    } catch (error: any) {
      console.error('❌ Error getting evaluation:', error.message);
      if (fallbackEvaluation) {
        console.warn(`⚠️ Using fallback evaluation for session ${sessionId}`);
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
  async getUserByFirebaseUid(firebaseUid: string): Promise<any | null> {
    try {
      if (!this.supabase) await this.initialize();

      const { data, error } = await this.supabase
        .from('users')
        .select('*')
        .eq('firebase_uid', firebaseUid)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No user found
          return null;
        }
        throw error;
      }

      return data;
    } catch (error: any) {
      console.error('❌ Error getting user by Firebase UID:', error.message);
      return null;
    }
  }

  /**
   * Get user by email
   */
  async getUserByEmail(email: string): Promise<any | null> {
    try {
      if (!this.supabase) await this.initialize();

      const { data, error } = await this.supabase
        .from('users')
        .select('*')
        .eq('email', email.toLowerCase().trim())
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No user found
          return null;
        }
        throw error;
      }

      return data;
    } catch (error: any) {
      console.error('❌ Error getting user by email:', error.message);
      return null;
    }
  }

  /**
   * Create new user
   */
  async createUser(userData: {
    email: string;
    firebaseUid: string;
    firstName?: string | null;
    lastName?: string | null;
    profileImageUrl?: string | null;
  }): Promise<any> {
    try {
      if (!this.supabase) await this.initialize();

      // Only insert minimal fields that exist in actual Supabase schema
      // Let Supabase auto-generate the integer ID
      const { data, error } = await this.supabase
        .from('users')
        .insert([{
          email: userData.email.toLowerCase().trim(),
          firebase_uid: userData.firebaseUid
        }])
        .select()
        .single();

      if (error) throw error;

      console.log('✅ User created in Supabase:', { id: data.id, email: data.email });
      return data;
    } catch (error: any) {
      console.error('❌ Error creating user:', error.message);
      throw new Error('Failed to create user in database');
    }
  }

  /**
   * Update user's Firebase UID
   */
  async updateUserFirebaseUid(userId: string, firebaseUid: string): Promise<void> {
    try {
      if (!this.supabase) await this.initialize();

      const { error } = await this.supabase
        .from('users')
        .update({
          firebase_uid: firebaseUid,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (error) throw error;

      console.log('✅ User Firebase UID updated:', { userId, firebaseUid });
    } catch (error: any) {
      console.error('❌ Error updating user Firebase UID:', error.message);
      throw new Error('Failed to update user Firebase UID');
    }
  }

  /**
   * Get user role
   */
  async getUserRole(userId: string): Promise<string> {
    try {
      if (!this.supabase) await this.initialize();

      const { data, error } = await this.supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No role found, default to student
          return 'student';
        }
        throw error;
      }

      return data.role;
    } catch (error: any) {
      console.error('❌ Error getting user role:', error.message);
      // Default to student on error
      return 'student';
    }
  }

  /**
   * Set user role
   */
  async setUserRole(userId: string, role: 'admin' | 'student'): Promise<void> {
    try {
      if (!this.supabase) await this.initialize();

      // First, try to update existing role
      const { error: updateError } = await this.supabase
        .from('user_roles')
        .update({
          role,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);

      // If no rows were updated, insert new role
      if (updateError || updateError?.code === 'PGRST116') {
        const { error: insertError } = await this.supabase
          .from('user_roles')
          .insert([{
            user_id: userId,
            role,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }]);

        if (insertError) {
          // Check if it's a duplicate key error (role already exists)
          if (!insertError.message.includes('duplicate')) {
            throw insertError;
          }
        }
      }

      console.log('✅ User role set:', { userId, role });
    } catch (error: any) {
      console.error('❌ Error setting user role:', error.message);
      throw new Error('Failed to set user role');
    }
  }

  /**
   * Get metrics for monitoring
   */
  getMetrics(): DatabaseMetrics {
    return { ...this.metrics };
  }

  /**
   * Check if service is ready
   */
  isReady(): boolean {
    return this.isInitialized && this.metrics.isHealthy;
  }

  private addFallbackSessionMessage(sessionId: string, message: any) {
    if (!sessionId) return;
    const existing = this.fallbackSessionMessages.get(sessionId) || [];
    existing.push({ ...message, sessionId });
    this.fallbackSessionMessages.set(sessionId, existing);
  }
}

// Export singleton instance
export const unifiedDb = new UnifiedDatabaseService();
