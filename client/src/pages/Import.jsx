export default function Import() {
  return (
    <>
      <div className="page-header">
        <div className="page-title">Importar Dados</div>
        <div className="page-sub">Utilize a aplicação Python para importar relatórios XTB e IBKR</div>
      </div>
      <div className="card" style={{ maxWidth: 600, textAlign: "center", padding: "40px 32px" }}>
        <div style={{ fontSize: "2.5rem", marginBottom: 16 }}>📥</div>
        <div style={{ fontWeight: 700, fontSize: "1.1rem", color: "var(--text)", marginBottom: 12 }}>
          Importação via aplicação Python
        </div>
        <div style={{ color: "#8b92a5", lineHeight: 1.7, fontSize: "0.88rem" }}>
          Os ficheiros XTB (.xlsx) e IBKR (.csv) são importados através da aplicação Streamlit.<br />
          Esta aplicação web lê diretamente a mesma base de dados SQLite.<br /><br />
          Para importar novos relatórios, abra o <strong style={{ color: "var(--text)" }}>arrancar_app.bat</strong>{" "}
          na pasta <code style={{ background: "var(--card)", padding: "2px 6px", borderRadius: 4 }}>trading_app</code>{" "}
          e utilize a página <strong style={{ color: "var(--text)" }}>Importar Dados</strong> da aplicação Streamlit.
        </div>
      </div>
    </>
  );
}
