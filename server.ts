import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import cors from "cors";
import { google } from "googleapis";
import dotenv from "dotenv";
import cookieSession from "cookie-session";
import { createClient } from "@supabase/supabase-js";
import multer from "multer";
import { secrets } from "./src/config/secrets.js";

dotenv.config();

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Initialize Supabase Client for Backend
let supabaseUrl = secrets.SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
let supabaseKey = secrets.SUPABASE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY || process.env.SUPABASE_KEY;

let supabase: any = null;

function initSupabase(url: string, key: string) {
  if (url && key) {
    supabase = createClient(url, key);
    console.log("JARVIS: Supabase client initialized on backend.");
    return true;
  }
  console.warn("JARVIS: Supabase credentials missing on backend.");
  return false;
}

initSupabase(supabaseUrl || '', supabaseKey || '');

// Initialize OAuth2 client lazily or with validation
const getOAuth2Client = (req?: express.Request) => {
  let clientId = secrets.OAUTH_CLIENT_ID?.trim() || process.env.OAUTH_CLIENT_ID?.trim();
  let clientSecret = secrets.OAUTH_CLIENT_SECRET?.trim() || process.env.OAUTH_CLIENT_SECRET?.trim();
  
  // Remove quotes if present (common copy-paste issue)
  if (clientId?.startsWith('"') && clientId?.endsWith('"')) clientId = clientId.substring(1, clientId.length - 1);
  if (clientId?.startsWith("'") && clientId?.endsWith("'")) clientId = clientId.substring(1, clientId.length - 1);
  if (clientSecret?.startsWith('"') && clientSecret?.endsWith('"')) clientSecret = clientSecret.substring(1, clientSecret.length - 1);
  if (clientSecret?.startsWith("'") && clientSecret?.endsWith("'")) clientSecret = clientSecret.substring(1, clientSecret.length - 1);
  
  // Use the provided APP_URL if available, otherwise fallback to request headers
  let appUrl = secrets.APP_URL || process.env.APP_URL;
  
  if (!appUrl && req) {
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers['host'];
    appUrl = `${protocol}://${host}`;
  }
  
  if (!appUrl) {
    // Current App URL as ultimate fallback
    appUrl = 'https://ais-dev-llodatp4nxef3ydanxuohk-3975274510.us-west2.run.app';
  }
  
  // Ensure appUrl doesn't have a trailing slash for consistent redirect_uri
  const cleanAppUrl = appUrl.replace(/\/$/, '');
  const redirectUri = `${cleanAppUrl}/auth/callback`;
  
  if (!clientId || !clientSecret || clientId === 'YOUR_CLIENT_ID') {
    console.error("CRITICAL: OAUTH_CLIENT_ID or OAUTH_CLIENT_SECRET not configured.");
    return null;
  }

  if (!clientId.endsWith('.apps.googleusercontent.com')) {
    console.warn("WARNING: OAUTH_CLIENT_ID does not end with .apps.googleusercontent.com. This might be an invalid client ID.");
  }

  return new google.auth.OAuth2(
    clientId,
    clientSecret,
    redirectUri
  );
};

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors({
    origin: true,
    credentials: true
  }));
  app.use(express.json());
  app.set('trust proxy', true); 

  app.use(cookieSession({
    name: 'jarvis-session',
    keys: [secrets.SESSION_SECRET || process.env.SESSION_SECRET || '@Wsx280360'],
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    secure: true,
    sameSite: 'none',
    httpOnly: true,
  }));

  // Middleware to handle Token-in-Header fallback
  app.use((req, res, next) => {
    const authHeader = req.headers.authorization;
    console.log('JARVIS: Verificando Authorization header:', !!authHeader);
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const tokenData = JSON.parse(Buffer.from(authHeader.split(' ')[1], 'base64').toString());
        console.log('JARVIS: Token decodificado, tem tokens:', !!tokenData.tokens);
        if (tokenData.tokens) {
          console.log('JARVIS: Token de cabeçalho decodificado com sucesso para:', tokenData.user?.email);
          // Manually populate session if it's not present or doesn't have tokens
          if (!(req as any).session) {
            (req as any).session = {};
          }
          if (!(req as any).session.tokens) {
            (req as any).session.tokens = tokenData.tokens;
            (req as any).session.user = tokenData.user;
          }
        }
      } catch (e) {
        console.error('JARVIS: Erro ao decodificar token de cabeçalho:', e);
      }
    }
    next();
  });

  // Dynamic Supabase client getter
  const getSupabase = (req: express.Request) => {
    const url = req.headers['x-supabase-url'] as string || supabaseUrl;
    const key = req.headers['x-supabase-key'] as string || supabaseKey;
    if (url && key) {
      try {
        return createClient(url, key);
      } catch (e) {
        console.error("JARVIS: Invalid Supabase URL or Key", e);
        return null;
      }
    }
    return null;
  };

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/api/db/health", async (req, res) => {
    const client = getSupabase(req);
    if (!client) return res.status(500).json({ error: "Supabase not configured" });
    try {
      // Try a simple query to check connection
      const { data, error } = await client.from('app_metadata').select('key').limit(1);
      if (error) throw error;
      res.json({ status: "connected", tables: true });
    } catch (error: any) {
      res.status(500).json({ status: "error", message: error.message });
    }
  });

  app.post("/api/db/config", (req, res) => {
    const { url, key } = req.body;
    if (url && key) {
      const success = initSupabase(url, key);
      if (success) {
        return res.json({ status: "ok", message: "Supabase configuration updated on backend" });
      }
    }
    res.status(400).json({ error: "Invalid configuration" });
  });

  app.get("/api/auth/url", (req, res) => {
    const client = getOAuth2Client(req);
    if (!client) {
      return res.status(500).json({ 
        error: "Configuração de OAuth ausente", 
        details: "OAUTH_CLIENT_ID ou OAUTH_CLIENT_SECRET não foram configurados nos Secrets do AI Studio." 
      });
    }

    // Debug: Log the redirect_uri being used
    const redirectUri = (client as any).redirectUri;
    console.log(`Generating Auth URL with redirect_uri: ${redirectUri}`);

    const scopes = [
      'openid',
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/gmail.modify',
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/drive',
      'https://www.googleapis.com/auth/tasks',
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/youtube.readonly',
      'https://www.googleapis.com/auth/photoslibrary.readonly',
      'https://www.googleapis.com/auth/photoslibrary',
      'https://www.googleapis.com/auth/cloud-platform',
      'https://www.googleapis.com/auth/devstorage.full_control',
    ];

    const url = client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent select_account'
    });

    res.json({ url });
  });

  app.get("/api/auth/debug", (req, res) => {
    const clientId = secrets.OAUTH_CLIENT_ID?.trim() || process.env.OAUTH_CLIENT_ID?.trim();
    const clientSecret = secrets.OAUTH_CLIENT_SECRET?.trim() || process.env.OAUTH_CLIENT_SECRET?.trim();
    const client = getOAuth2Client(req);
    const redirectUri = client ? (client as any).redirectUri : "Not configured";
    
    res.json({
      redirectUri,
      appUrl: secrets.APP_URL || process.env.APP_URL || "Not set in env",
      clientIdConfigured: !!clientId,
      clientIdPrefix: clientId ? clientId.substring(0, 10) + "..." : null,
      clientIdLength: clientId?.length || 0,
      clientSecretConfigured: !!clientSecret,
      clientSecretLength: clientSecret?.length || 0,
      nodeEnv: process.env.NODE_ENV
    });
  });

  app.get("/auth/callback", async (req, res) => {
    const { code } = req.query;
    const client = getOAuth2Client(req);
    if (!client || !code) {
      console.error('OAuth Callback Error: Missing client or code');
      return res.status(400).send('Invalid request or missing configuration');
    }

    try {
      console.log('Exchanging code for tokens...');
      console.log('Using redirectUri:', (client as any).redirectUri);
      console.log('Client ID Prefix:', (client as any)._clientId?.substring(0, 10) + '...');
      
      const { tokens } = await client.getToken(code as string);
      console.log('Tokens received successfully:', {
        has_access_token: !!tokens.access_token,
        has_id_token: !!tokens.id_token,
        has_refresh_token: !!tokens.refresh_token,
        scopes: tokens.scope
      });
      client.setCredentials(tokens);
      
      // Fetch user info to verify email
      const oauth2 = google.oauth2({ version: 'v2', auth: client });
      const userInfo = await oauth2.userinfo.get();
      
      const email = userInfo.data.email?.toLowerCase();
      const allowedAdmins = [
        'admjesusia@gmail.com',
        'jesusmjunior2021@gmail.com',
        'martjesusmartins@gmail.com'
      ];
      const adminEmailEnv = (secrets.ADMIN_EMAIL || process.env.ADMIN_EMAIL || '').toLowerCase();
      if (adminEmailEnv) {
        const emailsFromEnv = adminEmailEnv.split(',').map(e => e.trim());
        emailsFromEnv.forEach(email => {
          if (email && !allowedAdmins.includes(email)) {
            allowedAdmins.push(email);
          }
        });
      }
      
      if (!allowedAdmins.includes(email || '')) {
        return res.status(403).send(`
          <html>
            <body style="background: #09090b; color: #ef4444; font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh;">
              <div style="text-align: center; max-width: 400px; padding: 20px; border: 1px solid #ef4444; border-radius: 12px; background: #7f1d1d10;">
                <h2 style="margin-bottom: 10px;">Acesso Negado</h2>
                <p style="color: #a1a1aa;">O acesso ao JESUS I.A. 360° é restrito aos administradores autorizados.</p>
                <p style="color: #a1a1aa; font-size: 14px; margin-top: 20px;">Você está logado como: ${email}</p>
                <a href="/" style="display: inline-block; margin-top: 20px; padding: 10px 20px; background: #ef4444; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">Voltar</a>
              </div>
            </body>
          </html>
        `);
      }

      (req as any).session.tokens = tokens;
      (req as any).session.user = {
        email: userInfo.data.email,
        name: userInfo.data.name,
        picture: userInfo.data.picture,
        id: userInfo.data.id
      };
      
      console.log('JARVIS: Sessão atualizada para:', email);
      
      const sessionPayload = Buffer.from(JSON.stringify({
        tokens,
        user: {
          email: userInfo.data.email,
          name: userInfo.data.name,
          picture: userInfo.data.picture,
          id: userInfo.data.id
        }
      })).toString('base64');
      
      res.send(`
        <html>
          <body style="background: #09090b; color: #10b981; font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh;">
            <div style="text-align: center;">
              <h2 style="margin-bottom: 10px;">Autenticação Concluída!</h2>
              <p style="color: #71717a;">Esta janela fechará automaticamente.</p>
              <script>
                if (window.opener) {
                  window.opener.postMessage({ 
                    type: 'OAUTH_AUTH_SUCCESS', 
                    token: '${sessionPayload}' 
                  }, '*');
                  window.close();
                } else {
                  window.location.href = '/';
                }
              </script>
            </div>
          </body>
        </html>
      `);
    } catch (error: any) {
      console.error('Error exchanging code for tokens:', error.message);
      if (error.response && error.response.data) {
        console.error('Detailed OAuth Error:', JSON.stringify(error.response.data, null, 2));
      }
      
      // Check for common issues
      const clientId = secrets.OAUTH_CLIENT_ID?.trim() || process.env.OAUTH_CLIENT_ID?.trim();
      if (clientId && clientId.includes(' ')) {
        console.warn('WARNING: OAUTH_CLIENT_ID contains spaces. This will cause invalid_client.');
      }
      const clientSecret = secrets.OAUTH_CLIENT_SECRET?.trim() || process.env.OAUTH_CLIENT_SECRET?.trim();
      if (clientSecret && clientSecret.includes(' ')) {
        console.warn('WARNING: OAUTH_CLIENT_SECRET contains spaces. This will cause invalid_client.');
      }

      res.status(500).send(`Authentication failed: ${error.message}. Check server logs for details.`);
    }
  });

  app.get("/api/auth/status", (req, res) => {
    const session = (req as any).session;
    const hasTokens = !!(session && session.tokens);
    const authHeader = req.headers.authorization;
    
    const debugInfo = {
      hasSession: !!session,
      hasTokens,
      userEmail: session?.user?.email,
      authHeaderPresent: !!authHeader,
      authHeaderLength: authHeader ? authHeader.length : 0
    };
    
    console.log('JARVIS: Verificando sessão no servidor:', debugInfo);
    
    res.json({ 
      isAuthenticated: hasTokens,
      user: session?.user || null,
      tokens: session?.tokens || null,
      debug: debugInfo
    });
  });

  app.post("/api/auth/logout", (req, res) => {
    (req as any).session = null;
    res.json({ success: true });
  });

  // --- SUPABASE BACKEND ENDPOINTS ---
  // Metadata
  app.get("/api/db/metadata", async (req, res) => {
    const client = getSupabase(req);
    if (!client) return res.status(500).json({ error: "Supabase not configured" });
    const { data, error } = await client.from('app_metadata').select('*');
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  app.get("/api/db/metadata/:key", async (req, res) => {
    const client = getSupabase(req);
    if (!client) return res.status(500).json({ error: "Supabase not configured" });
    const { data, error } = await client.from('app_metadata').select('value').eq('key', req.params.key).single();
    if (error) return res.status(404).json({ error: error.message });
    res.json(data);
  });

  app.post("/api/db/metadata", async (req, res) => {
    const client = getSupabase(req);
    if (!client) return res.status(500).json({ error: "Supabase not configured" });
    const { key, value } = req.body;
    const { error } = await client.from('app_metadata').upsert({ key, value: JSON.stringify(value) });
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  });

  app.delete("/api/db/metadata/:key", async (req, res) => {
    const client = getSupabase(req);
    if (!client) return res.status(500).json({ error: "Supabase not configured" });
    const { error } = await client.from('app_metadata').delete().eq('key', req.params.key);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  });

  // Memory & Sessions
  app.post("/api/db/memory", async (req, res) => {
    const client = getSupabase(req);
    if (!client) return res.status(500).json({ error: "Supabase not configured" });
    const entry = req.body;
    const dbEntry = {
      ...entry,
      session_id: entry.sessionId || entry.session_id
    };
    delete (dbEntry as any).sessionId;
    
    const { error } = await client.from('memory').insert(dbEntry);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  });

  app.post("/api/db/sessions", async (req, res) => {
    const client = getSupabase(req);
    if (!client) return res.status(500).json({ error: "Supabase not configured" });
    
    // Map camelCase to snake_case for Supabase
    const session = req.body;
    const dbSession: any = {
      id: session.id,
      uid: session.uid,
      title: session.title,
      tags: session.tags,
      created_at: session.createdAt || session.created_at,
      updated_at: session.updatedAt || session.updated_at,
      is_archived: session.isArchived || session.is_archived || false,
      archived_at: session.archivedAt || session.archived_at || null
    };

    // Only add is_pinned if it's explicitly provided, to avoid schema cache errors if column is missing
    if (session.isPinned !== undefined || session.is_pinned !== undefined) {
      dbSession.is_pinned = session.isPinned || session.is_pinned || false;
    }

    const { error } = await client.from('sessions').upsert(dbSession);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  });

  app.get("/api/db/sessions/:uid", async (req, res) => {
    const client = getSupabase(req);
    if (!client) return res.status(500).json({ error: "Supabase not configured" });
    
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    
    const { data, error } = await client.from('sessions')
      .select('*')
      .eq('uid', req.params.uid)
      .order('updated_at', { ascending: false })
      .range(offset, offset + limit - 1);
      
    if (error) return res.status(500).json({ error: error.message });
    
    // Map back to camelCase
    const mappedData = data.map((d: any) => ({
      ...d,
      createdAt: d.created_at,
      updatedAt: d.updated_at,
      isPinned: d.is_pinned,
      isArchived: d.is_archived,
      archivedAt: d.archived_at
    }));
    res.json(mappedData);
  });

  app.get("/api/db/memory/:sessionId", async (req, res) => {
    const client = getSupabase(req);
    if (!client) return res.status(500).json({ error: "Supabase not configured" });
    
    const limit = parseInt(req.query.limit as string) || 100;
    const offset = parseInt(req.query.offset as string) || 0;
    
    const { data, error } = await client.from('memory')
      .select('*')
      .eq('session_id', req.params.sessionId)
      .order('timestamp', { ascending: true })
      .range(offset, offset + limit - 1);
      
    if (error) return res.status(500).json({ error: error.message });
    
    // Map back to camelCase
    const mappedData = data.map((d: any) => ({
      ...d,
      sessionId: d.session_id
    }));
    res.json(mappedData);
  });

  app.get("/api/db/memory/all/:uid", async (req, res) => {
    const client = getSupabase(req);
    if (!client) return res.status(500).json({ error: "Supabase not configured" });
    
    const limit = parseInt(req.query.limit as string) || 100;
    const offset = parseInt(req.query.offset as string) || 0;
    
    let query = client.from('memory').select('*').eq('uid', req.params.uid).order('timestamp', { ascending: false });
    if (req.query.since) {
      query = query.gte('timestamp', parseInt(req.query.since as string));
    }
    
    const { data, error } = await query.range(offset, offset + limit - 1);
    if (error) return res.status(500).json({ error: error.message });
    
    // Map back to camelCase
    const mappedData = data.map((d: any) => ({
      ...d,
      sessionId: d.session_id
    }));
    res.json(mappedData);
  });

  app.delete("/api/db/sessions/:id", async (req, res) => {
    const client = getSupabase(req);
    if (!client) return res.status(500).json({ error: "Supabase not configured" });
    const { error } = await client.from('sessions').delete().eq('id', req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  });

  // Search History
  app.post("/api/db/search", async (req, res) => {
    const client = getSupabase(req);
    if (!client) return res.status(500).json({ error: "Supabase not configured" });
    const entry = req.body;
    const dbEntry = {
      id: entry.id,
      uid: entry.uid,
      query: entry.query,
      type: entry.type,
      results: entry.results,
      timestamp: entry.timestamp,
      tags: entry.tags,
      summary: entry.summary,
      session_id: entry.sessionId || entry.session_id
    };
    const { data, error } = await client.from('search_history').upsert(dbEntry).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  app.get("/api/db/search/:uid", async (req, res) => {
    const client = getSupabase(req);
    if (!client) return res.status(500).json({ error: "Supabase not configured" });
    
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    
    const { data, error } = await client.from('search_history')
      .select('*')
      .eq('uid', req.params.uid)
      .order('timestamp', { ascending: false })
      .range(offset, offset + limit - 1);
      
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  app.delete("/api/db/search/:id", async (req, res) => {
    const client = getSupabase(req);
    if (!client) return res.status(500).json({ error: "Supabase not configured" });
    const { error } = await client.from('search_history').delete().eq('id', req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  });

  // Youtube Metadata
  app.post("/api/db/youtube", async (req, res) => {
    const client = getSupabase(req);
    if (!client) return res.status(500).json({ error: "Supabase not configured" });
    const video = req.body;
    const dbVideo = {
      videoId: video.videoId,
      title: video.title,
      channel_title: video.channel_title,
      thumbnail: video.thumbnail,
      link: video.link,
      timestamp: video.timestamp,
      session_id: video.sessionId || video.session_id
    };
    const { error } = await client.from('youtube_videos').upsert(dbVideo);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  });

  app.get("/api/db/youtube/:uid", async (req, res) => {
    const client = getSupabase(req);
    if (!client) return res.status(500).json({ error: "Supabase not configured" });
    // youtube_videos doesn't have uid in the original code, so we just fetch all
    const { data, error } = await client.from('youtube_videos').select('*').order('timestamp', { ascending: false }).limit(20);
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  app.delete("/api/db/youtube/:videoId", async (req, res) => {
    const client = getSupabase(req);
    if (!client) return res.status(500).json({ error: "Supabase not configured" });
    const { error } = await client.from('youtube_videos').delete().eq('id', req.params.videoId);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  });

  // Background Tasks
  app.post("/api/db/tasks", async (req, res) => {
    const client = getSupabase(req);
    if (!client) return res.status(500).json({ error: "Supabase not configured" });
    const task = req.body;
    const dbTask = {
      id: task.id,
      uid: task.uid,
      title: task.title,
      progress: task.progress || 0,
      status: task.status || 'pending',
      acknowledged: task.acknowledged || false,
      created_at: task.createdAt || new Date().toISOString()
    };
    const { error } = await client.from('background_tasks').upsert(dbTask);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  });

  app.get("/api/db/tasks/:uid", async (req, res) => {
    const client = getSupabase(req);
    if (!client) return res.status(500).json({ error: "Supabase not configured" });
    const { data, error } = await client.from('background_tasks').select('*').eq('uid', req.params.uid).order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  app.patch("/api/db/tasks/:id", async (req, res) => {
    const client = getSupabase(req);
    if (!client) return res.status(500).json({ error: "Supabase not configured" });
    const { error } = await client.from('background_tasks').update(req.body).eq('id', req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  });

  app.delete("/api/db/tasks/:id", async (req, res) => {
    const client = getSupabase(req);
    if (!client) return res.status(500).json({ error: "Supabase not configured" });
    const { error } = await client.from('background_tasks').delete().eq('id', req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  });

  app.post("/api/db/cards", async (req, res) => {
    const client = getSupabase(req);
    if (!client) return res.status(500).json({ error: "Supabase not configured" });
    const card = req.body;
    const dbCard = {
      id: card.id,
      uid: card.uid,
      session_id: card.sessionId || card.session_id,
      type: card.type,
      title: card.title,
      content: card.content,
      timestamp: card.timestamp,
      color: card.color,
      is_collapsed: card.isCollapsed || card.is_collapsed || false,
      is_pinned: card.isPinned || card.is_pinned || false,
      is_archived: card.isArchived || card.is_archived || false,
      metadata: card.metadata || {}
    };
    const { error } = await client.from('cards').upsert(dbCard);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  });

  app.get("/api/db/cards/:uid", async (req, res) => {
    const client = getSupabase(req);
    if (!client) return res.status(500).json({ error: "Supabase not configured" });
    const { data, error } = await client.from('cards').select('*').eq('uid', req.params.uid).order('timestamp', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    
    // Map back to camelCase
    const mappedData = data.map((d: any) => ({
      ...d,
      sessionId: d.session_id,
      isCollapsed: d.is_collapsed,
      isPinned: d.is_pinned,
      isArchived: d.is_archived
    }));
    res.json(mappedData);
  });

  app.delete("/api/db/cards/:id", async (req, res) => {
    const client = getSupabase(req);
    if (!client) return res.status(500).json({ error: "Supabase not configured" });
    const { error } = await client.from('cards').delete().eq('id', req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  });

  // Bulk Sync Endpoint
  app.post("/api/db/sync", async (req, res) => {
    console.log('JARVIS Sync: Recebendo dados para sincronização...');
    const client = getSupabase(req);
    if (!client) {
      console.error('JARVIS Sync Error: Supabase not configured');
      return res.status(500).json({ error: "Supabase not configured" });
    }
    const { sessions, memory, searches, youtube, cards, maps, photos } = req.body;
    console.log('JARVIS Sync Payload:', {
      sessions: sessions?.length || 0,
      memory: memory?.length || 0,
      searches: searches?.length || 0,
      youtube: youtube?.length || 0,
      cards: cards?.length || 0,
      maps: maps?.length || 0,
      photos: photos?.length || 0
    });
    
    const results = {
      sessions: 0,
      memory: 0,
      searches: 0,
      youtube: 0,
      cards: 0,
      maps: 0,
      photos: 0,
      errors: [] as string[]
    };

    if (sessions && sessions.length > 0) {
      const dbSessions = sessions.map((s: any) => {
        const session: any = {
          id: s.id,
          uid: s.uid,
          title: s.title,
          tags: s.tags,
          created_at: s.createdAt || s.created_at,
          updated_at: s.updatedAt || s.updated_at,
          is_archived: s.isArchived || s.is_archived || false,
          archived_at: s.archivedAt || s.archived_at || null
        };
        if (s.isPinned !== undefined || s.is_pinned !== undefined) {
          session.is_pinned = s.isPinned || s.is_pinned || false;
        }
        return session;
      });
      const { error } = await client.from('sessions').upsert(dbSessions);
      if (error) results.errors.push(`Sessions: ${error.message}`);
      else results.sessions = sessions.length;
    }

    if (memory && memory.length > 0) {
      const dbMemory = memory.map((m: any) => ({
        ...m,
        session_id: m.sessionId || m.session_id
      })).map((m: any) => {
        const { sessionId, ...rest } = m;
        return rest;
      });
      const { error } = await client.from('memory').upsert(dbMemory);
      if (error) results.errors.push(`Memory: ${error.message}`);
      else results.memory = memory.length;
    }

    if (searches && searches.length > 0) {
      const dbSearches = searches.map((s: any) => ({
        id: s.id,
        uid: s.uid,
        query: s.query,
        type: s.type,
        results: s.results,
        timestamp: s.timestamp,
        tags: s.tags,
        summary: s.summary,
        session_id: s.sessionId || s.session_id
      }));
      const { error } = await client.from('search_history').upsert(dbSearches);
      if (error) results.errors.push(`Searches: ${error.message}`);
      else results.searches = searches.length;
    }

    if (youtube && youtube.length > 0) {
      const dbYoutube = youtube.map((v: any) => ({
        videoId: v.videoId || v.id,
        title: v.title,
        channel_title: v.channelTitle || v.channel_title,
        thumbnail: v.thumbnail,
        link: v.link,
        timestamp: v.timestamp,
        session_id: v.sessionId || v.session_id
      }));
      const { error } = await client.from('youtube_videos').upsert(dbYoutube);
      if (error) results.errors.push(`Youtube: ${error.message}`);
      else results.youtube = youtube.length;
    }

    if (cards && cards.length > 0) {
      const dbCards = cards.map((c: any) => ({
        id: c.id,
        uid: c.uid,
        session_id: c.sessionId || c.session_id,
        type: c.type,
        title: c.title,
        content: c.content,
        timestamp: c.timestamp,
        color: c.color,
        is_collapsed: c.isCollapsed || c.is_collapsed || false,
        is_pinned: c.isPinned || c.is_pinned || false,
        is_archived: c.isArchived || c.is_archived || false,
        metadata: c.metadata || {}
      }));
      const { error } = await client.from('cards').upsert(dbCards);
      if (error) results.errors.push(`Cards: ${error.message}`);
      else results.cards = cards.length;
    }

    if (maps && maps.length > 0) {
      const dbMaps = maps.map((m: any) => ({
        id: m.id,
        uid: m.uid,
        title: m.title,
        address: m.address,
        lat: m.lat,
        lng: m.lng,
        timestamp: m.timestamp,
        session_id: m.sessionId || m.session_id,
        metadata: m.metadata || {}
      }));
      const { error } = await client.from('maps').upsert(dbMaps);
      if (error) results.errors.push(`Maps: ${error.message}`);
      else results.maps = maps.length;
    }

    if (photos && photos.length > 0) {
      const dbPhotos = photos.map((p: any) => ({
        id: p.id,
        uid: p.uid,
        url: p.url,
        title: p.title,
        timestamp: p.timestamp,
        session_id: p.sessionId || p.session_id,
        metadata: p.metadata || {}
      }));
      const { error } = await client.from('photos').upsert(dbPhotos);
      if (error) results.errors.push(`Photos: ${error.message}`);
      else results.photos = photos.length;
    }

    if (results.errors.length > 0) {
      console.error('JARVIS Sync Errors:', results.errors);
    }
    console.log('JARVIS Sync Results:', results);
    res.json(results);
  });

  // Generic Save Endpoint for individual items
  app.post("/api/db/generic_save", async (req, res) => {
    const client = getSupabase(req);
    if (!client) return res.status(500).json({ error: "Supabase not configured" });
    const { type, data, uid, id, timestamp } = req.body;
    
    try {
      let table = '';
      let dbData: any = { ...data, uid, id, timestamp };

      switch (type) {
        case 'memory': table = 'memory'; break;
        case 'sessions': table = 'sessions'; break;
        case 'cards': table = 'cards'; break;
        case 'searches': table = 'search_history'; break;
        default: table = 'app_metadata'; break;
      }

      const { error } = await client.from(table).upsert(dbData);
      if (error) throw error;
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Bulk Sync Endpoint for cache transfer
  app.post("/api/db/bulk_sync", async (req, res) => {
    const client = getSupabase(req);
    if (!client) return res.status(500).json({ error: "Supabase not configured" });
    const { entries } = req.body;
    
    if (!entries || !Array.isArray(entries)) {
      return res.status(400).json({ error: "Invalid entries" });
    }

    try {
      const results = [];
      for (const entry of entries) {
        let table = '';
        switch (entry.type) {
          case 'memory': table = 'memory'; break;
          case 'sessions': table = 'sessions'; break;
          case 'cards': table = 'cards'; break;
          case 'searches': table = 'search_history'; break;
          default: table = 'app_metadata'; break;
        }
        const { error } = await client.from(table).upsert({ ...entry.data, uid: entry.uid, id: entry.id, timestamp: entry.timestamp });
        if (error) console.error(`Error syncing entry ${entry.id}:`, error.message);
        else results.push(entry.id);
      }
      res.json({ success: true, syncedCount: results.length });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Export All Data Endpoint
  app.get("/api/db/export_all/:uid", async (req, res) => {
    const client = getSupabase(req);
    if (!client) return res.status(500).json({ error: "Supabase not configured" });
    const uid = req.params.uid;

    try {
      const [sessions, memory, searches, cards, tasks, maps, photos] = await Promise.all([
        client.from('sessions').select('*').eq('uid', uid),
        client.from('memory').select('*').eq('uid', uid),
        client.from('search_history').select('*').eq('uid', uid),
        client.from('cards').select('*').eq('uid', uid),
        client.from('background_tasks').select('*').eq('uid', uid),
        client.from('maps').select('*').eq('uid', uid),
        client.from('photos').select('*').eq('uid', uid)
      ]);

      res.json({
        uid,
        exportedAt: new Date().toISOString(),
        data: {
          sessions: sessions.data || [],
          memory: memory.data || [],
          searches: searches.data || [],
          cards: cards.data || [],
          tasks: tasks.data || [],
          maps: maps.data || [],
          photos: photos.data || []
        }
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Workspace Sync Endpoint
  app.post("/api/workspace/sync", async (req, res) => {
    const { uid } = req.body;
    const auth = getAuth(req);
    if (!auth) return res.status(401).json({ error: "Unauthorized" });

    try {
      // Trigger Google Sync logic (already exists in /api/db/google-sync)
      // We'll just reuse that logic or call it
      const client = getSupabase(req);
      if (!client) return res.status(500).json({ error: "Supabase not configured" });

      // Fetch Tasks, Calendar, Drive, Gmail (simplified reuse)
      const tasksApi = google.tasks({ version: 'v1', auth });
      const calendarApi = google.calendar({ version: 'v3', auth });
      const driveApi = google.drive({ version: 'v3', auth });
      
      const [tasks, events, files] = await Promise.all([
        tasksApi.tasks.list({ tasklist: '@default', maxResults: 10 }).catch(() => ({ data: { items: [] } })),
        calendarApi.events.list({ calendarId: 'primary', timeMin: new Date().toISOString(), maxResults: 10 }).catch(() => ({ data: { items: [] } })),
        driveApi.files.list({ pageSize: 10, fields: 'files(id, name, webViewLink)' }).catch(() => ({ data: { files: [] } }))
      ]);

      const syncResult = {
        tasks: tasks.data.items || [],
        events: events.data.items || [],
        files: files.data.files || []
      };

      // Save to Supabase
      await client.from('app_metadata').upsert({ 
        key: `workspace_sync_${uid}`, 
        value: JSON.stringify(syncResult) 
      });

      res.json({ success: true, ...syncResult });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/db/photos-sync", async (req, res) => {
    try {
      const auth = getAuth(req);
      const { token } = await auth.getAccessToken();
      const uid = req.body.uid;
      if (!uid) return res.status(400).json({ error: "UID is required" });

      const client = getSupabase(req);
      if (!client) return res.status(500).json({ error: "Supabase not configured" });

      // Calculate date 2 months ago
      const twoMonthsAgo = new Date();
      twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
      
      const startDate = {
        year: twoMonthsAgo.getFullYear(),
        month: twoMonthsAgo.getMonth() + 1,
        day: twoMonthsAgo.getDate()
      };
      
      const now = new Date();
      const endDate = {
        year: now.getFullYear(),
        month: now.getMonth() + 1,
        day: now.getDate()
      };

      const response = await fetch('https://photoslibrary.googleapis.com/v1/mediaItems:search', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          pageSize: 100,
          filters: {
            dateFilter: {
              ranges: [{ startDate, endDate }]
            }
          }
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error?.message || 'Erro ao buscar fotos do Google Photos');
      }

      const items = data.mediaItems || [];
      
      // Fetch existing photos to preserve custom titles and tags
      const { data: existingPhotos } = await client.from('photos').select('id, title, metadata').eq('uid', uid);
      const existingPhotosMap = new Map(existingPhotos?.map((p: any) => [p.id, p]) || []);

      const dbPhotos = items.map((item: any) => {
        const existing = existingPhotosMap.get(item.id);
        
        return {
          id: item.id,
          uid: uid,
          url: `${item.baseUrl}=w1024`, // Default reasonable size
          title: existing?.title || item.filename || item.description || 'Sem título',
          timestamp: new Date(item.mediaMetadata?.creationTime || new Date()).getTime(),
          metadata: {
            mimeType: item.mimeType,
            mediaMetadata: item.mediaMetadata,
            baseUrl: item.baseUrl,
            tags: existing?.metadata?.tags || []
          }
        };
      });

      if (dbPhotos.length > 0) {
        const { error } = await client.from('photos').upsert(dbPhotos);
        if (error) throw error;
      }

      res.json({ success: true, photos: dbPhotos });
    } catch (error: any) {
      console.error('Photos Sync Error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post("/api/db/google-sync", async (req, res) => {
    try {
      const auth = getAuth(req);
      const uid = req.body.uid;
      if (!uid) return res.status(400).json({ error: "UID is required" });

      const client = getSupabase(req);
      if (!client) return res.status(500).json({ error: "Supabase not configured" });

      // 1. Fetch Tasks
      const tasksApi = google.tasks({ version: 'v1', auth });
      const tasksRes = await tasksApi.tasks.list({ tasklist: '@default', maxResults: 20, showCompleted: false }).catch(() => ({ data: { items: [] } }));
      const tasks = tasksRes.data.items || [];

      // 2. Fetch Calendar Events
      const calendarApi = google.calendar({ version: 'v3', auth });
      const now = new Date();
      const calRes = await calendarApi.events.list({
        calendarId: 'primary',
        timeMin: now.toISOString(),
        maxResults: 20,
        singleEvents: true,
        orderBy: 'startTime',
      }).catch(() => ({ data: { items: [] } }));
      const events = calRes.data.items || [];

      // 3. Fetch Drive Files
      const driveApi = google.drive({ version: 'v3', auth });
      const driveRes = await driveApi.files.list({
        pageSize: 20,
        fields: 'nextPageToken, files(id, name, mimeType, modifiedTime, webViewLink)',
        orderBy: 'modifiedTime desc'
      }).catch(() => ({ data: { files: [] } }));
      const files = driveRes.data.files || [];

      // 4. Fetch Gmail Messages
      const gmailApi = google.gmail({ version: 'v1', auth });
      const gmailRes = await gmailApi.users.messages.list({ userId: 'me', maxResults: 10 }).catch(() => ({ data: { messages: [] } }));
      const gmailMessages = gmailRes.data.messages || [];
      const gmail = await Promise.all(gmailMessages.map(async (m: any) => {
        const msg = await gmailApi.users.messages.get({ userId: 'me', id: m.id }).catch(() => null);
        if (!msg) return null;
        const headers = msg.data.payload?.headers || [];
        return {
          id: m.id,
          threadId: m.threadId,
          from: headers.find((h: any) => h.name === 'From')?.value || 'Desconhecido',
          subject: headers.find((h: any) => h.name === 'Subject')?.value || '(Sem assunto)',
          snippet: msg.data.snippet,
          date: headers.find((h: any) => h.name === 'Date')?.value || '',
          labelIds: msg.data.labelIds
        };
      })).then(msgs => msgs.filter(m => m !== null));

      // Save to Supabase
      await Promise.all([
        client.from('app_metadata').upsert({ key: `google_tasks_${uid}`, value: JSON.stringify(tasks) }),
        client.from('app_metadata').upsert({ key: `google_calendar_${uid}`, value: JSON.stringify(events) }),
        client.from('app_metadata').upsert({ key: `google_drive_${uid}`, value: JSON.stringify(files) }),
        client.from('app_metadata').upsert({ key: `google_gmail_${uid}`, value: JSON.stringify(gmail) })
      ]);

      res.json({ success: true, tasks, events, files, gmail });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get("/api/db/google-sync/:uid", async (req, res) => {
    try {
      const uid = req.params.uid;
      const client = getSupabase(req);
      if (!client) return res.status(500).json({ error: "Supabase not configured" });

      const [tasksRes, eventsRes, filesRes, gmailRes] = await Promise.all([
        client.from('app_metadata').select('value').eq('key', `google_tasks_${uid}`).single(),
        client.from('app_metadata').select('value').eq('key', `google_calendar_${uid}`).single(),
        client.from('app_metadata').select('value').eq('key', `google_drive_${uid}`).single(),
        client.from('app_metadata').select('value').eq('key', `google_gmail_${uid}`).single()
      ]);

      res.json({
        success: true,
        tasks: tasksRes.data ? JSON.parse(tasksRes.data.value) : [],
        events: eventsRes.data ? JSON.parse(eventsRes.data.value) : [],
        files: filesRes.data ? JSON.parse(filesRes.data.value) : [],
        gmail: gmailRes.data ? JSON.parse(gmailRes.data.value) : []
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Maps and Photos Sync Endpoints
  app.post("/api/db/maps", async (req, res) => {
    try {
      const client = getSupabase(req);
      if (!client) return res.status(500).json({ error: "Supabase not configured" });
      const { uid, maps } = req.body;
      if (!uid) return res.status(400).json({ error: "UID is required" });
      
      if (Array.isArray(maps)) {
        const dbMaps = maps.map((m: any) => ({
          id: m.id,
          uid,
          title: m.title,
          address: m.address,
          lat: m.lat,
          lng: m.lng,
          timestamp: m.timestamp,
          session_id: m.sessionId || m.session_id,
          metadata: m.metadata || {}
        }));
        const { error } = await client.from('maps').upsert(dbMaps);
        if (error) throw error;
      }
      
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get("/api/db/maps/:uid", async (req, res) => {
    try {
      const uid = req.params.uid;
      const client = getSupabase(req);
      if (!client) return res.status(500).json({ error: "Supabase not configured" });
      const { data, error } = await client.from('maps').select('*').eq('uid', uid).order('timestamp', { ascending: false });
      if (error) throw error;
      
      const mappedData = data.map((d: any) => ({
        ...d,
        sessionId: d.session_id
      }));
      
      res.json({ success: true, maps: mappedData });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post("/api/db/photos", async (req, res) => {
    try {
      const client = getSupabase(req);
      if (!client) return res.status(500).json({ error: "Supabase not configured" });
      const { uid, photos } = req.body;
      if (!uid) return res.status(400).json({ error: "UID is required" });
      
      if (Array.isArray(photos)) {
        const dbPhotos = photos.map((p: any) => ({
          id: p.id,
          uid,
          url: p.url,
          title: p.title,
          timestamp: p.timestamp,
          session_id: p.sessionId || p.session_id,
          metadata: p.metadata || {}
        }));
        const { error } = await client.from('photos').upsert(dbPhotos);
        if (error) throw error;
      }
      
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get("/api/db/photos/:uid", async (req, res) => {
    try {
      const uid = req.params.uid;
      const client = getSupabase(req);
      if (!client) return res.status(500).json({ error: "Supabase not configured" });
      const { data, error } = await client.from('photos').select('*').eq('uid', uid).order('timestamp', { ascending: false });
      if (error) throw error;

      const mappedData = data.map((d: any) => ({
        ...d,
        sessionId: d.session_id
      }));

      res.json({ success: true, photos: mappedData });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Google Workspace Tool Endpoints
  const getAuth = (req: any) => {
    const tokens = req.session.tokens;
    if (!tokens) throw new Error("Not authenticated");
    const client = getOAuth2Client();
    if (!client) throw new Error("OAuth configuration missing");
    client.setCredentials(tokens);
    return client;
  };

  app.post("/api/tools/gmail/list", async (req, res) => {
    try {
      const auth = getAuth(req);
      const gmail = google.gmail({ version: 'v1', auth });
      const { maxResults = 10, query = '' } = req.body;
      
      const response = await gmail.users.messages.list({
        userId: 'me',
        maxResults,
        q: query,
      });
      
      const messages = [];
      if (response.data.messages) {
        for (const msg of response.data.messages) {
          const detail = await gmail.users.messages.get({
            userId: 'me',
            id: msg.id!,
            format: 'metadata',
            metadataHeaders: ['Subject', 'From', 'Date', 'Authentication-Results', 'Received', 'SPF', 'DKIM', 'DMARC']
          });
          messages.push({
            id: msg.id,
            snippet: detail.data.snippet,
            subject: detail.data.payload?.headers?.find(h => h.name === 'Subject')?.value,
            from: detail.data.payload?.headers?.find(h => h.name === 'From')?.value,
            date: detail.data.payload?.headers?.find(h => h.name === 'Date')?.value,
            authResults: detail.data.payload?.headers?.find(h => h.name === 'Authentication-Results')?.value,
            spf: detail.data.payload?.headers?.find(h => h.name === 'SPF')?.value,
            dkim: detail.data.payload?.headers?.find(h => h.name === 'DKIM')?.value,
            dmarc: detail.data.payload?.headers?.find(h => h.name === 'DMARC')?.value,
          });
        }
      }
      res.json({ success: true, messages });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post("/api/tools/gmail/get", async (req, res) => {
    try {
      const auth = getAuth(req);
      const gmail = google.gmail({ version: 'v1', auth });
      const { messageId } = req.body;
      
      const response = await gmail.users.messages.get({
        userId: 'me',
        id: messageId,
      });
      
      res.json({ success: true, message: response.data });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post("/api/tools/calendar/list", async (req, res) => {
    try {
      const auth = getAuth(req);
      const calendar = google.calendar({ version: 'v3', auth });
      const { maxResults = 10, timeMin, timeMax } = req.body;
      
      const response = await calendar.events.list({
        calendarId: 'primary',
        timeMin: timeMin || new Date().toISOString(),
        timeMax: timeMax,
        maxResults,
        singleEvents: true,
        orderBy: 'startTime',
      });
      res.json({ success: true, events: response.data.items });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post("/api/tools/tasks/list", async (req, res) => {
    try {
      const auth = getAuth(req);
      const tasks = google.tasks({ version: 'v1', auth });
      const { maxResults = 10 } = req.body;
      
      const response = await tasks.tasks.list({
        tasklist: '@default',
        maxResults,
        showCompleted: false,
      });
      res.json({ success: true, tasks: response.data.items });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post("/api/tools/tasks/create", async (req, res) => {
    try {
      const auth = getAuth(req);
      const tasks = google.tasks({ version: 'v1', auth });
      const { title, notes, due } = req.body;
      
      await tasks.tasks.insert({
        tasklist: '@default',
        requestBody: {
          title,
          notes,
          due,
        },
      });
      res.json({ success: true, message: "Tarefa criada no Google Tasks dedicado." });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post("/api/tools/tasks/update", async (req, res) => {
    try {
      const auth = getAuth(req);
      const tasks = google.tasks({ version: 'v1', auth });
      const { taskId, title, notes, due, status } = req.body;
      
      await tasks.tasks.patch({
        tasklist: '@default',
        task: taskId,
        requestBody: {
          title,
          notes,
          due,
          status,
        },
      });
      res.json({ success: true, message: "Tarefa atualizada com sucesso." });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post("/api/tools/tasks/delete", async (req, res) => {
    try {
      const auth = getAuth(req);
      const tasks = google.tasks({ version: 'v1', auth });
      const { taskId } = req.body;
      
      if (!taskId) {
        return res.status(400).json({ success: false, error: "taskId is required" });
      }

      console.log(`JARVIS: Excluindo tarefa: ${taskId}`);
      
      await tasks.tasks.delete({
        tasklist: '@default',
        task: taskId,
      });
      res.json({ success: true, message: "Tarefa excluída com sucesso." });
    } catch (error: any) {
      console.error("JARVIS: Erro ao excluir tarefa:", error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post("/api/tools/gmail/send", async (req, res) => {
    try {
      const auth = getAuth(req);
      const gmail = google.gmail({ version: 'v1', auth });
      const { to, subject, body } = req.body;
      
      const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`;
      const messageParts = [
        `From: <${(req as any).session.email || 'me'}>`,
        `To: ${to}`,
        `Content-Type: text/html; charset=utf-8`,
        `MIME-Version: 1.0`,
        `Subject: ${utf8Subject}`,
        '',
        body,
      ];
      const message = messageParts.join('\n');
      const encodedMessage = Buffer.from(message)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      await gmail.users.messages.send({
        userId: 'me',
        requestBody: { raw: encodedMessage },
      });
      res.json({ success: true, message: "E-mail enviado com sucesso." });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post("/api/tools/calendar/create", async (req, res) => {
    try {
      const auth = getAuth(req);
      const calendar = google.calendar({ version: 'v3', auth });
      const { summary, description, startTime, endTime } = req.body;
      
      await calendar.events.insert({
        calendarId: 'primary',
        requestBody: {
          summary,
          description,
          start: { dateTime: startTime },
          end: { dateTime: endTime },
        },
      });
      res.json({ success: true, message: "Evento criado no calendário." });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post("/api/tools/calendar/update", async (req, res) => {
    try {
      const auth = getAuth(req);
      const calendar = google.calendar({ version: 'v3', auth });
      const { eventId, summary, description, startTime, endTime } = req.body;
      
      await calendar.events.patch({
        calendarId: 'primary',
        eventId: eventId,
        requestBody: {
          summary,
          description,
          start: startTime ? { dateTime: startTime } : undefined,
          end: endTime ? { dateTime: endTime } : undefined,
        },
      });
      res.json({ success: true, message: "Evento atualizado com sucesso." });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post("/api/tools/calendar/delete", async (req, res) => {
    try {
      const auth = getAuth(req);
      const calendar = google.calendar({ version: 'v3', auth });
      const { eventId } = req.body;
      
      if (!eventId) {
        return res.status(400).json({ success: false, error: "eventId is required" });
      }

      console.log(`JARVIS: Excluindo evento do calendário: ${eventId}`);
      
      await calendar.events.delete({
        calendarId: 'primary',
        eventId: eventId,
      });
      res.json({ success: true, message: "Evento excluído com sucesso." });
    } catch (error: any) {
      console.error("JARVIS: Erro ao excluir evento:", error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post("/api/tools/drive/search", async (req, res) => {
    try {
      const auth = getAuth(req);
      const drive = google.drive({ version: 'v3', auth });
      const { query, deepSearch } = req.body;
      
      // 1. Extract semantic cores (núcleos semânticos) for fuzzy logic
      const stopWords = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'ou', 'com', 'sem', 'para', 'por', 'um', 'uma', 'o', 'a', 'os', 'as', 'em', 'no', 'na', 'nos', 'nas', 'que', 'se', 'como', 'mais', 'mas', 'ao', 'aos']);
      
      const words = query.toLowerCase()
        .replace(/[^\w\sÀ-ÿ-]/g, ' ') // Keep hyphens for words like ex-conteudista
        .split(/\s+/)
        .filter((w: string) => w.length > 2 && !stopWords.has(w))
        .slice(0, 5); // Limit to 5 cores to avoid API complexity limits
      
      let q = '';

      // Google Drive API 'contains' operator is very strict.
      // If we have parsed words, use them. Otherwise fallback to the raw query.
      if (words.length > 0) {
        // For fullText, we can just join words with spaces and let Google handle the semantic search
        // e.g. fullText contains 'iclea titularidade'
        const combinedWords = words.join(' ');
        
        // For name, we can check if the exact phrase is in the name, or if individual words are
        const nameConditions = words.map((w: string) => `name contains '${w}'`).join(' and ');
        
        q = `fullText contains '${combinedWords}' or (${nameConditions})`;
        
        if (deepSearch) {
           q = `(${q}) or description contains '${combinedWords}'`;
        }
      } else {
        // Fallback for very short queries or queries that were entirely stop words
        // Remove single quotes to prevent syntax errors
        const safeQuery = query.replace(/'/g, "\\'");
        q = `name contains '${safeQuery}' or fullText contains '${safeQuery}'`;
        if (deepSearch) {
          q = `(${q}) or description contains '${safeQuery}'`;
        }
      }

      const response = await drive.files.list({
        q,
        fields: 'files(id, name, webViewLink, mimeType, iconLink, createdTime, modifiedTime, parents)',
        pageSize: deepSearch ? 100 : 50, // Increased page size to return an extensive list
        orderBy: 'modifiedTime desc'
      });
      
      const files = response.data.files || [];
      
      // Fetch folder names for the parent IDs
      const parentIds = new Set<string>();
      files.forEach(f => {
        if (f.parents && f.parents.length > 0) {
          parentIds.add(f.parents[0]);
        }
      });

      const folderMap: Record<string, string> = {};
      if (parentIds.size > 0) {
        const folderIds = Array.from(parentIds);
        // Chunk to avoid URL length limits
        const chunks = [];
        for (let i = 0; i < folderIds.length; i += 20) {
          chunks.push(folderIds.slice(i, i + 20));
        }

        for (const chunk of chunks) {
          const folderQuery = chunk.map(id => `id = '${id}'`).join(' or ');
          try {
            const folderRes = await drive.files.list({
              q: `(${folderQuery}) and mimeType = 'application/vnd.google-apps.folder'`,
              fields: 'files(id, name)'
            });
            folderRes.data.files?.forEach(f => {
              if (f.id && f.name) folderMap[f.id] = f.name;
            });
          } catch (e) {
            console.error("Error fetching folder names", e);
          }
        }
      }

      const enrichedFiles = files.map(f => {
        const fileName = (f.name || '').toLowerCase();
        const queryLower = query.toLowerCase();
        
        // Simple similarity scoring
        let score = 0;
        const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2);
        const matches = queryWords.filter(w => fileName.includes(w));
        
        if (fileName.includes(queryLower)) {
          score = 100; // Exact phrase match in name
        } else if (matches.length === queryWords.length && queryWords.length > 0) {
          score = 90; // All words match in name
        } else if (matches.length > 0) {
          score = 40 + (matches.length / queryWords.length) * 40; // Partial word match in name
        } else {
          score = 20; // Only found via fullText
        }

        // Semantic boost for document types based on query context
        const isJuridicalQuery = queryLower.includes('petição') || queryLower.includes('inquérito') || queryLower.includes('jurídico') || queryLower.includes('processo');
        if (isJuridicalQuery) {
          if (f.mimeType?.includes('pdf') || f.mimeType?.includes('document')) {
            score += 10; // Boost documents/PDFs for juridical queries
          }
        }

        let color = 'red';
        if (score >= 85) color = 'green';
        else if (score >= 50) color = 'yellow';

        return {
          ...f,
          folderName: (f.parents && f.parents.length > 0) ? (folderMap[f.parents[0]] || 'Pasta Desconhecida') : 'Raiz',
          similarityScore: score,
          similarityColor: color
        };
      });

      // Sort by similarity score
      enrichedFiles.sort((a, b) => (b.similarityScore || 0) - (a.similarityScore || 0));

      res.json({ success: true, files: enrichedFiles });
    } catch (error: any) {
      console.error("Drive Search Error:", error.message, "Query was:", req.body.query);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post("/api/tools/drive/upload", async (req, res) => {
    try {
      const auth = getAuth(req);
      const drive = google.drive({ version: 'v3', auth });
      const { name, mimeType, content, parentId } = req.body;
      
      const fileMetadata: any = { name };
      if (parentId) fileMetadata.parents = [parentId];
      
      const media = {
        mimeType: mimeType || 'text/plain',
        body: content
      };

      const file = await drive.files.create({
        requestBody: fileMetadata,
        media: media,
        fields: 'id, name, webViewLink'
      });
      
      res.json({ success: true, file: file.data });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post("/api/tools/drive/download", async (req, res) => {
    try {
      const auth = getAuth(req);
      const drive = google.drive({ version: 'v3', auth });
      const { fileId } = req.body;
      
      const file = await drive.files.get({
        fileId: fileId,
        alt: 'media'
      }, { responseType: 'text' });
      
      res.json({ success: true, content: file.data });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post("/api/tools/drive/share", async (req, res) => {
    try {
      const auth = getAuth(req);
      const drive = google.drive({ version: 'v3', auth });
      const { fileId, role, type, emailAddress } = req.body;
      
      const permission: any = { role, type };
      if (emailAddress) permission.emailAddress = emailAddress;

      const result = await drive.permissions.create({
        fileId: fileId,
        requestBody: permission,
        fields: 'id'
      });
      
      res.json({ success: true, permissionId: result.data.id });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post("/api/tools/drive/labels/list", async (req, res) => {
    try {
      const auth = getAuth(req);
      const drivelabels = google.drivelabels({ version: 'v2', auth });
      
      const result = await drivelabels.labels.list({
        view: 'LABEL_VIEW_FULL'
      });
      
      res.json({ success: true, labels: result.data.labels });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post("/api/tools/drive/labels/apply", async (req, res) => {
    try {
      const auth = getAuth(req);
      const drive = google.drive({ version: 'v3', auth });
      const { fileId, labelId } = req.body;
      
      // Drive Labels API applies labels via the Drive API's modifyLabels method
      const result = await drive.files.modifyLabels({
        fileId: fileId,
        requestBody: {
          labelModifications: [
            {
              labelId: labelId,
              kind: 'drive#labelModification'
            }
          ]
        }
      });
      
      res.json({ success: true, modifiedLabels: result.data.modifiedLabels });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
  app.post("/api/tools/drive/create_folder", async (req, res) => {
    try {
      const auth = getAuth(req);
      const drive = google.drive({ version: 'v3', auth });
      const { name, parentId } = req.body;
      
      const fileMetadata = {
        name,
        mimeType: 'application/vnd.google-apps.folder',
        parents: parentId ? [parentId] : undefined
      };
      
      const file = await drive.files.create({
        requestBody: fileMetadata,
        fields: 'id, name, webViewLink',
      });
      res.json({ success: true, folder: file.data });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post("/api/tools/drive/update", async (req, res) => {
    try {
      const auth = getAuth(req);
      const drive = google.drive({ version: 'v3', auth });
      const { fileId, name } = req.body;
      
      await drive.files.update({
        fileId: fileId,
        requestBody: {
          name,
        },
      });
      res.json({ success: true, message: "Arquivo atualizado com sucesso." });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post("/api/tools/drive/delete", async (req, res) => {
    try {
      const auth = getAuth(req);
      const drive = google.drive({ version: 'v3', auth });
      const { fileId } = req.body;
      
      if (!fileId) {
        return res.status(400).json({ success: false, error: "fileId is required" });
      }

      console.log(`JARVIS: Excluindo arquivo do Drive: ${fileId}`);
      
      await drive.files.delete({
        fileId: fileId,
      });
      res.json({ success: true, message: "Arquivo excluído com sucesso." });
    } catch (error: any) {
      console.error("JARVIS: Erro ao excluir arquivo:", error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post("/api/tools/photos/search", async (req, res) => {
    try {
      const auth = getAuth(req);
      const { token } = await auth.getAccessToken();
      const { query, category, dateRange } = req.body;

      // Google Photos API doesn't have a direct "text search" like Drive.
      // We use filters for categories or dates.
      // For general text search, we might have to list and filter client-side or use contentFilter.
      
      const filters: any = {};
      if (category) {
        filters.contentFilter = {
          includedContentCategories: [category.toUpperCase()]
        };
      }
      
      if (dateRange) {
        filters.dateFilter = {
          ranges: [{
            startDate: dateRange.start,
            endDate: dateRange.end
          }]
        };
      }

      const response = await fetch('https://photoslibrary.googleapis.com/v1/mediaItems:search', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          pageSize: 50,
          filters: Object.keys(filters).length > 0 ? filters : undefined
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error?.message || 'Erro ao buscar fotos');
      }

      // If there's a text query, we filter by filename or description manually since API is limited
      let items = data.mediaItems || [];
      if (query) {
        const lowerQuery = query.toLowerCase();
        items = items.filter((item: any) => 
          (item.filename && item.filename.toLowerCase().includes(lowerQuery)) ||
          (item.description && item.description.toLowerCase().includes(lowerQuery))
        );
      }

      res.json({ success: true, photos: items });
    } catch (error: any) {
      console.error('Photos Search Error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post("/api/tools/photos/imagezer", async (req, res) => {
    try {
      const { imageUrl, prompt } = req.body;
      if (!imageUrl) return res.status(400).json({ error: "Image URL is required" });

      // Fetch the image to get base64
      const imageResponse = await fetch(imageUrl);
      const arrayBuffer = await imageResponse.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const base64Image = buffer.toString('base64');
      const mimeType = imageResponse.headers.get('content-type') || 'image/jpeg';

      const { GoogleGenAI } = require('@google/genai');
      const ai = new GoogleGenAI({ apiKey: secrets.GEMINI_API_KEY || process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: {
          parts: [
            {
              inlineData: {
                data: base64Image,
                mimeType: mimeType,
              },
            },
            {
              text: prompt || "Analise esta imagem e forneça: 1. Um título curto e descritivo. 2. Uma lista de 3 a 5 tags ou categorias relevantes (ex: 'natureza', 'trabalho', 'família'). Retorne APENAS um JSON no formato: {\"title\": \"...\", \"tags\": [\"...\", \"...\"]}",
            },
          ],
        },
        config: {
          responseMimeType: "application/json",
        }
      });

      const resultText = response.text || "{}";
      const result = JSON.parse(resultText);

      res.json({ success: true, result });
    } catch (error: any) {
      console.error('Imagezer Error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post("/api/tools/photos/delete", async (req, res) => {
    try {
      const auth = getAuth(req);
      const { token } = await auth.getAccessToken();
      const { mediaItemId } = req.body;

      // Note: batchDelete only works for items created by the app.
      // General deletion is not supported by the Library API.
      const response = await fetch('https://photoslibrary.googleapis.com/v1/mediaItems:batchDelete', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          mediaItemIds: [mediaItemId]
        })
      });

      if (response.status === 403) {
        return res.status(403).json({ 
          success: false, 
          error: "A API do Google Fotos só permite excluir fotos que foram criadas por este aplicativo. Fotos gerais da sua galeria não podem ser excluídas via API por segurança." 
        });
      }

      const data = await response.json();
      res.json({ success: true, data });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post("/api/db/upload", multer({ storage: multer.memoryStorage() }).single('file'), async (req, res) => {
    const client = getSupabase(req);
    if (!client) return res.status(500).json({ error: "Supabase not configured" });
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const file = req.file;
    const fileName = `${Date.now()}-${file.originalname}`;
    const filePath = `uploads/${fileName}`;

    try {
      const { data, error } = await client.storage
        .from('uploads')
        .upload(filePath, file.buffer, {
          contentType: file.mimetype,
          upsert: false
        });

      if (error) throw error;

      const { data: { publicUrl } } = client.storage
        .from('uploads')
        .getPublicUrl(filePath);

      res.json({ 
        success: true, 
        url: publicUrl,
        path: filePath,
        name: file.originalname,
        size: file.size,
        type: file.mimetype
      });
    } catch (error: any) {
      console.error('JARVIS: Erro no upload para Supabase Storage:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // JARVIS 360 Database Sync Endpoints
  app.post("/api/tools/drive/db/init", async (req, res) => {
    try {
      const auth = getAuth(req);
      const drive = google.drive({ version: 'v3', auth });
      
      // 1. Find or create Jarvis 360 folder
      let folderId: string;
      const folderRes = await drive.files.list({
        q: "name = 'Jarvis 360' and mimeType = 'application/vnd.google-apps.folder' and trashed = false",
        fields: 'files(id)',
        pageSize: 1
      });
      
      if (folderRes.data.files && folderRes.data.files.length > 0) {
        folderId = folderRes.data.files[0].id!;
      } else {
        const folderMetadata = {
          name: 'Jarvis 360',
          mimeType: 'application/vnd.google-apps.folder'
        };
        const folder = await drive.files.create({
          requestBody: folderMetadata,
          fields: 'id'
        });
        folderId = folder.data.id!;
      }

      // 2. Find or create Jarvis 360.db inside that folder
      let fileId: string;
      const fileRes = await drive.files.list({
        q: `name = 'Jarvis 360.db' and '${folderId}' in parents and trashed = false`,
        fields: 'files(id)',
        pageSize: 1
      });

      if (fileRes.data.files && fileRes.data.files.length > 0) {
        fileId = fileRes.data.files[0].id!;
      } else {
        // Create an empty file first
        const fileMetadata = {
          name: 'Jarvis 360.db',
          parents: [folderId]
        };
        const file = await drive.files.create({
          requestBody: fileMetadata,
          fields: 'id'
        });
        fileId = file.data.id!;
      }

      res.json({ success: true, folderId, fileId });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get("/api/tools/drive/db/download/:fileId", async (req, res) => {
    try {
      const auth = getAuth(req);
      const drive = google.drive({ version: 'v3', auth });
      const { fileId } = req.params;

      const response = await drive.files.get(
        { fileId, alt: 'media' },
        { responseType: 'arraybuffer' }
      );

      res.set('Content-Type', 'application/x-sqlite3');
      res.send(Buffer.from(response.data as ArrayBuffer));
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post("/api/tools/drive/db/upload", express.json({ limit: '50mb' }), async (req, res) => {
    try {
      const auth = getAuth(req);
      const drive = google.drive({ version: 'v3', auth });
      const { fileId, base64Data } = req.body;

      if (!fileId || !base64Data) {
        return res.status(400).json({ success: false, error: "Missing fileId or base64Data" });
      }

      const buffer = Buffer.from(base64Data, 'base64');
      
      await drive.files.update({
        fileId,
        media: {
          mimeType: 'application/x-sqlite3',
          body: buffer
        }
      });

      res.json({ success: true, message: "Banco de dados atualizado no Google Drive." });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Cloud Vision API Tool
  app.post("/api/tools/vision/analyze", async (req, res) => {
    try {
      const vision = require('@google-cloud/vision');
      const client = new vision.ImageAnnotatorClient({
        apiKey: process.env.GOOGLE_CLOUD_VISION_API_KEY
      });
      const { imageUri, features } = req.body;
      
      const [result] = await client.annotateImage({
        image: { source: { imageUri } },
        features: features || [{ type: 'LABEL_DETECTION' }, { type: 'TEXT_DETECTION' }, { type: 'IMAGE_PROPERTIES' }]
      });

      res.json({ success: true, result });
    } catch (error: any) {
      console.error('Vision API Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/tools/drive/create_doc", async (req, res) => {
    try {
      const auth = getAuth(req);
      const drive = google.drive({ version: 'v3', auth });
      const { name, content, parentId } = req.body;
      
      const fileMetadata = {
        name,
        mimeType: 'application/vnd.google-apps.document',
        parents: parentId ? [parentId] : undefined
      };
      
      const file = await drive.files.create({
        requestBody: fileMetadata,
        fields: 'id, name, webViewLink',
      });

      if (content) {
        const docs = google.docs({ version: 'v1', auth });
        await docs.documents.batchUpdate({
          documentId: file.data.id!,
          requestBody: {
            requests: [
              {
                insertText: {
                  location: { index: 1 },
                  text: content,
                },
              },
            ],
          },
        });
      }

      res.json({ success: true, doc: file.data });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post("/api/tools/drive/move_file", async (req, res) => {
    try {
      const auth = getAuth(req);
      const drive = google.drive({ version: 'v3', auth });
      const { fileId, folderId } = req.body;
      
      // Retrieve the existing parents to remove
      const file = await drive.files.get({
        fileId: fileId,
        fields: 'parents'
      });
      const previousParents = (file.data.parents || []).join(',');
      
      // Move the file to the new folder
      await drive.files.update({
        fileId: fileId,
        addParents: folderId,
        removeParents: previousParents,
        fields: 'id, parents'
      });
      res.json({ success: true, message: "Arquivo movido com sucesso." });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // JARVIS 360 Drive Database Endpoints
  app.get("/api/drive/db/init", async (req, res) => {
    try {
      const auth = getAuth(req);
      const drive = google.drive({ version: 'v3', auth });
      
      // 1. Find or create Jarvis 360 folder
      let folderId;
      let folderCreated = false;
      const folderSearch = await drive.files.list({
        q: "name = 'Jarvis 360' and mimeType = 'application/vnd.google-apps.folder' and trashed = false",
        fields: 'files(id, name)',
        pageSize: 1
      });

      if (folderSearch.data.files && folderSearch.data.files.length > 0) {
        folderId = folderSearch.data.files[0].id;
      } else {
        const folderMetadata = {
          name: 'Jarvis 360',
          mimeType: 'application/vnd.google-apps.folder'
        };
        const folder = await drive.files.create({
          requestBody: folderMetadata,
          fields: 'id'
        });
        folderId = folder.data.id;
        folderCreated = true;
      }

      // 2. Find or create Jarvis 360.db file
      let fileId;
      let content = "";
      let fileCreated = false;
      const fileSearch = await drive.files.list({
        q: `name = 'Jarvis 360.db' and '${folderId}' in parents and trashed = false`,
        fields: 'files(id, name, webViewLink)',
        pageSize: 1
      });

      if (fileSearch.data.files && fileSearch.data.files.length > 0) {
        fileId = fileSearch.data.files[0].id;
        const webViewLink = fileSearch.data.files[0].webViewLink;
        
        // Download content
        const response = await drive.files.get({
          fileId: fileId!,
          alt: 'media'
        }, { responseType: 'arraybuffer' });
        
        content = Buffer.from(response.data as ArrayBuffer).toString('base64');
        res.json({ success: true, fileId, folderId, content, webViewLink, folderCreated, fileCreated });
      } else {
        // Create empty file
        const fileMetadata = {
          name: 'Jarvis 360.db',
          parents: [folderId!]
        };
        const media = {
          mimeType: 'application/x-sqlite3',
          body: Buffer.from([])
        };
        const file = await drive.files.create({
          requestBody: fileMetadata,
          media: media,
          fields: 'id, webViewLink'
        });
        fileId = file.data.id;
        fileCreated = true;
        res.json({ success: true, fileId, folderId, content: "", webViewLink: file.data.webViewLink, folderCreated, fileCreated });
      }
    } catch (error: any) {
      console.error("Drive DB Init Error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post("/api/drive/db/save", async (req, res) => {
    try {
      const auth = getAuth(req);
      const drive = google.drive({ version: 'v3', auth });
      const { fileId, content } = req.body; // content is base64
      
      if (!fileId) throw new Error("File ID is required");

      const media = {
        mimeType: 'application/x-sqlite3',
        body: Buffer.from(content, 'base64')
      };

      await drive.files.update({
        fileId: fileId,
        media: media
      });

      res.json({ success: true });
    } catch (error: any) {
      console.error("Drive DB Save Error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post("/api/tools/youtube/search", async (req, res) => {
    try {
      const auth = getAuth(req);
      const youtube = google.youtube({ version: 'v3', auth });
      const { query, maxResults = 5 } = req.body;
      
      const response = await youtube.search.list({
        part: ['snippet'],
        q: query,
        maxResults,
        type: ['video'],
      });
      
      const videos = response.data.items?.map(item => ({
        id: item.id?.videoId,
        title: item.snippet?.title,
        description: item.snippet?.description,
        thumbnail: item.snippet?.thumbnails?.high?.url,
        channelTitle: item.snippet?.channelTitle,
        publishedAt: item.snippet?.publishedAt,
        link: `https://www.youtube.com/watch?v=${item.id?.videoId}`
      }));

      res.json({ success: true, videos });
    } catch (error: any) {
      console.warn("YouTube API failed, falling back to Gemini Search:", error.message);
      try {
        const { query, maxResults = 5 } = req.body;
        const { GoogleGenAI } = require('@google/genai');
        const ai = new GoogleGenAI({ apiKey: secrets.GEMINI_API_KEY || process.env.GEMINI_API_KEY });
        const searchResponse = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: `Encontre os vídeos mais relevantes no YouTube para: ${query}.`,
          config: {
            tools: [{ googleSearch: {} }]
          }
        });
        
        const chunks = searchResponse.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
        const videos = chunks
          .filter((c: any) => c.web?.uri?.includes('youtube.com/watch?v='))
          .map((c: any) => {
            const uri = c.web.uri;
            const videoId = uri.split('v=')[1]?.split('&')[0];
            return {
              id: videoId,
              title: c.web.title || 'Vídeo do YouTube',
              description: 'Encontrado via Google Search',
              thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
              channelTitle: 'YouTube',
              link: uri
            };
          });
        
        if (videos.length > 0) {
          return res.json({ success: true, videos: videos.slice(0, maxResults) });
        }
      } catch (fallbackError) {
        console.error("Fallback search failed:", fallbackError);
      }
      
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post("/api/tools/sheets/create", async (req, res) => {
    try {
      const auth = getAuth(req);
      const sheets = google.sheets({ version: 'v4', auth });
      const { title } = req.body;
      
      const spreadsheet = await sheets.spreadsheets.create({
        requestBody: {
          properties: { title }
        }
      });
      res.json({ success: true, spreadsheet: spreadsheet.data });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post("/api/tools/sheets/update", async (req, res) => {
    try {
      const auth = getAuth(req);
      const sheets = google.sheets({ version: 'v4', auth });
      const { spreadsheetId, range, values } = req.body;
      
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range,
        valueInputOption: 'RAW',
        requestBody: { values },
      });
      res.json({ success: true, message: "Planilha atualizada." });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post("/api/tools/hashnode/publish", async (req, res) => {
    try {
      const { title, content, token, publicationId } = req.body;
      if (!token) throw new Error("Hashnode API Token é necessário.");

      const query = `
        mutation PublishPost($input: PublishPostInput!) {
          publishPost(input: $input) {
            post {
              id
              url
            }
          }
        }
      `;

      const variables = {
        input: {
          title,
          contentMarkdown: content,
          publicationId: publicationId || undefined,
        }
      };

      const response = await fetch('https://api.hashnode.com/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token
        },
        body: JSON.stringify({ query, variables })
      });

      const result = await response.json();
      
      if (result.errors) {
        throw new Error(result.errors[0].message);
      }

      res.json({ success: true, post: result.data.publishPost.post });
    } catch (error: any) {
      console.error("Hashnode Publish Error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post("/api/tools/contacts/search", async (req, res) => {
    try {
      const auth = getAuth(req);
      const people = google.people({ version: 'v1', auth });
      const { query } = req.body;
      
      const response = await people.people.searchContacts({
        query,
        readMask: 'names,emailAddresses,phoneNumbers,photos',
      });
      
      const contacts = (response.data.results || []).map((result: any) => {
        const person = result.person;
        return {
          id: person.resourceName,
          name: person.names?.[0]?.displayName || 'Sem Nome',
          email: person.emailAddresses?.[0]?.value || 'Sem E-mail',
          phone: person.phoneNumbers?.[0]?.value || 'Sem Telefone',
          photo: person.photos?.[0]?.url || null
        };
      });
      
      res.json({ success: true, contacts });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const startListening = (port: number) => {
    const server = app.listen(port, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${port}`);
    });

    server.on('error', (e: any) => {
      if (e.code === 'EADDRINUSE') {
        console.log(`Port ${port} is in use, trying ${port + 1}...`);
        setTimeout(() => {
          server.close();
          startListening(port + 1);
        }, 1000);
      } else {
        console.error(e);
      }
    });
  };

  startListening(PORT);
}

startServer();
