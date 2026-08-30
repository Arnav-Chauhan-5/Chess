import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../hooks/useSocket";
import { ShoppingBag, Zap, Check, Lock } from "lucide-react";

const API = "http://localhost:3000";

function BoardSwatch({ light, dark, size = 64 }) {
  const cells = [];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      cells.push(
        <div
          key={`${row}-${col}`}
          style={{ background: (row + col) % 2 === 0 ? light : dark, width: size / 3, height: size / 3 }}
        />
      );
    }
  }
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: `repeat(3, ${size / 3}px)`,
      gridTemplateRows: `repeat(3, ${size / 3}px)`,
      borderRadius: 6, overflow: "hidden",
      border: "2px solid rgba(255,255,255,0.15)", flexShrink: 0,
    }}>
      {cells}
    </div>
  );
}

const PIECE_GLYPHS = ["\u265a","\u265b","\u265c","\u265d","\u265e","\u265f"];
const PIECE_STYLES = {
  standard: { bg: "#2a2a3e", fg: "#e8e8f0", shadow: "1px 1px 2px rgba(0,0,0,0.8)" },
  neo:      { bg: "#111827", fg: "#60a5fa", shadow: "0 0 8px rgba(96,165,250,0.4)" },
  cburnett: { bg: "#1c1c28", fg: "#d1d5db", shadow: "1px 1px 0 #000" },
  tatiana:  { bg: "#1e1225", fg: "#e879f9", shadow: "0 0 6px rgba(232,121,249,0.35)" },
  merida:   { bg: "#0f1923", fg: "#fbbf24", shadow: "0 0 8px rgba(251,191,36,0.4)" },
};

function PiecePreview({ pieceSetKey, size = 64 }) {
  const s = PIECE_STYLES[pieceSetKey] || PIECE_STYLES.standard;
  return (
    <div style={{
      width: size, height: size, background: s.bg, borderRadius: 6,
      border: "2px solid rgba(255,255,255,0.15)",
      display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gridTemplateRows: "repeat(2, 1fr)",
      placeItems: "center", flexShrink: 0, overflow: "hidden",
    }}>
      {PIECE_GLYPHS.map(g => (
        <span key={g} style={{ fontSize: size / 4.2, color: s.fg, textShadow: s.shadow, lineHeight: 1, userSelect: "none" }}>
          {g}
        </span>
      ))}
    </div>
  );
}

function CosmeticCard({ item, coinsBalance, onBuy, onEquip, buying }) {
  const isBoard   = item.type === "BOARD_THEME";
  const canAfford = coinsBalance >= item.coinCost;
  const shortfall = item.coinCost - coinsBalance;

  let action = null;
  if (item.equipped) {
    action = (
      <div style={{
        display: "flex", alignItems: "center", gap: "0.35rem",
        padding: "0.5rem 1rem", borderRadius: 8,
        background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.4)",
        color: "#4ade80", fontSize: "0.82rem", fontWeight: 700,
      }}>
        <Check size={14} /> Equipped
      </div>
    );
  } else if (item.owned) {
    action = (
      <button onClick={() => onEquip(item.id)} disabled={buying} className="shop-equip-btn" style={{
        padding: "0.5rem 1.1rem", borderRadius: 8, cursor: "pointer",
        background: "rgba(59,130,246,0.15)", border: "1px solid rgba(59,130,246,0.5)",
        color: "#60a5fa", fontSize: "0.82rem", fontWeight: 700, fontFamily: "inherit",
        transition: "all 0.2s", opacity: buying ? 0.6 : 1,
        display: "flex", alignItems: "center", gap: "0.3rem",
      }}>
        <Zap size={13} /> Equip
      </button>
    );
  } else if (canAfford) {
    action = (
      <button onClick={() => onBuy(item.id)} disabled={buying} className="shop-buy-btn" style={{
        padding: "0.5rem 1.1rem", borderRadius: 8, cursor: "pointer",
        background: "linear-gradient(135deg, #f59e0b, #d97706)", border: "none", color: "#000",
        fontSize: "0.82rem", fontWeight: 700, fontFamily: "inherit",
        transition: "all 0.2s", opacity: buying ? 0.6 : 1,
        display: "flex", alignItems: "center", gap: "0.3rem",
      }}>
        {"\uD83E\uDE99"} {item.coinCost.toLocaleString()}
      </button>
    );
  } else {
    action = (
      <div style={{ textAlign: "center" }}>
        <button disabled style={{
          padding: "0.5rem 1.1rem", borderRadius: 8,
          background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)",
          color: "var(--text-secondary)", fontSize: "0.82rem", fontWeight: 700, fontFamily: "inherit",
          cursor: "not-allowed", opacity: 0.7,
          display: "flex", alignItems: "center", gap: "0.3rem",
        }}>
          <Lock size={12} /> {item.coinCost.toLocaleString()}
        </button>
        <div style={{ fontSize: "0.72rem", color: "#f87171", marginTop: 4 }}>
          Need {shortfall.toLocaleString()} more {"\uD83E\uDE99"}
        </div>
      </div>
    );
  }

  return (
    <div className="shop-card" style={{
      background: item.equipped ? "linear-gradient(135deg,rgba(34,197,94,0.08),transparent)" : "rgba(255,255,255,0.03)",
      border: item.equipped ? "1px solid rgba(34,197,94,0.3)" : "1px solid rgba(255,255,255,0.08)",
      borderRadius: 12, padding: "1rem 1.25rem",
      display: "flex", alignItems: "center", gap: "1rem", transition: "all 0.25s",
    }}>
      {isBoard
        ? <BoardSwatch light={item.lightSquareColor} dark={item.darkSquareColor} size={64} />
        : <PiecePreview pieceSetKey={item.pieceSetKey} size={64} />
      }
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: 2 }}>
          <span style={{ fontWeight: 700, fontSize: "0.97rem" }}>{item.name}</span>
          {item.coinCost === 0 && (
            <span style={{
              fontSize: "0.65rem", fontWeight: 700, color: "#4ade80",
              background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.35)",
              padding: "1px 6px", borderRadius: 4, textTransform: "uppercase", letterSpacing: "0.5px",
            }}>FREE</span>
          )}
        </div>
        <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>{item.description}</div>
      </div>
      <div style={{ flexShrink: 0 }}>{action}</div>
    </div>
  );
}

export default function Shop() {
  const { user, token } = useAuth();
  const { socket }      = useSocket();

  const [catalog,              setCatalog]              = useState([]);
  const [coinsBalance,         setCoinsBalance]         = useState(null);
  const [equippedBoardThemeId, setEquippedBoardThemeId] = useState(null);
  const [equippedPieceSetId,   setEquippedPieceSetId]   = useState(null);
  const [loading,              setLoading]              = useState(true);
  const [error,                setError]                = useState(null);
  const [busy,                 setBusy]                 = useState(false);
  const [toast,                setToast]                = useState(null);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchCatalog = useCallback(async () => {
    if (!user || !token) return;
    try {
      const res  = await fetch(`${API}/cosmetics/catalog?userId=${user.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load catalog");
      const data = await res.json();
      setCatalog(data.catalog);
      setCoinsBalance(data.coinsBalance);
      setEquippedBoardThemeId(data.equippedBoardThemeId);
      setEquippedPieceSetId(data.equippedPieceSetId);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [user, token]);

  useEffect(() => { fetchCatalog(); }, [fetchCatalog]);

  useEffect(() => {
    if (!socket) return;
    const handler = (data) => {
      if (data.coinsAwarded) setCoinsBalance(prev => (prev ?? 0) + data.coinsAwarded);
    };
    socket.on("daily_challenge_updated", handler);
    return () => socket.off("daily_challenge_updated", handler);
  }, [socket]);

  const handleBuy = async (cosmeticItemId) => {
    if (!user || busy) return;
    setBusy(true);
    try {
      const res  = await fetch(`${API}/cosmetics/purchase`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, cosmeticItemId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Purchase failed");
      setCoinsBalance(data.updatedUser.coinsBalance);
      setEquippedBoardThemeId(data.updatedUser.equippedBoardThemeId);
      setEquippedPieceSetId(data.updatedUser.equippedPieceSetId);
      setCatalog(prev => prev.map(item => {
        if (item.id !== cosmeticItemId) return item.type === data.item.type ? { ...item, equipped: false } : item;
        return { ...item, owned: true, equipped: true };
      }));
      showToast(`Purchased & equipped "${data.item.name}"!`);
    } catch (e) { showToast(e.message, "error"); }
    finally     { setBusy(false); }
  };

  const handleEquip = async (cosmeticItemId) => {
    if (!user || busy) return;
    setBusy(true);
    try {
      const res  = await fetch(`${API}/cosmetics/equip`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, cosmeticItemId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Equip failed");
      setEquippedBoardThemeId(data.updatedUser.equippedBoardThemeId);
      setEquippedPieceSetId(data.updatedUser.equippedPieceSetId);
      const eq = catalog.find(i => i.id === cosmeticItemId);
      setCatalog(prev => prev.map(item => {
        if (item.id === cosmeticItemId) return { ...item, equipped: true };
        if (item.type === eq?.type)     return { ...item, equipped: false };
        return item;
      }));
      showToast(`"${eq?.name}" equipped!`);
    } catch (e) { showToast(e.message, "error"); }
    finally     { setBusy(false); }
  };

  const themes    = catalog.filter(i => i.type === "BOARD_THEME");
  const pieceSets = catalog.filter(i => i.type === "PIECE_SET");

  return (
    <div style={{ padding: "2rem", maxWidth: 860, margin: "0 auto" }}>

      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: "2rem", flexWrap: "wrap", gap: "1rem",
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "1.75rem", fontWeight: 800, display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <ShoppingBag size={28} color="var(--accent-color)" />
            Shop
          </h1>
          <p style={{ margin: "0.25rem 0 0", color: "var(--text-secondary)", fontSize: "0.9rem" }}>
            Complete the daily challenge to earn 50 {"\uD83E\uDE99"} per day
          </p>
        </div>

        {coinsBalance !== null && (
          <div style={{
            display: "flex", alignItems: "center", gap: "0.6rem",
            background: "linear-gradient(135deg,rgba(234,179,8,0.15),rgba(251,191,36,0.08))",
            border: "1px solid rgba(234,179,8,0.4)", borderRadius: 16, padding: "0.75rem 1.5rem",
          }}>
            <span style={{ fontSize: "1.6rem", lineHeight: 1 }}>{"\uD83E\uDE99"}</span>
            <div>
              <div style={{ fontWeight: 800, fontSize: "1.5rem", color: "#fbbf24", lineHeight: 1 }}>
                {coinsBalance.toLocaleString()}
              </div>
              <div style={{ fontSize: "0.72rem", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Coins</div>
            </div>
          </div>
        )}
      </div>

      {loading && <div style={{ textAlign: "center", padding: "4rem", color: "var(--text-secondary)" }}>Loading catalog\u2026</div>}
      {error   && <div style={{ textAlign: "center", padding: "4rem", color: "#f87171" }}>{error}</div>}

      {!loading && !error && (
        <>
          <section style={{ marginBottom: "2.5rem" }}>
            <h2 style={{
              fontSize: "1.05rem", fontWeight: 700, letterSpacing: "0.5px",
              color: "var(--text-secondary)", textTransform: "uppercase",
              margin: "0 0 1rem", display: "flex", alignItems: "center", gap: "0.5rem",
            }}>
              <span style={{ display: "inline-block", width: 3, height: 16, background: "var(--accent-color)", borderRadius: 2 }} />
              Board Themes
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {themes.map(item => (
                <CosmeticCard
                  key={item.id}
                  item={{ ...item, equipped: item.id === equippedBoardThemeId, owned: item.owned || item.id === equippedBoardThemeId }}
                  coinsBalance={coinsBalance ?? 0}
                  onBuy={handleBuy} onEquip={handleEquip} buying={busy}
                />
              ))}
            </div>
          </section>

          <section>
            <h2 style={{
              fontSize: "1.05rem", fontWeight: 700, letterSpacing: "0.5px",
              color: "var(--text-secondary)", textTransform: "uppercase",
              margin: "0 0 1rem", display: "flex", alignItems: "center", gap: "0.5rem",
            }}>
              <span style={{ display: "inline-block", width: 3, height: 16, background: "#a855f7", borderRadius: 2 }} />
              Piece Sets
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {pieceSets.map(item => (
                <CosmeticCard
                  key={item.id}
                  item={{ ...item, equipped: item.id === equippedPieceSetId, owned: item.owned || item.id === equippedPieceSetId }}
                  coinsBalance={coinsBalance ?? 0}
                  onBuy={handleBuy} onEquip={handleEquip} buying={busy}
                />
              ))}
            </div>
          </section>
        </>
      )}

      {toast && (
        <div style={{
          position: "fixed", bottom: "2rem", right: "2rem",
          background: toast.type === "error" ? "rgba(239,68,68,0.15)" : "rgba(34,197,94,0.15)",
          border: `1px solid ${toast.type === "error" ? "rgba(239,68,68,0.5)" : "rgba(34,197,94,0.5)"}`,
          borderLeft: `4px solid ${toast.type === "error" ? "#ef4444" : "#22c55e"}`,
          color: toast.type === "error" ? "#fca5a5" : "#86efac",
          padding: "0.9rem 1.5rem", borderRadius: 10,
          fontWeight: 600, fontSize: "0.9rem",
          boxShadow: "0 8px 30px rgba(0,0,0,0.4)",
          zIndex: 2000, animation: "shopToastIn 0.3s ease",
        }}>
          {toast.msg}
        </div>
      )}

      <style>{`
        .shop-card:hover { border-color: rgba(255,255,255,0.14) !important; background: rgba(255,255,255,0.05) !important; }
        .shop-buy-btn:hover:not(:disabled) { filter: brightness(1.15); transform: translateY(-1px); }
        .shop-equip-btn:hover:not(:disabled) { background: rgba(59,130,246,0.25) !important; border-color: rgba(59,130,246,0.7) !important; }
        @keyframes shopToastIn { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
      `}</style>
    </div>
  );
}
