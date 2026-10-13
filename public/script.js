
const form = document.getElementById("plan-form");
const button = document.getElementById("generate-btn");
const result = document.getElementById("result");
const planContent = document.getElementById("plan-content");
const errorMessage = document.getElementById("error-message");
const dateInput = document.getElementById("date");

dateInput.min = new Date().toLocaleDateString("en-CA");

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  errorMessage.hidden = true;
  result.hidden = true;
  button.disabled = true;
  button.innerHTML = "Creating your plan...";

  const formData = new FormData(form);

  const payload = {
    goal: formData.get("goal"),
    experience: formData.get("experience"),
    daysPerWeek: Number(formData.get("daysPerWeek")),
    targetDate: formData.get("targetDate"),
  };

  try {
    const response = await fetch("/api/generate-plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Unable to generate your plan.");
    }

    if (!data.plan) {
      throw new Error("The AI returned an empty plan. Please try again.");
    }

    // Render model output as text-safe Markdown.
    planContent.innerHTML = marked.parse(data.plan);
    result.hidden = false;
    result.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    errorMessage.textContent =
      error.message || "Something went wrong. Please try again.";
    errorMessage.hidden = false;
  } finally {
    button.disabled = false;
    button.innerHTML = 'Generate my plan <span>→</span>';
  }
});
