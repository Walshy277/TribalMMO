"use client";

import { useGame } from "@/lib/game";

const recipeIcons: Record<string, string> = { weapon: "⚔️", armor: "🛡️", consumable: "🧪", tool: "🔨" };

export default function InventoryPage() {
  const { character } = useGame();

  if (!character) {
    return <div className="text-tribal-500 text-center mt-20">Create a character first.</div>;
  }

  return (
    <div className="space-y-5 animate-fade-in max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-tribal-100">Inventory</h1>
        <p className="text-tribal-500 text-sm mt-0.5">Manage your equipment and items</p>
      </div>

      {/* Equipment */}
      <div className="card">
        <h2 className="text-sm font-semibold text-tribal-400 uppercase tracking-wider mb-4">Equipment</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-tribal-900/50 p-5 rounded-lg border border-tribal-800/50 text-center">
            <div className="text-3xl mb-2">⚔️</div>
            <div className="text-tribal-500 text-xs uppercase">Weapon</div>
            <div className="text-tribal-100 font-semibold mt-1">Bare Hands</div>
            <div className="text-tribal-600 text-xs mt-1">ATK +0</div>
          </div>
          <div className="bg-tribal-900/50 p-5 rounded-lg border border-tribal-800/50 text-center">
            <div className="text-3xl mb-2">🛡️</div>
            <div className="text-tribal-500 text-xs uppercase">Armor</div>
            <div className="text-tribal-100 font-semibold mt-1">Cloth Wrap</div>
            <div className="text-tribal-600 text-xs mt-1">DEF +0</div>
          </div>
        </div>
      </div>

      {/* Items */}
      <div className="card">
        <h2 className="text-sm font-semibold text-tribal-400 uppercase tracking-wider mb-4">Items</h2>
        {!character.inventory || character.inventory.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-4xl mb-2 opacity-50">📦</div>
            <p className="text-tribal-500">Your inventory is empty.</p>
            <p className="text-tribal-600 text-sm mt-1">Go gather or craft some items!</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {character.inventory.map((inv: any) => (
              <div key={inv.id} className="bg-tribal-900/50 p-3 rounded-lg border border-tribal-800/50 text-center hover:border-tribal-700/50 transition-colors">
                <div className="text-2xl mb-1">{recipeIcons[inv.item?.type] || "📦"}</div>
                <div className="text-tribal-200 text-sm font-medium">{inv.item?.name || "Unknown"}</div>
                <div className="text-tribal-500 text-xs">x{inv.quantity}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pets */}
      <div className="card">
        <h2 className="text-sm font-semibold text-tribal-400 uppercase tracking-wider mb-4">Pets</h2>
        {!character.pets || character.pets.length === 0 ? (
          <div className="text-center py-6">
            <div className="text-4xl mb-2 opacity-50">🐾</div>
            <p className="text-tribal-500">No pets yet.</p>
            <p className="text-tribal-600 text-sm mt-1">Visit the marketplace to find a companion.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {character.pets.map((pet: any) => (
              <div key={pet.id} className="bg-tribal-900/50 p-3 rounded-lg flex items-center justify-between border border-tribal-800/50">
                <div className="flex items-center gap-3">
                  <span className="text-xl">🐾</span>
                  <span className="text-tribal-200 font-semibold">{pet.name}</span>
                </div>
                <span className="text-tribal-500 text-sm capitalize bg-tribal-800 px-3 py-1 rounded-full">{pet.type}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
