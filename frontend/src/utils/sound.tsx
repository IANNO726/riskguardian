export function playNotification() {
  const audio = new Audio("/sounds/notify.mp3");
  audio.volume = 0.5;
  audio.play().catch(() => {});
}

