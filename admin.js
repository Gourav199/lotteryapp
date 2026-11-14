"use strict";

function showMessage(text, ok) {
  const message = document.getElementById("admin-message");
  message.textContent = text;
  message.hidden = !text;
  message.classList.toggle("ok", Boolean(ok));
}

async function readJson(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

function formatWhen(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function renderAccounts(accounts) {
  const body = document.getElementById("account-rows");
  const empty = document.getElementById("empty");
  const table = document.querySelector(".table-wrap");
  body.replaceChildren();
  empty.hidden = accounts.length > 0;
  table.hidden = accounts.length === 0;

  for (const account of accounts) {
    const row = document.createElement("tr");

    const name = document.createElement("td");
    name.textContent = account.username;

    const secret = document.createElement("td");
    secret.className = "secret";
    if (!account.password) {
      secret.textContent = "—";
    } else {
      const line = document.createElement("div");
      line.className = "secret-line";
      const value = document.createElement("span");
      value.className = "secret-value masked";
      value.textContent = "••••••••";
      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "ghost";
      toggle.textContent = "Unhide";
      toggle.setAttribute("aria-pressed", "false");
      toggle.setAttribute("aria-label", `Unhide password for ${account.username}`);
      let visible = false;
      toggle.addEventListener("click", () => {
        visible = !visible;
        value.textContent = visible ? account.password : "••••••••";
        value.classList.toggle("masked", !visible);
        toggle.textContent = visible ? "Hide" : "Unhide";
        toggle.setAttribute("aria-pressed", visible ? "true" : "false");
        toggle.setAttribute("aria-label", `${visible ? "Hide" : "Unhide"} password for ${account.username}`);
      });
      line.append(value, toggle);
      secret.append(line);
    }

    const when = document.createElement("td");
    when.textContent = formatWhen(account.createdAt);

    const actions = document.createElement("td");
    const actionRow = document.createElement("div");
    actionRow.className = "row-actions";

    const copy = document.createElement("button");
    copy.type = "button";
    copy.className = "ghost";
    copy.textContent = "Copy";
    copy.disabled = !account.password;
    copy.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(`${account.username}\n${account.password}`);
        copy.textContent = "Copied";
        window.setTimeout(() => {
          copy.textContent = "Copy";
        }, 1200);
      } catch {
        showMessage("Could not copy those details.");
      }
    });

    const editor = document.createElement("form");
    editor.className = "inline";
    const input = document.createElement("input");
    input.type = "text";
    input.required = true;
    input.minLength = 8;
    input.maxLength = 72;
    input.autocomplete = "off";
    input.spellcheck = false;
    input.placeholder = "New password";
    input.setAttribute("aria-label", `New password for ${account.username}`);
    const save = document.createElement("button");
    save.type = "submit";
    save.className = "ghost";
    save.textContent = "Save";
    editor.append(input, save);
    editor.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (input.value.length < 8 || input.value.length > 72) {
        showMessage("Password must be 8–72 characters.");
        return;
      }
      save.disabled = true;
      try {
        const response = await fetch("/api/admin/users", {
          method: "PATCH",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: account.username, password: input.value }),
        });
        const payload = await readJson(response);
        if (!response.ok) {
          showMessage(payload.error || "Could not update that password.");
          return;
        }
        showMessage(`Updated the password for ${account.username}.`, true);
        await loadAccounts();
      } catch {
        showMessage("Could not reach the server.");
      } finally {
        save.disabled = false;
      }
    });

    actionRow.append(copy, editor);
    actions.append(actionRow);
    row.append(name, secret, when, actions);
    body.append(row);
  }
}

async function loadAccounts() {
  const response = await fetch("/api/admin/users", { credentials: "same-origin" });
  const payload = await readJson(response);
  if (response.status === 401) {
    window.location.replace("login.html");
    return;
  }
  if (!response.ok) {
    showMessage(payload.error || "Could not load accounts.");
    return;
  }
  renderAccounts(payload.accounts || []);
}

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("create-form");
  const submit = document.getElementById("create-button");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    showMessage("");
    const username = document.getElementById("new-username").value.trim().toLowerCase();
    const password = document.getElementById("new-password").value;
    if (!/^[a-z0-9_]{3,32}$/.test(username)) {
      showMessage("Use 3–32 letters, numbers, or underscores.");
      return;
    }
    if (password.length < 8 || password.length > 72) {
      showMessage("Password must be 8–72 characters.");
      return;
    }

    submit.disabled = true;
    submit.textContent = "Creating…";
    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const payload = await readJson(response);
      if (!response.ok) {
        showMessage(payload.error || "Could not create that account.");
        return;
      }
      form.reset();
      showMessage(`Created ${payload.username}.`, true);
      await loadAccounts();
    } catch {
      showMessage("Could not reach the server.");
    } finally {
      submit.disabled = false;
      submit.textContent = "Create account";
    }
  });

  loadAccounts().catch(() => showMessage("Could not reach the server."));
});
