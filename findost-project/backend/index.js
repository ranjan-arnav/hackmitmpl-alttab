require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Initialize Gemini AI
const rawKey = process.env.GEMINI_API_KEY || '';
const masked = rawKey ? rawKey.slice(0,6) + '...' + rawKey.slice(-4) : 'NONE';
console.log('[Gemini] Loaded API key (masked):', masked);
// Treat only empty key as invalid; allow current provided key.
const isInvalidApiKey = !rawKey;
if (isInvalidApiKey) {
  console.warn('WARNING: GEMINI_API_KEY is not set. The /chat endpoint will not work until it is configured.');
}
const genAI = new GoogleGenerativeAI(rawKey || '');

// Chat endpoint
app.post('/chat', async (req, res) => {
  if (isInvalidApiKey) {
    return res.status(500).json({ error: 'AI not configured on server (missing API key)' });
  }
  try {
    const { message, profile, chatHistory } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Create system prompt with user profile
    const userProfile = profile || {};
    const systemPrompt = `You are 'FinDost,' a world-class AI financial coach for young adults in India. 
    Your persona is empathetic, encouraging, and clear. You must avoid all financial jargon and explain complex topics simply. 
    Your goal is to build the user's confidence. Always include a disclaimer to consult a professional for major decisions. 
    Personalize your advice using the user's profile: 
    Name: ${userProfile.full_name || 'Unknown'}, 
    Age: ${userProfile.age || 'Unknown'}, 
    Profession: ${userProfile.profession || 'Unknown'}, 
    Monthly Salary: ₹${userProfile.monthly_salary_inr || 'Unknown'}`;

    // Initialize the model
    const model = genAI.getGenerativeModel({
      model: "gemini-pro",
    });

    // Format chat history for the model
    let formattedHistory = [];
    if (chatHistory && chatHistory.length > 0) {
      formattedHistory = chatHistory.map(msg => ({
        role: msg.sender === 'user' ? 'user' : 'model',
        parts: [{ text: msg.message }]
      }));
    }

    // Create chat session
    const chat = model.startChat({
      history: formattedHistory,
      generationConfig: {
        maxOutputTokens: 1000,
      },
      systemInstruction: systemPrompt,
    });

    // Send message to model and get response
    const result = await chat.sendMessage(message);
    const response = result.response;
    const text = response.text();

    // Return AI's response
    res.json({ reply: text });
  } catch (error) {
    console.error('Error processing chat request:', error);
    res.status(500).json({ error: 'Failed to process request', details: error.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
