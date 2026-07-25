export default function MarketplacePage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-tribal-100">Marketplace</h1>
      
      <div className="card">
        <h2 className="text-lg font-semibold text-tribal-200 mb-4">Listings</h2>
        <p className="text-tribal-400">No items listed for sale.</p>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold text-tribal-200 mb-4">Your Listings</h2>
        <p className="text-tribal-400">You have no active listings.</p>
        <button className="btn-primary mt-4">Create Listing</button>
      </div>
    </div>
  );
}
