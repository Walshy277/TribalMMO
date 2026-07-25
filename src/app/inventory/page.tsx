"use client";

import { useGame } from "@/lib/game";

export default function InventoryPage() {
  const { character } = useGame();

  if (!character) {
    return <div className="text-tribal-400 text-center mt-20">Create a character first.</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-tribal-100">Inventory</h1>

      <div className="card">
        <h2 className="text-lg font-semibold text-tribal-200 mb-4">Equipment</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-tribal-800 p-3 rounded text-center">
            <div className="text-tribal-300 text-sm">Weapon</div>
            <div className="text-tribal-100">Bare Hands</div>
            <div className="text-tribal-500 text-xs">ATK +0</div>
          </div>
          <div className="bg-tribal-800 p-3 rounded text-center">
            <div className="text-tribal-300 text-sm">Armor</div>
            <div className="text-tribal-100">Cloth Wrap</div>
            <div className="text-tribal-500 text-xs">DEF +0</div>
          </div>
        </div>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold text-tribal-200 mb-4">Items</h2>
        {!character.inventory || character.inventory.length === 0 ? (
          <p className="text-tribal-400">Your inventory is empty. Go gather or craft some items!</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {character.inventory.map((inv: any) => (
              <div key={inv.id} className="bg-tribal-800 p-2 rounded text-center">
                <div className="text-tribal-200 text-sm">{inv.item?.name || "Unknown"}</div>
                <div className="text-tribal-500 text-xs">x{inv.quantity}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold text-tribal-200 mb-4">Pets</h2>
        {!character.pets || character.pets.length === 0 ? (
          <p className="text-tribal-400">No pets. Visit the marketplace to find a companion.</p>
        ) : (
          <div className="space-y-2">
            {character.pets.map((pet: any) => (
              <div key={pet.id} className="bg-tribal-800 p-2 rounded flex justify-between">
                <span className="text-tribal-200">{pet.name}</span>
                <span className="text-tribal-400 text-sm capitalize">{pet.type}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
