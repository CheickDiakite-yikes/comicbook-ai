import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Strategy as LocalStrategy } from "passport-local";

import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";
import { ObjectStorageService } from "./objectStorage";
import { randomUUID } from "crypto";
import bcrypt from "bcrypt";

if (!process.env.REPLIT_DOMAINS) {
  throw new Error("Environment variable REPLIT_DOMAINS not provided");
}

const getOidcConfig = memoize(
  async () => {
    return await client.discovery(
      new URL(process.env.ISSUER_URL ?? "https://replit.com/oidc"),
      process.env.REPL_ID!
    );
  },
  { maxAge: 3600 * 1000 }
);

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    rolling: true, // Extend session on activity
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: sessionTtl,
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax' // Fix cross-site POST in production
    },
  });
}

function updateUserSession(
  user: any,
  tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers
) {
  user.claims = tokens.claims();
  user.access_token = tokens.access_token;
  user.refresh_token = tokens.refresh_token;
  user.expires_at = user.claims?.exp;
}

/**
 * Downloads a Google profile picture and stores it in object storage
 * @param googleProfileUrl The Google profile picture URL
 * @param userId The user ID for file naming and permissions
 * @returns The object storage path or null if download fails
 */
async function downloadAndStoreGoogleProfilePicture(
  googleProfileUrl: string,
  userId: string
): Promise<string | null> {
  try {
    console.log(`🔥 Profile Download: Starting download from Google URL: ${googleProfileUrl}`);
    
    // Download image from Google
    const response = await fetch(googleProfileUrl);
    if (!response.ok) {
      console.error(`🔥 Profile Download: Failed to fetch image, status: ${response.status}`);
      return null;
    }
    
    const imageBuffer = await response.arrayBuffer();
    console.log(`🔥 Profile Download: Downloaded image, size: ${imageBuffer.byteLength} bytes`);
    
    // Generate unique filename
    const fileExtension = googleProfileUrl.includes('.jpg') ? 'jpg' : 'png';
    const filename = `profile-${userId}-${Date.now()}.${fileExtension}`;
    
    // Get upload URL from object storage
    const objectStorageService = new ObjectStorageService();
    const uploadURL = await objectStorageService.getObjectEntityUploadURL();
    console.log(`🔥 Profile Download: Got upload URL: ${uploadURL}`);
    
    // Upload image to object storage
    const uploadResponse = await fetch(uploadURL, {
      method: 'PUT',
      body: imageBuffer,
      headers: {
        'Content-Type': `image/${fileExtension}`,
        'Content-Length': imageBuffer.byteLength.toString(),
      },
    });
    
    if (!uploadResponse.ok) {
      console.error(`🔥 Profile Download: Failed to upload to object storage, status: ${uploadResponse.status}`);
      return null;
    }
    
    // Extract object path from upload URL
    const uploadUrl = new URL(uploadURL);
    const pathParts = uploadUrl.pathname.split('/');
    const objectPath = `/objects/uploads/${pathParts[pathParts.length - 1]}`;
    
    console.log(`🔥 Profile Download: Successfully uploaded to object storage: ${objectPath}`);
    
    // Set ACL policy to make the image public
    try {
      const objectFile = await objectStorageService.getObjectEntityFile(objectPath);
      await objectStorageService.trySetObjectEntityAclPolicy(objectPath, {
        owner: userId,
        visibility: "public",
      }, {
        variantType: "canonical",
        lifecycleTag: null,
      });
      console.log(`🔥 Profile Download: Set ACL policy for public access`);
    } catch (aclError) {
      console.warn(`🔥 Profile Download: Failed to set ACL policy, but upload succeeded:`, aclError);
    }
    
    return objectPath;
  } catch (error) {
    console.error(`🔥 Profile Download: Error downloading/storing profile picture:`, error);
    return null;
  }
}

async function upsertUser(
  claims: any,
) {
  await storage.upsertUser({
    id: claims["sub"],
    email: claims["email"],
    firstName: claims["first_name"],
    lastName: claims["last_name"],
    profileImageUrl: claims["profile_image_url"],
  });
}

async function upsertGoogleUser(
  profile: any
) {
  const googleUserId = `google-${profile.id}`;
  const userEmail = profile.emails?.[0]?.value || null;
  
  console.log(`🔥 Google OAuth: Starting upsertGoogleUser for profile ID: ${profile.id}`);
  console.log(`🔥 Google OAuth: Generated user ID: ${googleUserId}, email: ${userEmail}`);
  
  // First, check if a user with this email already exists (from Replit Auth or previous Google login)
  let existingUser = null;
  if (userEmail) {
    try {
      existingUser = await storage.getUserByEmail(userEmail);
      if (existingUser) {
        console.log(`🔥 Google OAuth: Found existing user with email ${userEmail}:`, {
          id: existingUser.id,
          email: existingUser.email,
          firstName: existingUser.firstName
        });
      }
    } catch (error) {
      console.log(`🔥 Google OAuth: No existing user found with email ${userEmail}`);
    }
  }
  
  // Handle profile picture - download and store in object storage if available
  let profileImageUrl = null;
  const googleProfileUrl = profile.photos?.[0]?.value;
  
  if (googleProfileUrl) {
    console.log(`🔥 Google OAuth: Google profile picture URL found: ${googleProfileUrl}`);
    
    // Attempt to download and store the profile picture
    const storedProfileUrl = await downloadAndStoreGoogleProfilePicture(googleProfileUrl, existingUser?.id || googleUserId);
    
    if (storedProfileUrl) {
      profileImageUrl = storedProfileUrl;
      console.log(`🔥 Google OAuth: Profile picture successfully stored in object storage: ${profileImageUrl}`);
    } else {
      // Fallback to Google URL if download/upload fails
      profileImageUrl = googleProfileUrl;
      console.warn(`🔥 Google OAuth: Failed to store profile picture, falling back to Google URL: ${profileImageUrl}`);
    }
  } else {
    console.log(`🔥 Google OAuth: No profile picture URL found in Google profile`);
  }
  
  try {
    let user;
    
    if (existingUser) {
      // Update the existing user's information without changing their ID
      console.log(`🔥 Google OAuth: Updating existing user ${existingUser.id} with Google profile data`);
      const userData = {
        id: existingUser.id, // Keep the original user ID
        email: userEmail,
        firstName: profile.name?.givenName || existingUser.firstName,
        lastName: profile.name?.familyName || existingUser.lastName,
        profileImageUrl: profileImageUrl || existingUser.profileImageUrl,
      };
      
      user = await storage.upsertUser(userData);
      console.log(`🔥 Google OAuth: Successfully updated existing user:`, {
        id: user.id,
        email: user.email,
        firstName: user.firstName
      });
    } else {
      // Create a new user with Google ID
      console.log(`🔥 Google OAuth: Creating new user with Google ID: ${googleUserId}`);
      const userData = {
        id: googleUserId,
        email: userEmail,
        firstName: profile.name?.givenName || null,
        lastName: profile.name?.familyName || null,
        profileImageUrl: profileImageUrl,
      };
      
      user = await storage.upsertUser(userData);
      console.log(`🔥 Google OAuth: Successfully created new user:`, {
        id: user.id,
        email: user.email,
        firstName: user.firstName
      });
    }
    
    return user;
  } catch (error) {
    console.error(`🔥 Google OAuth: CRITICAL ERROR during upsertUser:`, error);
    console.error(`🔥 Google OAuth: Error details:`, {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    throw error;
  }
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  const config = await getOidcConfig();

  const verify: VerifyFunction = async (
    tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
    verified: passport.AuthenticateCallback
  ) => {
    const user = {};
    updateUserSession(user, tokens);
    await upsertUser(tokens.claims());
    verified(null, user);
  };

  for (const domain of process.env
    .REPLIT_DOMAINS!.split(",")) {
    const strategy = new Strategy(
      {
        name: `replitauth:${domain}`,
        config,
        scope: "openid email profile offline_access",
        callbackURL: `https://${domain}/api/callback`,
      },
      verify,
    );
    passport.use(strategy);
  }

  // Google OAuth Strategy
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(new GoogleStrategy({
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "/api/auth/google/callback"
    },
    async (accessToken: string, refreshToken: string, profile: any, done: any) => {
      console.log(`🔥 Google OAuth: Strategy callback triggered for profile ID: ${profile.id}`);
      console.log(`🔥 Google OAuth: Profile data:`, {
        id: profile.id,
        displayName: profile.displayName,
        emails: profile.emails,
        photos: profile.photos
      });
      
      try {
        const googleUserId = `google-${profile.id}`;
        const user = {
          id: googleUserId,
          profile: profile,
          provider: 'google'
        };
        
        console.log(`🔥 Google OAuth: Creating user session object:`, user);
        
        // Create/update user in database
        const dbUser = await upsertGoogleUser(profile);
        console.log(`🔥 Google OAuth: Database user created/updated:`, dbUser);
        
        console.log(`🔥 Google OAuth: Strategy callback successful, calling done(null, user)`);
        return done(null, user);
      } catch (error) {
        console.error(`🔥 Google OAuth: STRATEGY CALLBACK ERROR:`, error);
        console.error(`🔥 Google OAuth: Error for profile ID: ${profile.id}`);
        console.error(`🔥 Google OAuth: Full error details:`, {
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          profile: profile
        });
        return done(error, null);
      }
    }));
  }

  // Local Strategy (Email/Password)
  passport.use(new LocalStrategy({
    usernameField: 'email',
    passwordField: 'password'
  },
  async (email: string, password: string, done: any) => {
    console.log(`🔥 Local Auth: Attempting login for email: ${email}`);
    
    try {
      // Find user by email
      const user = await storage.getUserByEmail(email);
      
      if (!user) {
        console.log(`🔥 Local Auth: No user found with email: ${email}`);
        return done(null, false, { message: 'Incorrect email or password' });
      }
      
      // Check if user has a password set
      if (!user.password) {
        console.log(`🔥 Local Auth: User ${user.id} has no password set (likely a Google OAuth user)`);
        return done(null, false, { message: 'This account uses Google sign-in. Please use Google to log in.' });
      }
      
      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.password);
      
      if (!isValidPassword) {
        console.log(`🔥 Local Auth: Invalid password for user: ${email}`);
        return done(null, false, { message: 'Incorrect email or password' });
      }
      
      console.log(`🔥 Local Auth: Login successful for user:`, {
        id: user.id,
        email: user.email,
        firstName: user.firstName
      });
      
      // Create session user object
      const sessionUser = {
        id: user.id,
        email: user.email,
        provider: 'local'
      };
      
      return done(null, sessionUser);
    } catch (error) {
      console.error(`🔥 Local Auth: Error during login:`, error);
      return done(error);
    }
  }));

  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));

  app.get("/api/login", (req, res, next) => {
    passport.authenticate(`replitauth:${req.hostname}`, {
      prompt: "login consent",
      scope: ["openid", "email", "profile", "offline_access"],
    })(req, res, next);
  });

  app.get("/api/callback", (req, res, next) => {
    passport.authenticate(`replitauth:${req.hostname}`, {
      successReturnToOrRedirect: "/",
      failureRedirect: "/api/login",
    })(req, res, next);
  });

  // Google OAuth routes
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    app.get("/api/auth/google",
      passport.authenticate("google", {
        scope: ["profile", "email"]
      })
    );

    app.get("/api/auth/google/callback",
      passport.authenticate("google", {
        successRedirect: "/",
        failureRedirect: "/api/login"
      })
    );
  }

  app.get("/api/logout", (req, res) => {
    req.logout(() => {
      res.redirect(
        client.buildEndSessionUrl(config, {
          client_id: process.env.REPL_ID!,
          post_logout_redirect_uri: `${req.protocol}://${req.hostname}`,
        }).href
      );
    });
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  console.log(`🔥 isAuthenticated: Called for ${req.method} ${req.url}`);
  console.log(`🔥 isAuthenticated: req.isAuthenticated() = ${req.isAuthenticated()}`);
  console.log(`🔥 isAuthenticated: req.user exists = ${!!req.user}`);
  const user = req.user as any;

  if (!req.isAuthenticated() || !user) {
    console.log(`🔥 isAuthenticated: FAILING - isAuthenticated=${req.isAuthenticated()}, user=${!!user}`);
    return res.status(401).json({ message: "Unauthorized" });
  }

  // Handle Google OAuth and Local Auth users (simpler auth check)
  if (user && (user.provider === 'google' || user.provider === 'local')) {
    console.log(`🔥 isAuthenticated: ${user.provider} user detected:`, { id: user.id, provider: user.provider });
    
    // Verify the user still exists in the database
    try {
      const dbUser = await storage.getUser(user.id);
      if (!dbUser) {
        console.error(`🔥 isAuthenticated: ${user.provider} user ${user.id} NOT found in database!`);
        return res.status(401).json({ message: "User not found in database", code: "user_not_found" });
      }
      
      console.log(`🔥 isAuthenticated: ${user.provider} user verified in database:`, { id: dbUser.id, email: dbUser.email });
      
      // Touch session to keep it alive
      if (req.session && req.session.touch) {
        req.session.touch();
      }
      return next();
    } catch (error) {
      console.error(`🔥 isAuthenticated: Database error checking ${user.provider} user:`, error);
      return res.status(500).json({ message: "Internal server error" });
    }
  }

  // Handle Replit Auth users (with token refresh)
  if (!user.expires_at) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const now = Math.floor(Date.now() / 1000);
  // Add 5 minute buffer to prevent unnecessary refreshes
  const tokenBuffer = 5 * 60; // 5 minutes in seconds
  
  if (now <= (user.expires_at - tokenBuffer)) {
    // Token is still valid, touch session to keep it alive
    if (req.session && req.session.touch) {
      req.session.touch();
    }
    return next();
  }

  // Token is about to expire or has expired, try to refresh
  const refreshToken = user.refresh_token;
  if (!refreshToken) {
    console.log("No refresh token available for user");
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const config = await getOidcConfig();
    const tokenResponse = await client.refreshTokenGrant(config, refreshToken);
    updateUserSession(user, tokenResponse);
    
    // Touch session after successful token refresh
    if (req.session && req.session.touch) {
      req.session.touch();
    }
    
    console.log("Successfully refreshed token for user");
    return next();
  } catch (error) {
    console.error("Token refresh failed:", error);
    
    // Clear the session since refresh failed - force re-authentication
    if (req.session) {
      req.session.destroy((err) => {
        if (err) console.error("Session destruction error:", err);
      });
    }
    
    return res.status(401).json({ message: "Unauthorized" });
  }
};
