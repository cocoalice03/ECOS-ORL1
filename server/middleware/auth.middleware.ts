import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { scryptSync, timingSafeEqual } from 'crypto';

export interface AuthenticatedRequest extends Request {
  user?: {
    email: string;
    isAdmin: boolean;
    iat?: number;
    exp?: number;
  };
}

export interface JWTPayload {
  email: string;
  isAdmin: boolean;
  iat?: number;
  exp?: number;
}

interface StoredCredential {
  hash: Buffer;
  salt: string;
  keyLength: number;
  algorithm: 'scrypt';
}

class AuthenticationService {
  private readonly jwtSecret: string;
  private readonly adminEmails: Set<string>;
  private readonly credentialStore: Map<string, StoredCredential>;
  private readonly bootstrapAdminEmails: Set<string>;
  private readonly allowBootstrapFallback: boolean;
  
  constructor() {
    // Use environment variable for JWT secret, fallback to a development secret
    this.jwtSecret = process.env.JWT_SECRET || 'development-secret-key-change-in-production';
    
    if (this.jwtSecret === 'development-secret-key-change-in-production' && process.env.NODE_ENV === 'production') {
      console.error('❌ SECURITY WARNING: JWT_SECRET not set in production! This is a security risk!');
    }
    
    this.credentialStore = new Map();
    this.bootstrapAdminEmails = new Set();
    this.allowBootstrapFallback = process.env.ALLOW_BOOTSTRAP_ADMIN === 'true' && process.env.NODE_ENV !== 'production';
    if (process.env.ALLOW_BOOTSTRAP_ADMIN === 'true' && process.env.NODE_ENV === 'production') {
      console.warn('⚠️ ALLOW_BOOTSTRAP_ADMIN is ignored in production to prevent insecure admin fallbacks.');
    }

    // Load admin emails from environment variable or use fallback
    const adminEmailsEnv = process.env.ADMIN_EMAILS;
    if (adminEmailsEnv) {
      this.adminEmails = new Set(
        adminEmailsEnv
          .split(',')
          .map(email => email.trim().toLowerCase())
          .filter(email => this.isValidEmail(email))
      );
      console.log(`✅ Loaded ${this.adminEmails.size} admin emails from environment`);
    } else {
      // No fallback - require proper environment configuration
      this.adminEmails = new Set();
      console.error('❌ No admin emails configured! Set ADMIN_EMAILS environment variable.');
    }

    this.initializeBootstrapAdmins();
    this.loadCredentialStore();
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private initializeBootstrapAdmins(): void {
    if (!this.allowBootstrapFallback) {
      return;
    }

    const bootstrapEmailsEnv = process.env.BOOTSTRAP_ADMIN_EMAILS;
    const fallbackEmails = bootstrapEmailsEnv
      ? bootstrapEmailsEnv.split(',').map(email => email.trim())
      : ['cherubindavid@gmail.com', 'colombemadoungou@gmail.com'];

    fallbackEmails
      .filter(email => this.isValidEmail(email))
      .map(email => this.normalizeEmail(email))
      .forEach(email => this.bootstrapAdminEmails.add(email));

    if (this.bootstrapAdminEmails.size > 0) {
      console.warn(
        `⚠️ Bootstrap admin fallback enabled for ${this.bootstrapAdminEmails.size} email${
          this.bootstrapAdminEmails.size > 1 ? 's' : ''
        }. Disable ALLOW_BOOTSTRAP_ADMIN to enforce environment-configured admins only.`
      );
    }
  }

  private loadCredentialStore(): void {
    const credentialJson = process.env.ADMIN_CREDENTIALS;

    if (!credentialJson) {
      console.warn('⚠️ ADMIN_CREDENTIALS not configured. Admin password verification will fail.');
      return;
    }

    try {
      const parsed = JSON.parse(credentialJson);

      if (!Array.isArray(parsed)) {
        throw new Error('ADMIN_CREDENTIALS must be a JSON array.');
      }

      let loaded = 0;
      for (const record of parsed) {
        if (!record || typeof record !== 'object') {
          continue;
        }

        const {
          email,
          hash,
          salt,
          keylen,
          algorithm
        } = record as Record<string, unknown>;

        if (typeof email !== 'string' || typeof hash !== 'string' || typeof salt !== 'string') {
          console.warn('⚠️ Skipping malformed admin credential entry.');
          continue;
        }

        const normalizedEmail = this.normalizeEmail(email);
        const algorithmName = (typeof algorithm === 'string' ? algorithm : 'scrypt').toLowerCase();
        if (algorithmName !== 'scrypt') {
          console.warn(`⚠️ Unsupported credential algorithm "${algorithmName}" for ${normalizedEmail}. Only scrypt is supported.`);
          continue;
        }

        const hashBuffer = Buffer.from(hash, 'hex');
        if (hashBuffer.length === 0) {
          console.warn(`⚠️ Skipping admin credential for ${normalizedEmail} due to empty hash.`);
          continue;
        }

        const keyLength = typeof keylen === 'number' && keylen > 0 ? keylen : hashBuffer.length;
        this.credentialStore.set(normalizedEmail, {
          hash: hashBuffer,
          salt,
          keyLength,
          algorithm: 'scrypt'
        });
        loaded += 1;
      }

      if (loaded === 0) {
        console.error('❌ No valid admin credentials loaded. Admin logins will be rejected.');
      } else {
        console.log(`✅ Loaded ${loaded} admin credential hash${loaded > 1 ? 'es' : ''} from ADMIN_CREDENTIALS.`);
      }
    } catch (error) {
      console.error('❌ Failed to parse ADMIN_CREDENTIALS environment variable:', error);
    }
  }

  public generateToken(email: string): string {
    if (!this.isValidEmail(email)) {
      throw new Error('Invalid email format');
    }

    const normalizedEmail = this.normalizeEmail(email);
    const payload: JWTPayload = {
      email: normalizedEmail,
      isAdmin: this.isAuthorizedAdminEmail(normalizedEmail)
    };

    return jwt.sign(payload, this.jwtSecret, {
      expiresIn: '24h',
      issuer: 'ecos-app',
      audience: 'ecos-users'
    });
  }

  public verifyToken(token: string): JWTPayload {
    try {
      const decoded = jwt.verify(token, this.jwtSecret, {
        issuer: 'ecos-app',
        audience: 'ecos-users'
      }) as JWTPayload;
      
      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('Token expired');
      } else if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('Invalid token');
      } else {
        throw new Error('Token verification failed');
      }
    }
  }

  public isAdmin(email: string): boolean {
    if (!email || typeof email !== 'string') {
      return false;
    }
    return this.adminEmails.has(this.normalizeEmail(email));
  }

  public getAdminEmails(): string[] {
    return Array.from(this.adminEmails);
  }

  public isAuthorizedAdminEmail(email: string): boolean {
    if (!email || typeof email !== 'string') {
      return false;
    }

    const normalizedEmail = this.normalizeEmail(email);
    if (this.adminEmails.has(normalizedEmail)) {
      return true;
    }

    return this.allowBootstrapFallback && this.bootstrapAdminEmails.has(normalizedEmail);
  }

  public verifyPassword(email: string, password: string): boolean {
    if (!email || !password) {
      return false;
    }

    const normalizedEmail = this.normalizeEmail(email);
    const credential = this.credentialStore.get(normalizedEmail);

    if (!credential) {
      return false;
    }

    try {
      const derivedKey = scryptSync(password, credential.salt, credential.keyLength);

      if (derivedKey.length !== credential.hash.length) {
        return false;
      }

      return timingSafeEqual(derivedKey, credential.hash);
    } catch (error) {
      console.error(`❌ Error verifying password for ${normalizedEmail}:`, error);
      return false;
    }
  }
}

// Singleton instance
export const authService = new AuthenticationService();

// Middleware for JWT token verification
export const authenticateToken = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ 
      error: 'Access token required',
      code: 'TOKEN_MISSING'
    });
  }

  try {
    const user = authService.verifyToken(token);
    req.user = user;
    next();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown authentication error';
    return res.status(403).json({ 
      error: errorMessage,
      code: 'TOKEN_INVALID'
    });
  }
};

// Middleware for admin authorization
export const requireAdmin = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ 
      error: 'Authentication required',
      code: 'AUTH_REQUIRED'
    });
  }

  if (!req.user.isAdmin) {
    return res.status(403).json({ 
      error: 'Admin privileges required',
      code: 'ADMIN_REQUIRED'
    });
  }

  next();
};

// Enhanced email-based authorization with optional bootstrap fallback
export const isAdminAuthorized = (email: string): boolean => {
  return authService.isAuthorizedAdminEmail(email);
};

// Middleware for email-based authorization (legacy during transition)
export const authorizeByEmail = (req: Request, res: Response, next: NextFunction) => {
  const email = req.query.email as string || req.body.email as string;
  
  if (!email) {
    return res.status(400).json({ 
      error: 'Email parameter required',
      code: 'EMAIL_REQUIRED'
    });
  }

  if (!isAdminAuthorized(email)) {
    return res.status(403).json({ 
      error: 'Unauthorized access',
      code: 'EMAIL_UNAUTHORIZED'
    });
  }

  next();
};