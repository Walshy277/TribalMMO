export default function CraftingPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-tribal-100">Crafting</h1>
      
      <div className="card">
        <h2 className="text-lg font-semibold text-tribal-200 mb-4">Recipes</h2>
        <p className="text-tribal-400">Learn recipes by increasing your crafting skill.</p>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold text-tribal-200 mb-4">Crafting Queue</h2>
        <p className="text-tribal-400">No items being crafted.</p>
      </div>
    </div>
  );
}
