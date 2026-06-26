'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
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
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale, LinearScale, PointElement,
  LineElement, Title, Tooltip, Legend, Filler
);

const WS_URL       = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8080';
const MAX_POINTS   = 60;
const RECONNECT_MS = 3000;
const RAMP_STEP    = 7;
const RAMP_TICK    = 40;

const chartOptions = (label, color) => ({
  responsive: true,
  maintainAspectRatio: false,
  animation: { duration: 0 },
  plugins: {
    legend: { display: false },
    title: { display: true, text: label, color: '#94a3b8', font: { size: 13 } },
  },
  scales: {
    x: { ticks: { color: '#64748b', maxTicksLimit: 8 }, grid: { color: '#1e293b' } },
    y: { ticks: { color: '#64748b' }, grid: { color: '#1e293b' } },
  },
});

function buildDataset(data, color) {
  return {
    labels: data.map((_, i) => i),
    datasets: [{
      data,
      borderColor: color,
      backgroundColor: color + '22',
      borderWidth: 2,
      pointRadius: 0,
      fill: true,
      tension: 0.4,
    }],
  };
}

// ── Pedal de perfil ────────────────────────────────────────────
function Pedal({ pwm, onStart, onStop }) {
  const active = pwm > 0;

  // -14° en reposo → +20° a tope (rango 34°)
  const angle = -14 + (pwm / 255) * 34;

  const c = {
    arm:    active ? '#92400e' : '#293548',
    armSt:  active ? '#fbbf2466' : '#374151',
    plate:  active ? '#d97706' : '#3f5068',
    plateSt:active ? '#fbbf24' : '#64748b',
    rib:    active ? '#78350f' : '#1a2535',
    pivot:  active ? '#b45309' : '#475569',
  };

  return (
    <div
      className="flex flex-col items-center gap-2 select-none"
      style={{ touchAction: 'none' }}
    >
      <span className="text-xs text-slate-500 uppercase tracking-widest">Acelerador</span>

      <div
        className="cursor-pointer"
        onMouseDown={onStart}
        onMouseUp={onStop}
        onMouseLeave={onStop}
        onTouchStart={e => { e.preventDefault(); onStart(); }}
        onTouchEnd={onStop}
      >
        <svg width="130" height="210" viewBox="0 0 130 210">
          <defs>
            {/* Glow filter para el pedal activo */}
            <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="4" result="blur"/>
              <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
          </defs>

          {/* Sombra en piso cuando activo */}
          <ellipse
            cx="52" cy="198" rx="48" ry="5"
            fill="#f59e0b" opacity={active ? 0.18 : 0}
            style={{ transition: 'opacity 0.3s' }}
          />

          {/* Piso */}
          <rect x="4" y="194" width="122" height="7" rx="3" fill="#111827"/>
          <rect x="4" y="194" width="122" height="2" rx="1" fill="#1f2d3d"/>

          {/* Soporte de montaje (fijo) */}
          <rect x="40" y="178" width="20" height="18" rx="3"
            fill="#161f2c" stroke="#2d3f52" strokeWidth="1"
          />
          {/* tornillo soporte */}
          <rect x="48" y="180" width="4" height="3" rx="1" fill="#374151"/>

          {/* ── Grupo rotante: brazo + placa ── */}
          <g style={{
            transform: `rotate(${angle}deg)`,
            transformOrigin: '50px 192px',
            transition: active
              ? 'none'
              : 'transform 0.55s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}>

            {/* Brazo */}
            <rect x="43" y="62" width="14" height="132" rx="5"
              fill={c.arm}
              stroke={c.armSt}
              strokeWidth="1"
              filter={active ? 'url(#glow)' : undefined}
            />
            {/* reflejo lateral del brazo */}
            <rect x="44" y="65" width="4" height="126" rx="2"
              fill="white" opacity="0.05"
            />

            {/* Unión brazo-placa */}
            <rect x="36" y="54" width="28" height="14" rx="4"
              fill={c.arm} stroke={c.armSt} strokeWidth="1"
            />

            {/* Placa del pedal */}
            <rect x="4" y="36" width="92" height="24" rx="5"
              fill={c.plate}
              stroke={c.plateSt}
              strokeWidth={active ? 1.5 : 1}
              filter={active ? 'url(#glow)' : undefined}
            />
            {/* brillo superior placa */}
            <rect x="6" y="38" width="88" height="6" rx="3"
              fill="white" opacity="0.07"
            />
            {/* estrías antideslizantes */}
            {[11, 22, 33, 44, 55, 66, 77].map(x => (
              <rect key={x} x={x} y="41" width="7" height="15" rx="2"
                fill={c.rib} opacity="0.9"
              />
            ))}
          </g>

          {/* Perno pivote (encima del brazo) */}
          <circle cx="50" cy="192" r="7"
            fill={c.pivot}
            stroke={active ? '#fbbf24' : '#64748b'}
            strokeWidth="1.5"
            style={{ transition: 'all 0.2s' }}
          />
          <circle cx="50" cy="192" r="3" fill="#cbd5e1" opacity="0.6"/>
          <circle cx="50" cy="192" r="1" fill="#0f172a"/>
        </svg>
      </div>

      {/* Estado */}
      <span
        className="text-xs font-bold tabular-nums tracking-widest"
        style={{
          color: active ? '#fbbf24' : '#3f5068',
          transition: 'color 0.2s',
        }}
      >
        {active ? `PWM  ${pwm}` : 'MANTÉN PRESIONADO'}
      </span>
    </div>
  );
}

// ── Dashboard ──────────────────────────────────────────────────
export default function Dashboard() {
  const wsRef          = useRef(null);
  const reconnectTimer = useRef(null);
  const pedalTimer     = useRef(null);

  const [connected, setConnected] = useState(false);
  const [pwm, setPwm]             = useState(0);
  const [telemetry, setTelemetry] = useState({ potencia: 0, aceleracion: 0, velocidad: 0 });
  const [rpmHist, setRpmHist]     = useState([]);
  const [accelHist, setAccelHist] = useState([]);

  const sendPwm = useCallback((value) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ pwm: value }));
    }
  }, []);

  const push = (setter, value) =>
    setter(prev => [...prev.slice(-MAX_POINTS + 1), value]);

  useEffect(() => {
    function connect() {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen  = () => { setConnected(true); clearTimeout(reconnectTimer.current); };
      ws.onclose = () => {
        setConnected(false);
        reconnectTimer.current = setTimeout(connect, RECONNECT_MS);
      };
      ws.onerror = () => ws.close();

      ws.onmessage = ({ data }) => {
        let msg;
        try { msg = JSON.parse(data); } catch { return; }
        if (msg.velocidad === undefined) return;
        setTelemetry(msg);
        push(setRpmHist,   msg.velocidad);
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
      setPwm(prev => {
        const next = Math.min(255, prev + RAMP_STEP);
        sendPwm(next);
        return next;
      });
    }, RAMP_TICK);
  }, [sendPwm]);

  const stopPedal = useCallback(() => {
    clearInterval(pedalTimer.current);
    setPwm(0);
    sendPwm(0);
  }, [sendPwm]);

  useEffect(() => {
    const up = () => stopPedal();
    window.addEventListener('mouseup',  up);
    window.addEventListener('touchend', up);
    return () => {
      window.removeEventListener('mouseup',  up);
      window.removeEventListener('touchend', up);
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
        <span className={`px-3 py-1 rounded-full text-xs font-semibold tracking-wider ${
          connected ? 'bg-emerald-900 text-emerald-300' : 'bg-red-900 text-red-300 animate-pulse'
        }`}>
          {connected ? '● ONLINE' : '● OFFLINE'}
        </span>
      </header>

      {/* Cards */}
      <section className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Velocidad',   value: telemetry.velocidad.toFixed(1),   unit: 'RPM'   },
          { label: 'Aceleración', value: telemetry.aceleracion.toFixed(2), unit: 'RPM/s' },
          { label: 'Duty Cycle',  value: dutyCycle,                         unit: '%'     },
        ].map(({ label, value, unit }) => (
          <div key={label} className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col items-center">
            <span className="text-xs text-slate-500 uppercase tracking-widest mb-1">{label}</span>
            <span className="text-4xl font-bold text-sky-400 tabular-nums">{value}</span>
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
              <span className="text-xs text-slate-500 uppercase tracking-widest">Control PWM</span>
              <span className="text-2xl font-bold text-amber-400 tabular-nums">
                {pwm}<span className="text-sm text-slate-500 ml-1">/ 255</span>
              </span>
            </div>

            <input
              type="range" min="0" max="255" value={pwm}
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
            data={buildDataset(rpmHist, '#38bdf8')}
            options={chartOptions('Velocidad (RPM)', '#38bdf8')}
          />
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 h-56">
          <Line
            data={buildDataset(accelHist, '#fb923c')}
            options={chartOptions('Aceleración (RPM/s)', '#fb923c')}
          />
        </div>
      </section>
    </div>
  );
}
