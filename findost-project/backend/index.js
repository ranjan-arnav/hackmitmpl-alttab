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

    // --- Stage 1: Content Moderation ---
    const moderationModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const moderationPrompt = `Is the following question about personal finance (budgeting, saving, investing, debt, salary, etc.)? Answer with only "yes" or "no". Question: "${message}"`;
    const moderationResult = await moderationModel.generateContent(moderationPrompt);
    const moderationResponse = await moderationResult.response;
    const moderationText = moderationResponse.text().trim().toLowerCase();

    if (!moderationText.includes('yes')) {
      // If not a financial question, send a canned response and stop.
      const cannedResponses = [
        "As FinDost, my focus is solely on personal finance. I can't answer that, but I'm ready to help with any money-related questions you have!",
        "My purpose is to help you with your finances. I can't provide information on other topics, but I can help you with budgeting, saving, or investing.",
        "That's outside of my area of expertise. I am FinDost, your personal finance assistant. How can I help you with your financial goals today?"
      ];
      const randomResponse = cannedResponses[Math.floor(Math.random() * cannedResponses.length)];
      return res.json({ reply: randomResponse });
    }

    // --- Stage 2: Financial Response ---
    // If moderation passes, proceed to get a financial answer.
    const systemPrompt = `
    **CRITICAL RULE: You are FinDost, a financial AI assistant. Your ONLY function is to answer questions about personal finance.**
    **Persona for Financial Questions:**
    - You are an empathetic, encouraging, and clear financial coach for young adults in India.
    - Explain complex topics simply, without jargon.
    - Your goal is to build the user's confidence.
    - Personalize your advice using the user's profile:
        - Name: ${userProfile.full_name || 'Not provided'}
        - Age: ${userProfile.age || 'Not provided'}
        - Profession: ${userProfile.profession || 'Not provided'}
        - Monthly Salary: ₹${userProfile.monthly_salary_inr || 'Not provided'}
    **MANDATORY DISCLAIMER:**
    - For ALL financial-related answers, you MUST end your response with this exact disclaimer: "Remember, I'm an AI assistant. It's a good idea to consult with a qualified financial advisor for major decisions."
    `;

    // Initialize the model for the main response
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      systemInstruction: systemPrompt
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
