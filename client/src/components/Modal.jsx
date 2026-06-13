import { useEffect } from "react";

const GREEN = "#10b981", RED = "#f43f5e";

const fmtVal = v =>
  (v >= 0 ? "+" : "") + "€ " +
  Math.abs(v).toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function Modal({ title, onClose, summary, children }) {
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
            {summary && (
              <>
                <div style={{
                  fontSize: "1.6rem", fontWeight: 700, marginTop: 6,
                  color: summary.value >= 0 ? GREEN : RED,
                }}>
                  {fmtVal(summary.value)}
                </div>
                <div style={{ fontSize: "0.72rem", color: "#4e6080", marginTop: 2 }}>
                  {summary.label}
                </div>
              </>
            )}
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {children}
        </div>
      </div>
    </div>
  );
}
