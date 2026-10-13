
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

    // Validate required fields.
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

    const days = Array.isArray(preferredDays)
      ? preferredDays
          .filter((day) => typeof day === "string")
          .map((day) => day.trim())
          .filter((day) =>
            [
              "Monday",
              "Tuesday",
              "Wednesday",
              "Thursday",
              "Friday",
              "Saturday",
              "Sunday",
            ].includes(day)
          )
          .filter((day, index, all) => all.indexOf(day) === index)
          .slice(0, 7)
      : [];

    if (days.length > 0 && days.length < trainingDays) {
      return res.status(400).json({
        error: "Please select at least as many preferred days as training days.",
      });
    }

    const prompt = `
You are PacePilot, a practical, evidence-informed and responsible running coach.

Create a personalized running plan using only the profile below.
Treat optional fields as missing when they are blank. Do not invent
running history, fitness measurements, injuries, or target paces.

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

PLAN REQUIREMENTS

Return Markdown using this structure:

# Your Running Plan

Give a brief, specific introduction explaining the plan's focus.

## Your Weekly Schedule

Create a table with these columns:
| Day | Workout | Duration or Distance | Effort | Instructions |

- Schedule exactly ${trainingDays} training sessions per week.
- Use preferred days where possible.
- Identify all other days as rest or recovery days outside the table.
- Space demanding sessions apart; beginners should focus on easy effort.
- Explain each session's purpose and instructions clearly.
- Define effort as Easy, Moderate, or Hard.
- Easy effort should feel conversational.
- Include warm-up and cool-down guidance where appropriate.
- Do not invent exact paces or assume the runner can run continuously.
- Adapt duration and distance to the experience and ability provided.

## Your Progression

Give 3-4 actionable bullets about consistency, recovery, and how to
adapt training when a session feels too difficult.

PROGRAM LENGTH AND STRUCTURE

Create a complete, multi-week training program, not just a sample week.

Choose a suitable duration based on the runner's goal, experience,
current ability, and target date.

When no target date is specified, use these starting guidelines:
- General fitness: 4–8 weeks, with a repeatable routine and gradual progression.
- Beginner aiming to complete a 5K: normally 8–12 weeks.
- 10K: normally 10–14 weeks, adjusted to current running ability.
- Half marathon: normally 12–16 weeks for a runner with an appropriate base.
- Marathon: normally 16–24 weeks for a runner with an appropriate base.

These are planning guidelines, not guarantees. Choose a longer or
shorter appropriate plan when the runner's starting ability warrants it.
Do not assume that a beginner is ready for a longer-distance program
without building a suitable foundation.

If a target date is provided:
- Calculate the approximate time available from the current date.
- Choose a realistic program duration that fits the time available.
- If the target is too soon for a responsible progression, explain this
  and recommend a safer alternative rather than forcing the timeline.
- Do not invent a target date if none is provided.

OUTPUT STRUCTURE

# Your Running Plan

Summarize the goal, total program duration, and training approach.

## Program Overview

State:
- Total duration in weeks.
- The main focus of each training phase.
- The expected weekly training frequency.
- Any important assumptions about the runner's current ability.

## Complete Weekly Training Program


WEEKLY SCHEDULE REQUIREMENTS

For every week, create a Markdown table with these columns:

| Day | Workout | Duration or Distance | Effort | Instructions |

The table must contain all seven days of the week, in order.

When preferred training days are provided:
- Use the actual weekday names, Monday through Sunday.
- Schedule exactly the requested number of training sessions.
- Place the workouts on the selected preferred days.
- Label every remaining day as Rest Day or Recovery Day.
- Do not schedule a workout on an unselected day unless the user has
  selected all seven days and the requested frequency allows it.

When no preferred training days are provided:
- Use Day 1 through Day 7, in order.
- Schedule exactly the requested number of training sessions.
- Label all remaining days as Rest Day or Recovery Day.
- Spread workouts across the week to allow adequate recovery.
- Avoid hard workouts on consecutive days.

For every training day:
- Include the workout name, duration or distance, effort, and instructions.
- Keep the instructions concise but actionable.

For every rest or recovery day:
- Set Workout to "Rest Day" or "Recovery Day".
- Set Duration or Distance to "Rest" or "Optional light activity".
- Set Effort to "Rest".
- Explain briefly that the day is for recovery. Gentle walking or
  mobility may be optional, but must not be presented as a required workout.

Do not omit rest days from the table.
Rest days do not count toward the requested training-session frequency.
Keep the same schedule format for every week of the program.

## Progression and Adaptation

Explain how training develops across the program, how to handle missed
sessions, and when to repeat a week instead of progressing.

## Recovery and Safety

Include practical recovery guidance and signs that mean the runner
should stop exercising and seek appropriate medical advice.

## Your First Step

Give one clear action for the first scheduled session.

Return only the finished Markdown program.

Avoid increasing training load aggressively or promising a result.

## Recovery and Safety

Give 2-3 concise bullets about rest, gradual progression, and when
to stop exercising and seek appropriate medical advice.

## Your First Step

Give one concrete, manageable action for the runner's next session.

COACHING RULES
- Match the plan to the goal, experience, available days, and stated ability.
- For beginners, prioritize consistency and easy effort before speed.
- Avoid hard workouts on consecutive days.
- If the target date appears unrealistic, explain the limitation and
  recommend a safer alternative.
- If important details are missing, choose conservative defaults
  and clearly state the assumption rather than inventing facts.
- Do not diagnose medical conditions.
- Keep the plan specific, readable, and practical.
- Return only the finished Markdown plan, without internal reasoning.

GOAL COMPLETION AND FINAL-WEEK REQUIREMENTS

The purpose of the program is to prepare the runner to achieve their
selected goal by the end of the program, provided the goal is realistic
for their starting ability and the available training time.

- For distance goals such as 5K, 10K, half marathon, and marathon,
  make the progression specific to completing the full target distance.
- Run-walk intervals may be used during early weeks when appropriate
  for the runner's experience and current ability.
- Progress from run-walk intervals toward longer continuous running
  when the runner is ready. Do not force this progression if the
  runner's current ability or recovery indicates it is inappropriate.
- In the final training weeks, include a clear, realistic pathway to
  completing the target distance continuously, when appropriate.
- Do not prescribe run-walk intervals as the default final goal for
  a runner whose stated objective is to run the full distance continuously.
- The final week should reflect the selected goal and program phase.
  If appropriate, include a reduced-load week or taper before the goal
  attempt rather than adding excessive training volume.
- Do not guarantee successful completion. If the goal is unrealistic
  for the available time or starting ability, explain why and recommend
  a safer progression.
- Do not confuse completing a distance with achieving a particular
  pace or finishing time. Only prescribe a time goal if the user asks
  for one and sufficient information is available.

`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash-lite",
      contents: prompt,
      config: {
        httpOptions: {
          timeout: 30000,
        },
      },
    });

    if (!response.text || !response.text.trim()) {
      throw new Error("Gemini returned an empty response.");
    }

    res.json({ plan: response.text });
  } catch (error) {
    console.error("Plan generation failed:", error.message);

    res.status(500).json({
      error:
        "Unable to generate a plan right now. Please try again shortly.",
    });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`PacePilot AI running on port ${PORT}`);
});

