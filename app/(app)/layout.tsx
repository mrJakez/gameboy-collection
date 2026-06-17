import GameBoyIcon from "@/app/components/GameBoyIcon";
import HeaderNav from "@/app/components/HeaderNav";
import { redirect } from "next/navigation";
import fs from "fs";
import path from "path";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const dbExists = fs.existsSync(path.join(process.cwd(), "data", "game_db.json"));
  if (!dbExists) redirect("/setup");

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 sm:py-8">
      <header className="mb-8 sm:mb-10 flex items-center justify-between gap-3">
        <a href="/" className="flex items-center gap-2.5 group min-w-0">
          <GameBoyIcon className="h-10 w-auto shrink-0" />
          <div className="min-w-0">
            <h1 className="text-xl font-semibold leading-tight text-zinc-100 group-hover:text-white transition-colors truncate">
              <span className="sm:hidden">GB Collection</span>
              <span className="hidden sm:inline">Game Boy Collection</span>
            </h1>
            <p className="text-xs text-zinc-500 mt-0.5">
              <span className="sm:hidden">GB · GBC · GBA</span>
              <span className="hidden sm:inline">Analogue Pocket · GB · GBC · GBA</span>
            </p>
          </div>
        </a>
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <HeaderNav />
        </div>
      </header>
      <main>{children}</main>
      {(process.env.NEXT_PUBLIC_BUILD_SHA || process.env.NEXT_PUBLIC_BUILD_TIME) && (
        <footer className="mt-12 pb-4 text-center">
          <span className="text-[11px] text-zinc-800 font-mono">
            {process.env.NEXT_PUBLIC_BUILD_SHA && <>#{process.env.NEXT_PUBLIC_BUILD_SHA}</>}
            {process.env.NEXT_PUBLIC_BUILD_SHA && process.env.NEXT_PUBLIC_BUILD_TIME && <> · </>}
            {process.env.NEXT_PUBLIC_BUILD_TIME && (() => {
              const d = new Date(process.env.NEXT_PUBLIC_BUILD_TIME!);
              return <>{d.toLocaleString("de-DE", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })} MEZ</>;
            })()}
          </span>
        </footer>
      )}
    </div>
  );
}
