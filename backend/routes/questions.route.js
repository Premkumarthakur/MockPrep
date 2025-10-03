const express = require('express');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { ENV_VARS } = require('../config/envVar.js');

const router = express.Router();

// ----------------- CHATBOT -----------------
router.post('/chat', async (req, res) => {
    const { message } = req.body;
    console.log("User prompt:", message);

    try {
        const genAI = new GoogleGenerativeAI(ENV_VARS.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" }); // latest stable pro model

        const results = await model.generateContent(message);
        const reply = results.response.text();
        console.log("Bot reply:", reply);

        res.json({ reply });
    } catch (error) {
        console.error('Error generating reply:', error);
        res.status(500).json({ error: 'Failed to generate reply', details: error.message || error });
    }
});

// ----------------- GENERATE INTERVIEW QUESTIONS -----------------
router.post('/generate-questions', async (req, res) => {
    const { techstack, qty, difficulty } = req.body;

    if (!qty) {
        return res.status(400).json({ error: 'Quantity of questions is required' });
    }

    const actualDifficulty = difficulty || "random";

    const prompt = `
You are an interview quiz generator. Generate ${qty} MCQ interview questions with answers for the topic: ${techstack} in ${actualDifficulty} difficulty.
Output format must be JSON:
[
  {
    "question": "Question text here",
    "code_snippet": "Optional code snippet if applicable",
    "options": ["Option1", "Option2", "Option3", "Option4"],
    "correctIndex": 0
  }
]
Ensure JSON is valid, do not include extra markdown or explanations.
`;

    console.log("Prompt sent to Gemini:", prompt);

    try {
        const genAI = new GoogleGenerativeAI(ENV_VARS.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" }); // latest pro model

        const results = await model.generateContent(prompt);
        const rawText = results.response.text();

        console.log("Raw AI output:", rawText);

        // Clean Markdown fences and parse JSON safely
        const cleanedText = rawText.replace(/```json|```/g, '').trim();
        let questions;

        try {
            questions = JSON.parse(cleanedText);
        } catch (jsonErr) {
            console.error("JSON parse error:", jsonErr);
            return res.status(500).json({
                error: "Invalid JSON from AI",
                raw: cleanedText
            });
        }

        res.json({ questions });

    } catch (error) {
        console.error('Error generating questions:', error);
        res.status(500).json({ error: 'Failed to generate questions', details: error.message || error });
    }
});

module.exports = router;
