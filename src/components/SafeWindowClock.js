"use client";

import { useState, useEffect } from 'react';

export default function SafeWindowClock({ hourlyData, t }) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  if (!hourlyData || !hourlyData.time || hourlyData.time.length === 0) {
    return null;
  }

  // Find closest hour index
  const nowTime = now.getTime();
  let startIndex = 0;
  let minDiff = Infinity;

  hourlyData.time.forEach((timeStr, idx) => {
    const [datePart, timePart] = timeStr.split('T');
    const [year, month, day] = datePart.split('-');
    const [hours, minutes] = timePart.split(':');
    const hourTime = new Date(year, month - 1, day, hours, minutes).getTime();
    const diff = Math.abs(hourTime - nowTime);
    if (diff < minDiff && hourTime >= nowTime - 3600000) {
      minDiff = diff;
      startIndex = idx;
    }
  });

  // Build next 12 hours with status
  const next12Hours = [];
  for (let i = 0; i < 12; i++) {
    const idx = startIndex + i;
    if (idx < hourlyData.time.length) {
      const timeStr = hourlyData.time[idx];
      const timePart = timeStr.split('T')[1];
      if (!timePart) continue;
      const hourNum = parseInt(timePart.split(':')[0], 10);

      const code = hourlyData.weathercode[idx];
      const precipProb = hourlyData.precipitation_probability?.[idx] ?? 0;
      const temp = hourlyData.temperature_2m?.[idx] ?? 0;

      let status = 'safe';
      if (code >= 80 || precipProb > 60 || code === 95 || code === 96 || code === 99) {
        status = 'danger';
      } else if (code >= 51 || precipProb > 30 || temp > 40) {
        status = 'caution';
      }

      next12Hours.push({ hour: hourNum, status });
    }
  }

  // Status colors — slightly muted to match the minimal b&w page palette
  const statusColors = {
    safe:    '#bbf7d0', // green-200
    caution: '#fde68a', // amber-200
    danger:  '#fca5a5', // red-300
  };

  const getStatusColor = (s) => statusColors[s] ?? '#e5e7eb';
  const getStatusLabel = (s) => t?.[s] ?? s;

  // SVG geometry
  const cx = 150, cy = 150;
  const faceR   = 132; // single outer circle
  const arcOuter = 132;
  const arcInner = 108; // width of status ring: 24px
  const numR     = 88;  // numerals radius
  const minTickOuter = 108;
  const minTickInner = 104;
  const hrTickOuter  = 108;
  const hrTickInner  = 100;

  // Polar helpers
  const toCart = (r, deg) => {
    const rad = (deg - 90) * Math.PI / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  };

  // Arc path for a donut segment
  const arcPath = (innerR, outerR, startDeg, endDeg) => {
    const GAP = 1.2; // degrees of gap between segments
    const s = startDeg + GAP / 2;
    const e = endDeg   - GAP / 2;
    const large = (e - s) > 180 ? 1 : 0;
    const o1 = toCart(outerR, s), o2 = toCart(outerR, e);
    const i1 = toCart(innerR, e), i2 = toCart(innerR, s);
    return [
      `M ${o1.x} ${o1.y}`,
      `A ${outerR} ${outerR} 0 ${large} 1 ${o2.x} ${o2.y}`,
      `L ${i1.x} ${i1.y}`,
      `A ${innerR} ${innerR} 0 ${large} 0 ${i2.x} ${i2.y}`,
      'Z'
    ].join(' ');
  };

  // Clock hands
  const currentHour = now.getHours();
  const currentMin  = now.getMinutes();
  const hourAngle   = (currentHour % 12) * 30 + currentMin * 0.5;
  const minuteAngle = currentMin * 6;

  const hPt = toCart(58, hourAngle);
  const mPt = toCart(82, minuteAngle);

  return (
    <div className="flex flex-col items-center p-4 bg-white border border-gray-200 rounded-sm">
      <h3 className="text-xs font-bold uppercase tracking-wider text-gray-900 border-b border-gray-200 w-full text-center pb-2 mb-5">
        {t?.timelineTitle || "12-Hour Forecast Clock"}
      </h3>

      <svg width="300" height="300" viewBox="0 0 300 300">
        {/* Single outer clock face */}
        <circle cx={cx} cy={cy} r={faceR} fill="#ffffff" stroke="#d1d5db" strokeWidth="1.5" />

        {/* Status arc ring — fills the outer band */}
        {next12Hours.map((d, i) => {
          const startAngle = (d.hour % 12) * 30;
          const endAngle   = startAngle + 30;
          return (
            <path
              key={i}
              d={arcPath(arcInner, arcOuter, startAngle, endAngle)}
              fill={getStatusColor(d.status)}
            />
          );
        })}

        {/* Minute ticks (60 ticks, thin) */}
        {[...Array(60)].map((_, i) => {
          const angle = i * 6;
          const isHour = i % 5 === 0;
          const inner = toCart(isHour ? hrTickInner : minTickInner, angle);
          const outer = toCart(isHour ? hrTickOuter : minTickOuter, angle);
          return (
            <line
              key={i}
              x1={inner.x} y1={inner.y}
              x2={outer.x} y2={outer.y}
              stroke={isHour ? '#6b7280' : '#d1d5db'}
              strokeWidth={isHour ? 1.5 : 0.75}
            />
          );
        })}

        {/* Hour numerals */}
        {[...Array(12)].map((_, i) => {
          const num = i + 1;
          const pt  = toCart(numR, num * 30);
          return (
            <text
              key={num}
              x={pt.x} y={pt.y}
              fontSize="12"
              fill="#374151"
              textAnchor="middle"
              dominantBaseline="central"
              fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
              fontWeight="600"
              letterSpacing="-0.5"
            >
              {num}
            </text>
          );
        })}

        {/* Hour hand */}
        <line
          x1={cx} y1={cy} x2={hPt.x} y2={hPt.y}
          stroke="#111827" strokeWidth="4.5" strokeLinecap="round"
        />
        {/* Minute hand */}
        <line
          x1={cx} y1={cy} x2={mPt.x} y2={mPt.y}
          stroke="#111827" strokeWidth="2.5" strokeLinecap="round"
        />
        {/* Center pin */}
        <circle cx={cx} cy={cy} r="4"   fill="#111827" />
        <circle cx={cx} cy={cy} r="1.5" fill="#ffffff" />
      </svg>

      {/* Legend */}
      <div className="flex items-center space-x-6 mt-4">
        {['safe', 'caution', 'danger'].map(status => (
          <div key={status} className="flex items-center space-x-1.5">
            <span
              className="w-2.5 h-2.5 rounded-full border border-gray-200"
              style={{ backgroundColor: getStatusColor(status) }}
            />
            <span className="text-xs font-mono uppercase tracking-wider text-gray-600">
              {getStatusLabel(status)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
