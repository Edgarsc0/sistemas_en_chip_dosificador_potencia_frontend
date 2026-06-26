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
const RAMP_STEP    = 7;   // PWM incremento por tick (~40ms) → ~1.4s a tope
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

function Pedal({ pwm, onStart, onStop }) {
  const tiltDeg = (pwm / 255) * 32;
  const active  = pwm > 0;

  return (
    <div className="flex flex-col items-center gap-3 select-none">
      <span className="text-xs text-slate-500 uppercase tracking-widest">Acelerador</span>

      {/* Zona interactiva */}
      <div
        className="relative flex flex-col items-center cursor-pointer"
        style={{ height: 160, width: 90 }}
        onMouseDown={onStart}
        onMouseUp={onStop}
        onMouseLeave={onStop}
        onTouchStart={e => { e.preventDefault(); onStart(); }}
        onTouchEnd={onStop}
      >
        {/* Perno de sujeción */}
        <div className="w-8 h-3 rounded-sm bg-slate-600 border border-slate-500 z-10" />

        {/* Brazo + placa del pedal — rota desde arriba */}
        <div
          style={{
            transformOrigin: 'top center',
            transform: `rotate(${tiltDeg}deg)`,
            transition: active ? 'none' : 'transform 0.45s cubic-bezier(0.34,1.56,0.64,1)',
          }}
          className="flex flex-col items-center"
        >
          {/* Brazo */}
          <div
            className="w-4 rounded-sm transition-colors duration-150"
            style={{
              height: 100,
              background: active
                ? 'linear-gradient(to bottom, #78350f, #92400e)'
                : 'linear-gradient(to bottom, #334155, #1e293b)',
              boxShadow: active ? '0 0 12px #f59e0b55' : 'none',
            }}
          />

          {/* Placa del pedal */}
          <div
            className="rounded-b-md border-b-4 transition-colors duration-150"
            style={{
              width: 72,
              height: 22,
              borderColor: active ? '#f59e0b' : '#475569',
              background: active
                ? 'linear-gradient(to bottom, #b45309, #92400e)'
                : 'linear-gradient(to bottom, #475569, #334155)',
              boxShadow: active ? '0 4px 16px #f59e0b66' : 'none',
            }}
          >
            {/* Estrías */}
            <div className="flex gap-1 px-2 pt-1">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-sm"
                  style={{
                    height: 10,
                    background: active ? '#78350f' : '#1e293b',
                    opacity: 0.7,
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Piso */}
        <div
          className="absolute bottom-0 rounded-full"
          style={{
            width: 80,
            height: 4,
            background: active ? '#f59e0b44' : '#1e293b',
            boxShadow: active ? '0 0 10px #f59e0b88' : 'none',
            transition: 'all 0.2s',
          }}
        />
      </div>

      {/* Estado */}
      <span
        className="text-xs font-bold tracking-widest transition-colors"
        style={{ color: active ? '#f59e0b' : '#475569' }}
      >
        {active ? `PWM ${pwm}` : 'MANTÉN PRESIONADO'}
      </span>
    </div>
  );
}

export default function Dashboard() {
  const wsRef          = useRef(null);
  const reconnectTimer = useRef(null);
  const pedalTimer     = useRef(null);
  const [connected, setConnected]   = useState(false);
  const [pwm, setPwm]               = useState(0);
  const [telemetry, setTelemetry]   = useState({ potencia: 0, aceleracion: 0, velocidad: 0 });
  const [rpmHist, setRpmHist]       = useState([]);
  const [accelHist, setAccelHist]   = useState([]);

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

  // Pedal: rampa de aceleración mientras se mantiene presionado
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

  // Prevenir que soltar mouse fuera de la ventana deje el pedal atascado
  useEffect(() => {
    const release = () => stopPedal();
    window.addEventListener('mouseup', release);
    window.addEventListener('touchend', release);
    return () => {
      window.removeEventListener('mouseup', release);
      window.removeEventListener('touchend', release);
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

      {/* Control — slider + pedal lado a lado */}
      <section className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-6">
        <div className="flex gap-6 items-start">

          {/* Slider y botones */}
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

          {/* Divisor */}
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
