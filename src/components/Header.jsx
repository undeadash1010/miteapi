export default function Header({ view, onNavigate }) {
  const navigation = [
    ['home', 'Home'],
    ['search', 'Search'],
    ['library', 'Library']
  ];

  return (
    <header className="fixed top-0 inset-x-0 z-40 bg-[#131316]/90 backdrop-blur-xl border-b border-[#2a2a2d]/50">
      <div className="h-14 max-w-3xl mx-auto px-4 flex items-center justify-between">
        <button type="button" onClick={() => onNavigate('home')} className="flex items-center gap-2 group" aria-label="Go to home">
          <span className="font-display text-2xl font-semibold text-[#e4e1e6] group-hover:text-[#f2c36b] transition-colors tracking-tight">mite</span>
          <span className="amber-dot" />
        </button>
        <nav className="flex items-center gap-1 text-xs sm:text-sm" aria-label="Main navigation">
          {navigation.map(([key, label]) => {
            const active = view === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => onNavigate(key)}
                className={`nav-btn px-3 py-1.5 rounded-full ${active ? 'text-[#f2c36b] font-semibold bg-[#f2c36b]/10' : 'text-[#9b8f7e] hover:text-[#e4e1e6]'}`}
              >
                {label}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
