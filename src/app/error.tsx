"use client";

// Детали ошибки (сообщение, стектрейс, ошибки Postgres) намеренно не выводятся:
// в production Next передаёт сюда только обезличенный digest.
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="shell">
      <div className="state">
        <p className="big">Что-то пошло не так</p>
        <p>Попробуйте обновить страницу или зайдите позже.</p>
        <p>
          <button type="button" onClick={reset}>
            Попробовать снова
          </button>
        </p>
      </div>
    </div>
  );
}
