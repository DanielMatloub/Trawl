import { useState, useEffect, useRef } from "react";
import { BrowserMultiFormatReader } from "@zxing/library";

const scoreColor = (score) => {
  if (score === "A") return { bg: "#e8f5e9", color: "#2e7d32" };
  if (score === "B") return { bg: "#f1f8e9", color: "#558b2f" };
  if (score === "C") return { bg: "#fff8e1", color: "#f57f17" };
  if (score === "D") return { bg: "#fff3e0", color: "#e65100" };
  if (score === "F") return { bg: "#fce4ec", color: "#c62828" };
  return { bg: "#f5f5f5", color: "#888" };
};

export default function App() {
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const videoRef = useRef(null);
  const readerRef = useRef(null);

  useEffect(() => {
    if (!scanning) return;

    const reader = new BrowserMultiFormatReader();
    readerRef.current = reader;

    reader.decodeFromVideoDevice(null, videoRef.current, (result, err) => {
      if (result) {
        handleBarcode(result.getText());
      }
    }).catch(e => {
      setError("Camera access denied. Please allow camera access to scan barcodes.");
      setScanning(false);
    });

    return () => reader.reset();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanning]);

  async function handleBarcode(barcode) {
    if (loading) return;
    setScanning(false);
    setLoading(true);
    setResult(null);

    try {
      const res = await fetch(`https://trawl-production-1443.up.railway.app/scan/${barcode}`);
      const data = await res.json();
      setResult(data);
    } catch (e) {
      setResult({ error: "something_wrong", message: "Something went wrong. Try again." });
    }
    setLoading(false);
  }

  function reset() {
    setResult(null);
    setError(null);
    setScanning(false);
  }

  const score = result?.sustainability_score;
  const colors = scoreColor(score);

  return (
    <div style={{ height: "100vh", background: "#000", fontFamily: "sans-serif", display: "flex", flexDirection: "column", position: "relative", overflow: "hidden" }}>

      {/* Header */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 10, padding: "16px 20px", background: "linear-gradient(to bottom, rgba(0,0,0,0.7), transparent)" }}>
        <span style={{ color: "#fff", fontWeight: "700", fontSize: "20px" }}>Trawl</span>
      </div>

      {/* Camera */}
      <video ref={videoRef} style={{ width: "100%", height: "100%", objectFit: "cover", display: scanning || loading ? "block" : "none" }} />

      {/* Landing */}
      {!scanning && !result && !loading && !error && (
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", zIndex: 10, padding: "24px" }}>
          <div style={{ textAlign: "center", marginBottom: "48px" }}>
            <div style={{ fontSize: "48px", marginBottom: "16px" }}>🐟</div>
            <h1 style={{ color: "#fff", fontSize: "28px", fontWeight: "800", marginBottom: "8px" }}>Trawl</h1>
            <p style={{ color: "rgba(255,255,255,0.7)", fontSize: "16px" }}>Scan a seafood barcode to see its environmental impact</p>
          </div>
          <button
            onClick={() => setScanning(true)}
            style={{ background: "#fff", color: "#222", border: "none", padding: "16px 32px", borderRadius: "14px", fontSize: "17px", fontWeight: "700", cursor: "pointer" }}
          >
            Scan a barcode
          </button>
        </div>
      )}

      {/* Viewfinder overlay */}
      {scanning && (
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", zIndex: 5 }}>
          <div style={{ width: "240px", height: "160px", position: "relative" }}>
            {[["top", "left"], ["top", "right"], ["bottom", "left"], ["bottom", "right"]].map(([v, h], i) => (
              <div key={i} style={{ position: "absolute", [v]: 0, [h]: 0, width: "24px", height: "24px", borderTop: v === "top" ? "3px solid #fff" : "none", borderBottom: v === "bottom" ? "3px solid #fff" : "none", borderLeft: h === "left" ? "3px solid #fff" : "none", borderRight: h === "right" ? "3px solid #fff" : "none" }} />
            ))}
          </div>
          <p style={{ color: "rgba(255,255,255,0.8)", fontSize: "14px", marginTop: "24px" }}>Point at a seafood barcode</p>
          <button
            onClick={() => setScanning(false)}
            style={{ marginTop: "16px", background: "rgba(255,255,255,0.2)", color: "#fff", border: "1px solid rgba(255,255,255,0.4)", padding: "10px 20px", borderRadius: "10px", fontSize: "14px", cursor: "pointer" }}
          >
            Cancel
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10, background: "rgba(0,0,0,0.6)" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ color: "#fff", fontSize: "16px", marginBottom: "8px" }}>Analyzing...</div>
            <div style={{ color: "rgba(255,255,255,0.6)", fontSize: "13px" }}>Looking up sustainability data</div>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10, padding: "24px" }}>
          <div style={{ background: "#fff", borderRadius: "16px", padding: "24px", textAlign: "center" }}>
            <p style={{ color: "#333", marginBottom: "16px" }}>{error}</p>
            <button onClick={reset} style={{ background: "#222", color: "#fff", border: "none", padding: "10px 20px", borderRadius: "8px", cursor: "pointer" }}>Try Again</button>
          </div>
        </div>
      )}

      {/* Result */}
      {result && !loading && (
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 10, background: "#fff", borderRadius: "20px 20px 0 0", padding: "20px", maxHeight: "75vh", overflowY: "auto" }}>
          <div style={{ width: "40px", height: "4px", background: "#ddd", borderRadius: "2px", margin: "0 auto 20px" }} />

          {result.error === "limit_reached" ? (
            <div style={{ textAlign: "center", padding: "16px" }}>
              <div style={{ fontSize: "32px", marginBottom: "12px" }}>🔒</div>
              <p style={{ fontWeight: "600", fontSize: "16px", marginBottom: "8px" }}>Daily limit reached</p>
              <p style={{ color: "#666", fontSize: "14px", marginBottom: "20px" }}>{result.message}</p>
              <button style={{ background: "#222", color: "#fff", border: "none", padding: "12px 24px", borderRadius: "8px", fontSize: "15px", cursor: "pointer", width: "100%" }}>
                Unlock unlimited — $5
              </button>
            </div>
          ) : result.error ? (
            <div style={{ textAlign: "center", padding: "16px" }}>
              <p style={{ color: "#888" }}>{result.message}</p>
              <button onClick={reset} style={{ marginTop: "16px", background: "#222", color: "#fff", border: "none", padding: "10px 20px", borderRadius: "8px", cursor: "pointer" }}>Try Again</button>
            </div>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "16px" }}>
                <div style={{ width: "56px", height: "56px", borderRadius: "14px", background: colors.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span style={{ fontSize: "28px", fontWeight: "800", color: colors.color }}>{score}</span>
                </div>
                <div>
                  <div style={{ fontWeight: "700", fontSize: "16px" }}>{result.product_name}</div>
                  <div style={{ color: "#888", fontSize: "13px" }}>{result.brand}</div>
                </div>
              </div>

              <div style={{ background: "#f9f9f9", borderRadius: "12px", padding: "14px", marginBottom: "14px", fontSize: "13px", lineHeight: "2" }}>
                {result.species && <div><span style={{ color: "#888" }}>Species</span><span style={{ float: "right", fontWeight: "600" }}>{result.species}</span></div>}
                {result.fishing_method && <div><span style={{ color: "#888" }}>Fishing method</span><span style={{ float: "right" }}>{result.fishing_method}</span></div>}
                {result.origin_country && <div><span style={{ color: "#888" }}>Origin</span><span style={{ float: "right" }}>{result.origin_country}</span></div>}
                {result.certifications && <div><span style={{ color: "#888" }}>Certifications</span><span style={{ float: "right" }}>{result.certifications}</span></div>}
                {result.confidence && <div><span style={{ color: "#888" }}>Confidence</span><span style={{ float: "right", textTransform: "capitalize" }}>{result.confidence}</span></div>}
              </div>

              <div style={{ fontSize: "14px", lineHeight: "1.7", color: "#333", marginBottom: "20px" }}>
                {result.environmental_impact}
              </div>

              {result.cached && (
                <div style={{ fontSize: "11px", color: "#aaa", marginBottom: "12px" }}>
                  ⚡ Instant result from Trawl database · Last updated {result.last_updated?.split("T")[0]}
                </div>
              )}

              {result.scans_remaining !== undefined && result.scans_remaining <= 3 && (
                <p style={{ color: "#888", fontSize: "12px", marginBottom: "12px" }}>
                  {result.scans_remaining} free {result.scans_remaining === 1 ? "scan" : "scans"} remaining today.
                </p>
              )}

              <button onClick={reset} style={{ width: "100%", padding: "14px", borderRadius: "10px", background: "#222", color: "#fff", border: "none", fontSize: "15px", cursor: "pointer" }}>
                Scan another
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}