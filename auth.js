"use strict";

const AUTH_SESSION_KEY = "lottery-authenticated";
const LOGIN_USERNAME = "admin";
const LOGIN_PASSWORD = "change-this-password";
const isLoginPage = /(?:^|\/)login\.html$/i.test(window.location.pathname);

if (!isLoginPage && sessionStorage.getItem(AUTH_SESSION_KEY) !== "1") {
  window.location.replace("login.html");
}

document.addEventListener("DOMContentLoaded", () => {
  if (!isLoginPage) return;

  if (sessionStorage.getItem(AUTH_SESSION_KEY) === "1") {
    window.location.replace("index.html");
    return;
  }

  const form = document.getElementById("login-form");
  const usernameInput = document.getElementById("username");
  const passwordInput = document.getElementById("password");
  const message = document.getElementById("login-message");

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    if (usernameInput.value === LOGIN_USERNAME && passwordInput.value === LOGIN_PASSWORD) {
      sessionStorage.setItem(AUTH_SESSION_KEY, "1");
      window.location.replace("index.html");
      return;
    }

    message.textContent = "That username or password doesn't match.";
    message.hidden = false;
    passwordInput.value = "";
    passwordInput.focus();
  });
});
