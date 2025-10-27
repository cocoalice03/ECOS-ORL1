import {
  pgTable,
  text,
  varchar,
  timestamp,
  jsonb,
  serial,
  integer,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ============================================================================
// USER MANAGEMENT
// ============================================================================

// Users table - stores all user accounts
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).unique().notNull(),
  firstName: varchar("first_name", { length: 255 }),
  lastName: varchar("last_name", { length: 255 }),
  profileImageUrl: varchar("profile_image_url", { length: 500 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ============================================================================
// SCENARIOS
// ============================================================================

// Scenarios table - medical training scenarios for ECOS
export const scenarios = pgTable("scenarios", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  patientPrompt: text("patient_prompt").notNull(),
  evaluationCriteria: jsonb("evaluation_criteria"),
  pineconeIndex: varchar("pinecone_index", { length: 255 }),
  imageUrl: varchar("image_url", { length: 500 }),
  createdBy: varchar("created_by", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertScenarioSchema = createInsertSchema(scenarios).pick({
  title: true,
  description: true,
  patientPrompt: true,
  evaluationCriteria: true,
  pineconeIndex: true,
  imageUrl: true,
  createdBy: true,
});

export type Scenario = typeof scenarios.$inferSelect;
export type InsertScenario = z.infer<typeof insertScenarioSchema>;

// ============================================================================
// ECOS SESSIONS
// ============================================================================

// Sessions table - ECOS examination sessions
export const sessions = pgTable("sessions", {
  id: serial("id").primaryKey(),
  sessionId: varchar("session_id", { length: 255 }).unique().notNull(), // String ID like "session_1_123456_abc"
  studentEmail: varchar("student_email", { length: 255 }).notNull(),
  scenarioId: integer("scenario_id").notNull().references(() => scenarios.id),
  status: varchar("status", { length: 50 }).default("active"),
  startTime: timestamp("start_time").defaultNow(),
  endTime: timestamp("end_time"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertSessionSchema = createInsertSchema(sessions).pick({
  sessionId: true,
  studentEmail: true,
  scenarioId: true,
  status: true,
});

export type Session = typeof sessions.$inferSelect;
export type InsertSession = z.infer<typeof insertSessionSchema>;

// ============================================================================
// MESSAGES / EXCHANGES
// ============================================================================

// Exchanges table - chat messages between student and virtual patient
export const exchanges = pgTable("exchanges", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull().references(() => sessions.id),
  role: varchar("role", { length: 20 }).notNull(), // 'user' or 'assistant'
  question: text("question"),
  response: text("response"),
  timestamp: timestamp("timestamp").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertExchangeSchema = createInsertSchema(exchanges).pick({
  sessionId: true,
  role: true,
  question: true,
  response: true,
});

export type Exchange = typeof exchanges.$inferSelect;
export type InsertExchange = z.infer<typeof insertExchangeSchema>;

// ============================================================================
// EVALUATIONS
// ============================================================================

// Evaluations table - ECOS assessment results
export const evaluations = pgTable("evaluations", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull().references(() => sessions.id),
  scenarioId: integer("scenario_id").notNull().references(() => scenarios.id),
  studentEmail: varchar("student_email", { length: 255 }).notNull(),
  scores: jsonb("scores").default('{}'),
  globalScore: integer("global_score").default(0),
  strengths: text("strengths").array().default([]),
  weaknesses: text("weaknesses").array().default([]),
  recommendations: text("recommendations").array().default([]),
  feedback: text("feedback"),
  heuristic: jsonb("heuristic"),
  llmScorePercent: integer("llm_score_percent"),
  criteriaDetails: jsonb("criteria_details"),
  evaluatedAt: timestamp("evaluated_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertEvaluationSchema = createInsertSchema(evaluations).pick({
  sessionId: true,
  scenarioId: true,
  studentEmail: true,
  scores: true,
  globalScore: true,
  strengths: true,
  weaknesses: true,
  recommendations: true,
  feedback: true,
  heuristic: true,
  llmScorePercent: true,
  criteriaDetails: true,
});

export type Evaluation = typeof evaluations.$inferSelect;
export type InsertEvaluation = z.infer<typeof insertEvaluationSchema>;

// ============================================================================
// TRAINING SESSIONS
// ============================================================================

// Training Sessions table - organized training sessions for teachers
export const trainingSessions = pgTable("training_sessions", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  createdBy: varchar("created_by", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertTrainingSessionSchema = createInsertSchema(trainingSessions).pick({
  title: true,
  description: true,
  startDate: true,
  endDate: true,
  createdBy: true,
});

export type TrainingSession = typeof trainingSessions.$inferSelect;
export type InsertTrainingSession = z.infer<typeof insertTrainingSessionSchema>;

// Training Session Scenarios table - many-to-many relationship
export const trainingSessionScenarios = pgTable("training_session_scenarios", {
  id: serial("id").primaryKey(),
  trainingSessionId: integer("training_session_id").notNull().references(() => trainingSessions.id),
  scenarioId: integer("scenario_id").notNull().references(() => scenarios.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertTrainingSessionScenarioSchema = createInsertSchema(trainingSessionScenarios).pick({
  trainingSessionId: true,
  scenarioId: true,
});

export type TrainingSessionScenario = typeof trainingSessionScenarios.$inferSelect;
export type InsertTrainingSessionScenario = z.infer<typeof insertTrainingSessionScenarioSchema>;

// Training Session Students table - student assignments to training sessions
export const trainingSessionStudents = pgTable("training_session_students", {
  id: serial("id").primaryKey(),
  trainingSessionId: integer("training_session_id").notNull().references(() => trainingSessions.id),
  studentEmail: varchar("student_email", { length: 255 }).notNull(),
  assignedAt: timestamp("assigned_at").defaultNow(),
});

export const insertTrainingSessionStudentSchema = createInsertSchema(trainingSessionStudents).pick({
  trainingSessionId: true,
  studentEmail: true,
});

export type TrainingSessionStudent = typeof trainingSessionStudents.$inferSelect;
export type InsertTrainingSessionStudent = z.infer<typeof insertTrainingSessionStudentSchema>;
