const apiKey =
  document.getElementById(
    "apiKey"
  );

const model =
  document.getElementById(
    "model"
  );

const saveButton =
  document.getElementById(
    "save"
  );

const status =
  document.getElementById(
    "status"
  );

document.addEventListener(
  "DOMContentLoaded",
  loadSettings
);

async function loadSettings() {
  const data =
    await chrome.storage.local.get(
      "settings"
    );

  const settings =
    data.settings || {};

  apiKey.value =
    settings.apiKey || "";

  model.value =
    settings.model ||
    "gpt-5.6-luna";
}

saveButton.addEventListener(
  "click",
  async () => {

    await chrome.storage.local.set({
      settings: {
        apiKey:
          apiKey.value.trim(),

        model:
          model.value,

        theme:
          "dark"
      }
    });

    status.textContent =
      "✓ Settings saved";

    setTimeout(() => {
      status.textContent = "";
    }, 2000);
  }
);
