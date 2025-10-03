const express = require('express');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { ENV_VARS } = require('../config/envVar.js');
const Quiz = require('../models/Quiz.js');
const connectToMongo = require('../connectDb.js');

const router = express.Router();

// ----------------- GENERATE QUIZ ID -----------------
router.post('/generate-id', async (req, res) => {
    await connectToMongo();
    const { userID, qty } = req.body;

    const newQuiz = new Quiz({ userID, qty });
    await newQuiz.save();

    res.json({ quizID: newQuiz._id });
});

// ----------------- GENERATE QUIZ QUESTION -----------------
router.post('/generate-quiz', async (req, res) => {
    await connectToMongo();
    const { techstack, difficulty, quizID, qsNo, qty } = req.body;

    if (!quizID) return res.status(400).json({ error: "quizID is required" });
    if (!techstack) return res.status(400).json({ error: "techstack is required" });

    const actualDifficulty = difficulty || "random";

    if (qsNo > qty) {
        return res.json({ hasMoreQuestions: false });
    }

    const prompt = `
You are an interview quiz question generator. Generate 1 MCQ question with answer for topic: ${techstack} in ${actualDifficulty} difficulty.
Output format must be valid JSON:
{
    "question": "Question text here",
    "code_snippet": "Optional code snippet if needed",
    "options": ["Option1", "Option2", "Option3", "Option4"],
    "correct": "Correct option text",
    "correctIndex": 0
}
Do not include extra text or markdown. Keep JSON strictly valid.
`;

    try {
        const genAI = new GoogleGenerativeAI(ENV_VARS.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });

        const results = await model.generateContent(prompt);
        const rawText = results.response.text();
        console.log("AI output:", rawText);

        let generatedQuestion;
        try {
            generatedQuestion = JSON.parse(rawText.replace(/```json|```/g, '').trim());
        } catch (jsonErr) {
            console.error("JSON parse error:", jsonErr);
            return res.status(500).json({ error: "Invalid JSON from AI", raw: rawText });
        }

        const quiz = await Quiz.findById(quizID);
        if (!quiz) return res.status(404).json({ error: "Quiz not found" });

        quiz.questions.push(generatedQuestion);
        quiz.correct_answers.push(generatedQuestion.correct);
        quiz.correct_answers_index.push(generatedQuestion.correctIndex);
        await quiz.save();

        // Remove correct answer from response to frontend
        const responseQuestion = { ...generatedQuestion };
        delete responseQuestion.correct;
        delete responseQuestion.correctIndex;

        res.json({ question: responseQuestion, techstack, difficulty });
    } catch (error) {
        console.error("Error generating quiz question:", error);
        res.status(500).json({ error: "Failed to generate question", details: error.message || error });
    }
});

// ----------------- SAVE ANSWER -----------------
router.post('/save-answer', async (req, res) => {
    await connectToMongo();
    const { selectedAnswer, selectedIndex, quizID } = req.body;

    try {
        const quiz = await Quiz.findById(quizID);
        if (!quiz) return res.status(404).json({ error: "Quiz not found" });

        quiz.chosen_answers.push(selectedAnswer);
        quiz.chosen_answers_index.push(selectedIndex);
        await quiz.save();

        res.json({ message: "Answer submitted successfully" });
    } catch (error) {
        console.error("Error submitting answer:", error);
        res.status(500).json({ error: "Failed to submit answer", details: error.message || error });
    }
});

// ----------------- EVALUATE QUIZ -----------------
router.post('/evaluate-answer', async (req, res) => {
    await connectToMongo();
    const { quizID } = req.body;

    try {
        const quiz = await Quiz.findById(quizID);
        if (!quiz) return res.status(404).json({ error: "Quiz not found" });

        const correctAnswers = quiz.correct_answers_index;
        const userAnswers = quiz.chosen_answers_index;
        const score = correctAnswers.filter((a, i) => a === userAnswers[i]).length;

        quiz.score = score;
        quiz.status = "Completed";
        await quiz.save();

        res.json({ quiz });
    } catch (error) {
        console.error("Error evaluating quiz:", error);
        res.status(500).json({ error: "Failed to evaluate quiz", details: error.message || error });
    }
});

// ----------------- TERMINATE QUIZ -----------------
router.post('/terminate-quiz', async (req, res) => {
    await connectToMongo();
    const { quizID } = req.body;

    try {
        await Quiz.findByIdAndDelete(quizID);
        res.json({ message: "Quiz terminated successfully" });
    } catch (error) {
        console.error("Error terminating quiz:", error);
        res.status(500).json({ error: "Failed to terminate quiz", details: error.message || error });
    }
});

module.exports = router;
