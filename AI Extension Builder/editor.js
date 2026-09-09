let project = null;
let currentFileIndex = -1;

const projectName =
  document.getElementById(
    "projectName"
  );

const fileList =
  document.getElementById(
    "fileList"
  );

const currentFile =
  document.getElementById(
    "currentFile"
  );

const codeEditor =
  document.getElementById(
    "codeEditor"
  );

const fileStatus =
  document.getElementById(
    "fileStatus"
  );

const validationStatus =
  document.getElementById(
    "validationStatus"
  );

const chat =
  document.getElementById(
    "chat"
  );

const aiPrompt =
  document.getElementById(
    "aiPrompt"
  );

document.addEventListener(
  "DOMContentLoaded",
  loadProject
);

async function loadProject() {
  const data =
    await chrome.storage.local.get([
      "projects",
      "activeProjectId"
    ]);

  const projects =
    data.projects || [];

  project =
    projects.find(
      p =>
        p.id ===
        data.activeProjectId
    );

  if (!project) {
    project = {
      id: crypto.randomUUID(),

      name:
        "My Extension",

      description: "",

      files: [
        {
          path: "manifest.json",

          content:
`{
  "manifest_version": 3,
  "name": "My Extension",
  "version": "1.0.0",
  "description": "My Chrome extension",
  "action": {
    "default_popup": "popup.html"
  }
}`
        }
      ],

      notes: [],

      createdAt: Date.now(),

      updatedAt: Date.now()
    };
  }

  renderProject();

  addMessage(
    "ai",
    "Project loaded. Tell me what you want to change."
  );
}

function renderProject() {
  projectName.textContent =
    project.name;

  renderFiles();

  if (
    project.files.length > 0
  ) {
    selectFile(
      currentFileIndex >= 0
        ? currentFileIndex
        : 0
    );
  }
}

function renderFiles() {
  fileList.innerHTML = "";

  project.files.forEach(
    (file, index) => {

      const element =
        document.createElement(
          "div"
        );

      element.className =
        "file";

      if (
        index === currentFileIndex
      ) {
        element.classList.add(
          "active"
        );
      }

      element.textContent =
        file.path;

      element.addEventListener(
        "click",
        () => {
          saveCurrentFile();
          selectFile(index);
        }
      );

      fileList.appendChild(
        element
      );
    }
  );
}

function selectFile(index) {
  currentFileIndex = index;

  const file =
    project.files[index];

  if (!file) {
    currentFile.textContent =
      "No file";

    codeEditor.value = "";

    return;
  }

  currentFile.textContent =
    file.path;

  codeEditor.value =
    file.content;

  fileStatus.textContent =
    "";

  renderFiles();
}

function saveCurrentFile() {
  if (
    currentFileIndex < 0
  ) {
    return;
  }

  project.files[
    currentFileIndex
  ].content =
    codeEditor.value;
}

document.getElementById(
  "saveProject"
).addEventListener(
  "click",
  async () => {

    saveCurrentFile();

    project.updatedAt =
      Date.now();

    const data =
      await chrome.storage.local.get(
        "projects"
      );

    const projects =
      data.projects || [];

    const index =
      projects.findIndex(
        p => p.id === project.id
      );

    if (index >= 0) {
      projects[index] =
        project;
    } else {
      projects.unshift(
        project
      );
    }

    await chrome.storage.local.set({
      projects
    });

    validationStatus.textContent =
      "✓ Saved";
  }
);

document.getElementById(
  "validateButton"
).addEventListener(
  "click",
  validateProject
);

async function validateProject() {
  saveCurrentFile();

  const errors = [];

  const manifest =
    project.files.find(
      f =>
        f.path ===
        "manifest.json"
    );

  if (!manifest) {
    errors.push(
      "manifest.json is missing."
    );
  } else {
    try {
      const json =
        JSON.parse(
          manifest.content
        );

      if (
        json.manifest_version !==
        3
      ) {
        errors.push(
          "manifest_version must be 3."
        );
      }

      if (!json.name) {
        errors.push(
          "manifest.name is missing."
        );
      }

      if (!json.version) {
        errors.push(
          "manifest.version is missing."
        );
      }

    } catch (error) {
      errors.push(
        `Invalid manifest JSON: ${error.message}`
      );
    }
  }

  const paths =
    new Set(
      project.files.map(
        f => f.path
      )
    );

  if (manifest) {
    const manifestJson =
      JSON.parse(
        manifest.content
      );

    const references =
      [];

    if (
      manifestJson.action
        ?.default_popup
    ) {
      references.push(
        manifestJson.action
          .default_popup
      );
    }

    if (
      manifestJson.background
        ?.service_worker
    ) {
      references.push(
        manifestJson.background
          .service_worker
      );
    }

    for (
      const reference
      of references
    ) {
      if (
        !paths.has(reference)
      ) {
        errors.push(
          `Referenced file is missing: ${reference}`
        );
      }
    }
  }

  if (errors.length) {
    validationStatus.textContent =
      `✗ ${errors.length} error(s)`;

    addMessage(
      "ai",
      "Validation errors:\n\n" +
      errors.join("\n")
    );

    return errors;
  }

  validationStatus.textContent =
    "✓ Project valid";

  addMessage(
    "ai",
    "✓ Basic project validation passed."
  );

  return [];
}

document.getElementById(
  "askButton"
).addEventListener(
  "click",
  askAI
);

async function askAI() {
  const prompt =
    aiPrompt.value.trim();

  if (!prompt) {
    return;
  }

  saveCurrentFile();

  addMessage(
    "user",
    prompt
  );

  aiPrompt.value = "";

  addMessage(
    "ai",
    "Working on your request..."
  );

  try {
    const response =
      await chrome.runtime.sendMessage({
        action:
          "generateProject",

        prompt,

        files:
          project.files
      });

    if (!response.success) {
      throw new Error(
        response.error
      );
    }

    applyAIProject(
      response.result
    );

    replaceLastAIMessage(
      `Done. I updated ${response.result.files.length} project files.`
    );

  } catch (error) {

    replaceLastAIMessage(
      `Error: ${error.message}`
    );
  }
}

document.getElementById(
  "fixButton"
).addEventListener(
  "click",
  async () => {

    const errors =
      await validateProject();

    if (!errors.length) {
      addMessage(
        "ai",
        "I don't see any validation errors to fix."
      );

      return;
    }

    addMessage(
      "user",
      "Fix the project errors."
    );

    addMessage(
      "ai",
      "Analyzing and fixing..."
    );

    try {
      const response =
        await chrome.runtime.sendMessage({
          action: "fixProject",

          error:
            errors.join("\n"),

          files:
            project.files
        });

      if (!response.success) {
        throw new Error(
          response.error
        );
      }

      applyAIProject(
        response.result
      );

      replaceLastAIMessage(
        "✓ I fixed the detected problems."
      );

    } catch (error) {
      replaceLastAIMessage(
        `Fix failed: ${error.message}`
      );
    }
  }
);

function applyAIProject(result) {
  if (
    result.projectName
  ) {
    project.name =
      result.projectName;
  }

  if (
    result.description
  ) {
    project.description =
      result.description;
  }

  project.files =
    result.files;

  project.updatedAt =
    Date.now();

  currentFileIndex = 0;

  renderProject();

  saveProjectSilently();
}

async function saveProjectSilently() {
  const data =
    await chrome.storage.local.get(
      "projects"
    );

  const projects =
    data.projects || [];

  const index =
    projects.findIndex(
      p => p.id === project.id
    );

  if (index >= 0) {
    projects[index] =
      project;
  } else {
    projects.unshift(
      project
    );
  }

  await chrome.storage.local.set({
    projects
  });
}

function addMessage(
  type,
  text
) {
  const message =
    document.createElement(
      "div"
    );

  message.className =
    `message ${type}`;

  message.textContent =
    text;

  chat.appendChild(
    message
  );

  chat.scrollTop =
    chat.scrollHeight;
}

function replaceLastAIMessage(
  text
) {
  const messages =
    chat.querySelectorAll(
      ".message.ai"
    );

  const last =
    messages[messages.length - 1];

  if (last) {
    last.textContent =
      text;
  }
}

document.getElementById(
  "downloadProject"
).addEventListener(
  "click",
  downloadProject
);

async function downloadProject() {
  saveCurrentFile();

  for (
    const file
    of project.files
  ) {
    const blob =
      new Blob(
        [file.content],
        {
          type:
            "text/plain;charset=utf-8"
        }
      );

    const url =
      URL.createObjectURL(
        blob
      );

    const filename =
      `${project.name.replace(/[^a-z0-9-_]/gi, "-")}/${file.path}`;

    await chrome.downloads.download({
      url,
      filename,
      saveAs: false
    });

    setTimeout(
      () =>
        URL.revokeObjectURL(
          url
        ),
      5000
    );
  }

  validationStatus.textContent =
    "✓ Files downloaded";
}

document.getElementById(
  "addFile"
).addEventListener(
  "click",
  () => {

    const filename =
      prompt(
        "File name:",
        "new-file.js"
      );

    if (!filename) {
      return;
    }

    project.files.push({
      path: filename,
      content: ""
    });

    currentFileIndex =
      project.files.length - 1;

    renderProject();
  }
);

document.getElementById(
  "newProject"
).addEventListener(
  "click",
  () => {

    chrome.tabs.create({
      url:
        chrome.runtime.getURL(
          "popup.html"
        )
    });
  }
);

document.getElementById(
  "settingsButton"
).addEventListener(
  "click",
  () => {
    chrome.runtime.openOptionsPage();
  }
);
