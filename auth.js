"use strict";

const isLoginPage = /(?:^|\/)login\.html$/i.test(window.location.pathname);
const isAdminPage = /(?:^|\/)admin\.html$/i.test(window.location.pathname);

function showLoginMessage(text) {
  const message = document.getElementById("login-message");
  if (!message) return;
  message.textContent = text;
  message.hidden = !text;
}

async function readJson(response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

async function signOut() {
  const button = document.getElementById("sign-out");
  if (button) button.disabled = true;
  try {
    await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
  } finally {
    sessionStorage.setItem("lottery-signed-out", "1");
    window.location.replace("login.html");
  }
}

function showAdminLink() {
  const add = () => {
    const actions = document.querySelector(".header-actions");
    if (!actions || document.getElementById("admin-link")) return;
    const link = document.createElement("a");
    link.id = "admin-link";
    link.className = "sign-out";
    link.href = "admin.html";
    link.textContent = "Accounts";
    actions.prepend(link);
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", add, { once: true });
  } else {
    add();
  }
}

async function requireSession() {
  document.documentElement.style.visibility = "hidden";
  try {
    const response = await fetch("/api/auth/me", {
      credentials: "same-origin",
      signal: AbortSignal.timeout(8000),
    });
    const payload = await readJson(response);
    if (!response.ok || !payload.signedIn) {
      window.location.replace("login.html");
      return;
    }
    if (isAdminPage && payload.role !== "admin") {
      window.location.replace("index.html");
      return;
    }
    if (payload.role === "admin") showAdminLink();
    document.documentElement.style.visibility = "";
  } catch {
    window.location.replace("login.html");
  }
}

if (!isLoginPage) {
  window.addEventListener("DOMContentLoaded", () => {
    const button = document.getElementById("sign-out");
    if (button) button.addEventListener("click", signOut);
  });
  requireSession();
}

document.addEventListener("DOMContentLoaded", () => {
  if (!isLoginPage) return;

  const form = document.getElementById("login-form");
  const usernameInput = document.getElementById("username");
  const passwordInput = document.getElementById("password");
  const submitButton = document.getElementById("submit-button");

  const justSignedOut = sessionStorage.getItem("lottery-signed-out") === "1";
  sessionStorage.removeItem("lottery-signed-out");
  if (!justSignedOut) {
    fetch("/api/auth/me", { credentials: "same-origin" }).then(async (response) => {
      const payload = await readJson(response);
      if (response.ok && payload.signedIn) window.location.replace("index.html");
    }).catch(() => {});
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    showLoginMessage("");

    const username = usernameInput.value.trim().toLowerCase();
    const password = passwordInput.value;
    if (!username || !password) {
      showLoginMessage("Enter a username and password.");
      return;
    }

    submitButton.disabled = true;
    submitButton.textContent = "Signing in…";

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const payload = await readJson(response);
      if (!response.ok) {
        showLoginMessage(payload.error || "Could not sign in right now.");
        passwordInput.value = "";
        passwordInput.focus();
        return;
      }
      window.location.replace(payload.role === "admin" ? "admin.html" : "index.html");
    } catch {
      showLoginMessage("Could not reach the sign-in service.");
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = "Sign in";
    }
  });
});
