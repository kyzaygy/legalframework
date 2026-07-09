"use client";

import { useEffect, useRef, useState } from "react";

// Маркер пункта («1.», «а)») как якорная ссылка: клик ставит #якорь в адрес
// и копирует полную ссылку на пункт в буфер обмена.
export function AnchorMark({ id, marker }: { id: string; marker: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  function handleClick() {
    const url = `${location.origin}${location.pathname}#${id}`;
    navigator.clipboard?.writeText(url).then(
      () => {
        setCopied(true);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => setCopied(false), 1600);
      },
      () => {
        // Буфер недоступен (http, старый браузер) — просто якорь.
      },
    );
  }

  return (
    <a
      className="mk mk-anchor"
      href={`#${id}`}
      title="Скопировать ссылку на пункт"
      onClick={handleClick}
    >
      {marker}
      {copied && (
        <span className="mk-copied" role="status">
          Ссылка скопирована
        </span>
      )}
    </a>
  );
}
