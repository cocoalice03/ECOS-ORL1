import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { z } from "zod";
import { users, ecosScenarios, ecosSessions, ecosMessages, ecosEvaluations, trainingSessions, trainingSessionStudents, trainingSessionScenarios } from '../shared/schema.js';
import { unifiedDb } from './services/unified-database.service.js';
import { eq, and } from 'drizzle-orm';
import { scenarioSyncService } from './services/scenario-sync.service.js';
import {
  authService,
  authenticateToken,
  requireAdmin,
  isAdminAuthorized,
  authorizeByEmail,
  type AuthenticatedRequest
} from './middleware/auth.middleware.js';
import { verifyFirebaseToken } from './middleware/firebase-auth.middleware.js';
import {
  validateLogin,
  validateCreateStudent,
  validateCreateEcosSession,
  validateEcosMessage,
  validateEcosEvaluation,
  validateEmailQuery,
  validateSessionIdParam,
  validateRequestSize,
  validateContentType,
  validateCreateTrainingSession,
  type ValidatedRequest
} from './middleware/validation.middleware.js';
import {
  authRateLimit,
  firebaseAuthRateLimit,
  apiRateLimit,
  strictRateLimit,
  emailBasedRateLimit,
  ecosSessionRateLimit,
  ecosEvaluationRateLimit
} from './middleware/rate-limit.middleware.js';
import { APIError, asyncHandler, sendErrorResponse } from './middleware/error-handler.middleware.js';
import { apiLogger } from './services/logger.service.js';
import { openaiService } from './services/openai.service.js';

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  // Database initialization is now handled by startup sequencer
  // No async initialization needed here - all handled by UnifiedDatabaseService

  // In-memory user storage for demonstration
  const inMemoryUsers = new Map<string, { userId: string; createdAt: Date }>();

  async function findOrCreateStudent(email: string): Promise<{ userId: string; isNewUser: boolean }> {
    try {
      // Try database first - functionality temporarily disabled
      try {
        // Database operations temporarily disabled due to schema migration
        // Fallback to in-memory storage directly
        if (inMemoryUsers.has(email)) {
          const user = inMemoryUsers.get(email)!;
          return { userId: user.userId, isNewUser: false };
        }

        const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        inMemoryUsers.set(email, { userId, createdAt: new Date() });
        return { userId, isNewUser: true };
      } catch (dbError) {
        console.log('Database not available, using in-memory storage');
        
        // Fallback to in-memory storage
        if (inMemoryUsers.has(email)) {
          const user = inMemoryUsers.get(email)!;
          return { userId: user.userId, isNewUser: false };
        }

        const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        inMemoryUsers.set(email, { userId, createdAt: new Date() });
        return { userId, isNewUser: true };
      }
    } catch (error) {
      console.error('Error in findOrCreateStudent:', error);
      throw error;
    }
  }

  // Health check endpoint for diagnostics
  app.get("/api/health", (req: Request, res: Response) => {
    res.status(200).json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      service: "ecos-api",
      version: "1.0.0"
    });
  });

  // Teacher auth check endpoint for diagnostics
  app.get("/api/teacher/auth-check", (req: Request, res: Response) => {
    const { email } = req.query;
    
    // ROBUST AUTHENTICATION - Force admin email acceptance
    const adminEmails = ['cherubindavid@gmail.com', 'colombemadoungou@gmail.com'];
    const emailStr = typeof email === 'string' ? email.trim().toLowerCase() : '';
    
    if (!emailStr) {
      return res.status(400).json({ message: "Email required" });
    }
    
    if (!adminEmails.includes(emailStr)) {
      return res.status(403).json({ message: "Not authorized as teacher" });
    }
    
    res.status(200).json({
      message: "Teacher authentication successful",
      email: email,
      timestamp: new Date().toISOString()
    });
  });

  // Authentication endpoints
  app.post("/api/auth/login", authRateLimit.middleware(), validateContentType(), validateRequestSize(), validateLogin, async (req: ValidatedRequest, res: Response) => {
    try {
      const { email, password } = (req.validatedBody || req.body) as { email: string; password: string };

      if (!authService.isAuthorizedAdminEmail(email)) {
        return res.status(401).json({
          error: 'Invalid credentials',
          code: 'INVALID_CREDENTIALS'
        });
      }

      if (!authService.verifyPassword(email, password)) {
        return res.status(401).json({
          error: 'Invalid credentials',
          code: 'INVALID_CREDENTIALS'
        });
      }

      const token = authService.generateToken(email);
      
      res.status(200).json({
        message: 'Login successful',
        token,
        user: {
          email,
          isAdmin: true
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ 
        error: 'Login failed',
        code: 'LOGIN_FAILED'
      });
    }
  });

  app.post("/api/auth/verify", authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    res.status(200).json({
      message: 'Token valid',
      user: req.user
    });
  });

  app.get("/api/auth/profile", authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
    res.status(200).json({
      user: req.user,
      adminEmails: authService.getAdminEmails()
    });
  });

  // Check if email has admin privileges
  app.get("/api/auth/check-admin", asyncHandler(async (req: Request, res: Response) => {
    const email = req.query.email as string;

    if (!email) {
      throw APIError.badRequest('Email parameter required');
    }

    const isAdmin = authService.isAdmin(email);
    res.status(200).json({
      isAdmin,
      email: email.toLowerCase().trim()
    });
  }));

  // Firebase Authentication endpoints
  app.post("/api/auth/firebase-login", firebaseAuthRateLimit.middleware(), async (req: Request, res: Response) => {
    try {
      // Use the statically imported middleware
      const firebaseReq = req as any;

      await new Promise<void>((resolve, reject) => {
        verifyFirebaseToken(firebaseReq, res, (err?: any) => {
          if (err) reject(err);
          else resolve();
        });
      });

      // Return user data and JWT token
      res.status(200).json({
        user: {
          uid: firebaseReq.firebaseUser.uid,
          email: firebaseReq.firebaseUser.email,
          role: firebaseReq.firebaseUser.role,
          emailVerified: firebaseReq.firebaseUser.emailVerified
        },
        jwtToken: firebaseReq.jwtToken,
        message: 'Firebase authentication successful'
      });
    } catch (error: any) {
      console.error('❌ Firebase login error:', error);
      res.status(403).json({
        error: error.message || 'Firebase authentication failed',
        code: 'FIREBASE_LOGIN_FAILED'
      });
    }
  });

  app.post("/api/auth/firebase-register", firebaseAuthRateLimit.middleware(), validateContentType(), validateRequestSize(), async (req: Request, res: Response) => {
    try {
      const { email, password, firstName, lastName } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          error: 'Email and password are required',
          code: 'MISSING_CREDENTIALS'
        });
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          error: 'Invalid email format',
          code: 'INVALID_EMAIL'
        });
      }

      // Validate password strength
      if (password.length < 6) {
        return res.status(400).json({
          error: 'Password must be at least 6 characters',
          code: 'WEAK_PASSWORD'
        });
      }

      // Import Firebase Admin service
      const { firebaseAdminService } = await import('./services/firebase-admin.service.js');

      // Check if user already exists
      const existingUser = await firebaseAdminService.getUserByEmail(email);
      if (existingUser) {
        return res.status(409).json({
          error: 'Email already in use',
          code: 'EMAIL_IN_USE'
        });
      }

      // Create Firebase user
      const firebaseUser = await firebaseAdminService.createUser(email, password);

      // Create user in Supabase
      const supabaseUser = await unifiedDb.createUser({
        email,
        firebaseUid: firebaseUser.uid,
        firstName: firstName || null,
        lastName: lastName || null,
        profileImageUrl: null
      });

      // Assign student role by default
      await unifiedDb.setUserRole(supabaseUser.id, 'student');

      // Generate JWT token
      const jwtToken = authService.generateToken(email);

      res.status(201).json({
        user: {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          role: 'student',
          emailVerified: false
        },
        jwtToken,
        message: 'User registered successfully'
      });

    } catch (error: any) {
      console.error('❌ Firebase registration error:', error);
      res.status(500).json({
        error: error.message || 'Registration failed',
        code: 'REGISTRATION_FAILED'
      });
    }
  });

  // Route to sync scenarios from Pinecone - supports both auth methods during transition
  app.post("/api/admin/sync-scenarios", asyncHandler(async (req: Request, res: Response) => {
    const { email } = req.query;
    
    if (!email || !isAdminAuthorized(email as string)) {
      throw APIError.forbidden("Accès non autorisé");
    }

    await scenarioSyncService.syncScenariosFromPinecone();
    res.status(200).json({ message: "Synchronisation des scénarios terminée avec succès" });
  }));

  // Route to test direct database connection and fetch scenarios
  app.get("/api/admin/test-db", async (req: Request, res: Response) => {
    const { email } = req.query;
    
    if (!email || !isAdminAuthorized(email as string)) {
      return res.status(403).json({ message: "Accès non autorisé" });
    }

    try {
      console.log('🔧 Testing database connection via unified service...');
      await unifiedDb.initialize(); // Ensure database is initialized
      
      const scenarios = await unifiedDb.getScenarios();
      
      res.status(200).json({ 
        connected: true,
        scenarios,
        count: scenarios.length,
        message: `Connexion Supabase réussie - ${scenarios.length} scénarios trouvés`
      });
      
    } catch (error: any) {
      console.error("Error connecting to Supabase:", error);
      res.status(500).json({ 
        message: "Erreur de connexion à la base de données Supabase",
        error: error.message,
        connected: false
      });
    }
  });

  // Route to get available scenarios for students
  app.get("/api/student/available-scenarios", async (req: Request, res: Response) => {
    try {
      console.log('🔧 Fetching student scenarios from database only...');
      const scenarios = await scenarioSyncService.getAvailableScenarios();
      
      res.status(200).json({ 
        scenarios,
        connected: true,
        source: 'database'
      });
      
    } catch (error: any) {
      console.error("Error fetching student scenarios:", error);
      res.status(500).json({ 
        message: "Erreur de connexion à la base de données",
        error: error.message,
        connected: false
      });
    }
  });

  // Route to get scenarios for teacher dashboard
  app.get("/api/teacher/scenarios", async (req: Request, res: Response) => {
    const { email } = req.query;
    
    // ROBUST AUTHENTICATION - Force admin email acceptance
    const adminEmails = ['cherubindavid@gmail.com', 'colombemadoungou@gmail.com'];
    const emailStr = typeof email === 'string' ? email.trim().toLowerCase() : '';
    
    if (!emailStr || !adminEmails.includes(emailStr)) {
      // Silent rejection for unauthorized emails (no spam logs)
      if (emailStr && !adminEmails.includes(emailStr)) {
        console.log('⚠️ [SILENT-REJECT] Non-admin email attempted access:', emailStr);
      }
      return res.status(403).json({ message: "Accès non autorisé" });
    }
    
    console.log('✅ [ADMIN-ACCESS] Authorized admin email:', emailStr);

    try {
      console.log('🔧 Fetching teacher scenarios using unified database...');
      
      const scenarios = await unifiedDb.getScenarios();
      
      res.status(200).json({ 
        scenarios,
        connected: true,
        source: 'unified-database'
      });
      
    } catch (error: any) {
      console.error("Error fetching teacher scenarios:", error);
      
      // Fallback response
      res.status(200).json({ 
        scenarios: [],
        connected: false,
        source: 'error-fallback',
        message: 'Service temporarily unavailable',
        error: error.message
      });
    }
  });

  // Route to get scenarios (GET /api/ecos/scenarios) - using UnifiedDatabaseService
  app.get("/api/ecos/scenarios", async (req: Request, res: Response) => {
    try {
      console.log('🔧 Fetching scenarios via /api/ecos/scenarios using unified database...');
      
      const scenarios = await unifiedDb.getScenarios();
      
      res.status(200).json({ 
        scenarios,
        connected: true,
        source: 'unified-database-ecos-endpoint'
      });
      
    } catch (error: any) {
      console.error("Error fetching scenarios via /api/ecos/scenarios:", error);
      
      // Fallback response
      res.status(200).json({ 
        scenarios: [],
        connected: false,
        source: 'error-fallback-ecos-endpoint',
        message: 'Service temporarily unavailable',
        error: error.message
      });
    }
  });

  // Route to create a new scenario
  app.post("/api/ecos/scenarios", async (req: Request, res: Response) => {
    const { email, title, description, patientPrompt, evaluationCriteria, pineconeIndex } = req.body;
    
    if (!email || !isAdminAuthorized(email)) {
      return res.status(403).json({ message: "Accès non autorisé" });
    }

    if (!title || !description) {
      return res.status(400).json({ message: "Titre et description requis" });
    }

    try {
      // Parse and validate evaluation criteria if provided
      let parsedCriteria = null;
      if (evaluationCriteria) {
        try {
          // Handle both string and object formats
          if (typeof evaluationCriteria === 'string') {
            parsedCriteria = JSON.parse(evaluationCriteria);
          } else if (typeof evaluationCriteria === 'object') {
            parsedCriteria = evaluationCriteria;
          }
          
          // Validate criteria structure
          if (!parsedCriteria || typeof parsedCriteria !== 'object') {
            throw new Error('Evaluation criteria must be a valid object');
          }
        } catch (parseError) {
          return res.status(400).json({ 
            message: "Format JSON invalide pour les critères d'évaluation",
            error: (parseError as Error).message 
          });
        }
      }

      // Use unified database service for scenario creation
      await unifiedDb.initialize(); // Ensure database is initialized

      const newScenario = await unifiedDb.createScenario({
        title,
        description,
        patientPrompt: patientPrompt || null,
        evaluationCriteria: parsedCriteria,
        imageUrl: null,
        createdBy: email
      });

      res.status(200).json({ 
        message: "Scénario créé avec succès",
        scenario: newScenario
      });

    } catch (error: any) {
      console.error("Error creating scenario:", error);
      res.status(500).json({ 
        message: "Erreur lors de la création du scénario",
        error: error.message
      });
    }
  });

  // Route to update a scenario
  app.put("/api/ecos/scenarios/:id", async (req: Request, res: Response) => {
    const { id } = req.params;
    const { email, title, description, patientPrompt, evaluationCriteria, pineconeIndex } = req.body;
    
    if (!email || !isAdminAuthorized(email)) {
      return res.status(403).json({ message: "Accès non autorisé" });
    }

    try {
      // Parse and validate evaluation criteria if provided
      let parsedCriteria = null;
      if (evaluationCriteria) {
        try {
          // Handle both string and object formats
          if (typeof evaluationCriteria === 'string') {
            parsedCriteria = JSON.parse(evaluationCriteria);
          } else if (typeof evaluationCriteria === 'object') {
            parsedCriteria = evaluationCriteria;
          }
          
          // Validate criteria structure
          if (!parsedCriteria || typeof parsedCriteria !== 'object') {
            throw new Error('Evaluation criteria must be a valid object');
          }
        } catch (parseError) {
          return res.status(400).json({ 
            message: "Format JSON invalide pour les critères d'évaluation",
            error: (parseError as Error).message 
          });
        }
      }

      // Use unified database service for scenario updates
      await unifiedDb.initialize(); // Ensure database is initialized

      const updatedScenario = await unifiedDb.updateScenario(id, {
        title,
        description,
        patientPrompt: patientPrompt || null,
        evaluationCriteria: parsedCriteria,
        pineconeIndex: pineconeIndex || null
      });

      res.status(200).json({ 
        message: "Scénario modifié avec succès",
        scenario: updatedScenario
      });

    } catch (error: any) {
      console.error("Error updating scenario:", error);
      res.status(500).json({ 
        message: "Erreur lors de la modification du scénario",
        error: error.message
      });
    }
  });

  // Route to delete a scenario
  app.delete("/api/ecos/scenarios/:id", async (req: Request, res: Response) => {
    const { id } = req.params;
    const { email } = req.query;
    
    if (!email || !isAdminAuthorized(email as string)) {
      return res.status(403).json({ message: "Accès non autorisé" });
    }

    try {
      // Use unified database service for scenario deletion
      await unifiedDb.initialize(); // Ensure database is initialized

      await unifiedDb.deleteScenario(id);

      res.status(200).json({ 
        message: "Scénario supprimé avec succès"
      });

    } catch (error: any) {
      console.error("Error deleting scenario:", error);
      res.status(500).json({ 
        message: "Erreur lors de la suppression du scénario",
        error: error.message
      });
    }
  });

  // Route to generate evaluation criteria for a scenario
  app.post("/api/ecos/generate-criteria", async (req: Request, res: Response) => {
    const { email, scenarioDescription } = req.body;
    
    if (!email || !isAdminAuthorized(email)) {
      return res.status(403).json({ message: "Accès non autorisé" });
    }

    if (!scenarioDescription) {
      return res.status(400).json({ message: "Description du scénario requise" });
    }

    try {
      const { promptGenService } = await import('./services/promptGen.service.js');
      
      const criteria = await promptGenService.generateEvaluationCriteria(scenarioDescription);
      
      res.status(200).json({ 
        message: "Critères d'évaluation générés avec succès",
        criteria
      });

    } catch (error: any) {
      console.error("Error generating evaluation criteria:", error);
      res.status(500).json({ 
        message: "Erreur lors de la génération des critères d'évaluation",
        error: error.message
      });
    }
  });

  // New dedicated teacher endpoint for generating and synchronizing criteria
  app.post("/api/teacher/generate-criteria", async (req: Request, res: Response) => {
    const { email, textCriteria, scenarioId } = req.body;
    
    // Authentication check
    if (!email || !isAdminAuthorized(email)) {
      return res.status(403).json({ message: "Accès non autorisé" });
    }

    // Validation
    if (!textCriteria) {
      return res.status(400).json({ message: "Description des critères d'évaluation requise" });
    }

    try {
      console.log(`🔄 Generating criteria for teacher ${email}`);
      console.log(`📝 Text criteria: ${textCriteria.substring(0, 100)}...`);
      
      // Import prompt generation service
      const { promptGenService } = await import('./services/promptGen.service.js');
      
      // Generate structured JSON criteria using AI
      const generatedCriteria = await promptGenService.generateEvaluationCriteria(textCriteria);
      console.log('✅ Generated criteria:', generatedCriteria);

      // If scenarioId is provided, update the scenario in database
      if (scenarioId) {
        console.log(`📊 Updating scenario ${scenarioId} with generated criteria`);
        
        try {
          await unifiedDb.initialize();
          const updatedScenario = await unifiedDb.updateScenario(scenarioId, {
            evaluationCriteria: generatedCriteria
          });
          
          console.log(`✅ Scenario ${scenarioId} updated successfully`);
          
          // Return response with database sync confirmation
          res.status(200).json({
            message: "Critères d'évaluation générés et synchronisés avec succès",
            criteria: generatedCriteria,
            scenarioUpdated: true,
            scenarioId: scenarioId,
            scenarioTitle: updatedScenario.title
          });
        } catch (updateError: any) {
          console.error(`❌ Failed to update scenario ${scenarioId}:`, updateError.message);
          
          // Return criteria even if database sync failed
          res.status(200).json({
            message: "Critères d'évaluation générés avec succès, mais la synchronisation avec la base de données a échoué",
            criteria: generatedCriteria,
            scenarioUpdated: false,
            error: updateError.message,
            warning: `Le scénario ${scenarioId} n'existe pas ou n'a pas pu être mis à jour`
          });
        }
      } else {
        // Return response without database sync
        res.status(200).json({
          message: "Critères d'évaluation générés avec succès",
          criteria: generatedCriteria,
          scenarioUpdated: false
        });
      }

    } catch (error: any) {
      console.error("Error in teacher generate-criteria:", error);
      res.status(500).json({
        message: "Erreur lors de la génération des critères d'évaluation",
        error: error.message,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  });

  // Route to update Pinecone index for a scenario
  app.post("/api/teacher/update-pinecone-index", async (req: Request, res: Response) => {
    const { email, scenarioId, pineconeIndex } = req.body;
    
    // Authentication check
    if (!email || !isAdminAuthorized(email)) {
      return res.status(403).json({ message: "Accès non autorisé" });
    }
    
    // Validation
    if (!scenarioId) {
      return res.status(400).json({ message: "ID du scénario requis" });
    }
    
    if (!pineconeIndex) {
      return res.status(400).json({ message: "Index Pinecone requis" });
    }
    
    try {
      console.log(`🔄 Updating Pinecone index for scenario ${scenarioId} to ${pineconeIndex}`);
      
      await unifiedDb.initialize();
      const updatedScenario = await unifiedDb.updateScenario(scenarioId, {
        pineconeIndex: pineconeIndex
      });
      
      console.log(`✅ Scenario ${scenarioId} Pinecone index updated successfully`);
      
      res.status(200).json({
        message: "Index Pinecone synchronisé avec succès",
        scenarioId: scenarioId,
        pineconeIndex: pineconeIndex,
        scenarioTitle: updatedScenario.title,
        success: true
      });
      
    } catch (error: any) {
      console.error(`❌ Failed to update Pinecone index for scenario ${scenarioId}:`, error.message);
      
      res.status(500).json({
        message: "Erreur lors de la synchronisation de l'index Pinecone",
        error: error.message,
        scenarioId: scenarioId,
        pineconeIndex: pineconeIndex,
        success: false
      });
    }
  });

  // Route to get dashboard stats for teachers
  app.get("/api/teacher/dashboard", async (req: Request, res: Response) => {
    const { email } = req.query;
    
    // ROBUST AUTHENTICATION - Force admin email acceptance
    const adminEmails = ['cherubindavid@gmail.com', 'colombemadoungou@gmail.com'];
    const emailStr = typeof email === 'string' ? email.trim().toLowerCase() : '';
    
    if (!emailStr || !adminEmails.includes(emailStr)) {
      return res.status(403).json({ message: "Accès non autorisé" });
    }

    try {
      console.log('🔧 Fetching teacher dashboard using unified database...');
      
      const stats = await unifiedDb.getDashboardStats();

      res.status(200).json(stats);
    } catch (error: any) {
      console.error("Error fetching dashboard stats:", error);
      
      // Fallback response
      res.status(200).json({
        totalScenarios: 0,
        activeSessions: 0,
        completedSessions: 0,
        totalStudents: 0,
        message: "Service temporarily unavailable"
      });
    }
  });

  // Route to get available Pinecone indexes
  app.get("/api/admin/indexes", async (req: Request, res: Response) => {
    const { email } = req.query;
    
    if (!email || !isAdminAuthorized(email as string)) {
      return res.status(403).json({ message: "Accès non autorisé" });
    }

    try {
      const { pineconeService } = await import('./services/pinecone.service.js');
      console.log('🔄 Fetching Pinecone indexes...');
      
      const indexes = await pineconeService.listIndexes();
      console.log('✅ Indexes fetched successfully:', indexes);
      
      res.status(200).json({ 
        indexes,
        message: "Index récupérés avec succès" 
      });
    } catch (error: any) {
      console.error("Error fetching indexes:", error);
      res.status(500).json({ 
        message: "Erreur lors de la récupération des index Pinecone",
        error: error.message 
      });
    }
  });

  // API route to create or verify a student account
  app.post("/api/student", validateContentType(), validateRequestSize(), validateCreateStudent, async (req: ValidatedRequest, res: Response) => {
    const schema = z.object({
      email: z.string().email("Format d'email invalide"),
    });

    try {
      const { email } = schema.parse(req.body);
      const { userId, isNewUser } = await findOrCreateStudent(email);
      res.status(200).json({ 
        message: "Compte étudiant traité avec succès", 
        userId, 
        isNewUser 
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Données invalides", errors: error.errors });
      }
      console.error("Error in /api/student:", error);
      res.status(500).json({ message: "Erreur interne du serveur" });
    }
  });

  // Auto-register student endpoint (used by student page)
  app.post("/api/student/auto-register", validateContentType(), validateRequestSize(), async (req: Request, res: Response) => {
    const schema = z.object({
      email: z.string().email("Format d'email invalide"),
    });

    try {
      const { email } = schema.parse(req.body);
      console.log('🚀 Auto-registering student:', email);
      
      const { userId, isNewUser } = await findOrCreateStudent(email);
      
      res.status(200).json({ 
        message: "Auto-registration successful", 
        userId, 
        isNewUser,
        email
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid email format", errors: error.errors });
      }
      console.error("Error in /api/student/auto-register:", error);
      res.status(500).json({ message: "Auto-registration failed" });
    }
  });

  // API route to start a simulation session (disabled for now - using fallback data)
  app.post("/api/session/start", async (req: Request, res: Response) => {
    return res.status(501).json({ 
      message: "Fonctionnalité temporairement désactivée",
      details: "Cette fonctionnalité sera réactivée une fois la base de données connectée"
    });
  });

  // API route to get scenarios for a student
  app.get("/api/student/scenarios", async (req: Request, res: Response) => {
    const schema = z.object({
      email: z.string().email(),
    });

    try {
      const { email } = schema.parse(req.query);
      
      // Use scenario sync service to get scenarios
      try {
        const scenarios = await scenarioSyncService.getAvailableScenarios();
        
        res.status(200).json({ 
          scenarios: scenarios,
          training_sessions: [],
          source: 'database'
        });
      } catch (dbError: any) {
        console.error('Database error:', dbError);
        // Return empty array if database error
        res.status(200).json({ 
          scenarios: [],
          training_sessions: [],
          source: 'database',
          error: 'Database connection issue'
        });
      }

    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Données invalides", errors: error.errors });
      }
      console.error("Error in /api/student/scenarios:", error);
      res.status(500).json({ message: "Erreur interne du serveur" });
    }
  });

  // Admin health check 
  app.get("/api/admin/health", async (req: Request, res: Response) => {
    try {
      // Use unified database service for health check
      const healthResult = await unifiedDb.healthCheck();
      res.status(200).json({ 
        status: 'healthy', 
        message: 'Database connection is working.',
        metrics: healthResult.metrics,
        uptime: healthResult.uptime
      });
    } catch (error: any) {
      console.error('Health check failed:', error);
      res.status(500).json({ 
        status: 'unhealthy', 
        message: 'Database connection failed', 
        error: error.message 
      });
    }
  });

  // Route to get students for teacher dashboard
  app.get("/api/teacher/students", async (req: Request, res: Response) => {
    const { email } = req.query;
    
    // ROBUST AUTHENTICATION - Force admin email acceptance
    const adminEmails = ['cherubindavid@gmail.com', 'colombemadoungou@gmail.com'];
    const emailStr = typeof email === 'string' ? email.trim().toLowerCase() : '';
    
    if (!emailStr || !adminEmails.includes(emailStr)) {
      return res.status(403).json({ message: "Accès non autorisé" });
    }

    try {
      console.log('🔧 Fetching teacher students using unified database...');
      
      const students = await unifiedDb.getStudents();
      
      res.status(200).json({ 
        students,
        message: "Student list retrieved successfully",
        connected: true
      });
      
    } catch (error: any) {
      console.error("Error fetching teacher students:", error);
      res.status(200).json({ 
        students: [],
        message: "Service temporarily unavailable",
        connected: false,
        error: error.message
      });
    }
  });

  // Update a training session
  app.put("/api/training-sessions/:id", ecosSessionRateLimit.middleware(), validateContentType(), validateRequestSize(), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { email, ...updates } = req.body;
      
      if (!email) {
        return res.status(400).json({ 
          error: "Email is required",
          code: "MISSING_EMAIL"
        });
      }

      // Validate admin access
      const adminEmails = ['cherubindavid@gmail.com', 'colombemadoungou@gmail.com'];
      const emailStr = typeof email === 'string' ? email.trim().toLowerCase() : '';
      
      if (!adminEmails.includes(emailStr)) {
        return res.status(403).json({ 
          message: "Accès non autorisé - fonction réservée aux administrateurs" 
        });
      }

      console.log(`🔄 Updating training session ${id} for admin: ${email}`);
      
      // Use unified database service to update training session
      const updatedSession = await unifiedDb.updateTrainingSession(id, updates, emailStr);

      res.status(200).json({
        trainingSession: updatedSession,
        message: "Training session updated successfully",
        success: true
      });
      
    } catch (error) {
      console.error('Error updating training session:', error);
      res.status(500).json({
        error: 'Failed to update training session',
        code: 'TRAINING_SESSION_UPDATE_FAILED'
      });
    }
  });

  // Delete a training session
  app.delete("/api/training-sessions/:id", ecosSessionRateLimit.middleware(), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { email } = req.query;
      
      if (!email) {
        return res.status(400).json({ 
          error: "Email is required",
          code: "MISSING_EMAIL"
        });
      }

      // Validate admin access
      const adminEmails = ['cherubindavid@gmail.com', 'colombemadoungou@gmail.com'];
      const emailStr = typeof email === 'string' ? email.trim().toLowerCase() : '';
      
      if (!adminEmails.includes(emailStr)) {
        return res.status(403).json({ 
          message: "Accès non autorisé - fonction réservée aux administrateurs" 
        });
      }

      console.log(`🔄 Deleting training session ${id} for admin: ${email}`);
      
      // Use unified database service to delete training session
      await unifiedDb.deleteTrainingSession(id, emailStr);

      res.status(200).json({
        message: "Training session deleted successfully",
        success: true
      });
      
    } catch (error) {
      console.error('Error deleting training session:', error);
      res.status(500).json({
        error: 'Failed to delete training session',
        code: 'TRAINING_SESSION_DELETE_FAILED'
      });
    }
  });

  // Get all training sessions
  app.get("/api/training-sessions", ecosSessionRateLimit.middleware(), async (req: Request, res: Response) => {
    try {
      const { email } = req.query;
      
      if (!email) {
        return res.status(400).json({ 
          error: "Email is required",
          code: "MISSING_EMAIL"
        });
      }

      // Validate admin access
      const adminEmails = ['cherubindavid@gmail.com', 'colombemadoungou@gmail.com'];
      const emailStr = typeof email === 'string' ? email.trim().toLowerCase() : '';
      
      if (!adminEmails.includes(emailStr)) {
        return res.status(403).json({ 
          message: "Accès non autorisé - fonction réservée aux administrateurs" 
        });
      }

      console.log(`🔄 Fetching training sessions for admin: ${email}`);
      
      // Use unified database service to get real training sessions
      const trainingSessions = await unifiedDb.getTrainingSessions(emailStr);

      res.status(200).json({
        trainingSessions,
        message: "Training sessions retrieved successfully",
        count: trainingSessions.length
      });
      
    } catch (error) {
      console.error('Error fetching training sessions:', error);
      res.status(500).json({
        error: 'Failed to fetch training sessions',
        code: 'TRAINING_SESSIONS_FETCH_FAILED'
      });
    }
  });

  // Get specific training session details
  app.get("/api/training-sessions/:id", ecosSessionRateLimit.middleware(), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { email } = req.query;

      if (!email) {
        return res.status(400).json({
          error: "Email is required",
          code: "MISSING_EMAIL"
        });
      }

      // Validate admin access
      const adminEmails = ['cherubindavid@gmail.com', 'colombemadoungou@gmail.com'];
      const emailStr = typeof email === 'string' ? email.trim().toLowerCase() : '';

      if (!adminEmails.includes(emailStr)) {
        return res.status(403).json({
          message: "Accès non autorisé - fonction réservée aux administrateurs"
        });
      }

      console.log(`🔄 Fetching training session ${id} for admin: ${email}`);

      // Use unified database service to get real training session
      const trainingSession = await unifiedDb.getTrainingSessionById(id, emailStr);

      if (!trainingSession) {
        return res.status(404).json({
          error: 'Training session not found',
          code: 'TRAINING_SESSION_NOT_FOUND'
        });
      }

      res.status(200).json({
        trainingSession,
        message: "Training session details retrieved successfully"
      });

    } catch (error) {
      console.error('Error fetching training session details:', error);
      res.status(500).json({
        error: 'Failed to fetch training session details',
        code: 'TRAINING_SESSION_DETAILS_FAILED'
      });
    }
  });

  // Get all ECOS sessions for a training session (for teacher history view)
  app.get("/api/training-sessions/:id/sessions", ecosSessionRateLimit.middleware(), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { email } = req.query;

      if (!email) {
        return res.status(400).json({
          error: "Email is required",
          code: "MISSING_EMAIL"
        });
      }

      // Validate admin access
      const adminEmails = ['cherubindavid@gmail.com', 'colombemadoungou@gmail.com'];
      const emailStr = typeof email === 'string' ? email.trim().toLowerCase() : '';

      if (!adminEmails.includes(emailStr)) {
        return res.status(403).json({
          message: "Accès non autorisé - fonction réservée aux administrateurs"
        });
      }

      console.log(`📚 Fetching all ECOS sessions for training session ${id} (teacher: ${email})`);

      // Use the new method to get all sessions for this training session
      const sessions = await unifiedDb.getTrainingSessionSessions(parseInt(id));

      console.log(`✅ Retrieved ${sessions.length} ECOS sessions for training session ${id}`);

      res.status(200).json({
        sessions,
        count: sessions.length,
        trainingSessionId: parseInt(id),
        message: 'Training session ECOS sessions retrieved successfully'
      });

    } catch (error: any) {
      console.error('Error fetching training session ECOS sessions:', error);
      res.status(500).json({
        error: 'Failed to fetch training session ECOS sessions',
        code: 'TRAINING_SESSION_SESSIONS_FAILED',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  });

  // Create a new training session
  app.post("/api/training-sessions", ecosSessionRateLimit.middleware(), validateContentType(), validateRequestSize(), validateCreateTrainingSession, async (req: ValidatedRequest, res: Response) => {
    try {
      const { email } = req.body;
      const { title, description, scenarioIds, studentEmails } = req.body;
      
      // Validate admin access
      const adminEmails = ['cherubindavid@gmail.com', 'colombemadoungou@gmail.com'];
      const emailStr = typeof email === 'string' ? email.trim().toLowerCase() : '';
      
      if (!adminEmails.includes(emailStr)) {
        return res.status(403).json({ 
          message: "Accès non autorisé - fonction réservée aux administrateurs" 
        });
      }

      console.log(`🔄 Creating training session for admin: ${email}`);
      console.log(`📝 Session details:`, { title, description, scenarioIds, studentEmails });
      
      // Use unified database service to create real training session
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
      console.error('Error creating training session:', error);
      res.status(500).json({
        error: 'Failed to create training session',
        code: 'TRAINING_SESSION_CREATE_FAILED'
      });
    }
  });


  // ECOS Core Functionality Endpoints

  // Get ECOS sessions for a student (filtered by email)
  app.get("/api/ecos/sessions", async (req: Request, res: Response) => {
    try {
      const { email } = req.query;

      if (!email) {
        return res.status(400).json({
          error: "Email is required",
          code: "MISSING_EMAIL"
        });
      }

      console.log(`📚 Fetching ECOS sessions for student: ${email}`);

      // Use the new method to get student sessions with scenario information
      const sessions = await unifiedDb.getStudentSessions(email as string);

      console.log(`✅ Retrieved ${sessions.length} sessions for student ${email}`);

      res.status(200).json({
        sessions,
        count: sessions.length,
        message: 'Sessions retrieved successfully'
      });
    } catch (error: any) {
      console.error('Error getting ECOS sessions:', error);
      res.status(500).json({
        error: 'Failed to get ECOS sessions',
        code: 'SESSIONS_GET_FAILED',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  });

  // Start a new ECOS session
  app.post("/api/ecos/sessions", ecosSessionRateLimit.middleware(), validateContentType(), validateRequestSize(), validateCreateEcosSession, async (req: ValidatedRequest, res: Response) => {
    try {
      const { studentEmail, scenarioId } = req.validatedBody || req.body;
      
      if (!studentEmail || !scenarioId) {
        return res.status(400).json({ 
          error: "StudentEmail and scenarioId are required",
          code: "MISSING_REQUIRED_FIELDS"
        });
      }

      // Generate session ID that includes scenario ID for easy retrieval
      const sessionId = `session_${scenarioId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Store session in database using UnifiedDatabaseService
      try {
        const sessionData = await unifiedDb.createSession({
          sessionId,
          studentEmail,
          scenarioId: parseInt(scenarioId),
          status: 'active'
        });

        console.log('✅ Created and stored ECOS session:', sessionId, 'in database');
      } catch (dbError: any) {
        console.error('❌ Failed to store session in database:', dbError.message);
        // Continue with response even if DB storage fails
        console.warn('⚠️ Session created in memory only due to database error');
      }

      res.status(201).json({
        sessionId,
        scenarioId: parseInt(scenarioId),
        studentEmail,
        status: 'active',
        startTime: new Date(),
        message: 'ECOS session created successfully'
      });
    } catch (error) {
      console.error('Error creating ECOS session:', error);
      res.status(500).json({
        error: 'Failed to create ECOS session',
        code: 'SESSION_CREATE_FAILED'
      });
    }
  });

  // Get ECOS session details
  app.get("/api/ecos/sessions/:sessionId", async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;
      const { email } = req.query;

      if (!email) {
        return res.status(400).json({ 
          error: "Email is required",
          code: "MISSING_EMAIL"
        });
      }

      // Try to get session from database and fetch actual scenario data
      try {
        // Extract scenario ID from session ID (format: session_SCENARIOID_timestamp_random)
        let scenarioId = null;
        if (sessionId.startsWith('session_')) {
          const parts = sessionId.split('_');
          if (parts.length >= 2 && !isNaN(parseInt(parts[1]))) {
            scenarioId = parseInt(parts[1]);
          }
        }
        
        if (!scenarioId) {
          return res.status(400).json({
            error: 'Invalid session ID format - cannot extract scenario ID',
            code: 'INVALID_SESSION_ID'
          });
        }
        
        // Get actual scenario data from database
        const scenarios = await unifiedDb.getScenarios();
        const scenario = scenarios.find(s => s.id === scenarioId);
        
        if (!scenario) {
          return res.status(404).json({
            error: `Scenario ${scenarioId} not found in database`,
            code: 'SCENARIO_NOT_FOUND'
          });
        }

        // Clean and normalize evaluation criteria format
        const cleanEvaluationCriteria = (criteria: any) => {
          if (!criteria) return null;
          
          // If criteria has both generatedText and evaluation_criteria, use only evaluation_criteria
          if (criteria.evaluation_criteria && Array.isArray(criteria.evaluation_criteria)) {
            console.log('✅ Using clean evaluation_criteria array format');
            return criteria.evaluation_criteria;
          }
          
          // If criteria is already a clean array or object, return as is
          if (Array.isArray(criteria) || (typeof criteria === 'object' && !criteria.generatedText)) {
            console.log('✅ Using existing clean criteria format');
            return criteria;
          }
          
          // If only generatedText exists, try to extract the proper format
          if (criteria.generatedText && typeof criteria.generatedText === 'string') {
            try {
              console.log('🔄 Parsing generatedText to extract evaluation criteria');
              const parsed = JSON.parse(criteria.generatedText.replace(/```json\n?|\n?```/g, ''));
              return parsed.evaluation_criteria || parsed;
            } catch (e) {
              console.warn('❌ Failed to parse generatedText criteria, using original format');
              return criteria;
            }
          }
          
          return criteria;
        };

        // Return session with actual scenario data
        return res.status(200).json({
          session: {
            id: sessionId,
            status: 'active',
            startTime: new Date(),
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
          note: 'Session with complete scenario data from database'
        });

        // This code was moved above and is no longer needed here
      } catch (dbError) {
        console.error('❌ Database error retrieving scenario:', dbError);
        return res.status(500).json({
          error: 'Database error - unable to retrieve scenario data',
          code: 'DATABASE_ERROR',
          details: process.env.NODE_ENV === 'development' ? dbError.message : 'Internal server error'
        });
      }
    } catch (error) {
      console.error('Error getting ECOS session:', error);
      res.status(500).json({
        error: 'Failed to get ECOS session',
        code: 'SESSION_GET_FAILED'
      });
    }
  });

  // Update ECOS session (end session)
  app.put("/api/ecos/sessions/:sessionId", validateContentType(), validateRequestSize(), async (req: Request, res: Response) => {
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

      console.log(`📝 Updating session ${sessionId} status to ${status} for ${email}`);

      // Update session status in database
      try {
        await unifiedDb.updateSessionStatus(sessionId, status);
        console.log(`✅ Session ${sessionId} marked as ${status} in database`);
      } catch (dbError: any) {
        console.warn('⚠️ Failed to update session status in database:', dbError.message);
        // Continue anyway - frontend shows status locally
      }

      res.status(200).json({
        sessionId,
        status,
        updatedAt: new Date(),
        message: 'Session updated successfully'
      });
    } catch (error) {
      console.error('Error updating ECOS session:', error);
      res.status(500).json({
        error: 'Failed to update ECOS session',
        code: 'SESSION_UPDATE_FAILED'
      });
    }
  });

  // Add message to ECOS session (Chat functionality)
  app.post("/api/ecos/sessions/:sessionId/messages", apiRateLimit.middleware(), validateContentType(), validateRequestSize(), validateEcosMessage, async (req: ValidatedRequest, res: Response) => {
    const { email } = req.query;

    // Students can send messages in their own sessions - no admin restriction
    if (!email) {
      return res.status(400).json({ message: "Email requis" });
    }
    try {
      const { sessionId } = req.params;
      const { email } = req.query;
      const { message, role, type } = req.validatedBody || req.body;

      const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Store user message in database
      try {
        await unifiedDb.storeSessionMessage({
          sessionId,
          role: role || 'user',
          question: message,
          response: '',
          content: message
        });
        console.log('✅ Stored user message in database for session:', sessionId);
      } catch (dbError: any) {
        console.warn('⚠️ Failed to store user message:', dbError.message);
      }

      // Generate AI response (placeholder for now)
      const aiResponseContent = `I understand your message: "${message}". How can I assist you further in this medical scenario?`;

      const aiResponse = {
        id: `msg_ai_${Date.now()}`,
        sessionId,
        content: aiResponseContent,
        role: 'assistant',
        type: 'text',
        senderEmail: 'system@ecos.ai',
        createdAt: new Date()
      };

      // Store AI response in database
      try {
        await unifiedDb.storeSessionMessage({
          sessionId,
          role: 'assistant',
          question: '',
          response: aiResponseContent,
          content: aiResponseContent
        });
        console.log('✅ Stored AI response in database for session:', sessionId);
      } catch (dbError: any) {
        console.warn('⚠️ Failed to store AI response:', dbError.message);
      }

      res.status(201).json({
        userMessage: {
          id: messageId,
          sessionId,
          content: message,
          role: role || 'user',
          type: type || 'text',
          senderEmail: email,
          createdAt: new Date()
        },
        aiResponse,
        message: 'Message added to session successfully'
      });
    } catch (error) {
      console.error('Error adding message to ECOS session:', error);
      res.status(500).json({
        error: 'Failed to add message to session',
        code: 'MESSAGE_ADD_FAILED'
      });
    }
  });

  const slugifyId = (value: string, fallback: string) => {
    if (!value) return fallback;
    return value.toString().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') || fallback;
  };

  const normalizeText = (value: string) => {
    return value
      ? value
          .toString()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase()
      : '';
  };

  /**
   * Extract relevant message excerpts to justify evaluation scores
   * Instead of keyword matching, we sample representative messages from the conversation
   */
  const extractRelevantExcerpts = (messages: any[], maxExcerpts: number = 3) => {
    if (!Array.isArray(messages) || messages.length === 0) {
      return [];
    }

    // Sample messages from different parts of the conversation
    // to give a representative view: beginning, middle, end
    const excerpts: any[] = [];
    const totalMessages = messages.length;

    if (totalMessages <= maxExcerpts) {
      // If few messages, return all
      excerpts.push(...messages);
    } else {
      // Sample from beginning, middle, and end
      const indices = [
        0, // First exchange
        Math.floor(totalMessages / 2), // Middle
        totalMessages - 1 // Last exchange
      ].slice(0, maxExcerpts);

      indices.forEach(index => {
        if (messages[index]) {
          excerpts.push(messages[index]);
        }
      });
    }

    return excerpts.map((msg: any) => ({
      role: msg.role === 'user' ? 'Étudiant' : 'Patient',
      rawRole: msg.role,
      excerpt: (msg.question || msg.response || msg.content || '').toString().slice(0, 220),
      timestamp: msg.timestamp || msg.created_at || msg.updated_at || null
    }));
  };

  // Evaluate ECOS session performance
  app.post("/api/ecos/sessions/:sessionId/evaluate", ecosEvaluationRateLimit.middleware(), validateContentType(), validateRequestSize(), validateEcosEvaluation, async (req: ValidatedRequest, res: Response) => {
    const { email } = req.query;

    // Students can evaluate their own sessions - no admin restriction
    if (!email) {
      return res.status(400).json({ message: "Email requis" });
    }
    try {
      const { sessionId } = req.params;
      const { criteria, responses } = req.validatedBody || req.body;

      // Extract scenarioId from sessionId
      const scenarioIdMatch = sessionId.match(/^session_(\d+)_/);
      const scenarioId = scenarioIdMatch ? parseInt(scenarioIdMatch[1]) : null;

      // Load scenario to get evaluation_criteria from DB
      const scenarios = await unifiedDb.getScenarios();
      const scenario = scenarioId ? scenarios.find(s => s.id === scenarioId) : null;
      console.log('🔍 [TRACE] Loaded scenario:', scenario?.id, scenario?.title);
      console.log('🔍 [TRACE] Scenario has evaluation_criteria?', !!scenario?.evaluation_criteria);
      const dbCriteria = scenario?.evaluation_criteria || null;

      // Fetch conversation history using the correct method
      const messages = await unifiedDb.getSessionMessages(sessionId, 50);

      if (!messages || messages.length === 0) {
        return res.status(400).json({
          error: "Pas assez d'échanges pour une évaluation - la session était vide",
          code: 'INSUFFICIENT_CONTENT',
          sessionId: sessionId,
          messagesFound: messages?.length || 0
        });
      }

      // Build transcript from messages
      const transcript = messages.map((msg: any, idx: number) => {
        const content = msg.question || msg.response || msg.content || '';
        const role = msg.role === 'user' ? 'Étudiant' : 'Patient';
        return `${role}: ${content.toString().trim()}`;
      }).join('\n---\n');

      console.log(`📊 Building evaluation from ${messages.length} messages for session ${sessionId}`);
      console.log(`📝 Transcript preview:`, transcript.substring(0, 200) + '...');

      // Normalize criteria from DB
      const normalizeCriteria = (raw: any) => {
        try {
          if (!raw) return [] as any[];

          // Handle nested structure: { evaluation_criteria: [...] }
          if (raw.evaluation_criteria && Array.isArray(raw.evaluation_criteria)) {
            return raw.evaluation_criteria.map((c: any, i: number) => ({
              id: (c.id || c.key || c.name || c.label || `crit_${i}`).toString().toLowerCase().replace(/\s+/g,'_'),
              name: c.name || c.label || c.id || `Critère ${i+1}`,
              description: c.description || '',
              maxScore: typeof c.maxScore === 'number' ? c.maxScore : 4,
              weight: typeof c.weight === 'number' ? c.weight : (typeof c.poids === 'number' ? c.poids : null),
              indicators: Array.isArray(c.indicators) ? c.indicators.map((ind: any) => ind.description || ind.name || ind).filter(Boolean) :
                          Array.isArray(c.elements) ? c.elements.map((el: any) => typeof el === 'string' ? el : el.description || el.name || '').filter(Boolean) :
                          c.description ? [c.description] : []
            }));
          }

          if (Array.isArray(raw)) {
            return raw.map((c: any, i: number) => ({
              id: (c.id || c.key || c.name || c.label || `crit_${i}`).toString().toLowerCase().replace(/\s+/g,'_'),
              name: c.name || c.label || c.id || `Critère ${i+1}`,
              description: c.description || '',
              maxScore: typeof c.maxScore === 'number' ? c.maxScore : 4,
              weight: typeof c.weight === 'number' ? c.weight : (typeof c.poids === 'number' ? c.poids : null),
              indicators: Array.isArray(c.indicators) ? c.indicators.map((ind: any) => ind.description || ind.name || ind).filter(Boolean) :
                          Array.isArray(c.elements) ? c.elements.map((el: any) => typeof el === 'string' ? el : el.description || el.name || '').filter(Boolean) :
                          c.description ? [c.description] : []
            }));
          }
          if (raw.categories && Array.isArray(raw.categories)) {
            return raw.categories.map((category: any, i: number) => {
              const baseId = (category.id || category.name || `category_${i}`).toString().toLowerCase().replace(/\s+/g, '_');
              const indicators = Array.isArray(category.indicators)
                ? category.indicators.map((ind: any) => ind.description || ind.name || '').filter(Boolean)
                : [];

              return {
                id: baseId,
                name: category.name || category.id || `Catégorie ${i + 1}`,
                description: indicators.length ? indicators.join(' ; ') : (category.description || ''),
                maxScore: typeof category.maxScore === 'number' ? category.maxScore : 4,
                weight: typeof category.weight === 'number' ? category.weight : (typeof category.poids === 'number' ? category.poids : null),
                indicators
              };
            });
          }
          if (raw.criteria && Array.isArray(raw.criteria)) {
            return raw.criteria.map((c: any, i: number) => ({
              id: (c.id || c.key || c.name || c.label || `crit_${i}`).toString().toLowerCase().replace(/\s+/g,'_'),
              name: c.name || c.label || c.id || `Critère ${i+1}`,
              description: c.description || '',
              maxScore: typeof c.maxScore === 'number' ? c.maxScore : 4,
              weight: typeof c.weight === 'number' ? c.weight : (typeof c.poids === 'number' ? c.poids : null),
              indicators: Array.isArray(c.indicators) ? c.indicators.map((ind: any) => ind.description || ind.name || ind).filter(Boolean) :
                          Array.isArray(c.elements) ? c.elements.map((el: any) => typeof el === 'string' ? el : el.description || el.name || '').filter(Boolean) :
                          c.description ? [c.description] : []
            }));
          }
          if (typeof raw === 'object') {
            return Object.keys(raw).map((k, i) => {
              const value = raw[k];

              // Support both French (elements/poids) and English (indicators/weight) property names
              const indicators = Array.isArray(value?.indicators)
                ? value.indicators.map((ind: any) => ind.description || ind.name || ind).filter(Boolean)
                : Array.isArray(value?.elements)
                ? value.elements.map((el: any) => typeof el === 'string' ? el : el.description || el.name || '').filter(Boolean)
                : [];

              const weight = typeof value?.weight === 'number'
                ? value.weight
                : typeof value?.poids === 'number'
                ? value.poids
                : null;

              return {
                id: k.toLowerCase().replace(/\s+/g, '_'),
                name: k.charAt(0).toUpperCase() + k.slice(1).replace(/_/g, ' '),
                description: typeof value === 'string' ? value : (value?.description || ''),
                maxScore: 4,
                weight,
                indicators
              };
            });
          }
          return [] as any[];
        } catch {
          return [] as any[];
        }
      };

      // DIAGNOSTIC LOGGING - START
      console.log('🔍 [TRACE] dbCriteria type:', typeof dbCriteria);
      console.log('🔍 [TRACE] dbCriteria is null?', dbCriteria === null);
      console.log('🔍 [TRACE] dbCriteria is array?', Array.isArray(dbCriteria));
      if (dbCriteria && typeof dbCriteria === 'object') {
        console.log('🔍 [TRACE] dbCriteria keys:', Object.keys(dbCriteria));
        console.log('🔍 [TRACE] dbCriteria sample:', JSON.stringify(dbCriteria).substring(0, 500));
      } else {
        console.log('🔍 [TRACE] dbCriteria value:', dbCriteria);
      }
      // DIAGNOSTIC LOGGING - END

      const criteriaList = normalizeCriteria(dbCriteria);

      // DIAGNOSTIC LOGGING - START
      console.log('🔍 [TRACE] criteriaList length:', criteriaList.length);
      if (criteriaList.length > 0) {
        console.log('🔍 [TRACE] First criterion:', JSON.stringify(criteriaList[0], null, 2));
        console.log('🔍 [TRACE] First criterion indicators:', criteriaList[0].indicators);
      } else {
        console.log('🔍 [TRACE] criteriaList is EMPTY - will use fallback');
      }
      // DIAGNOSTIC LOGGING - END

      const fallbackCriteria = [
        { id: 'communication', name: 'Communication', maxScore: 4 },
        { id: 'clinical_reasoning', name: 'Raisonnement Clinique', maxScore: 4 },
        { id: 'empathy', name: 'Empathie', maxScore: 4 },
        { id: 'professionalism', name: 'Professionnalisme', maxScore: 4 }
      ];
      const usedCriteria = criteriaList.length > 0 ? criteriaList : fallbackCriteria;

      // DIAGNOSTIC LOGGING - START
      console.log('🔍 [TRACE] Using criteriaList or fallback?', criteriaList.length > 0 ? 'criteriaList' : 'FALLBACK');
      console.log('🔍 [TRACE] usedCriteria length:', usedCriteria.length);
      console.log('🔍 [TRACE] usedCriteria[0]:', JSON.stringify(usedCriteria[0], null, 2));
      // DIAGNOSTIC LOGGING - END

      // Build LLM prompt enforcing JSON output
      const systemPrompt = `Tu es un examinateur ECOS. Évalue la performance de l'étudiant en te basant UNIQUEMENT sur la transcription fournie.

Consignes :
- Pour CHAQUE critère, vérifie si l'étudiant a abordé les indicateurs spécifiques listés
- Attribue une note entière de 0 à 4 basée sur la couverture des indicateurs :
  * 0 = aucun indicateur traité
  * 1 = abordé superficiellement (< 25% des indicateurs)
  * 2 = partiellement traité (25-50% des indicateurs)
  * 3 = bien traité (50-75% des indicateurs)
  * 4 = maîtrisé (> 75% des indicateurs avec qualité)
- Pour chaque critère, identifie 2-3 points forts, 2-3 points faibles, 2-3 actions d'amélioration
- Justifie chaque note en citant des exemples précis de la transcription
- Fournis une synthèse globale avec forces majeures, faiblesses prioritaires, recommandations actionnables

IMPORTANT: Base-toi sur les indicateurs spécifiques fournis pour chaque critère. Ne te contente pas de notions génériques.

Réponds UNIQUEMENT en JSON valide sans texte avant/après.

Format JSON attendu :
{
  "criteria": [
    {
      "id": "crit_id",
      "name": "Nom du critère",
      "score": number,
      "maxScore": 4,
      "strengths": ["point fort 1 avec référence à la transcription", "point fort 2", ...],
      "weaknesses": ["faiblesse 1 avec exemple", "faiblesse 2", ...],
      "actions": ["recommandation 1 actionnable", "recommandation 2", ...],
      "justification": "Justification détaillée citant des passages de la transcription"
    }
  ],
  "overall": {
    "strengths": ["force majeure 1", "force majeure 2", ...],
    "weaknesses": ["faiblesse prioritaire 1", "faiblesse prioritaire 2", ...],
    "recommendations": ["recommandation 1", "recommandation 2", "recommandation 3"],
    "summary": "Synthèse en 2-3 phrases résumant la performance globale"
  },
  "overall_score_percent": number
}`;

      const rubricText = usedCriteria.map(c => {
        const indicatorsList = c.indicators && c.indicators.length > 0
          ? `\n  Indicateurs à évaluer:\n${c.indicators.map(ind => `  * ${ind}`).join('\n')}`
          : '';
        const weight = c.weight ? ` (pondération: ${c.weight}%)` : '';
        return `- ${c.name} (id: ${c.id})${weight} — max ${c.maxScore}${indicatorsList}`;
      }).join('\n\n');
      const userPrompt = `Scénario: ${scenario?.title || 'Inconnu'}\n\nCritères d'évaluation:\n${rubricText}\n\nTranscription de la session:\n${transcript}`;

      let llmJson: any = null;
      try {
        const completion = await openaiService.createCompletion({
          model: "gpt-4o",
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.3,
          max_completion_tokens: 2000,
          response_format: { type: "json_object" }
        });
        const content = completion.choices?.[0]?.message?.content || '{}';
        // Strip markdown code blocks that OpenAI sometimes adds despite instructions
        const cleanedContent = content.replace(/```json\s*\n?|```\s*$/g, '').trim();
        llmJson = JSON.parse(cleanedContent);
      } catch (err) {
        console.warn('⚠️ LLM evaluation parsing failed, using heuristic fallback. Error:', (err as Error).message);
      }

      // Map LLM output to evaluation structure
      const evaluationId = `eval_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const criteriaResults = (llmJson?.criteria && Array.isArray(llmJson.criteria))
        ? llmJson.criteria
        : [];

      const clamp = (n: any) => Math.max(0, Math.min(4, Math.round(Number(n) || 0)));
      const toArray = (value: any): string[] => {
        if (!value) return [];
        if (Array.isArray(value)) return value.map((entry: any) => (entry ?? '').toString()).filter((entry: string) => entry.trim().length > 0);
        return [value.toString()].filter(Boolean);
      };

      // Extract representative message excerpts as evidence
      const conversationExcerpts = extractRelevantExcerpts(messages, 3);

      const weightValues = usedCriteria.map((criterion: any) => {
        const weight = Number(criterion.weight);
        return Number.isFinite(weight) && weight > 0 ? weight : 1;
      });
      const weightSum = weightValues.reduce((sum: number, w: number) => sum + w, 0) || usedCriteria.length;

      const combinedCriteria = usedCriteria.map((criterion: any, index: number) => {
        const criterionId = criterion.id;
        const llmMatch = criteriaResults.find((entry: any) => {
          const entryId = (entry.id || '').toString().toLowerCase();
          const entryName = (entry.name || '').toString().toLowerCase();
          return entryId === criterionId || entryName === criterion.name.toLowerCase();
        }) || null;

        const llmScore = clamp(llmMatch?.score ?? llmMatch?.note ?? 2);
        const maxScore = typeof llmMatch?.maxScore === 'number' ? llmMatch.maxScore : 4;

        // Use LLM score directly without heuristic limitation
        const finalScore = llmScore;

        return {
          id: criterionId,
          name: criterion.name,
          description: criterion.description || '',
          indicators: criterion.indicators || [],
          weight: Math.round((weightValues[index] / weightSum) * 10000) / 100, // pourcentage arrondi à 2 décimales
          rawWeight: weightValues[index],
          maxScore,
          score: finalScore,
          rawScore: llmScore,
          strengths: toArray(llmMatch?.strengths),
          weaknesses: toArray(llmMatch?.weaknesses),
          actions: toArray(llmMatch?.actions || llmMatch?.recommendations),
          justification: (llmMatch?.justification || '').toString(),
          // Add conversation excerpts as evidence instead of keyword matching
          evidence: conversationExcerpts
        };
      });

      const weightedTotal = combinedCriteria.reduce((sum: number, criterion: any) => {
        return sum + ((criterion.score / criterion.maxScore) * (criterion.rawWeight || 1));
      }, 0);
      const weightedPercent = Math.round((weightedTotal / weightSum) * 100);

      const llmOverallPercent = typeof llmJson?.overall_score_percent === 'number'
        ? Math.round(llmJson.overall_score_percent)
        : null;

      // Use LLM score or calculated weighted score (no heuristic limitation)
      const overallScorePercent = llmOverallPercent ?? weightedPercent;

      const uniqueList = (list: string[], limit = 3) => {
        const seen = new Set<string>();
        const result: string[] = [];
        for (const item of list) {
          const trimmed = item.trim();
          if (!trimmed || seen.has(trimmed)) continue;
          seen.add(trimmed);
          result.push(trimmed);
          if (result.length >= limit) break;
        }
        return result;
      };

      const overallSection = llmJson?.overall || {};
      const aggregatedStrengths = uniqueList([
        ...toArray(overallSection.strengths || llmJson?.strengths),
        ...combinedCriteria.flatMap((criterion: any) => criterion.strengths)
      ]);
      const aggregatedWeaknesses = uniqueList([
        ...toArray(overallSection.weaknesses || llmJson?.weaknesses),
        ...combinedCriteria.flatMap((criterion: any) => criterion.weaknesses)
      ]);
      const aggregatedRecommendations = uniqueList([
        ...toArray(overallSection.recommendations || llmJson?.recommendations),
        ...combinedCriteria.flatMap((criterion: any) => criterion.actions)
      ]);
      const summaryText = (overallSection.summary || overallSection.comment || llmJson?.summary || '').toString();

      const evaluation = {
        overall_score: overallScorePercent,
        criteria_scores: combinedCriteria.reduce((acc: any, c: any) => { acc[c.id] = Math.round((c.score / c.maxScore) * 100); return acc; }, {}),
        scores: combinedCriteria.reduce((acc: any, c: any) => { acc[c.id] = c.score; return acc; }, {}),
        criteria: combinedCriteria,
        feedback: aggregatedStrengths,
        recommendations: aggregatedRecommendations,
        weaknesses: aggregatedWeaknesses,
        summary: summaryText,
        llmScorePercent: llmOverallPercent ?? weightedPercent,
        weightedScorePercent: weightedPercent
      };

      // Store evaluation in database
      try {
        await unifiedDb.createEvaluation({
          sessionId,
          scenarioId: scenarioId!,
          studentEmail: email as string,
          scores: evaluation.scores,
          globalScore: overallScorePercent,
          strengths: Array.isArray(evaluation.feedback) ? evaluation.feedback : [],
          weaknesses: Array.isArray(evaluation.weaknesses) ? evaluation.weaknesses : [],
          recommendations: Array.isArray(evaluation.recommendations) ? evaluation.recommendations : [],
          feedback: `Évaluation automatique - Score IA: ${overallScorePercent}%`,
          llmScorePercent: evaluation.llmScorePercent,
          criteriaDetails: evaluation.criteria
        });
        console.log(`✅ Stored evaluation for session ${sessionId} in database`);
      } catch (dbError: any) {
        console.error(`❌ Failed to store evaluation in database:`, {
          message: dbError?.message,
          code: dbError?.code,
          details: dbError?.details,
          hint: dbError?.hint,
          sessionId,
          studentEmail: email
        });

        // Return error to frontend - evaluation computed but not persisted
        return res.status(500).json({
          error: 'Failed to store evaluation in database',
          code: 'EVALUATION_STORAGE_FAILED',
          details: process.env.NODE_ENV === 'development' ? dbError?.message : undefined,
          evaluation: evaluation  // Still return the computed evaluation
        });
      }

      res.status(200).json({
        evaluationId,
        sessionId,
        evaluation,
        message: 'Session evaluated and stored successfully'
      });
    } catch (error) {
      console.error('Error evaluating ECOS session:', error);
      res.status(500).json({
        error: 'Failed to evaluate session',
        code: 'EVALUATION_FAILED'
      });
    }
  });

  // Get evaluation report for ECOS session
  app.get("/api/ecos/sessions/:sessionId/report", async (req: Request, res: Response) => {
    const { email } = req.query;

    // Students can view their own evaluation reports - no admin restriction
    if (!email) {
      return res.status(400).json({ message: "Email requis" });
    }

    try {
      const { sessionId } = req.params;

      const evaluationRecord = await unifiedDb.getEvaluation(sessionId);
      if (!evaluationRecord) {
        return res.status(404).json({
          error: 'Aucune évaluation enregistrée pour cette session',
          code: 'EVALUATION_NOT_FOUND'
        });
      }

      const scenarioIdMatch = sessionId.match(/^session_(\d+)_/);
      const scenarioId = scenarioIdMatch ? parseInt(scenarioIdMatch[1]) : null;

      let scenarioTitle = 'Scénario inconnu';
      let evaluationCriteria: any = null;

      if (scenarioId) {
        try {
          const scenarios = await unifiedDb.getScenarios();
          const scenario = scenarios.find(s => s.id === scenarioId);
          if (scenario) {
            scenarioTitle = scenario.title;
            evaluationCriteria = scenario.evaluation_criteria || null;
          }
        } catch (dbError) {
          console.warn('⚠️ Could not load scenario for evaluation report:', (dbError as Error).message);
        }
      }

      const messages = await unifiedDb.getSessionMessages(sessionId, 100);

      const storedScores = evaluationRecord.scores || {};
      const storedCriteriaDetails = Array.isArray(evaluationRecord.criteria_details) ? evaluationRecord.criteria_details : null;

      const criteria = Object.keys(storedScores).map(key => {
        const scoreValue = Number(storedScores[key] ?? 0);
        const storedDetail = storedCriteriaDetails?.find((detail: any) => (detail.id || '').toString() === key);
        const name = storedDetail?.name || key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        const weight = typeof storedDetail?.weight === 'number' ? storedDetail.weight : null;

        // Use stored evidence (conversation excerpts) from evaluation
        const evidence = storedDetail?.evidence || [];

        return {
          id: key,
          name,
          score: scoreValue,
          percent: Math.round((scoreValue / (storedDetail?.maxScore || 4)) * 100),
          maxScore: storedDetail?.maxScore || 4,
          weight,
          strengths: Array.isArray(storedDetail?.strengths) ? storedDetail.strengths : [],
          weaknesses: Array.isArray(storedDetail?.weaknesses) ? storedDetail.weaknesses : [],
          actions: Array.isArray(storedDetail?.actions) ? storedDetail.actions : [],
          justification: storedDetail?.justification || '',
          indicators: Array.isArray(storedDetail?.indicators) ? storedDetail.indicators : [],
          evidence: evidence  // Conversation excerpts as justification
        };
      });

      const overallScore = Number(evaluationRecord.global_score ?? 0);
      const summary = evaluationRecord.summary || `Évaluation du scénario "${scenarioTitle}" basée sur ${messages.length} échange${messages.length > 1 ? 's' : ''} patient/infirmier.`;

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
          generatedAt: evaluationRecord.evaluated_at || evaluationRecord.created_at || new Date().toISOString()
        },
        message: 'Evaluation report generated successfully'
      });
    } catch (error) {
      console.error('Error generating ECOS session report:', error);
      res.status(500).json({
        error: 'Failed to generate evaluation report',
        code: 'EVALUATION_REPORT_FAILED'
      });
    }
  });

  // Session ID parsing utility function
  function extractScenarioIdFromSessionId(sessionId: string): number | null {
    if (!sessionId || typeof sessionId !== 'string') return null;
    const match = sessionId.match(/^session_(\d+)_/);
    if (match && match[1]) {
      const parsed = parseInt(match[1], 10);
      return Number.isNaN(parsed) || parsed <= 0 ? null : parsed;
    }
    return null;
  }

  // AI-powered virtual patient simulator with memory and role recognition
  app.post("/api/ecos/patient-simulator", apiRateLimit.middleware(), validateContentType(), validateRequestSize(), async (req: Request, res: Response) => {
    try {
      const { email, sessionId, query, scenarioId: providedScenarioId } = req.body;

      // Try to resolve scenarioId with fallback to sessionId parsing
      let resolvedScenarioId = providedScenarioId;

      if (!resolvedScenarioId && sessionId) {
        resolvedScenarioId = extractScenarioIdFromSessionId(sessionId);
        if (resolvedScenarioId) {
          console.log(`🔄 [patient-simulator] Extracted scenarioId ${resolvedScenarioId} from sessionId: ${sessionId}`);
        }
      }

      // Convert scenarioId to number if it's a string (CRITICAL for emotional state system)
      if (resolvedScenarioId) {
        const numericScenarioId = typeof resolvedScenarioId === 'string'
          ? parseInt(resolvedScenarioId, 10)
          : resolvedScenarioId;

        if (!isNaN(numericScenarioId)) {
          resolvedScenarioId = numericScenarioId;
          console.log(`✅ [patient-simulator] Converted scenarioId to number:`, numericScenarioId);
        }
      }

      console.log('🔄 [patient-simulator] Received request:', {
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

      // Import services
      const { virtualPatientService } = await import('./services/virtual-patient.service.js');

      // Validate input using resolved scenarioId
      const validation = virtualPatientService.validateInput({
        sessionId,
        email,
        query,
        scenarioId: resolvedScenarioId
      });

      if (!validation.valid) {
        return res.status(400).json({
          error: validation.error,
          code: 'INVALID_INPUT'
        });
      }

      console.log(`🤖 AI Patient simulator query from ${email} in session ${sessionId}:`, {
        query: query.substring(0, 100) + (query.length > 100 ? '...' : ''),
        resolvedScenarioId,
        extractionUsed: !providedScenarioId && !!resolvedScenarioId
      });

      // Validate scenario exists before processing
      if (resolvedScenarioId) {
        try {
          const scenarios = await unifiedDb.getScenarios();
          const scenario = scenarios.find(s => s.id === parseInt(resolvedScenarioId.toString(), 10));
          if (!scenario) {
            return res.status(404).json({
              error: `Scenario ${resolvedScenarioId} not found`,
              code: 'SCENARIO_NOT_FOUND'
            });
          }
          console.log(`✅ Using scenario: "${scenario.title}" (ID: ${resolvedScenarioId}) ${!providedScenarioId ? '[EXTRACTED from sessionId]' : '[PROVIDED directly]'}`);
        } catch (error) {
          console.error('❌ Error validating scenario:', error);
          return res.status(500).json({
            error: 'Failed to validate scenario',
            code: 'SCENARIO_VALIDATION_FAILED'
          });
        }
      }

      // Warning if no scenarioId could be resolved
      if (!resolvedScenarioId) {
        console.warn('⚠️ [patient-simulator] No scenarioId provided or extractable - patient will use generic fallback prompt instead of scenario-specific prompt');
        console.warn('⚠️ [patient-simulator] SessionId pattern for extraction:', sessionId);
      }

      // Generate AI-powered patient response with memory and role awareness
      console.log(`🚀 [patient-simulator] Calling virtualPatientService.generatePatientResponse with resolved scenarioId: ${resolvedScenarioId}`);
      const patientResponse = await virtualPatientService.generatePatientResponse(
        sessionId,
        email,
        query,
        resolvedScenarioId
      );

      // Store conversation in database for analytics and memory persistence
      try {
        const memory = virtualPatientService.getConversationMemory?.(sessionId);
        await unifiedDb.storeConversationExchange({
          email,
          question: query,
          response: patientResponse.response,
          sessionId,
          scenarioId: resolvedScenarioId,
          studentRole: patientResponse.addressing,
          contextData: {
            medicalContext: patientResponse.medicalContext,
            timestamp: new Date().toISOString(),
            responseMetadata: {
              aiGenerated: true,
              memoryUsed: !!memory,
              conversationLength: memory?.conversationHistory?.length || 0
            }
          }
        });

        await unifiedDb.storeSessionMessage({
          sessionId,
          role: 'user',
          question: query,
          response: ''
        });

        await unifiedDb.storeSessionMessage({
          sessionId,
          role: 'assistant',
          question: '',
          response: patientResponse.response,
          content: patientResponse.response
        });
      } catch (storageError) {
        console.warn('⚠️ Failed to store conversation exchange:', storageError);
        // Continue - storage failure shouldn't break patient simulator
      }

      res.status(200).json({
        response: patientResponse.response,
        sessionId,
        timestamp: new Date(),
        addressing: patientResponse.addressing,
        medicalContext: patientResponse.medicalContext,
        message: 'AI patient response generated with memory and role awareness'
      });

    } catch (error: any) {
      console.error('❌ Error in AI patient simulator:', error);
      res.status(500).json({
        error: 'Failed to generate AI patient response',
        code: 'AI_PATIENT_SIMULATOR_FAILED',
        details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  });

  return httpServer;
}
