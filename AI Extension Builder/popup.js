const promptInput =
  document.getElementById("prompt");

const buildButton =
  document.getElementById(
    "buildButton"
  );

const settingsButton =
  document.getElementById(
    "settingsButton"
  );

const status =
  document.getElementById("status");

const statusTitle =
  document.getElementById(
    "statusTitle"
  );

const statusText =
  document.getElementById(
    "statusText"
  );

const examples =
  document.querySelectorAll(
    ".example"
  );

examples.forEach(button => {
  button.addEventListener(
    "click",
    () => {
      promptInput.value =
        button.textContent.trim();

      promptInput.focus();
    }
  );
});

settingsButton.addEventListener(
  "click",
  () => {
    chrome.runtime.openOptionsPage();
  }
);

buildButton.addEventListener(
  "click",
  build
);

async function build() {
  const prompt =
    promptInput.value.trim();

  if (!prompt) {
    promptInput.focus();
    return;
  }

  setLoading(true);

  try {
    const result =
      await chrome.runtime.sendMessage({
        action: "generateProject",
        prompt,
        files: []
      });

    if (!result.success) {
      throw new Error(
        result.error
      );
    }

    await saveProject(
      result.result
    );

    statusTitle.textContent =
      "Project created";

    statusText.textContent =
      `${result.result.files.length} files generated. Opening editor...`;

    setTimeout(() => {
      chrome.tabs.create({
        url: chrome.runtime.getURL(
          "editor.html"
        )
      });
    }, 700);

  } catch (error) {
    statusTitle.textContent =
      "Build failed";

    statusText.textContent =
      error.message;
  } finally {
    buildButton.disabled =
      false;
  }
}

async function saveProject(project) {
  const projectId =
    crypto.randomUUID();

  const savedProject = {
    id: projectId,

    name:
      project.projectName ||
      "Untitled Extension",

    description:
      project.description || "",

    files:
      project.files || [],

    notes:
      project.notes || [],

    createdAt:
      Date.now(),

    updatedAt:
      Date.now()
  };

  const data =
    await chrome.storage.local.get(
      "projects"
    );

  const projects =
    data.projects || [];

  projects.unshift(
    savedProject
  );

  await chrome.storage.local.set({
    projects
  });

  await chrome.storage.local.set({
    activeProjectId:
      projectId
  });
}

function setLoading(value) {
  buildButton.disabled =
    value;

  status.classList.toggle(
    "hidden",
    !value
  );

  if (value) {
    statusTitle.textContent =
      "Building...";

    statusText.textContent =
      "AI is generating your project files.";
  }
}
