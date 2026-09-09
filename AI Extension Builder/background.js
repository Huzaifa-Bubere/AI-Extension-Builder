const DEFAULT_SETTINGS = {
  apiKey: "",
  model: "gpt-5.6-luna",
  theme: "dark"
};

chrome.runtime.onInstalled.addListener(async () => {
  const data = await chrome.storage.local.get("settings");

  if (!data.settings) {
    await chrome.storage.local.set({
      settings: DEFAULT_SETTINGS
    });
  }
});

chrome.runtime.onMessage.addListener(
  (message, sender, sendResponse) => {
    if (message.action === "generateProject") {
      generateProject(message.prompt, message.files)
        .then(result => {
          sendResponse({
            success: true,
            result
          });
        })
        .catch(error => {
          sendResponse({
            success: false,
            error: error.message
          });
        });

      return true;
    }

    if (message.action === "fixProject") {
      fixProject(
        message.error,
        message.files
      )
        .then(result => {
          sendResponse({
            success: true,
            result
          });
        })
        .catch(error => {
          sendResponse({
            success: false,
            error: error.message
          });
        });

      return true;
    }
  }
);

async function getSettings() {
  const data =
    await chrome.storage.local.get(
      "settings"
    );

  return {
    ...DEFAULT_SETTINGS,
    ...(data.settings || {})
  };
}

async function callOpenAI(prompt) {
  const settings = await getSettings();

  if (!settings.apiKey) {
    throw new Error(
      "OpenAI API key is not configured. Open Settings and add your API key."
    );
  }

  const response = await fetch(
    "https://api.openai.com/v1/responses",
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
        "Authorization":
          `Bearer ${settings.apiKey}`
      },

      body: JSON.stringify({
        model: settings.model,

        input: [
          {
            role: "developer",
            content: [
              {
                type: "input_text",
                text: `
You are an expert Chrome Extension engineer.

You build production-quality Manifest V3 Chrome extensions.

Always:
- use Manifest V3
- create valid JSON
- avoid deprecated APIs
- keep permissions minimal
- escape strings correctly
- produce complete files
- make code modular
- handle errors
- never leave TODO placeholders
- never omit required files
- never use Markdown fences around JSON output

Your response MUST be valid JSON.

Expected format:

{
  "projectName": "string",
  "description": "string",
  "files": [
    {
      "path": "manifest.json",
      "content": "complete file content"
    }
  ],
  "notes": [
    "string"
  ]
}

Do not return anything outside the JSON object.
`
              }
            ]
          },

          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: prompt
              }
            ]
          }
        ]
      })
    }
  );

  if (!response.ok) {
    const text =
      await response.text();

    throw new Error(
      `OpenAI API error ${response.status}: ${text}`
    );
  }

  const data =
    await response.json();

  return extractOutputText(data);
}

async function generateProject(
  prompt,
  existingFiles = []
) {
  const context =
    existingFiles.length > 0
      ? `
Existing project:

${JSON.stringify(
  existingFiles,
  null,
  2
)}

Modify or extend the existing project where appropriate.
`
      : "";

  const finalPrompt = `
Build a complete Chrome extension based on this request:

${prompt}

${context}

Return every file required for the extension to work.

Include:
- manifest.json
- popup files when appropriate
- background service worker when appropriate
- content scripts when appropriate
- options/settings when appropriate
- CSS
- JavaScript
- HTML

Do not generate binary files.

For icons, reference icon.png but do not generate binary data.

${existingFiles.length > 0
    ? "Preserve working functionality unless the request requires changing it."
    : ""}
`;

  const text =
    await callOpenAI(finalPrompt);

  return parseProject(text);
}

async function fixProject(
  error,
  files
) {
  const prompt = `
Fix this Chrome extension.

ERROR:
${error}

CURRENT FILES:
${JSON.stringify(
  files,
  null,
  2
)}

Find the root cause.

Return the COMPLETE corrected files.

Do not return partial patches.

Return JSON:

{
  "projectName": "string",
  "description": "string",
  "files": [
    {
      "path": "filename",
      "content": "complete content"
    }
  ],
  "notes": []
}
`;

  const text =
    await callOpenAI(prompt);

  return parseProject(text);
}

function extractOutputText(response) {
  if (
    typeof response.output_text ===
    "string"
  ) {
    return response.output_text;
  }

  let result = "";

  for (const item of response.output || []) {
    if (item.type !== "message") {
      continue;
    }

    for (const content of item.content || []) {
      if (
        content.type ===
        "output_text"
      ) {
        result += content.text;
      }
    }
  }

  return result;
}

function parseProject(text) {
  let cleaned =
    text.trim();

  if (
    cleaned.startsWith("```")
  ) {
    cleaned =
      cleaned
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/\s*```$/i, "");
  }

  let parsed;

  try {
    parsed =
      JSON.parse(cleaned);
  } catch {
    const start =
      cleaned.indexOf("{");

    const end =
      cleaned.lastIndexOf("}");

    if (
      start === -1 ||
      end === -1
    ) {
      throw new Error(
        "AI returned invalid project JSON."
      );
    }

    parsed =
      JSON.parse(
        cleaned.slice(
          start,
          end + 1
        )
      );
  }

  if (
    !Array.isArray(parsed.files)
  ) {
    throw new Error(
      "AI response does not contain a files array."
    );
  }

  parsed.files =
    parsed.files.filter(file =>
      file &&
      typeof file.path === "string" &&
      typeof file.content === "string"
    );

  return parsed;
}
