export default function InventoryPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-tribal-100">Inventory</h1>
      
      <div className="card">
        <h2 className="text-lg font-semibold text-tribal-200 mb-4">Items</h2>
        <p className="text-tribal-400">Your inventory is empty.</p>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold text-tribal-200 mb-4">Equipment</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-tribal-800 p-3 rounded text-center">
            <div className="text-tribal-300 text-sm">Weapon</div>
            <div className="text-tribal-100">Empty</div>
          </div>
          <div className="bg-tribal-800 p-3 rounded text-center">
            <div className="text-tribal-300 text-sm">Armor</div>
            <div className="text-tribal-100">Empty</div>
          </div>
        </div>
      </div>
    </div>
  );
}
