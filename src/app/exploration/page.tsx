export default function ExplorationPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-tribal-100">Exploration</h1>
      
      <div className="card">
        <h2 className="text-lg font-semibold text-tribal-200 mb-4">Current Location</h2>
        <p className="text-tribal-400">You stand at the edge of the forest...</p>
        <div className="mt-4 flex gap-4">
          <button className="btn-primary">Explore Forward</button>
          <button className="btn-secondary">Rest</button>
        </div>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold text-tribal-200 mb-4">Stamina</h2>
        <div className="w-full bg-tribal-800 rounded-full h-4">
          <div className="bg-tribal-500 h-4 rounded-full" style={{ width: '100%' }}></div>
        </div>
        <p className="text-tribal-400 mt-2">100 / 100</p>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold text-tribal-200 mb-4">Recent Events</h2>
        <div className="space-y-2 text-tribal-400">
          <p>No events yet. Start exploring!</p>
        </div>
      </div>
    </div>
  );
}
