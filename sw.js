console.log("Service Worker Loaded...");

self.addEventListener("push", (e) => {
  const data = e.data.json();
  console.log("Push Recieved...");

  self.registration.showNotification(data.title, {
    icon: './pushbus_icon_192x192',
    body: data.body,
  });
});
