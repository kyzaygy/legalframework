import Link from "next/link";

export default function NotFound() {
  return (
    <div className="shell">
      <div className="state">
        <p className="big">Страница не найдена</p>
        <p>
          Возможно, статья или кодекс не существует. <Link href="/">Вернуться на главную →</Link>
        </p>
      </div>
    </div>
  );
}
