
const form = document.getElementById("plan-form");
const button = document.getElementById("generate-btn");
const result = document.getElementById("result");
const planContent = document.getElementById("plan-content");
const errorMessage = document.getElementById("error-message");
const loadingMessage = document.getElementById("loading-message");
const dateInput = document.getElementById("date");
const daysSelect = document.getElementById("days");
const daysHint = document.getElementById("days-hint");

const buttonLabel = button.querySelector(".button-label");
const dayCheckboxes = [
  ...form.querySelectorAll('input[name="preferredDays"]'),
];

// Use the user's local date rather than relying on browser locale formatting.
function getLocalDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

dateInput.min = getLocalDateString();

// Keep the preferred-day selection consistent with the requested frequency.
function updatePreferredDaysHint() {
  const selectedCount = dayCheckboxes.filter(
    (checkbox) => checkbox.checked
  ).length;

  const requiredCount = Number(daysSelect.value);

  if (selectedCount === 0) {
    daysHint.textContent =
      "Leave all days unselected to let your coach choose a schedule.";
    return;
  }

  if (selectedCount < requiredCount) {
    daysHint.textContent =
      `Select at least ${requiredCount} days. ` +
      `${selectedCount} currently selected.`;
    return;
  }

  daysHint.textContent =
    `${selectedCount} preferred day${selectedCount === 1 ? "" : "s"} selected.`;
}

daysSelect.addEventListener("change", updatePreferredDaysHint);

dayCheckboxes.forEach((checkbox) => {
  checkbox.addEventListener("change", () => {
    const selected = dayCheckboxes.filter(
      (item) => item.checked
    );

    // Do not allow more preferred days than the weekly session count.
    if (selected.length > Number(daysSelect.value)) {
      checkbox.checked = false;
      daysHint.textContent =
        `You selected the maximum of ${daysSelect.value} preferred days.`;
      return;
    }

    updatePreferredDaysHint();
  });
});

updatePreferredDaysHint();

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  errorMessage.hidden = true;
  errorMessage.textContent = "";
  result.hidden = true;
  loadingMessage.hidden = false;
  button.disabled = true;
  button.setAttribute("aria-busy", "true");

  if (buttonLabel) {
    buttonLabel.textContent = "Creating your plan...";
  }

  const formData = new FormData(form);

  const preferredDays = formData.getAll("preferredDays");
  const daysPerWeek = Number(formData.get("daysPerWeek"));

  if (
    preferredDays.length > 0 &&
    preferredDays.length < daysPerWeek
  ) {
    loadingMessage.hidden = true;
    button.disabled = false;
    button.removeAttribute("aria-busy");

    if (buttonLabel) {
      buttonLabel.textContent = "Generate my plan";
    }

    errorMessage.textContent =
      `Please select at least ${daysPerWeek} preferred training days, ` +
      "or clear all selections to let your coach choose.";
    errorMessage.hidden = false;
    return;
  }

  const payload = {
    goal: formData.get("goal"),
    experience: formData.get("experience"),
    daysPerWeek,
    targetDate: formData.get("targetDate"),
    currentAbility: formData.get("currentAbility"),
    preferredDays,
    additionalNotes: formData.get("additionalNotes"),
  };

  try {
    const response = await fetch("/api/generate-plan", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.error || "Unable to generate your plan."
      );
    }

    if (
      typeof data.plan !== "string" ||
      !data.plan.trim()
    ) {
      throw new Error(
        "The AI returned an empty plan. Please try again."
      );
    }

    if (typeof marked === "undefined") {
      throw new Error(
        "The plan display library could not be loaded. Refresh and try again."
      );
    }

    const renderedMarkdown = marked.parse(data.plan);

    // Sanitize generated HTML before inserting it into the page.
    if (typeof DOMPurify === "undefined") {
      throw new Error(
        "The secure plan display library could not be loaded. Refresh and try again."
      );
    }

    planContent.innerHTML = DOMPurify.sanitize(renderedMarkdown);

    result.hidden = false;
    result.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  } catch (error) {
    console.error("Plan request failed:", error);

    errorMessage.textContent =
      error.message ||
      "Something went wrong. Please try again.";
    errorMessage.hidden = false;
  } finally {
    loadingMessage.hidden = true;
    button.disabled = false;
    button.removeAttribute("aria-busy");

    if (buttonLabel) {
      buttonLabel.textContent = "Generate my plan";
    }
  }
});
