import { useEffect, useMemo, useRef, useState } from "react";
import { create, all } from "mathjs";

const math = create(all, { number: "number" });

// ---- degree/radian helpers ----
const toRad = (x) => (x * Math.PI) / 180;
const toDeg = (x) => (x * 180) / Math.PI;

const sind = (x) => Math.sin(toRad(x));
const cosd = (x) => Math.cos(toRad(x));
const tand = (x) => Math.tan(toRad(x));

const asind = (x) => toDeg(Math.asin(x));
const acosd = (x) => toDeg(Math.acos(x));
const atand = (x) => toDeg(Math.atan(x));

math.import({ sind, cosd, tand, asind, acosd, atand }, { override: true, silent: true });

const BTN = ({ label, onClick, wide = false, className = "", title }) => (
  <button title={title || label} onClick={onClick} className={`calc-btn ${wide ? "wide" : ""} ${className}`}>
    {label}
  </button>
);

export default function App() {
  const [expr, setExpr] = useState("");
  const [display, setDisplay] = useState("0");
  const [degMode, setDegMode] = useState(true);
  const [memory, setMemory] = useState(0);

  // keep the last typed equation when "=" is pressed
  const [originalExpr, setOriginalExpr] = useState("");
  const [afterEquals, setAfterEquals] = useState(false);

  // history tape (array of { eq, res })
  const [history, setHistory] = useState([]);
  const pushHistory = (eq, res) => setHistory((h) => [{ eq, res }, ...h].slice(0, 10));
  const clearHistory = () => setHistory([]);

  const lastAns = useRef(0);

  const scope = useMemo(
    () => ({
      Ans: lastAns.current,
      Mem: memory,
      pi: Math.PI,
      e: Math.E,
      sqrt: math.sqrt,
      cbrt: (x) => Math.cbrt(x),
      exp: math.exp,
      log10: (x) => math.log10(x),
      log: (x) => math.log(x),
      nthRoot: (x, n) => math.nthRoot(x, n),
      random: Math.random,
      factorial: (n) => {
        if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) throw new Error("factorial expects a non-negative integer");
        if (n > 170) throw new Error("n too large");
        let r = 1;
        for (let i = 2; i <= n; i++) r *= i;
        return r;
      },
      sind, cosd, tand, asind, acosd, atand,
    }),
    [memory]
  );

  // --------- actions ----------
  const insert = (text) =>
    setExpr((s) => {
      if (afterEquals) {
        const isOp = /^[+\-*/^]$/.test(text);
        setAfterEquals(false);
        if (isOp) return String(display) + text; // continue from result
        setOriginalExpr("");
        return text; // start fresh
      }
      return s + text;
    });

  const backspace = () => setExpr((s) => (s.length ? s.slice(0, -1) : ""));
  const clearAll = () => {
    setExpr("");
    setDisplay("0");
    setOriginalExpr("");
    setAfterEquals(false);
  };
  const handleFactorial = () => insert("!");
  const handleReciprocal = () => insert("1/(");
  const handleEXP = () => insert("E");
  const percentage = () => insert("*0.01");

  const useConstant = (name) => {
    setExpr((s) => (!s || /[+\-*/^,(]$/.test(s) ? s + name : s + "*" + name));
  };
  const useAns = () => useConstant("Ans");
  const mr = () => setExpr((s) => (!s || /[+\-*/^,(]$/.test(s) ? s + "Mem" : s + "*Mem"));

  const mPlus = () => {
    try {
      const v = evaluateSafe(expr || display);
      setMemory((m) => m + v);
    } catch {}
  };
  const mMinus = () => {
    try {
      const v = evaluateSafe(expr || display);
      setMemory((m) => m - v);
    } catch {}
  };
  const rnd = () => insert("random()");

  const toggleSign = () => {
    if (!expr) {
      if (display === "0") return;
      setExpr(display.startsWith("-") ? display.slice(1) : "-" + display);
      setDisplay((d) => (d.startsWith("-") ? d.slice(1) : "-" + d));
      return;
    }
    setExpr((s) => `(-1)*(${s})`);
  };

  const evaluateSafe = (raw) => {
    if (!raw.trim()) return 0;
    let s = raw;
    if (degMode) {
      s = s
        .replaceAll(/(?<![A-Za-z0-9_])sin\(/g, "sind(")
        .replaceAll(/(?<![A-Za-z0-9_])cos\(/g, "cosd(")
        .replaceAll(/(?<![A-Za-z0-9_])tan\(/g, "tand(")
        .replaceAll(/(?<![A-Za-z0-9_])asin\(/g, "asind(")
        .replaceAll(/(?<![A-Za-z0-9_])acos\(/g, "acosd(")
        .replaceAll(/(?<![A-Za-z0-9_])atan\(/g, "atand(");
    }
    const result = math.evaluate(s, scope);
    if (typeof result === "number" && Number.isFinite(result)) return result;
    return math.number(result);
  };

  const equals = () => {
    try {
      const eq = expr || originalExpr || String(display);
      const val = evaluateSafe(eq);
      lastAns.current = val;
      setOriginalExpr(eq);
      setDisplay(String(val));
      setAfterEquals(true);
      pushHistory(eq, String(val));
      // do NOT overwrite expr; insert() decides next step
    } catch {
      setDisplay("Error");
      setAfterEquals(true);
    }
  };

  const recall = (item) => {
    setExpr(item.eq);
    setOriginalExpr(item.eq);
    setDisplay(item.res);
    setAfterEquals(true);
  };

  // --------- keyboard support ----------
  useEffect(() => {
    const handleKey = (e) => {
      const key = e.key;

      // Numbers and decimal
      if (/^[0-9.]$/.test(key)) {
        insert(key);
        return;
      }

      // Operators
      if (["+", "-", "*", "/", "^", "%"].includes(key)) {
        insert(key);
        return;
      }

      // Parentheses
      if (key === "(" || key === ")") {
        insert(key);
        return;
      }

      // Enter / = → evaluate
      if (key === "Enter" || key === "=") {
        e.preventDefault();
        equals();
        return;
      }

      // Backspace → delete
      if (key === "Backspace") {
        e.preventDefault();
        backspace();
        return;
      }

      // Escape → clear all
      if (key === "Escape") {
        clearAll();
        return;
      }
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [afterEquals, display, expr]); // dependencies

  // --------- UI layout ----------
  const buttons = [
    { label: "sin", onClick: () => insert("sin(") },
    { label: "cos", onClick: () => insert("cos(") },
    { label: "tan", onClick: () => insert("tan(") },
    { label: "", spacer: true },
    { label: "Deg", toggle: "deg" },
    { label: "Rad", toggle: "rad" },

    { label: "sin⁻¹", onClick: () => insert("asin(") },
    { label: "cos⁻¹", onClick: () => insert("acos(") },
    { label: "tan⁻¹", onClick: () => insert("atan(") },
    { label: "π", onClick: () => useConstant("pi") },
    { label: "e", onClick: () => useConstant("e") },

    { label: "xʸ", onClick: () => insert("^") },
    { label: "x³", onClick: () => insert("^3") },
    { label: "x²", onClick: () => insert("^2") },
    { label: "eˣ", onClick: () => insert("exp(") },
    { label: "10ˣ", onClick: () => insert("10^(") },

    { label: "y√x", onClick: () => insert("nthRoot("), title: "nthRoot(x, y)" },
    { label: "³√x", onClick: () => insert("cbrt(") },
    { label: "√x", onClick: () => insert("sqrt(") },
    { label: "ln", onClick: () => insert("log(") },
    { label: "log", onClick: () => insert("log10(") },

    { label: "(", onClick: () => insert("(") },
    { label: ")", onClick: () => insert(")") },
    { label: "1/x", onClick: handleReciprocal },
    { label: "%", onClick: percentage },
    { label: "n!", onClick: handleFactorial },

    { label: "7", onClick: () => insert("7"), className: "digit" },
    { label: "8", onClick: () => insert("8"), className: "digit" },
    { label: "9", onClick: () => insert("9"), className: "digit" },
    { label: "+", onClick: () => insert("+"), className: "op" },
    { label: "Back", onClick: backspace, className: "ctrl" },

    { label: "4", onClick: () => insert("4"), className: "digit" },
    { label: "5", onClick: () => insert("5"), className: "digit" },
    { label: "6", onClick: () => insert("6"), className: "digit" },
    { label: "−", onClick: () => insert("-"), className: "op" },
    { label: "Ans", onClick: useAns, className: "mem" },

    { label: "1", onClick: () => insert("1"), className: "digit" },
    { label: "2", onClick: () => insert("2"), className: "digit" },
    { label: "3", onClick: () => insert("3"), className: "digit" },
    { label: "×", onClick: () => insert("*"), className: "op" },
    { label: "M+", onClick: mPlus, className: "mem" },

    { label: "0", onClick: () => insert("0"), className: "digit" },
    { label: ".", onClick: () => insert("."), className: "digit" },
    { label: "EXP", onClick: handleEXP, className: "ctrl", title: "Scientific notation (E)" },
    { label: "÷", onClick: () => insert("/"), className: "op" },
    { label: "M-", onClick: mMinus, className: "mem" },

    { label: "±", onClick: toggleSign, className: "ctrl" },
    { label: "RND", onClick: rnd, className: "ctrl" },
    { label: "AC", onClick: clearAll, className: "danger" },
    { label: "=", onClick: equals, className: "equals", wide: true },
    { label: "MR", onClick: mr, className: "mem" },
  ];

  return (
    <div className="page">
      <div className="calc">
        <div className="display" title={originalExpr || expr || "0"}>
          <div className="small">{originalExpr || expr || "\u00A0"}</div>
          <div className="big">{display}</div>
        </div>

        {/* History */}
        <div className="history">
          <div className="history-head">
            <span>History</span>
            <button className="clear-hist" onClick={clearHistory}>CLR HIST</button>
          </div>
          <div className="history-body">
            {history.length === 0 ? (
              <div className="history-empty">No entries yet</div>
            ) : (
              history.map((h, i) => (
                <div key={i} className="history-row" onClick={() => recall(h)} title="Click to recall">
                  <div className="eq">{h.eq}</div>
                  <div className="res">= {h.res}</div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="row mode">
          <BTN label="sin" onClick={() => insert("sin(")} />
          <BTN label="cos" onClick={() => insert("cos(")} />
          <BTN label="tan" onClick={() => insert("tan(")} />
          <div className="spacer" />
          <label className="mode-toggle">
            <input type="radio" checked={degMode} onChange={() => setDegMode(true)} />
            Deg
          </label>
          <label className="mode-toggle">
            <input type="radio" checked={!degMode} onChange={() => setDegMode(false)} />
            Rad
          </label>
        </div>

        <div className="grid">
          {buttons.slice(6).map((b, i) =>
            b.spacer ? (
              <div key={i} className="spacer" />
            ) : b.toggle ? null : (
              <BTN key={i} label={b.label} onClick={b.onClick} wide={b.wide} className={b.className || ""} title={b.title} />
            )
          )}
        </div>
      </div>

      {/* Inline styles for quick setup */}
      <style>{`
        :root { --bg:#e8eef5; --panel:#f6f8fb; --btn:#e3ebf3; --btn-dark:#d4dde7; --accent:#356a9a; --accent-2:#4e7fb0; --text:#10324d; }
        html, body, #root { height:100%; margin:0; }
        body { background: linear-gradient(180deg,#c8dae9,#eaf2fa); font-family: system-ui, Arial, sans-serif; }
        .page { min-height:100vh; display:flex; align-items:center; justify-content:center; padding:24px; }
        .calc { background:#fff; border:2px solid #1a3850; border-radius:10px; box-shadow:0 12px 30px rgba(0,0,0,0.18); width:330px; padding:12px; }

        .display { background:var(--accent); color:#fff; border-radius:6px; padding:10px 12px; box-shadow: inset 0 -2px 0 rgba(0,0,0,0.15); min-height:54px; display:flex; flex-direction:column; justify-content:center; overflow:hidden; }
        .display .small { font-size:12px; opacity:.85; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .display .big { font-size:26px; text-align:right; font-weight:700; line-height:1.3; }

        /* History styles */
        .history { background:#f7f9fc; border:1px solid #d3ddea; border-radius:8px; margin:10px 0 12px; }
        .history-head { display:flex; align-items:center; justify-content:space-between; padding:6px 8px; font-size:12px; color:#27445f; }
        .clear-hist { background:#ffe7ea; border:1px solid #f2aab1; border-radius:6px; padding:4px 8px; font-size:11px; cursor:pointer; }
        .clear-hist:hover { filter: brightness(0.96); }
        .history-body { max-height:120px; overflow:auto; border-top:1px solid #e1e9f3; }
        .history-empty { padding:10px 8px; color:#6b7c8e; font-size:12px; }
        .history-row { display:flex; justify-content:space-between; gap:8px; padding:6px 8px; font-size:12px; cursor:pointer; }
        .history-row:nth-child(odd) { background:#f0f5fb; }
        .history-row:hover { background:#e8f1fb; }
        .history-row .eq { color:#324f6b; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:60%; }
        .history-row .res { color:#0e2f49; font-weight:600; }

        .row.mode { display:grid; grid-template-columns: repeat(3, 1fr) 1fr auto auto; gap:6px; margin-top:6px; margin-bottom:6px; }
        .grid { display:grid; grid-template-columns: repeat(5, 1fr); gap:6px; }
        .calc-btn { background:var(--btn); border:1px solid #aebdcb; border-radius:6px; padding:10px 0; font-size:14px; color:var(--text); cursor:pointer; user-select:none; transition: transform .02s ease, background .2s ease; }
        .calc-btn:hover { background:var(--btn-dark); }
        .calc-btn:active { transform: translateY(1px); }
        .calc-btn.wide { grid-column: span 2; }
        .calc-btn.op { background:#dbe6f2; font-weight:700; }
        .calc-btn.equals { background: var(--accent-2); color:#fff; font-weight:700; }
        .calc-btn.danger { background:#ffdfe1; border-color:#e9a4a9; }
        .calc-btn.mem { background:#e8f2ff; }
        .calc-btn.ctrl { background:#eef0f4; }
        .calc-btn.digit { background:#e8eff6; }
        .mode-toggle { display:flex; align-items:center; gap:6px; color:#123; font-size:13px; }
        .mode-toggle input { accent-color: var(--accent-2); }

        @media (max-width: 360px) { .calc { width:95vw; } }
      `}</style>
    </div>
  );
}