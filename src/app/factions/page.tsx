export default function FactionsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-tribal-100">Factions</h1>
      
      <div className="card">
        <h2 className="text-lg font-semibold text-tribal-200 mb-4">Your Faction</h2>
        <p className="text-tribal-400">You are not a member of any faction.</p>
        <button className="btn-primary mt-4">Create Faction</button>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold text-tribal-200 mb-4">All Factions</h2>
        <p className="text-tribal-400">No factions exist yet.</p>
      </div>
    </div>
  );
}
