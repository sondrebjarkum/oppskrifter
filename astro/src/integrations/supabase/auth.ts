import { supabase } from "./supabase-client.js";

export async function login({ email, password }: { email: string, password: string }) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email,
    password: password,
  });

  if (error) {
    console.error("Login failed:", error);
    alert("Wrong username or password");
    return null;
  }

  localStorage.setItem("email", email);

  return data;
}

export async function logOut() {
  const { error } = await supabase.auth.signOut();

  if (error) {
    console.error("Error logging out:", error);
  }

  localStorage.removeItem("email");
  window.location.reload();
}

export async function verifySession() {
  const { error } = await supabase.auth.getUser();

  if (error) {
    console.error("Invalid session token:", error.message);
    return false;
  }

  return true;
}

export function weakVerifySession() {
  return document.documentElement.dataset.loggedIn === "true";
}