export function Header() {
  return (
    <header className="bg-tribal-900 border-b border-tribal-700 px-4 py-3">
      <div className="flex items-center justify-between">
        <a href="/" className="text-xl font-bold text-tribal-100">
          TribalMMO
        </a>
        <nav className="flex items-center gap-4">
          <span className="text-tribal-400 text-sm hidden sm:inline">Guest</span>
          <button className="btn-primary text-sm">Login</button>
        </nav>
      </div>
    </header>
  );
}
