
require("dotenv").config();

const express = require("express");
const path = require("path");
const { GoogleGenAI } = require("@google/genai");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "20kb" }));
app.use(express.static(path.join(__dirname, "../public")));

if (!process.env.GEMINI_API_KEY) {
  console.error("GEMINI_API_KEY is missing from the environment.");
  process.exit(1);
}

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const allowedExperiences = [
  "Beginner",
  "Some experience",
  "Regular runner",
];

const validDays = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    message: "PacePilot AI backend is running.",
  });
});

app.post("/api/generate-plan", async (req, res) => {
  try {
    const {
      goal,
      experience,
      daysPerWeek,
      targetDate,
      currentAbility,
      preferredDays,
      additionalNotes,
    } = req.body || {};

    // Validate the required fields.
    if (
      typeof goal !== "string" ||
      !goal.trim() ||
      goal.length > 150
    ) {
      return res.status(400).json({
        error: "Please provide a valid running goal.",
      });
    }

    if (!allowedExperiences.includes(experience)) {
      return res.status(400).json({
        error: "Please select a valid experience level.",
      });
    }

    const trainingDays = Number(daysPerWeek);

    if (
      !Number.isInteger(trainingDays) ||
      trainingDays < 1 ||
      trainingDays > 7
    ) {
      return res.status(400).json({
        error: "Training days must be a whole number from 1 to 7.",
      });
    }

    // Validate optional text fields.
    const cleanOptionalText = (value, maxLength) => {
      if (value == null || value === "") return "";
      if (typeof value !== "string") return null;
      if (value.length > maxLength) return null;
      return value.trim();
    };

    const ability = cleanOptionalText(currentAbility, 300);
    const notes = cleanOptionalText(additionalNotes, 500);
    const date = cleanOptionalText(targetDate, 10);

    if (ability === null || notes === null || date === null) {
      return res.status(400).json({
        error: "One or more optional fields are invalid or too long.",
      });
    }

    // Validate the optional target date.
    if (
      date &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        !Number.isFinite(Date.parse(`${date}T00:00:00Z`)) ||
        new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date)
    ) {
      return res.status(400).json({
        error: "Please provide a valid target date.",
      });
    }

    // Validate and deduplicate preferred weekdays.
    if (
      preferredDays != null &&
      !Array.isArray(preferredDays)
    ) {
      return res.status(400).json({
        error: "Preferred training days must be a list of weekdays.",
      });
    }

    const days = Array.isArray(preferredDays)
      ? [
          ...new Set(
            preferredDays.filter(
              (day) =>
                typeof day === "string" &&
                validDays.includes(day.trim())
            ).map((day) => day.trim())
          ),
        ]
      : [];

    if (days.length > 0 && days.length < trainingDays) {
      return res.status(400).json({
        error:
          "Please select at least as many preferred days as training days.",
      });
    }

    const today = new Date().toISOString().slice(0, 10);

    const prompt = `
You are PacePilot, a practical, evidence-informed and responsible running coach.

Create a personalized running program using only the runner information
below. Do not invent running history, fitness measurements, injuries,
or target paces.

RUNNER PROFILE
- Goal: ${goal.trim()}
- Experience: ${experience}
- Training sessions per week: ${trainingDays}
- Target date: ${date || "Not specified"}
- Current running ability: ${ability || "Not provided"}
- Preferred training days: ${
      days.length ? days.join(", ") : "No preferences provided"
    }
- Additional information: ${notes || "None provided"}
- Current date: ${today}

PROGRAM LENGTH

Create a complete multi-week program, not just a sample week.

Use these guidelines when no target date is provided:
- General fitness: 4–8 weeks.
- Beginner 5K: normally 8–12 weeks.
- 10K: normally 10–14 weeks, depending on current ability.
- Half marathon: normally 12–16 weeks for a runner with an appropriate base.
- Marathon: normally 16–24 weeks for a runner with an appropriate base.

These are guidelines, not guarantees. Adapt the duration to the runner's
starting ability. A beginner may need a foundation-building phase first.

If a target date is provided, assess the time available. If it is
unrealistic, explain the limitation and recommend a safer alternative.
Do not promise that the runner will achieve the goal.

OUTPUT STRUCTURE

# Your Running Plan

Briefly summarize the goal, program duration, and training approach.

## Program Overview

State:
- Total duration in weeks.
- Main focus of each training phase.
- Expected weekly training frequency.
- Important assumptions about current ability.

## Complete Weekly Training Program

Provide a separate heading for every week, from Week 1 to the final week.

Every week must have a Markdown table with these exact columns:

| Day | Workout | Duration or Distance | Effort | Instructions |

Every table must contain exactly seven rows, one for each day.

When preferred training days are provided:
- Use actual weekday names from Monday through Sunday.
- Schedule exactly ${trainingDays} training sessions.
- Schedule workouts only on selected preferred days.
- Label every other day Rest Day or Recovery Day.

When no preferred days are provided:
- Label days Day 1 through Day 7 in calendar order.
- Schedule exactly ${trainingDays} training sessions.
- Include all remaining days as rest or recovery days.
- Space sessions appropriately and avoid consecutive hard workouts.

For each training session, provide the workout, duration or distance,
effort (Easy, Moderate, or Hard), and concise practical instructions.

For rest or recovery days:
- Workout: Rest Day or Recovery Day.
- Duration or Distance: Rest or Optional light activity.
- Effort: Rest.
- Explain that recovery is the purpose. Walking or mobility may be
  optional, not a required workout.

Do not omit rest days. Rest days do not count as training sessions.
Keep the same table structure for every week.

PROGRESSION AND GOAL COMPLETION

- Adapt progression to the goal, experience, current ability, and
  available time.
- For beginners, prioritize consistency and easy effort before speed.
- Run-walk intervals may be appropriate during early weeks.
- Where appropriate, progressively build toward continuous running.
- For distance goals such as 5K, 10K, half marathon, or marathon,
  work toward completing the full target distance by the end, if realistic.
- Do not make run-walk intervals the default final goal when the stated
  objective is continuous running, unless the runner's ability makes
  that progression inappropriate.
- Do not confuse completing a distance with achieving a target pace.
  Do not invent pace targets.
- Use a suitable reduced-load week or taper when appropriate.
- Never increase training load aggressively or guarantee success.

## Progression and Adaptation

Explain how the program develops, how to handle missed sessions, and
when to repeat a week rather than progress.

## Recovery and Safety

Give 2–3 concise bullets about recovery, gradual progression, and when
to stop exercising and seek appropriate medical advice. Do not diagnose.

## Your First Step

Give one clear action for the first scheduled session.

Return only the finished Markdown program, without internal reasoning.
`;

    // Try the primary model, then a fallback if necessary.
    const modelsToTry = [
      "gemini-3.5-flash-lite",
      "gemini-3.8-flash",
    ];

    let plan = "";
    let lastError;

    for (const model of modelsToTry) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            httpOptions: {
              timeout: 60000,
            },
          },
        });

        if (
          typeof response.text === "string" &&
          response.text.trim()
        ) {
          plan = response.text.trim();
          console.log(`Plan generated successfully with ${model}.`);
          break;
        }

        lastError = new Error(
          `Model ${model} returned an empty response.`
        );
        console.error(lastError.message);
      } catch (error) {
        lastError = error;
        console.error(
          `Plan generation failed with ${model}:`,
          error.message
        );
      }
    }

    if (!plan) {
      const errorMessage = lastError?.message || "";
      const errorStatus =
        lastError?.status || lastError?.code ||
        lastError?.error?.status;

      const isUnavailable =
        errorStatus === 503 ||
        errorStatus === "503" ||
        errorStatus === "UNAVAILABLE" ||
        /high demand|temporarily unavailable|service unavailable/i.test(
          errorMessage
        );

      if (isUnavailable) {
        return res.status(503).json({
          error:
            "The AI service is busy right now. Please try again in a moment.",
        });
      }

      return res.status(502).json({
        error:
          "The AI service could not generate a plan. Please try again shortly.",
      });
    }

    // Send exactly one successful response.
    return res.json({ plan });
  } catch (error) {
    console.error(
      "Plan generation request failed:",
      error.message
    );

    if (error.status === 400 || error.status === 413) {
      return res.status(400).json({
        error: "The request was invalid. Please check your form and try again.",
      });
    }

    return res.status(500).json({
      error:
        "Unable to generate a plan right now. Please try again shortly.",
    });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`PacePilot AI running on port ${PORT}`);
});
