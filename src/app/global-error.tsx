"use client";

// Запасной обработчик для ошибок в корневом layout. Никаких деталей ошибки.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="ru">
      <body>
        <div style={{ padding: "4rem 1.5rem", textAlign: "center", fontFamily: "system-ui, sans-serif" }}>
          <p style={{ fontSize: "1.25rem", fontWeight: 600 }}>Что-то пошло не так</p>
          <p>Попробуйте обновить страницу или зайдите позже.</p>
          <p>
            <button type="button" onClick={reset}>
              Попробовать снова
            </button>
          </p>
        </div>
      </body>
    </html>
  );
}
