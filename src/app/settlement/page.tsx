export default function SettlementPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-tribal-100">Settlement</h1>
      
      <div className="card">
        <h2 className="text-lg font-semibold text-tribal-200 mb-4">Settlement Info</h2>
        <p className="text-tribal-400">No settlement yet. Join or create a faction to build one.</p>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold text-tribal-200 mb-4">Buildings</h2>
        <p className="text-tribal-400">No buildings constructed.</p>
      </div>
    </div>
  );
}
