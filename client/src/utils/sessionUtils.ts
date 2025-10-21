/**
 * Session Utilities
 * 
 * Utilities for parsing session IDs and extracting scenario information
 * Used to handle race conditions and provide fallback scenarioId extraction
 */

/**
 * Extract scenario ID from session ID pattern
 * 
 * Session ID format: "session_{scenarioId}_{timestamp}_{randomId}"
 * Example: "session_5_1757582642186_rmo2xxmip" -> 5
 * 
 * @param sessionId - The session ID string
 * @returns The extracted scenario ID or null if parsing fails
 */
export function extractScenarioIdFromSessionId(sessionId: string): number | null {
  if (!sessionId || typeof sessionId !== 'string') {
    console.warn('⚠️ [sessionUtils] Invalid sessionId provided:', sessionId);
    return null;
  }

  try {
    // Match pattern: session_NUMBER_anything
    const match = sessionId.match(/^session_(\d+)_/);
    
    if (match && match[1]) {
      const scenarioId = parseInt(match[1], 10);
      
      if (isNaN(scenarioId) || scenarioId <= 0) {
        console.warn('⚠️ [sessionUtils] Invalid scenario ID extracted:', match[1]);
        return null;
      }
      
      console.log(`✅ [sessionUtils] Extracted scenarioId ${scenarioId} from sessionId: ${sessionId}`);
      return scenarioId;
    }
    
    console.warn('⚠️ [sessionUtils] Could not match session pattern for:', sessionId);
    return null;
    
  } catch (error) {
    console.error('❌ [sessionUtils] Error parsing sessionId:', error);
    return null;
  }
}

/**
 * Validate if a session ID follows the expected pattern
 * 
 * @param sessionId - The session ID to validate
 * @returns True if the session ID is valid, false otherwise
 */
export function isValidSessionId(sessionId: string): boolean {
  if (!sessionId || typeof sessionId !== 'string') {
    return false;
  }
  
  return /^session_\d+_\d+_[a-z0-9]+$/i.test(sessionId);
}

/**
 * Get scenario ID with fallback priority
 * 
 * Priority order:
 * 1. Direct scenarioId parameter
 * 2. scenarioId from session object
 * 3. scenarioId extracted from sessionId string
 * 
 * @param options - Object containing possible scenario ID sources
 * @returns The best available scenario ID or null
 */
export function getScenarioIdWithFallback(options: {
  scenarioId?: number;
  session?: { scenarioId?: number };
  sessionId?: string;
}): number | null {
  const { scenarioId, session, sessionId } = options;
  
  // Priority 1: Direct scenarioId parameter
  if (typeof scenarioId === 'number' && scenarioId > 0) {
    console.log(`✅ [sessionUtils] Using direct scenarioId: ${scenarioId}`);
    return scenarioId;
  }
  
  // Priority 2: scenarioId from session object
  if (session?.scenarioId && typeof session.scenarioId === 'number' && session.scenarioId > 0) {
    console.log(`✅ [sessionUtils] Using session.scenarioId: ${session.scenarioId}`);
    return session.scenarioId;
  }
  
  // Priority 3: Extract from sessionId string
  if (sessionId) {
    const extractedId = extractScenarioIdFromSessionId(sessionId);
    if (extractedId) {
      console.log(`✅ [sessionUtils] Using extracted scenarioId from sessionId: ${extractedId}`);
      return extractedId;
    }
  }
  
  console.warn('⚠️ [sessionUtils] No valid scenarioId found in any source', { scenarioId, session, sessionId });
  return null;
}

/**
 * Debug session data for troubleshooting
 * 
 * @param sessionData - All available session-related data
 */
export function debugSessionData(sessionData: {
  sessionId?: string;
  session?: any;
  scenarioId?: number;
  [key: string]: any;
}): void {
  console.group('🔍 [sessionUtils] Debug Session Data');
  console.log('sessionId:', sessionData.sessionId);
  console.log('session object:', sessionData.session);
  console.log('direct scenarioId:', sessionData.scenarioId);
  
  if (sessionData.sessionId) {
    console.log('isValidSessionId:', isValidSessionId(sessionData.sessionId));
    console.log('extractedScenarioId:', extractScenarioIdFromSessionId(sessionData.sessionId));
  }
  
  console.log('final scenarioId:', getScenarioIdWithFallback({
    scenarioId: sessionData.scenarioId,
    session: sessionData.session,
    sessionId: sessionData.sessionId
  }));
  
  console.groupEnd();
}