import Plot from 'react-plotly.js'

function ImpliedVolSurface({ surfaceData }) {
  if (!surfaceData || !surfaceData.z || !surfaceData.z.length) {
    return null
  }

  const { x, y, z } = surfaceData

  return (
    <div className="iv-surface-section">
      <h3 className="iv-surface-title">3D Implied Volatility Surface</h3>
      <p className="iv-surface-subtitle">
        Each point shows implied volatility for a given strike and expiration.
      </p>
      <div className="iv-surface-plot-wrapper">
        <Plot
          data={[
            {
              type: 'surface',
              x,
              y,
              z,
              colorscale: 'Viridis',
              showscale: true,
              colorbar: { title: 'Implied Volatility' },
            },
          ]}
          layout={{
            autosize: true,
            height: 500,
            margin: { l: 0, r: 0, b: 0, t: 30 },
            scene: {
              xaxis: { title: 'Strike Price' },
              yaxis: { title: 'Expiration' },
              zaxis: { title: 'Implied Volatility' },
            },
          }}
          style={{ width: '100%', height: '100%' }}
          useResizeHandler
          className="iv-surface-plot"
        />
      </div>
    </div>
  )
}

export default ImpliedVolSurface


