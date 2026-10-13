
require("dotenv").config();

const express = require("express");
const path = require("path");
const { GoogleGenAI } = require("@google/genai");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "../public")));

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "PacePilot AI backend is running." });
});

app.post("/api/generate-plan", async (req, res) => {
  try {
    const { goal, experience, daysPerWeek, targetDate } = req.body;

    if (!goal || !experience || !daysPerWeek) {
      return res.status(400).json({
        error: "Please provide a goal, experience level and training days.",
      });
    }

    
const prompt = `
You are PacePilot, a practical and responsible running coach.

Create a personalized, realistic running training plan using the
user's information below.

RUNNER PROFILE
- Goal: ${goal}
- Experience: ${experience}
- Training days per week: ${daysPerWeek}
- Target date: ${targetDate || "No target date specified"}

OUTPUT REQUIREMENTS

Keep the response concise, practical, and easy to scan.
Use Markdown and follow this exact structure:

# Your Running Plan

Start with a short introduction of no more than 2 sentences.
Explain the main focus of this plan and how it suits the runner.

## Weekly Training Schedule

Create a Markdown table with these columns:

| Day | Workout | Duration or Distance | Effort | Instructions |

Requirements:
- Include exactly ${daysPerWeek} training sessions per week.
- Identify each session by day of the week.
- Include appropriate recovery or rest days between harder sessions.
- Use realistic duration or distance targets for the runner's experience.
- Explain each workout briefly, using one short sentence.
- Define effort using simple terms: Easy, Moderate, or Hard.
- Explain that easy running should feel conversational.
- Include warm-up and cool-down guidance when appropriate.
- Do not prescribe exact running paces unless the user provides
  enough information to estimate them responsibly.

## How to Progress

Provide 3-4 short bullet points explaining how to progress,
recover, and adapt the training plan.

## Important Notes

Include 2-3 short bullet points covering recovery, gradual
progression, and when to stop exercising and seek medical advice.

PLAN DESIGN RULES
- Adapt the plan to the selected goal and experience level.
- For beginners, prioritize consistency and easy effort before speed.
- Include rest days and avoid scheduling hard workouts on
  consecutive days.
- Increase training load gradually; do not increase distance
  aggressively or guarantee that the runner will reach the goal.
- If the target date is provided, consider the time available.
  If the timeline is unrealistic, explain this briefly and suggest
  a safer alternative rather than forcing the goal.
- If no target date is provided, create a practical 4-week starter plan.
- Keep each weekly schedule compact. If the target date requires
  a longer plan, organize it into clearly labeled weekly blocks.
- Do not invent information about the runner.
- Do not add a long motivational introduction or a generic essay.
- Return only the finished Markdown plan. Do not include your
  internal reasoning.
`;

    const response = await ai.models.generateContent({
  model: "gemini-3.5-flash-lite",
  contents: prompt,
  config: {
    httpOptions: {
      timeout: 30000
    }
  }
});

    res.json({ plan: response.text });
  } catch (error) {
    console.error("Plan generation failed:", error.message);
    res.status(500).json({
      error: "Unable to generate a plan. Check the server configuration and API access.",
    });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`PacePilot AI running on http://localhost:${PORT}`);
});
