import { useEffect } from "react";

const GREEN = "#10b981", RED = "#f43f5e";

const fmtVal = v =>
  (v < 0 ? "-" : "") + "€ " +
  Math.abs(v).toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function Modal({ title, onClose, summary, brokers, children }) {
  useEffect(() => {
    const handler = e => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <div>
            <div className="modal-title">{title}</div>
          </div>
          {brokers && brokers.length > 0 && (() => {
            const total = brokers.length > 1 ? brokers.reduce((s, [, st]) => s + st.pl, 0) : null;
            return (
              <div style={{ marginLeft: "auto", marginRight: 16, display: "flex", gap: 8, alignItems: "flex-start" }}>
                {/* Coluna nome+valor (com tracejado no total) */}
                <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 180 }}>
                  {brokers.map(([broker, st]) => (
                    <div key={broker} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 16 }}>
                      <span style={{ fontSize: "0.68rem", color: "#fff" }}>{broker}</span>
                      <span style={{ fontSize: "0.88rem", fontWeight: 700, color: st.pl >= 0 ? GREEN : RED }}>{fmtVal(st.pl)}</span>
                    </div>
                  ))}
                  {total !== null && (
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 16, borderTop: "1px dashed rgba(255,255,255,0.15)", paddingTop: 5, marginTop: 2 }}>
                      <span style={{ fontSize: "0.68rem", color: "#4e6080" }}>Total</span>
                      <span style={{ fontSize: "0.88rem", fontWeight: 700, color: total >= 0 ? GREEN : RED }}>{fmtVal(total)}</span>
                    </div>
                  )}
                </div>
                {/* Coluna n.º de trades (fora do tracejado) */}
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {brokers.map(([broker, st]) => (
                    <div key={broker} style={{ fontSize: "0.65rem", color: "#4e6080", lineHeight: "1.6rem" }}>
                      ({st.n} trade{st.n !== 1 ? "s" : ""})
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {children}
        </div>
      </div>
    </div>
  );
}
