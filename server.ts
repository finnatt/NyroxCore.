import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import { OpenAI } from "openai";
import { GoogleGenAI } from "@google/genai";
import path from "path";
import fs from "fs-extra";
import nodemailer from "nodemailer";

// Remove global initialization
// const PROJECTS_ROOT = path.join(process.cwd(), "NyroxProjects");
// fs.ensureDirSync(PROJECTS_ROOT);

// Email Transporter Configuration
const transporter = nodemailer.createTransport({
  host: "smtp.mail.me.com",
  port: 587,
  secure: false, // TLS
  auth: {
    user: "finnattermeier03@icloud.com",
    pass: "jluj-khcv-uedq-rcww",
  },
  tls: {
    rejectUnauthorized: false, // Disable certificate check as requested
  },
});

// Initialize Database
// Removed global db.exec call - moved to startServer

export async function startServer(userDataPath?: string) {
  const app = express();
  const PORT = 3000;
  
  const dbPath = userDataPath ? path.join(userDataPath, "nyrox_core.db") : "nyrox_core.db";
  const db = new Database(dbPath);
  
  const projectsPath = userDataPath ? path.join(userDataPath, "NyroxProjects") : path.join(process.cwd(), "NyroxProjects");
  fs.ensureDirSync(projectsPath);
    app.use(cors());
  app.use(express.json());

  // Initialize Database Schema
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
    CREATE TABLE IF NOT EXISTS users (
      email TEXT PRIMARY KEY,
      password TEXT,
      is_owner INTEGER DEFAULT 0,
      verified INTEGER DEFAULT 0,
      verification_code TEXT
    );
    CREATE TABLE IF NOT EXISTS chats (
      id TEXT PRIMARY KEY,
      title TEXT,
      model_provider TEXT,
      mode TEXT DEFAULT 'chat',
      project_name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id TEXT,
      role TEXT,
      content TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(chat_id) REFERENCES chats(id)
    );
  `);
  
  // --- Auth Routes ---
  app.post("/api/auth/request-code", async (req, res) => {
    const { email, password } = req.body;
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    
    const existingUser = db.prepare("SELECT * FROM users WHERE email = ?").get(email) as any;
    
    if (existingUser) {
      if (existingUser.password !== password) {
        return res.status(401).json({ error: "Ungültiges Passwort" });
      }
      db.prepare("UPDATE users SET verification_code = ?, verified = 0 WHERE email = ?")
        .run(code, email);
    } else {
      db.prepare("INSERT INTO users (email, password, verification_code, verified) VALUES (?, ?, ?, 0)")
        .run(email, password, code);
    }
    
    // Send Real Email
    try {
      await transporter.sendMail({
        from: '"NyroxCore Security" <finnattermeier03@icloud.com>',
        to: email,
        subject: "Dein NyroxCore Verifizierungscode",
        text: `Dein Verifizierungscode lautet: ${code}`,
        html: `
          <div style="font-family: sans-serif; padding: 20px; background-color: #0a0a0a; color: #ffffff; border-radius: 10px;">
            <h2 style="color: #10b981;">NyroxCore Verifizierung</h2>
            <p>Nutze den folgenden Code, um deine Identität zu bestätigen:</p>
            <div style="font-size: 32px; font-weight: bold; letter-spacing: 5px; padding: 20px; background: #1a1a1a; border-radius: 8px; text-align: center; margin: 20px 0; border: 1px solid #333;">
              ${code}
            </div>
            <p style="color: #666; font-size: 12px;">Falls du diese Anfrage nicht gestellt hast, kannst du diese E-Mail ignorieren.</p>
          </div>
        `,
      });
      console.log(`[AUTH] E-Mail erfolgreich an ${email} gesendet.`);
      res.json({ success: true, message: "Verifizierungscode wurde per E-Mail gesendet." });
    } catch (error) {
      console.error("[AUTH] E-Mail Fehler:", error);
      res.status(500).json({ error: "E-Mail konnte nicht gesendet werden." });
    }
  });

  app.post("/api/auth/verify", (req, res) => {
    const { email, code } = req.body;
    const user = db.prepare("SELECT * FROM users WHERE email = ? AND verification_code = ?").get(email, code) as any;
    
    if (user) {
      // Whitelist specific developer email or first verified user
      const developerEmail = "melvin.attermeier@icloud.com";
      const isDeveloper = email.toLowerCase() === developerEmail.toLowerCase();
      
      const userCount = db.prepare("SELECT COUNT(*) as count FROM users WHERE verified = 1").get() as any;
      const isOwner = (userCount.count === 0 || isDeveloper) ? 1 : 0;
      
      db.prepare("UPDATE users SET verified = 1, is_owner = ? WHERE email = ?").run(isOwner, email);
      res.json({ success: true, isOwner: !!isOwner });
    } else {
      res.status(400).json({ error: "Ungültiger Code" });
    }
  });

  // --- API Routes ---

  // Settings
  app.get("/api/settings", (req, res) => {
    const rows = db.prepare("SELECT * FROM settings").all();
    const settings = rows.reduce((acc: any, row: any) => {
      acc[row.key] = row.value;
      return acc;
    }, {});
    res.json(settings);
  });

  app.post("/api/settings", (req, res) => {
    const { openai_key, gemini_key, last_provider } = req.body;
    const upsert = db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)");
    if (openai_key !== undefined) upsert.run("openai_key", openai_key);
    if (gemini_key !== undefined) upsert.run("gemini_key", gemini_key);
    if (last_provider !== undefined) upsert.run("last_provider", last_provider);
    res.json({ success: true });
  });

  // Chats
  app.get("/api/chats", (req, res) => {
    const chats = db.prepare("SELECT * FROM chats ORDER BY created_at DESC").all();
    res.json(chats);
  });

  app.get("/api/chats/:id/messages", (req, res) => {
    const messages = db.prepare("SELECT * FROM messages WHERE chat_id = ? ORDER BY timestamp ASC").all(req.params.id);
    res.json(messages);
  });

  app.post("/api/chats", (req, res) => {
    const { id, title, model_provider, mode, project_name } = req.body;
    db.prepare("INSERT INTO chats (id, title, model_provider, mode, project_name) VALUES (?, ?, ?, ?, ?)")
      .run(id, title, model_provider, mode || 'chat', project_name || null);
    res.json({ success: true });
  });

  // Project Files
  app.get("/api/projects/:name/files", async (req, res) => {
    const projectPath = path.join(projectsPath, req.params.name);
    try {
      if (!fs.existsSync(projectPath)) return res.json([]);
      const files = await fs.readdir(projectPath);
      const fileDetails = await Promise.all(files.map(async (file) => {
        const stats = await fs.stat(path.join(projectPath, file));
        return { name: file, isDirectory: stats.isDirectory() };
      }));
      res.json(fileDetails);
    } catch (error) {
      res.status(500).json({ error: "Fehler beim Auflisten der Dateien" });
    }
  });

  app.get("/api/projects/:name/files/:filename", async (req, res) => {
    const filePath = path.join(projectsPath, req.params.name, req.params.filename);
    try {
      const content = await fs.readFile(filePath, "utf-8");
      res.json({ content });
    } catch (error) {
      res.status(404).json({ error: "Datei nicht gefunden" });
    }
  });

  app.post("/api/chats/:id/messages", (req, res) => {
    const { role, content } = req.body;
    db.prepare("INSERT INTO messages (chat_id, role, content) VALUES (?, ?, ?)").run(req.params.id, role, content);
    res.json({ success: true });
  });

  // AI Proxy
  app.post("/api/chat/completions", async (req, res) => {
    const { provider, messages, mode, chatId } = req.body;
    
    const settingsRows = db.prepare("SELECT * FROM settings").all();
    const settings = settingsRows.reduce((acc: any, row: any) => {
      acc[row.key] = row.value;
      return acc;
    }, {});

    // Dual-Model Logic
    let model = req.body.model;
    if (!model) {
      if (provider === "openai") {
        model = mode === "ide" ? "gpt-4o" : "gpt-4o-mini";
      } else {
        model = mode === "ide" ? "gemini-3.1-pro-preview" : "gemini-3-flash-preview";
      }
    }

    try {
      let aiResponse = "";
      let modelUsed = model;

      if (provider === "openai") {
        const apiKey = settings.openai_key;
        if (!apiKey) return res.status(400).json({ error: "OpenAI API Key fehlt" });
        
        const openai = new OpenAI({ apiKey });
        const response = await openai.chat.completions.create({
          model: model,
          messages: messages.map((m: any) => ({ role: m.role, content: m.content })),
        });
        aiResponse = response.choices[0].message.content || "";
      } else if (provider === "gemini") {
        const apiKey = settings.gemini_key || process.env.GEMINI_API_KEY;
        if (!apiKey) return res.status(400).json({ error: "Gemini API Key fehlt" });

        const ai = new GoogleGenAI({ apiKey });
        
        // Convert history to Gemini format
        const contents = messages.map((m: any) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        }));

        const response = await ai.models.generateContent({
          model: model,
          contents: contents,
          config: {
            tools: [{ googleSearch: {} }] // Enable Grounding
          }
        });
        
        aiResponse = response.text || "";
      }

      // IDE Mode: Auto-File System & Dependency Detection
      if (mode === "ide" && aiResponse && chatId) {
        const chat = db.prepare("SELECT * FROM chats WHERE id = ?").get(chatId) as any;
        if (chat && chat.project_name) {
          const projectPath = path.join(projectsPath, chat.project_name);
          await fs.ensureDir(projectPath);

          // Regex to find code blocks with filenames
          const codeBlockRegex = /```(?:\w+)?\s*\n\/\/\s*file:\s*([^\n]+)\n([\s\S]*?)```/g;
          let match;
          const detectedDeps = new Set<string>();

          while ((match = codeBlockRegex.exec(aiResponse)) !== null) {
            const fileName = match[1].trim();
            const fileContent = match[2];
            await fs.writeFile(path.join(projectPath, fileName), fileContent);

            // Simple dependency detection (e.g., import/require)
            const importRegex = /(?:import|from|require)\s+['"]([^' "./][^'"]+)['"]/g;
            let depMatch;
            while ((depMatch = importRegex.exec(fileContent)) !== null) {
              detectedDeps.add(depMatch[1]);
            }
          }

          // Create package.json if dependencies are found
          if (detectedDeps.size > 0) {
            const pkgPath = path.join(projectPath, "package.json");
            const pkg = fs.existsSync(pkgPath) ? await fs.readJson(pkgPath) : { name: chat.project_name.toLowerCase(), version: "1.0.0", dependencies: {} };
            
            detectedDeps.forEach(dep => {
              if (!pkg.dependencies[dep]) pkg.dependencies[dep] = "latest";
            });
            
            await fs.writeJson(pkgPath, pkg, { spaces: 2 });
          }
        }
      }

      res.json({ content: aiResponse, modelUsed });
    } catch (error: any) {
      console.error("AI Proxy Error:", error);
      res.status(500).json({ error: error.message });
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
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

import { fileURLToPath } from 'url';

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  startServer();
}
