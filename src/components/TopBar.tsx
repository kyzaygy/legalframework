import Link from "next/link";
import { SearchBox } from "./SearchBox";

export function TopBar() {
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <Link className="brand" href="/" aria-label="На главную">
          <span className="brand-mark" aria-hidden="true" />
          Legal Framework
        </Link>
        <SearchBox placeholder="Найти статью или слово из закона" />
      </div>
    </header>
  );
}
