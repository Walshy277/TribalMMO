export default function CharacterPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-tribal-100">Character</h1>
      
      <div className="card">
        <h2 className="text-lg font-semibold text-tribal-200 mb-4">Profile</h2>
        <p className="text-tribal-400">Create your character to begin your journey.</p>
        <button className="btn-primary mt-4">Create Character</button>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold text-tribal-200 mb-4">Core Stats</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="text-center">
            <div className="text-tribal-300 text-sm">Strength</div>
            <div className="text-xl font-bold text-tribal-100">1</div>
          </div>
          <div className="text-center">
            <div className="text-tribal-300 text-sm">Agility</div>
            <div className="text-xl font-bold text-tribal-100">1</div>
          </div>
          <div className="text-center">
            <div className="text-tribal-300 text-sm">Endurance</div>
            <div className="text-xl font-bold text-tribal-100">1</div>
          </div>
          <div className="text-center">
            <div className="text-tribal-300 text-sm">Focus</div>
            <div className="text-xl font-bold text-tribal-100">1</div>
          </div>
          <div className="text-center">
            <div className="text-tribal-300 text-sm">Cunning</div>
            <div className="text-xl font-bold text-tribal-100">1</div>
          </div>
        </div>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold text-tribal-200 mb-4">Skills</h2>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-tribal-300">Gathering</span>
            <span className="text-tribal-100">Tier I</span>
          </div>
          <div className="flex justify-between">
            <span className="text-tribal-300">Crafting</span>
            <span className="text-tribal-100">Tier I</span>
          </div>
          <div className="flex justify-between">
            <span className="text-tribal-300">Combat</span>
            <span className="text-tribal-100">Tier I</span>
          </div>
          <div className="flex justify-between">
            <span className="text-tribal-300">Survival</span>
            <span className="text-tribal-100">Tier I</span>
          </div>
          <div className="flex justify-between">
            <span className="text-tribal-300">Diplomacy</span>
            <span className="text-tribal-100">Tier I</span>
          </div>
        </div>
      </div>
    </div>
  );
}
