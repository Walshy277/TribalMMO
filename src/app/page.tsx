export default function Dashboard() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-tribal-100">Dashboard</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="card">
          <h2 className="text-lg font-semibold text-tribal-200 mb-2">Character</h2>
          <p className="text-tribal-400">View and manage your character</p>
          <a href="/character" className="mt-4 inline-block text-tribal-400 hover:text-tribal-300">
            Go to Character →
          </a>
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold text-tribal-200 mb-2">Exploration</h2>
          <p className="text-tribal-400">Venture into the wilds</p>
          <a href="/exploration" className="mt-4 inline-block text-tribal-400 hover:text-tribal-300">
            Go to Exploration →
          </a>
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold text-tribal-200 mb-2">Actions</h2>
          <p className="text-tribal-400">Craft, train, and build</p>
          <a href="/actions" className="mt-4 inline-block text-tribal-400 hover:text-tribal-300">
            Go to Actions →
          </a>
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold text-tribal-200 mb-2">Combat</h2>
          <p className="text-tribal-400">Engage in turn-based battles</p>
          <a href="/combat" className="mt-4 inline-block text-tribal-400 hover:text-tribal-300">
            Go to Combat →
          </a>
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold text-tribal-200 mb-2">Inventory</h2>
          <p className="text-tribal-400">Manage your items</p>
          <a href="/inventory" className="mt-4 inline-block text-tribal-400 hover:text-tribal-300">
            Go to Inventory →
          </a>
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold text-tribal-200 mb-2">Factions</h2>
          <p className="text-tribal-400">Join or create a faction</p>
          <a href="/factions" className="mt-4 inline-block text-tribal-400 hover:text-tribal-300">
            Go to Factions →
          </a>
        </div>
      </div>
    </div>
  );
}
