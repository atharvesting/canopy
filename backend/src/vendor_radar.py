"""
vendor_radar.py — Vendor-Friendly Radar Visualization for Project Canopy

Generates a clear, easy-to-understand wind/weather risk visualization
designed for street vendors who may not understand scientific radar imagery.

Uses REAL Open-Meteo weather data (wind speed, direction, temperature)
to produce a visually compelling "risk zone" map.
"""

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
import numpy as np
import os


def _wind_direction_label(degrees):
    """Convert wind direction degrees to compass label."""
    dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
    idx = round(degrees / 45) % 8
    return dirs[idx]


def _risk_level(windspeed, weathercode, temperature):
    """Calculate overall risk level 0-100 from weather data."""
    risk = 0
    
    # Wind contribution (0-40 points)
    if windspeed > 50:
        risk += 40
    elif windspeed > 35:
        risk += 30
    elif windspeed > 20:
        risk += 15
    else:
        risk += 5
    
    # Weather code contribution (0-40 points)
    if weathercode in {95, 96, 99}:  # Thunderstorm
        risk += 40
    elif weathercode in {65, 82}:     # Heavy rain
        risk += 30
    elif weathercode in {61, 63, 80, 81}:  # Moderate rain
        risk += 20
    elif weathercode in {51, 53, 55}:  # Drizzle
        risk += 10
    elif weathercode in {45, 48}:      # Fog
        risk += 8
    
    # Temperature extremes (0-20 points)
    if temperature > 42:
        risk += 20
    elif temperature > 38:
        risk += 15
    elif temperature < 2:
        risk += 15
    elif temperature < 10:
        risk += 8
    
    return min(risk, 100)


def generate_vendor_radar(weather_data, lat, lon, output_path="/tmp/current_radar.png"):
    """
    Generate a vendor-friendly radar visualization.
    
    Instead of scientific wind shear data, this creates an intuitive
    'danger zone' map that any vendor can instantly understand:
    - Green center = your location (safe right now)
    - Yellow/Orange rings = approaching weather risk
    - Red zones = danger areas
    - Clear wind arrow showing direction
    - Big, readable risk label
    """
    temp = weather_data.get('temperature', 25)
    wind = weather_data.get('windspeed', 10)
    wind_dir = weather_data.get('winddirection', 0)
    weathercode = weather_data.get('weathercode', 0)
    
    risk = _risk_level(wind, weathercode, temp)
    
    fig, ax = plt.subplots(1, 1, figsize=(7, 7), facecolor='#1a1a2e')
    ax.set_facecolor('#1a1a2e')
    
    # Create concentric risk zones using radial gradient
    theta = np.linspace(0, 2 * np.pi, 200)
    
    # Outer danger zone (shifts based on wind direction)
    wind_rad = np.radians(wind_dir + 180)  # Danger comes FROM wind direction
    
    for radius in np.linspace(4.5, 1.0, 40):
        # Shift intensity towards wind direction
        intensity_factor = radius / 4.5
        
        # Color: green (safe) at center → yellow → orange → red (danger) at edge
        if risk > 60:
            r_color = min(1.0, 0.2 + intensity_factor * 0.8)
            g_color = max(0.0, 0.8 - intensity_factor * 0.7)
            b_color = 0.1
        elif risk > 30:
            r_color = min(1.0, 0.1 + intensity_factor * 0.9)
            g_color = min(1.0, 0.6 + intensity_factor * 0.2 - intensity_factor * 0.5)
            b_color = 0.05
        else:
            r_color = max(0.0, intensity_factor * 0.3)
            g_color = min(1.0, 0.4 + (1 - intensity_factor) * 0.5)
            b_color = max(0.0, intensity_factor * 0.2)
        
        # Offset rings in wind direction for visual realism
        offset_x = np.cos(wind_rad) * intensity_factor * 0.8
        offset_y = np.sin(wind_rad) * intensity_factor * 0.8
        
        x = radius * np.cos(theta) + offset_x
        y = radius * np.sin(theta) + offset_y
        ax.fill(x, y, color=(r_color, g_color, b_color, 0.15 + intensity_factor * 0.1))
    
    # Draw grid rings
    for r in [1.5, 3.0, 4.5]:
        circle = plt.Circle((0, 0), r, fill=False, color='#ffffff', linewidth=0.5, alpha=0.2, linestyle='--')
        ax.add_patch(circle)
    
    # Draw crosshairs
    ax.axhline(y=0, color='#ffffff', linewidth=0.5, alpha=0.15)
    ax.axvline(x=0, color='#ffffff', linewidth=0.5, alpha=0.15)
    
    # Wind direction arrow (pointing where wind is GOING)
    arrow_len = 2.5
    wind_going_rad = np.radians(wind_dir)
    dx = np.sin(wind_going_rad) * arrow_len
    dy = np.cos(wind_going_rad) * arrow_len
    ax.annotate('', xy=(dx, dy), xytext=(0, 0),
                arrowprops=dict(arrowstyle='->', color='#00d4ff', lw=2.5))
    
    # Wind label at arrow tip
    label_x = np.sin(wind_going_rad) * (arrow_len + 0.6)
    label_y = np.cos(wind_going_rad) * (arrow_len + 0.6)
    ax.text(label_x, label_y, f'{wind} km/h\n{_wind_direction_label(wind_dir)}',
            color='#00d4ff', fontsize=10, fontweight='bold', ha='center', va='center',
            fontfamily='monospace')
    
    # Your Location marker (center)
    ax.plot(0, 0, 'o', color='#00ff88', markersize=14, markeredgecolor='white', markeredgewidth=2, zorder=10)
    ax.text(0, -0.6, '📍 YOU', color='#00ff88', fontsize=11, fontweight='bold', 
            ha='center', va='top', fontfamily='sans-serif')
    
    # Risk Level Badge (top)
    if risk > 60:
        badge_color = '#ff4444'
        badge_text = 'HIGH RISK'
    elif risk > 30:
        badge_color = '#ffaa00'
        badge_text = 'MODERATE RISK'
    else:
        badge_color = '#00cc66'
        badge_text = 'LOW RISK'
    
    ax.text(0, 5.3, badge_text, color=badge_color, fontsize=18, fontweight='bold',
            ha='center', va='center', fontfamily='sans-serif',
            bbox=dict(boxstyle='round,pad=0.4', facecolor='#1a1a2e', edgecolor=badge_color, linewidth=2))
    
    # Temperature display (top-left)
    ax.text(-5.0, 5.3, f'{round(temp)}°C', color='white', fontsize=14, fontweight='bold',
            ha='left', va='center', fontfamily='monospace')
    
    # Coordinates (bottom)
    ax.text(0, -5.5, f'{lat:.4f}°N  {lon:.4f}°E', color='#888888', fontsize=8,
            ha='center', va='center', fontfamily='monospace')
    
    # Title
    ax.text(0, 6.2, 'PROJECT CANOPY — WEATHER RISK SCAN', color='#cccccc', fontsize=9,
            ha='center', va='center', fontfamily='monospace', 
            fontweight='bold')
    
    ax.set_xlim(-6, 6)
    ax.set_ylim(-6.5, 7)
    ax.set_aspect('equal')
    ax.axis('off')
    
    plt.tight_layout(pad=0.5)
    os.makedirs(os.path.dirname(output_path) if os.path.dirname(output_path) else "/tmp", exist_ok=True)
    plt.savefig(output_path, dpi=150, bbox_inches='tight', facecolor='#1a1a2e', edgecolor='none')
    plt.close()
    
    return output_path


if __name__ == "__main__":
    # Quick test
    test_weather = {
        "temperature": 36.5,
        "windspeed": 28.3,
        "winddirection": 225,
        "weathercode": 3
    }
    path = generate_vendor_radar(test_weather, 26.9124, 75.7873, output_path="test_radar.png")
    print(f"Generated: {path}")
