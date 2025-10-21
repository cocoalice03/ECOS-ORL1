/**
 * Firebase Authentication Middleware
 *
 * Verifies Firebase ID tokens and manages user authentication/authorization
 */

import { Request, Response, NextFunction } from 'express';
import { firebaseAdminService } from '../services/firebase-admin.service.js';
import { unifiedDb } from '../services/unified-database.service.js';
import { authService } from './auth.middleware.js';

export interface FirebaseAuthRequest extends Request {
  firebaseUser?: {
    uid: string;
    email: string;
    role?: 'admin' | 'student';
    emailVerified: boolean;
  };
  jwtToken?: string;
}

/**
 * Middleware to verify Firebase ID token and load/create user in Supabase
 */
export const verifyFirebaseToken = async (
  req: FirebaseAuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    // Extract Firebase ID token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'No Firebase ID token provided',
        code: 'FIREBASE_TOKEN_MISSING'
      });
    }

    const idToken = authHeader.split('Bearer ')[1];

    // Verify token with Firebase Admin
    const decodedToken = await firebaseAdminService.verifyIdToken(idToken);

    if (!decodedToken.email) {
      return res.status(400).json({
        error: 'Firebase user has no email',
        code: 'FIREBASE_EMAIL_MISSING'
      });
    }

    // Load or create user in Supabase
    const { user, role } = await getOrCreateSupabaseUser(
      decodedToken.uid,
      decodedToken.email
    );

    // Attach Firebase user info to request
    req.firebaseUser = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      role: role as 'admin' | 'student',
      emailVerified: decodedToken.email_verified || false
    };

    // Generate internal JWT for backward compatibility
    const jwtToken = authService.generateToken(decodedToken.email);
    req.jwtToken = jwtToken;

    console.log('✅ Firebase user authenticated:', {
      uid: decodedToken.uid,
      email: decodedToken.email,
      role
    });

    next();
  } catch (error: any) {
    console.error('❌ Firebase token verification failed:', error.message);

    return res.status(403).json({
      error: error.message || 'Firebase authentication failed',
      code: 'FIREBASE_AUTH_FAILED'
    });
  }
};

/**
 * Get or create user in Supabase from Firebase UID
 */
async function getOrCreateSupabaseUser(
  firebaseUid: string,
  email: string
): Promise<{ user: any; role: string }> {
  try {
    // Check if user exists by firebase_uid
    const existingUser = await unifiedDb.getUserByFirebaseUid(firebaseUid);

    if (existingUser) {
      const role = await unifiedDb.getUserRole(existingUser.id);
      console.log('✅ Found existing Supabase user:', {
        id: existingUser.id,
        email: existingUser.email,
        role
      });
      return { user: existingUser, role };
    }

    // Check if user exists by email (for migration cases)
    const userByEmail = await unifiedDb.getUserByEmail(email);

    if (userByEmail) {
      // Update existing user with firebase_uid
      await unifiedDb.updateUserFirebaseUid(userByEmail.id, firebaseUid);
      const role = await unifiedDb.getUserRole(userByEmail.id);
      console.log('✅ Linked existing Supabase user to Firebase:', {
        id: userByEmail.id,
        email: userByEmail.email,
        firebaseUid,
        role
      });
      return { user: userByEmail, role };
    }

    // Create new user in Supabase
    const newUser = await unifiedDb.createUser({
      email,
      firebaseUid,
      firstName: null,
      lastName: null,
      profileImageUrl: null
    });

    // Assign default role (student)
    await unifiedDb.setUserRole(newUser.id, 'student');

    console.log('✅ Created new Supabase user from Firebase:', {
      id: newUser.id,
      email: newUser.email,
      firebaseUid,
      role: 'student'
    });

    return { user: newUser, role: 'student' };
  } catch (error) {
    console.error('❌ Error getting/creating Supabase user:', error);
    throw new Error('Failed to sync user with database');
  }
}

/**
 * Middleware to require admin role
 */
export const requireFirebaseAdmin = (
  req: FirebaseAuthRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.firebaseUser) {
    return res.status(401).json({
      error: 'Authentication required',
      code: 'AUTH_REQUIRED'
    });
  }

  if (req.firebaseUser.role !== 'admin') {
    return res.status(403).json({
      error: 'Admin privileges required',
      code: 'ADMIN_REQUIRED'
    });
  }

  next();
};

/**
 * Middleware to require student role (or admin)
 */
export const requireFirebaseStudent = (
  req: FirebaseAuthRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.firebaseUser) {
    return res.status(401).json({
      error: 'Authentication required',
      code: 'AUTH_REQUIRED'
    });
  }

  if (req.firebaseUser.role !== 'student' && req.firebaseUser.role !== 'admin') {
    return res.status(403).json({
      error: 'Student access required',
      code: 'STUDENT_REQUIRED'
    });
  }

  next();
};

/**
 * Optional Firebase authentication (doesn't fail if no token)
 */
export const optionalFirebaseAuth = async (
  req: FirebaseAuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // No token provided, continue without authentication
    return next();
  }

  try {
    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await firebaseAdminService.verifyIdToken(idToken);

    if (decodedToken.email) {
      const { user, role } = await getOrCreateSupabaseUser(
        decodedToken.uid,
        decodedToken.email
      );

      req.firebaseUser = {
        uid: decodedToken.uid,
        email: decodedToken.email,
        role: role as 'admin' | 'student',
        emailVerified: decodedToken.email_verified || false
      };

      const jwtToken = authService.generateToken(decodedToken.email);
      req.jwtToken = jwtToken;
    }
  } catch (error) {
    // Ignore authentication errors for optional auth
    console.log('⚠️ Optional Firebase auth failed, continuing without auth');
  }

  next();
};
