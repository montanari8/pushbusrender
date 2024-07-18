const publicVapidKey = "BGzhoR-UB7WPENnX8GsiKD90O8hLL7j8EPNL3ERqEiUUw1go74KBLCbiInuD_oamyCI5AjtScd2h8fqifk9fpjA"; // REPLACE_WITH_YOUR_KEY


// Use a URL base da API a partir de uma variável de ambiente ou um valor padrão
const apiBaseUrl = process.env.API_BASE_URL;
//const apiBaseUrl = "http://localhost:3000";

// Check for service worker
if ("serviceWorker" in navigator) {
  send().catch((err) => console.error(err));
}

// Register SW, Register Push, Send Push
async function send() {
  // Register Service Worker
  console.log("Registrando service worker...");
  const register = await navigator.serviceWorker.register("./sw.js", {
    scope: "/",
  });
  console.log("Service Worker Registrado..");

  // Register Push
  console.log("Registrando Push...");
  const subscription = await register.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicVapidKey),
  });
  console.log("Push Registrado...");

  // Send Push Notification
  console.log("Enviando Push...");
  await fetch(`${apiBaseUrl}/subscribe`, {
    method: "POST",
    body: JSON.stringify(subscription),
    headers: {
      "content-type": "application/json",
    },
  });
  console.log("Push enviado...");
}

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, "+")
    .replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
