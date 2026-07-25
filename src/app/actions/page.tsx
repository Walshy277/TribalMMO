export default function ActionsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-tribal-100">Actions</h1>
      
      <div className="card">
        <h2 className="text-lg font-semibold text-tribal-200 mb-4">Active Actions</h2>
        <p className="text-tribal-400">No active actions.</p>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold text-tribal-200 mb-4">Available Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-tribal-800 p-3 rounded">
            <div className="font-semibold text-tribal-200">Craft</div>
            <div className="text-sm text-tribal-400">Create tools, weapons, and more</div>
            <button className="btn-primary mt-2 text-sm">Start Crafting</button>
          </div>
          <div className="bg-tribal-800 p-3 rounded">
            <div className="font-semibold text-tribal-200">Train</div>
            <div className="text-sm text-tribal-400">Improve your skills</div>
            <button className="btn-primary mt-2 text-sm">Start Training</button>
          </div>
          <div className="bg-tribal-800 p-3 rounded">
            <div className="font-semibold text-tribal-200">Gather</div>
            <div className="text-sm text-tribal-400">Collect resources in bulk</div>
            <button className="btn-primary mt-2 text-sm">Start Gathering</button>
          </div>
          <div className="bg-tribal-800 p-3 rounded">
            <div className="font-semibold text-tribal-200">Build</div>
            <div className="text-sm text-tribal-400">Construct settlement buildings</div>
            <button className="btn-primary mt-2 text-sm">Start Building</button>
          </div>
        </div>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold text-tribal-200 mb-4">Action Slots</h2>
        <p className="text-tribal-400">1 / 1 slots used</p>
      </div>
    </div>
  );
}
