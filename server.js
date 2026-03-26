require('dotenv').config(); 
const express = require('express');
const { Pool } = require('pg');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// --- 1. DATABASE SETUP ---
// --- 1. DATABASE SETUP ---
// Force a check to ensure the URL exists
const dbUrl = process.env.DATABASE_URL;

if (!dbUrl || typeof dbUrl !== 'string') {
  console.error("❌ FATAL: DATABASE_URL is missing or not a string in .env!");
  process.exit(1); 
}

const isProduction = dbUrl.includes('render.com');

const pool = new Pool({
  connectionString: dbUrl,
  ssl: isProduction ? { rejectUnauthorized: false } : false
});

// --- 2. GEMINI AI SETUP ---
if (!process.env.GEMINI_API_KEY) {
    console.error("❌ FATAL: GEMINI_API_KEY is missing from your .env file!");
}
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const initDB = async () => {
  const queryText = `
    CREATE TABLE IF NOT EXISTS contacts (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS chat_logs (
      id SERIAL PRIMARY KEY,
      user_query TEXT,
      bot_response TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );`;
  try {
    await pool.query(queryText);
    console.log(`✅ Database Ready! (Mode: ${isProduction ? 'Production' : 'Local'})`);
  } catch (err) {
    console.error("❌ Database Initialization Error:", err.message);
  }
};
initDB();

// --- 3. MIDDLEWARE ---
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

// --- 4. ROUTES ---

// Serve the Home Page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Gemini Chatbot Endpoint
app.post('/api/chat', async (req, res) => {
  const { message } = req.body;

  try {
    // 1. Initialize the Model
    const model = genAI.getGenerativeModel({ 
        model: "gemini-2.5-flash-lite" 
    });

    // 2. Generate Content with basic prompt instructions
    const prompt = `You are a professional assistant for Saniya Shiju's portfolio. 
    Saniya is a BCA student. Keep responses very brief (max 2 sentences). 
    User Question: ${message}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const botReply = response.text();

    // 3. Log the successful chat to Postgres
    await pool.query(
      'INSERT INTO chat_logs (user_query, bot_response) VALUES ($1, $2)',
      [message, botReply]
    );

    res.json({ reply: botReply });

  } catch (err) {
    // --- CRITICAL: LOOK AT YOUR VS CODE TERMINAL FOR THIS OUTPUT ---
    console.error("--- GEMINI API ERROR LOG ---");
    console.error("Message:", err.message);
    if (err.stack) console.error("Stack Trace:", err.stack);
    console.error("-----------------------------");

    res.status(500).json({ reply: "I'm having a bit of a technical glitch. Try again!" });
  }
});

// Contact Form Endpoint
app.post('/send-to-db', async (req, res) => {
  const { name, message } = req.body;
  try {
    await pool.query('INSERT INTO contacts (name, message) VALUES ($1, $2)', [name, message]);
    res.send('<h1>Success! Message saved.</h1><a href="/">Go Back</a>');
  } catch (err) {
    console.error("Contact Form Error:", err.message);
    res.status(500).send('Error saving to database');
  }
});

// Secret Admin View (Contacts + Chats)
app.get('/view-data-admin', async (req, res) => {
  try {
    const contacts = await pool.query('SELECT * FROM contacts ORDER BY created_at DESC');
    const chats = await pool.query('SELECT * FROM chat_logs ORDER BY created_at DESC LIMIT 15');
    
    let html = '<h1>Admin Dashboard</h1>';
    html += '<h2>Recent Contact Messages</h2><table border="1"><tr><th>Name</th><th>Message</th></tr>';
    contacts.rows.forEach(r => html += `<tr><td>${r.name}</td><td>${r.message}</td></tr>`);
    html += '</table><h2>Recent AI Chats</h2><table border="1"><tr><th>User Query</th><th>AI Response</th></tr>';
    chats.rows.forEach(r => html += `<tr><td>${r.user_query}</td><td>${r.bot_response}</td></tr>`);
    html += '</table><br><a href="/">Back</a>';
    
    res.send(html);
  } catch (err) {
    res.status(500).send('Error fetching data');
  }
});

app.listen(port, () => {
  console.log(`🚀 Server running at http://localhost:${port}`);
});