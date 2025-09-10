import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";

import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";

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
  const userData = {
    id: googleUserId,
    email: profile.emails?.[0]?.value || null,
    firstName: profile.name?.givenName || null,
    lastName: profile.name?.familyName || null,
    profileImageUrl: profile.photos?.[0]?.value || null,
  };
  
  console.log(`🔥 Google OAuth: Starting upsertGoogleUser for profile ID: ${profile.id}`);
  console.log(`🔥 Google OAuth: Generated user ID: ${googleUserId}`);
  console.log(`🔥 Google OAuth: User data:`, userData);
  
  try {
    const user = await storage.upsertUser(userData);
    console.log(`🔥 Google OAuth: Successfully upserted user:`, user);
    
    // Verify the user was created by immediately fetching it
    const verifyUser = await storage.getUser(googleUserId);
    if (verifyUser) {
      console.log(`🔥 Google OAuth: Verified user exists in database:`, verifyUser);
    } else {
      console.error(`🔥 Google OAuth: ERROR - User not found after creation! Expected ID: ${googleUserId}`);
    }
    
    return user;
  } catch (error) {
    console.error(`🔥 Google OAuth: CRITICAL ERROR during upsertUser:`, error);
    console.error(`🔥 Google OAuth: Error details:`, {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      userData: userData
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

  // Handle Google OAuth users (simpler auth check)
  if (user && user.provider === 'google') {
    console.log(`🔥 isAuthenticated: Google OAuth user detected:`, { id: user.id, provider: user.provider });
    
    // Verify the user still exists in the database
    try {
      const dbUser = await storage.getUser(user.id);
      if (!dbUser) {
        console.error(`🔥 isAuthenticated: Google OAuth user ${user.id} NOT found in database!`);
        return res.status(401).json({ message: "User not found in database", code: "user_not_found" });
      }
      
      console.log(`🔥 isAuthenticated: Google OAuth user verified in database:`, { id: dbUser.id, email: dbUser.email });
      
      // Touch session to keep it alive
      if (req.session && req.session.touch) {
        req.session.touch();
      }
      return next();
    } catch (error) {
      console.error(`🔥 isAuthenticated: Database error checking Google OAuth user:`, error);
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
