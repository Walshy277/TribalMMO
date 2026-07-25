export default function CombatPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-tribal-100">Combat</h1>
      
      <div className="card">
        <h2 className="text-lg font-semibold text-tribal-200 mb-4">Encounter</h2>
        <p className="text-tribal-400">No active combat. Explore to find enemies.</p>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold text-tribal-200 mb-4">Combat Stats</h2>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-tribal-300 text-sm">Attack</div>
            <div className="text-xl font-bold text-tribal-100">1</div>
          </div>
          <div>
            <div className="text-tribal-300 text-sm">Defense</div>
            <div className="text-xl font-bold text-tribal-100">1</div>
          </div>
          <div>
            <div className="text-tribal-300 text-sm">Health</div>
            <div className="text-xl font-bold text-tribal-100">10</div>
          </div>
        </div>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold text-tribal-200 mb-4">Equipment</h2>
        <div className="space-y-2 text-tribal-400">
          <div className="flex justify-between">
            <span>Weapon</span>
            <span>None</span>
          </div>
          <div className="flex justify-between">
            <span>Armor</span>
            <span>None</span>
          </div>
        </div>
      </div>
    </div>
  );
}
