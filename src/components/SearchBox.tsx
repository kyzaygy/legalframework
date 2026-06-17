"use client";

import { useRouter } from "next/navigation";
import { SearchIcon } from "./icons";

interface SearchBoxProps {
  placeholder: string;
}

export function SearchBox({ placeholder }: SearchBoxProps) {
  const router = useRouter();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = new FormData(event.currentTarget).get("q");
    const query = value?.toString().trim() ?? "";
    router.push(query ? `/search?q=${encodeURIComponent(query)}` : "/search");
  }

  return (
    <form className="searchbox" role="search" onSubmit={handleSubmit}>
      <SearchIcon size={17} />
      <input
        type="search"
        name="q"
        placeholder={placeholder}
        aria-label="Поиск по статьям и кодексам"
        autoComplete="off"
      />
      <button className="go" type="submit">
        Найти
      </button>
    </form>
  );
}
