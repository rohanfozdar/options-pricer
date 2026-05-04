import Plot from 'react-plotly.js'

function ImpliedVolSurface({ surfaceData, currentPrice }) {
  if (!surfaceData || !surfaceData.z || !surfaceData.z.length) {
    return null
  }

  const { x, y, z } = surfaceData

  // Human-readable expiration labels: "2026-05-16" → "May 16"
  const yLabels = y.map((exp) =>
    new Date(exp + 'T12:00:00').toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })
  )

  // Flatten z to compute range (skip nulls)
  const zFlat = z.flat().filter((v) => v !== null && !isNaN(v))
  const zMin = zFlat.length ? Math.min(...zFlat) : 0
  const zMax = zFlat.length ? Math.max(...zFlat) : 1

  // ATM strike: closest x to currentPrice
  let atmIdx = 0
  let atmStrike = x[0]
  if (currentPrice != null && x.length > 0) {
    let minDist = Infinity
    x.forEach((strike, i) => {
      const d = Math.abs(strike - currentPrice)
      if (d < minDist) {
        minDist = d
        atmIdx = i
        atmStrike = strike
      }
    })
  }
  const hasAtm = currentPrice != null

  // Lowest-IV point
  let minZ = Infinity
  let minZRow = 0
  let minZCol = 0
  z.forEach((row, ri) => {
    row.forEach((val, ci) => {
      if (val !== null && !isNaN(val) && val < minZ) {
        minZ = val
        minZRow = ri
        minZCol = ci
      }
    })
  })

  // ATM surface curve: z values at the ATM column for each expiration
  const atmZ = z.map((row) => (row[atmIdx] !== null ? row[atmIdx] : null))

  // 3D scene annotations
  const sceneAnnotations = []
  if (hasAtm) {
    sceneAnnotations.push({
      x: atmStrike,
      y: yLabels[0],
      z: zMax + (zMax - zMin) * 0.2,
      text: `ATM (~$${Math.round(currentPrice)})`,
      showarrow: true,
      arrowhead: 2,
      arrowcolor: 'rgba(255,255,255,0.85)',
      arrowsize: 1.5,
      ax: 60,
      ay: -40,
      font: { color: '#ffffff', size: 11, family: "'DM Mono', monospace" },
      bgcolor: 'rgba(13,15,20,0.88)',
      bordercolor: 'rgba(255,255,255,0.35)',
      borderwidth: 1,
    })
  }
  if (minZ !== Infinity) {
    sceneAnnotations.push({
      x: x[minZCol],
      y: yLabels[minZRow],
      z: minZ,
      text: 'Lowest IV — near ATM',
      showarrow: true,
      arrowhead: 1,
      arrowcolor: '#00d4aa',
      arrowsize: 1.5,
      ax: -70,
      ay: 50,
      font: { color: '#00d4aa', size: 10, family: "'DM Mono', monospace" },
      bgcolor: 'rgba(13,15,20,0.88)',
      bordercolor: 'rgba(0,212,170,0.45)',
      borderwidth: 1,
    })
  }

  const traces = [
    {
      type: 'surface',
      x,
      y: yLabels,
      z,
      colorscale: [
        [0, '#1a4fa0'],
        [0.5, '#f5f0e8'],
        [1, '#b91c1c'],
      ],
      showscale: true,
      colorbar: {
        title: { text: 'Implied Vol (%)', font: { color: '#a0aabb', size: 12 } },
        tickformat: '.0%',
        tickfont: { color: '#a0aabb', size: 10 },
        len: 0.7,
        thickness: 15,
        bgcolor: 'rgba(13,15,20,0)',
        bordercolor: '#1e2736',
        borderwidth: 1,
      },
      hovertemplate:
        'Strike: $%{x}<br>Expiration: %{y}<br>Implied Vol: %{z:.1%}<extra></extra>',
      opacity: 0.93,
      lighting: {
        ambient: 0.72,
        diffuse: 0.6,
        roughness: 0.5,
        specular: 0.25,
        fresnel: 0.15,
      },
    },
  ]

  // ATM reference line traces along the surface at the ATM column
  if (hasAtm && atmZ.some((v) => v !== null)) {
    traces.push({
      type: 'scatter3d',
      x: Array(yLabels.length).fill(atmStrike),
      y: yLabels,
      z: atmZ,
      mode: 'lines',
      line: { color: 'rgba(255,255,255,0.82)', width: 5, dash: 'dashdot' },
      showlegend: false,
      hoverinfo: 'skip',
      name: 'ATM',
    })
  }

  return (
    <div className="iv-surface-section">
      <h3 className="iv-surface-title">3D Implied Volatility Surface</h3>

      <div className="iv-surface-explainer">
        <p>
          This surface maps <strong>implied volatility</strong> across strike prices and expiration
          dates, revealing the market&apos;s priced-in expectation of price movement for each
          strike–expiry pair. Values are derived live from the options chain.
        </p>
        <p>
          The <strong>volatility smile / skew</strong> — the curvature across strikes — arises
          because options away from at-the-money are priced with extra premium to account for tail
          risk. <span className="iv-blue">Deep blue</span> marks low IV (cheap options, calm
          expectations); <span className="iv-red">deep red</span> signals elevated IV (expensive
          options, uncertainty). The dashed white line traces the current ATM strike.
        </p>
      </div>

      <div className="iv-surface-plot-wrapper">
        <Plot
          data={traces}
          layout={{
            autosize: true,
            height: 560,
            paper_bgcolor: '#0d0f14',
            plot_bgcolor: '#0d0f14',
            margin: { l: 0, r: 0, b: 0, t: 10 },
            font: { family: "'DM Mono', monospace", color: '#a0aabb' },
            scene: {
              bgcolor: '#0d1520',
              xaxis: {
                title: { text: 'Strike Price', font: { color: '#6b7a8d', size: 11 } },
                tickfont: { color: '#6b7a8d', size: 9 },
                gridcolor: '#1e2736',
                zerolinecolor: '#1e2736',
                backgroundcolor: '#0d1520',
              },
              yaxis: {
                title: { text: 'Expiration', font: { color: '#6b7a8d', size: 11 } },
                tickfont: { color: '#6b7a8d', size: 9 },
                gridcolor: '#1e2736',
                backgroundcolor: '#0d1520',
              },
              zaxis: {
                title: { text: 'Implied Vol (%)', font: { color: '#6b7a8d', size: 11 } },
                tickformat: '.0%',
                tickfont: { color: '#6b7a8d', size: 9 },
                gridcolor: '#1e2736',
                backgroundcolor: '#0d1520',
              },
              annotations: sceneAnnotations,
            },
          }}
          config={{ displayModeBar: false }}
          style={{ width: '100%', height: '100%' }}
          useResizeHandler
          className="iv-surface-plot"
        />
      </div>
    </div>
  )
}

export default ImpliedVolSurface
