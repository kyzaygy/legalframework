"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "contrast";

interface Settings {
  readSize: number;
  readLh: number;
  theme: Theme;
}

const DEFAULTS: Settings = { readSize: 19, readLh: 1.7, theme: "light" };
const STORAGE_KEY = "kodeksy-reading";

function applySettings(settings: Settings): void {
  const root = document.documentElement;
  root.style.setProperty("--read-size", `${settings.readSize}px`);
  root.style.setProperty("--read-lh", String(settings.readLh));
  root.setAttribute("data-theme", settings.theme === "contrast" ? "contrast" : "light");
}

export function ReadingTweaks() {
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState<Settings>(DEFAULTS);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = { ...DEFAULTS, ...(JSON.parse(stored) as Partial<Settings>) };
        setSettings(parsed);
        applySettings(parsed);
      }
    } catch {
      // ignore unreadable storage
    }
  }, []);

  function update<K extends keyof Settings>(key: K, value: Settings[K]): void {
    setSettings((previous) => {
      const next = { ...previous, [key]: value };
      applySettings(next);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore unwritable storage
      }
      return next;
    });
  }

  return (
    <div className="tweaks">
      {open && (
        <div className="tweaks-panel" role="dialog" aria-label="Настройки чтения">
          <div className="tweaks-section">Чтение</div>
          <div className="tweak-slider">
            <label>
              <span>Размер текста</span>
              <span className="value">{settings.readSize} px</span>
            </label>
            <input
              type="range"
              min={16}
              max={24}
              step={1}
              value={settings.readSize}
              onChange={(event) => update("readSize", Number(event.target.value))}
            />
          </div>
          <div className="tweak-slider">
            <label>
              <span>Межстрочный</span>
              <span className="value">{settings.readLh.toFixed(2)}</span>
            </label>
            <input
              type="range"
              min={1.5}
              max={2}
              step={0.05}
              value={settings.readLh}
              onChange={(event) => update("readLh", Number(event.target.value))}
            />
          </div>
          <div className="tweaks-section">Тема</div>
          <div className="tweak-radio" role="group" aria-label="Тема оформления">
            <button
              type="button"
              aria-pressed={settings.theme === "light"}
              onClick={() => update("theme", "light")}
            >
              Светлая
            </button>
            <button
              type="button"
              aria-pressed={settings.theme === "contrast"}
              onClick={() => update("theme", "contrast")}
            >
              Контрастная
            </button>
          </div>
        </div>
      )}
      <button
        className="tweaks-toggle"
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        Aa Вид
      </button>
    </div>
  );
}
