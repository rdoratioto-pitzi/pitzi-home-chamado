import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "renov-notification-prefs";

export interface NotificationPreferences {
  soundEnabled: boolean;
  pushEnabled: boolean;
  soundVolume: number;
}

const defaultPrefs: NotificationPreferences = {
  soundEnabled: true,
  pushEnabled: true,
  soundVolume: 0.5,
};

export function useNotificationPreferences() {
  const [prefs, setPrefsState] = useState<NotificationPreferences>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) return { ...defaultPrefs, ...JSON.parse(stored) };
    } catch {}
    return defaultPrefs;
  });

  const setPrefs = useCallback((update: Partial<NotificationPreferences>) => {
    setPrefsState((prev) => {
      const next = { ...prev, ...update };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  return { prefs, setPrefs };
}

let audioContext: AudioContext | null = null;

export function playNotificationSound(volume: number = 0.5) {
  try {
    if (!audioContext) {
      audioContext = new AudioContext();
    }
    if (audioContext.state === "suspended") {
      audioContext.resume();
    }
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
    oscillator.frequency.setValueAtTime(1100, audioContext.currentTime + 0.08);
    oscillator.frequency.setValueAtTime(880, audioContext.currentTime + 0.16);

    gainNode.gain.setValueAtTime(volume * 0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.3);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.3);
  } catch {}
}

export async function requestPushPermission(): Promise<boolean> {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  return result === "granted";
}

export function sendBrowserNotification(title: string, body: string, url?: string) {
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  if (document.hasFocus()) return;

  try {
    const notification = new window.Notification(title, {
      body,
      icon: "/favicon.png",
      badge: "/favicon.png",
      tag: "renov-notification-" + Date.now(),
    });

    if (url) {
      notification.onclick = () => {
        window.focus();
        window.location.hash = "";
        window.location.pathname = url;
        notification.close();
      };
    }

    setTimeout(() => notification.close(), 8000);
  } catch {}
}
