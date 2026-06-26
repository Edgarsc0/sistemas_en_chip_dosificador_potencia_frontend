"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Line } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
);

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8080";
const MAX_POINTS = 60;
const RECONNECT_MS = 3000;
const RAMP_STEP = 7;
const RAMP_TICK = 40;

const chartOptions = (label) => ({
  responsive: true,
  maintainAspectRatio: false,
  animation: { duration: 0 },
  plugins: {
    legend: { display: false },
    title: { display: true, text: label, color: "#94a3b8", font: { size: 13 } },
  },
  scales: {
    x: {
      ticks: { color: "#64748b", maxTicksLimit: 8 },
      grid: { color: "#1e293b" },
    },
    y: { ticks: { color: "#64748b" }, grid: { color: "#1e293b" } },
  },
});

function buildDataset(data, color) {
  return {
    labels: data.map((_, i) => i),
    datasets: [
      {
        data,
        borderColor: color,
        backgroundColor: color + "22",
        borderWidth: 2,
        pointRadius: 0,
        fill: true,
        tension: 0.4,
      },
    ],
  };
}

// ── Pedal ────────────────────────────────────────────────────────────────────
function Pedal({ pwm, onStart, onStop }) {
  const svgRef = useRef(null);
  const active = pwm > 0;
  const pct = pwm / 255;

  // Geometría fija
  const pivX = 221,
    pivY = 164; // pivote del pedal (extremo derecho, anclado al suelo)
  const fwX = 27,
    fwY = 110; // anclaje del cilindro en el firewall
  // Perno en coords locales del pedal (relativo al pivote, rot=0)
  // SVG sin rot: (101,170) → local: (101-221, 170-164) = (-120, 6)
  const lx = -120,
    ly = 6;

  // Reposo: +45°  →  presionado: +5°
  const angle = 45 - pct * 40;

  function pegWorld(angleDeg) {
    const r = (angleDeg * Math.PI) / 180;
    return {
      x: pivX + lx * Math.cos(r) - ly * Math.sin(r),
      y: pivY + lx * Math.sin(r) + ly * Math.cos(r),
    };
  }

  const peg = pegWorld(angle);
  const dx = peg.x - fwX;
  const dy = peg.y - fwY;
  const cylAngle = (Math.atan2(dy, dx) * 180) / Math.PI;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const cylLen = Math.min(52, dist * 0.38);

  const pedalTransition = active
    ? "transform 75ms ease-out"
    : "transform 0.5s cubic-bezier(0.34,1.56,0.64,1)";

  return (
    <div
      className="flex flex-row items-center gap-6 select-none"
      style={{ touchAction: "none" }}
    >
      {/* Etiqueta */}
      <div className="flex flex-col items-end gap-1">
        <span className="text-xs text-slate-500 font-bold uppercase tracking-widest">
          Acelerador
        </span>
        <div className="h-px w-10 bg-slate-800 rounded-full" />
      </div>

      {/* Zona del pedal */}
      <div
        className="cursor-pointer relative p-3 bg-slate-950/45 rounded-2xl border border-slate-800/50 shadow-inner"
        onMouseDown={onStart}
        onMouseUp={onStop}
        onMouseLeave={onStop}
        onTouchStart={(e) => {
          e.preventDefault();
          onStart();
        }}
        onTouchEnd={onStop}
      >
        {/* Glow ambiental */}
        <div
          className="absolute inset-0 rounded-2xl pointer-events-none transition-opacity duration-300"
          style={{
            background:
              "radial-gradient(circle at 50% 80%, rgba(251,191,36,.18), transparent 70%)",
            opacity: pct,
            zIndex: 0,
          }}
        />

        <svg
          ref={svgRef}
          width="280"
          height="220"
          viewBox="0 0 280 220"
          style={{
            display: "block",
            overflow: "visible",
            position: "relative",
            zIndex: 1,
          }}
        >
          <defs>
            <linearGradient id="pg-chrome" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#475569" />
              <stop offset="30%" stopColor="#cbd5e1" />
              <stop offset="70%" stopColor="#94a3b8" />
              <stop offset="100%" stopColor="#1e293b" />
            </linearGradient>
            <linearGradient id="pg-rubber" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#1e293b" />
              <stop offset="100%" stopColor="#0f172a" />
            </linearGradient>
            <linearGradient id="pg-rod" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#94a3b8" />
              <stop offset="40%" stopColor="#e2e8f0" />
              <stop offset="100%" stopColor="#475569" />
            </linearGradient>
            <linearGradient id="pg-cyl" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#1e293b" />
              <stop offset="50%" stopColor="#334155" />
              <stop offset="100%" stopColor="#0f172a" />
            </linearGradient>
          </defs>

          {/* Suelo */}
          <rect x="15" y="168" width="250" height="8" rx="3" fill="#0b1121" />
          <rect x="15" y="168" width="250" height="2" rx="1" fill="#1e293b" />

          {/* Firewall izquierdo */}
          <rect
            x="15"
            y="50"
            width="12"
            height="122"
            rx="3"
            fill="#0b1121"
            stroke="#1e293b"
            strokeWidth="1"
          />
          <circle cx="21" cy="68" r="2.5" fill="#334155" />
          <circle cx="21" cy="68" r="1" fill="#0f172a" />
          <circle cx="21" cy="155" r="2.5" fill="#334155" />
          <circle cx="21" cy="155" r="1" fill="#0f172a" />

          {/* Pivote base (extremo derecho) */}
          <rect x="206" y="158" width="30" height="12" rx="3" fill="#0b1121" />
          <circle
            cx={pivX}
            cy={pivY}
            r="11"
            fill="#0f172a"
            stroke="#1e293b"
            strokeWidth="1.5"
          />
          <circle cx={pivX} cy={pivY} r="5" fill="#64748b" />
          <circle cx={pivX} cy={pivY} r="2" fill="#0f172a" />

          {/* Varilla (detrás del pedal) */}
          <line
            x1={fwX}
            y1={fwY}
            x2={peg.x}
            y2={peg.y}
            stroke="url(#pg-rod)"
            strokeWidth="7"
            strokeLinecap="round"
          />
          <line
            x1={fwX}
            y1={fwY + 2}
            x2={peg.x}
            y2={peg.y + 2}
            stroke="#0f172a"
            strokeWidth="3"
            strokeLinecap="round"
            opacity=".5"
          />

          {/* Cilindro (rota desde el firewall apuntando al perno) */}
          <g
            style={{
              transformOrigin: `${fwX}px ${fwY}px`,
              transform: `rotate(${cylAngle}deg)`,
            }}
          >
            <rect
              x={fwX}
              y={fwY - 8}
              width={cylLen}
              height="16"
              rx="4"
              fill="url(#pg-cyl)"
              stroke="#334155"
              strokeWidth="0.5"
            />
            <line
              x1={fwX + 2}
              y1={fwY - 6}
              x2={fwX + cylLen - 2}
              y2={fwY - 6}
              stroke="#64748b"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <line
              x1={fwX + 2}
              y1={fwY + 6}
              x2={fwX + cylLen - 2}
              y2={fwY + 6}
              stroke="#020617"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <circle
              cx={fwX}
              cy={fwY}
              r="8"
              fill="#0f172a"
              stroke="#334155"
              strokeWidth="1"
            />
            <circle cx={fwX} cy={fwY} r="4" fill="#1e293b" />
            <circle cx={fwX} cy={fwY} r="1.5" fill="#334155" />
          </g>

          {/* Pedal — pivota en (pivX, pivY); reposo +45°, presionado +5° */}
          <g
            style={{
              transformOrigin: `${pivX}px ${pivY}px`,
              transform: `rotate(${angle}deg)`,
              transition: pedalTransition,
            }}
          >
            {/* Brazo estructural inferior */}
            <rect x="38" y="158" width="186" height="9" rx="3" fill="#1e293b" />
            {/* Canto inferior cromado */}
            <rect
              x="36"
              y="164"
              width="188"
              height="3"
              rx="1"
              fill="#475569"
              opacity=".6"
            />
            {/* Cara de goma (donde va el pie) */}
            <rect
              x="40"
              y="139"
              width="184"
              height="20"
              rx="5"
              fill="url(#pg-rubber)"
            />
            {/* Canto superior cromado */}
            <rect
              x="38"
              y="138"
              width="186"
              height="3"
              rx="2"
              fill="#94a3b8"
              opacity=".75"
            />
            {/* Franja lateral izquierda */}
            <rect
              x="38"
              y="138"
              width="5"
              height="33"
              rx="2"
              fill="#64748b"
              opacity=".5"
            />

            {/* Grips de goma */}
            {[58, 82, 106, 130, 154, 178].map((gx) => (
              <g key={gx}>
                <rect
                  x={gx}
                  y="142"
                  width="6"
                  height="13"
                  rx="3"
                  fill="#0f172a"
                />
                <rect
                  x={gx}
                  y="143"
                  width="2"
                  height="11"
                  rx="1"
                  fill="#334155"
                />
              </g>
            ))}

            {/* Perno del pistón (cara inferior, a 120px del pivote) */}
            <circle
              cx="101"
              cy="170"
              r="5.5"
              fill="#94a3b8"
              stroke="#0f172a"
              strokeWidth="1.5"
            />
            <circle cx="101" cy="170" r="2" fill="#0f172a" />
          </g>

          {/* Sombra en el suelo */}
          <ellipse
            cx="160"
            cy="173"
            rx={60 - pct * 15}
            ry="4"
            fill="#000"
            opacity={0.25 + pct * 0.2}
          />
        </svg>
      </div>

      {/* Panel digital */}
      <div className="flex flex-col items-start gap-2 min-w-[100px]">
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full transition-colors duration-300 ${active ? "bg-emerald-400 shadow-[0_0_8px_#34d399]" : "bg-slate-700"}`}
          />
          <span
            className="text-[11px] font-bold tabular-nums tracking-widest transition-colors duration-200"
            style={{ color: active ? "#fcd34d" : "#64748b" }}
          >
            {active ? `THROTTLE ${Math.round(pct * 100)}%` : "READY"}
          </span>
        </div>
        <div className="w-full h-2 bg-slate-950 border border-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full transition-all duration-75"
            style={{
              width: `${pct * 100}%`,
              background: "linear-gradient(90deg,#f59e0b,#fcd34d)",
            }}
          />
        </div>
        <span className="text-[10px] text-slate-600 tracking-wider">
          PWM {pwm} / 255
        </span>
      </div>
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const wsRef = useRef(null);
  const reconnectTimer = useRef(null);
  const pedalTimer = useRef(null);

  const [connected, setConnected] = useState(false);
  const [pwm, setPwm] = useState(0);
  const [telemetry, setTelemetry] = useState({
    potencia: 0,
    aceleracion: 0,
    velocidad: 0,
  });
  const [rpmHist, setRpmHist] = useState([]);
  const [accelHist, setAccelHist] = useState([]);

  const sendPwm = useCallback((value) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ pwm: value }));
    }
  }, []);

  const push = (setter, value) =>
    setter((prev) => [...prev.slice(-MAX_POINTS + 1), value]);

  useEffect(() => {
    function connect() {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        clearTimeout(reconnectTimer.current);
      };
      ws.onclose = () => {
        setConnected(false);
        reconnectTimer.current = setTimeout(connect, RECONNECT_MS);
      };
      ws.onerror = () => ws.close();

      ws.onmessage = ({ data }) => {
        let msg;
        try {
          msg = JSON.parse(data);
        } catch {
          return;
        }
        if (msg.velocidad === undefined) return;
        setTelemetry(msg);
        push(setRpmHist, msg.velocidad);
        push(setAccelHist, msg.aceleracion);
      };
    }

    connect();
    return () => {
      clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, []);

  const startPedal = useCallback(() => {
    clearInterval(pedalTimer.current);
    pedalTimer.current = setInterval(() => {
      setPwm((prev) => {
        const next = Math.min(255, prev + RAMP_STEP);
        sendPwm(next);
        return next;
      });
    }, RAMP_TICK);
  }, [sendPwm]);

  const stopPedal = useCallback(() => {
    clearInterval(pedalTimer.current);
    pedalTimer.current = setInterval(() => {
      setPwm((prev) => {
        if (prev <= 0) {
          clearInterval(pedalTimer.current);
          return 0;
        }
        const next = Math.max(0, prev - 3);
        sendPwm(next);
        return next;
      });
    }, RAMP_TICK);
  }, [sendPwm]);

  useEffect(() => {
    const up = () => stopPedal();
    window.addEventListener("mouseup", up);
    window.addEventListener("touchend", up);
    return () => {
      window.removeEventListener("mouseup", up);
      window.removeEventListener("touchend", up);
    };
  }, [stopPedal]);

  const handleSlider = (e) => {
    clearInterval(pedalTimer.current);
    const v = Number(e.target.value);
    setPwm(v);
    sendPwm(v);
  };

  const setPreset = (v) => {
    clearInterval(pedalTimer.current);
    setPwm(v);
    sendPwm(v);
  };

  const dutyCycle = ((pwm / 255) * 100).toFixed(1);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 font-mono">
      {/* Header */}
      <header className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold tracking-widest text-slate-200 uppercase">
          Motor Telemetry Dashboard
        </h1>
        <span
          className={`px-3 py-1 rounded-full text-xs font-semibold tracking-wider ${
            connected
              ? "bg-emerald-900 text-emerald-300"
              : "bg-red-900 text-red-300 animate-pulse"
          }`}
        >
          {connected ? "● ONLINE" : "● OFFLINE"}
        </span>
      </header>

      {/* Cards */}
      <section className="grid grid-cols-3 gap-4 mb-6">
        {[
          {
            label: "Velocidad",
            value: telemetry.velocidad.toFixed(1),
            unit: "RPM",
          },
          {
            label: "Aceleración",
            value: telemetry.aceleracion.toFixed(2),
            unit: "RPM/s",
          },
          { label: "Duty Cycle", value: dutyCycle, unit: "%" },
        ].map(({ label, value, unit }) => (
          <div
            key={label}
            className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col items-center"
          >
            <span className="text-xs text-slate-500 uppercase tracking-widest mb-1">
              {label}
            </span>
            <span className="text-4xl font-bold text-sky-400 tabular-nums">
              {value}
            </span>
            <span className="text-sm text-slate-500 mt-1">{unit}</span>
          </div>
        ))}
      </section>

      {/* Control */}
      <section className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-6">
        <div className="flex gap-6 items-center">
          {/* Slider + botones */}
          <div className="flex-1">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-slate-500 uppercase tracking-widest">
                Control PWM
              </span>
              <span className="text-2xl font-bold text-amber-400 tabular-nums">
                {pwm}
                <span className="text-sm text-slate-500 ml-1">/ 255</span>
              </span>
            </div>

            <input
              type="range"
              min="0"
              max="255"
              value={pwm}
              onChange={handleSlider}
              className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-amber-400 bg-slate-700"
            />

            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setPreset(0)}
                className="flex-1 py-2 rounded-lg bg-red-900 hover:bg-red-700 text-red-200 font-bold text-sm tracking-wider transition-colors"
              >
                STOP ■
              </button>
              <button
                onClick={() => setPreset(255)}
                className="flex-1 py-2 rounded-lg bg-emerald-900 hover:bg-emerald-700 text-emerald-200 font-bold text-sm tracking-wider transition-colors"
              >
                MAX ▲
              </button>
            </div>
          </div>

          <div className="w-px bg-slate-800 self-stretch" />

          {/* Pedal */}
          <Pedal pwm={pwm} onStart={startPedal} onStop={stopPedal} />
        </div>
      </section>

      {/* Gráficas */}
      <section className="grid grid-cols-2 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 h-56">
          <Line
            data={buildDataset(rpmHist, "#38bdf8")}
            options={chartOptions("Velocidad (RPM)")}
          />
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 h-56">
          <Line
            data={buildDataset(accelHist, "#fb923c")}
            options={chartOptions("Aceleración (RPM/s)")}
          />
        </div>
      </section>
    </div>
  );
}
