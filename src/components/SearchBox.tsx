"use client";

import { useRouter } from "next/navigation";
import { SearchIcon } from "./icons";

interface SearchBoxProps {
  variant: "bar" | "hero";
  placeholder: string;
  defaultValue?: string;
  autoFocus?: boolean;
}

export function SearchBox({ variant, placeholder, defaultValue, autoFocus }: SearchBoxProps) {
  const router = useRouter();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = new FormData(event.currentTarget).get("q");
    const query = value?.toString().trim() ?? "";
    router.push(query ? `/search?q=${encodeURIComponent(query)}` : "/search");
  }

  return (
    <form className={variant === "hero" ? "hero-search" : "searchbox"} role="search" onSubmit={handleSubmit}>
      <SearchIcon size={variant === "hero" ? 20 : 17} />
      <input
        type="search"
        name="q"
        placeholder={placeholder}
        aria-label="Поиск по статьям и кодексам"
        autoComplete="off"
        defaultValue={defaultValue}
        autoFocus={autoFocus}
      />
      <button className="go" type="submit">
        Найти
      </button>
    </form>
  );
}
