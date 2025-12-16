import { useState } from 'react'
import './App.css'
import ImpliedVolSurface from './ImpliedVolSurface.jsx'

// Backend Flask API base URL (Render)
   const API_BASE_URL = 'https://options-pricer

function App() {
  const [ticker, setTicker] = useState('')
  const [optionType, setOptionType] = useState('call')
  const [expiration, setExpiration] = useState('')
  const [expirations, setExpirations] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadingExpirations, setLoadingExpirations] = useState(false)
  const [results, setResults] = useState(null)
  const [error, setError] = useState(null)
  const [ivSurfaceData, setIvSurfaceData] = useState(null)
  const [loadingSurface, setLoadingSurface] = useState(false)
  const [surfaceError, setSurfaceError] = useState(null)

  const fetchExpirations = async (tickerSymbol) => {
    if (!tickerSymbol.trim()) {
      setError('Please enter a stock ticker')
      return
    }

    setLoadingExpirations(true)
    setError(null)
    setExpirations([])
    setExpiration('')

    try {
      const response = await fetch(
        `${API_BASE_URL}/expirations?ticker=${encodeURIComponent(
          tickerSymbol.toUpperCase(),
        )}`,
      )

      // Check if response is actually JSON
      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text()
        throw new Error(
          `Server returned non-JSON response. Make sure backend is running on Render. Response: ${text.substring(
            0,
            100,
          )}`,
        )
      }

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch expiration dates')
      }

      setExpirations(data.expirations || [])
      if (data.expirations && data.expirations.length > 0) {
        setExpiration(data.expirations[0])
      }
    } catch (err) {
      setError(err.message)
      setExpirations([])
    } finally {
      setLoadingExpirations(false)
    }
  }

  const handleTickerChange = (e) => {
    const newTicker = e.target.value.toUpperCase()
    setTicker(newTicker)
    if (newTicker.trim()) {
      fetchExpirations(newTicker)
    } else {
      setExpirations([])
      setExpiration('')
    }
  }

  const handleCalculate = async (e) => {
    e.preventDefault()

    if (!ticker.trim() || !expiration) {
      setError('Please fill in all fields')
      return
    }

    setLoading(true)
    setError(null)
    setResults(null)
    setIvSurfaceData(null)

    try {
      const response = await fetch(`${API_BASE_URL}/price-options`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ticker: ticker.toUpperCase(),
          optionType: optionType,
          expiration: expiration,
        }),
      })

      // Check if response is actually JSON
      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text()
        throw new Error(
          `Server returned non-JSON response. Make sure backend is running. Response: ${text.substring(
            0,
            100,
          )}`,
        )
      }

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to calculate option prices')
      }

      setResults(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const buildIvSurface = async () => {
    if (!ticker.trim() || !expirations.length) {
      setSurfaceError('Enter a ticker and load expiration dates first.')
      return
    }

    setLoadingSurface(true)
    setSurfaceError(null)

    try {
      // Use up to the first 5 expirations to keep the plot readable
      const selectedExpirations = expirations.slice(0, 5)

      const allStrikesSet = new Set()
      const rowsByExpiration = []

      for (const exp of selectedExpirations) {
        const response = await fetch(`${API_BASE_URL}/price-options`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ticker: ticker.toUpperCase(),
            optionType: optionType,
            expiration: exp,
          }),
        })

        const contentType = response.headers.get('content-type')
        if (!contentType || !contentType.includes('application/json')) {
          const text = await response.text()
          throw new Error(
            `Server returned non-JSON response while building surface. Response: ${text.substring(
              0,
              80,
            )}`,
          )
        }

        const data = await response.json()
        if (!response.ok) {
          throw new Error(
            data.error || `Failed to fetch option data for expiration ${exp}`,
          )
        }

        const rows = data.results || []
        rows.forEach((row) => {
          allStrikesSet.add(row.Strike)
        })

        rowsByExpiration.push({
          exp,
          rows,
        })
      }

      const x = Array.from(allStrikesSet).sort((a, b) => a - b)
      const y = selectedExpirations

      const z = y.map((exp) => {
        const entry = rowsByExpiration.find((r) => r.exp === exp)
        const map = new Map(
          (entry?.rows || []).map((row) => [row.Strike, row['Implied Vol'] ?? null]),
        )
        return x.map((strike) => {
          const iv = map.get(strike)
          return typeof iv === 'number' ? iv : null
        })
      })

      setIvSurfaceData({ x, y, z })
    } catch (err) {
      setSurfaceError(err.message)
    } finally {
      setLoadingSurface(false)
    }
  }

  const formatCurrency = (value) => {
    if (value === null || value === undefined || isNaN(value)) return 'N/A'
    return `$${value.toFixed(2)}`
  }

  const formatPercent = (value) => {
    if (value === null || value === undefined || isNaN(value)) return 'N/A'
    return `${value.toFixed(2)}%`
  }

  const formatNumber = (value, decimals = 4) => {
    if (value === null || value === undefined || isNaN(value)) return 'N/A'
    return value.toFixed(decimals)
  }

  return (
    <div className="app">
      <header className="header">
        <h1>Options Pricer</h1>
        <p>Calculate option valuations using binomial tree model</p>
      </header>

      <main className="main-content">
        <form onSubmit={handleCalculate} className="options-form">
          <div className="form-group">
            <label htmlFor="ticker">Stock Ticker</label>
            <input
              type="text"
              id="ticker"
              value={ticker}
              onChange={handleTickerChange}
              placeholder="e.g., AAPL"
              required
              className="input"
            />
          </div>

          <div className="form-group">
            <label htmlFor="optionType">Option Type</label>
            <select
              id="optionType"
              value={optionType}
              onChange={(e) => setOptionType(e.target.value)}
              className="select"
            >
              <option value="call">Call</option>
              <option value="put">Put</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="expiration">Expiration Date</label>
            {loadingExpirations ? (
              <div className="loading">Loading expiration dates...</div>
            ) : (
              <select
                id="expiration"
                value={expiration}
                onChange={(e) => setExpiration(e.target.value)}
                className="select"
                required
                disabled={!expirations.length}
              >
                <option value="">Select expiration date</option>
                {expirations.map((exp) => (
                  <option key={exp} value={exp}>
                    {exp}
                  </option>
                ))}
              </select>
            )}
          </div>

          {error && <div className="error-message">{error}</div>}

          <button
            type="submit"
            className="submit-button"
            disabled={loading || loadingExpirations}
          >
            {loading ? 'Calculating...' : 'Calculate Option Prices'}
          </button>
        </form>

        {results && (
          <div className="results-container">
            <div className="results-header">
              <h2>Option Pricing Results</h2>
              <div className="results-summary">
                <div className="summary-item">
                  <span className="summary-label">Current Price:</span>
                  <span className="summary-value">
                    {formatCurrency(results.currentPrice)}
                  </span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">Time to Maturity:</span>
                  <span className="summary-value">
                    {formatNumber(results.timeToMaturity)} years
                  </span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">Risk-Free Rate:</span>
                  <span className="summary-value">
                    {formatPercent(results.riskFreeRate * 100)}
                  </span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">Expiration:</span>
                  <span className="summary-value">{results.expiration}</span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">Option Type:</span>
                  <span className="summary-value">
                    {results.optionType.toUpperCase()}
                  </span>
                </div>
              </div>
            </div>

            <div className="table-container">
              <table className="results-table">
                <thead>
                  <tr>
                    <th>Strike</th>
                    <th>Bid</th>
                    <th>Ask</th>
                    <th>Mid Price</th>
                    <th>Implied Vol</th>
                    <th>Last Price</th>
                    <th>American Option Value</th>
                  </tr>
                </thead>
                <tbody>
                  {results.results.map((row, index) => (
                    <tr key={index}>
                      <td>{formatCurrency(row.Strike)}</td>
                      <td>{formatCurrency(row.Bid)}</td>
                      <td>{formatCurrency(row.Ask)}</td>
                      <td>{formatCurrency(row['Mid Price'])}</td>
                      <td>{formatPercent(row['Implied Vol'] * 100)}</td>
                      <td>{formatCurrency(row['Last Yahoo Price'])}</td>
                      <td className="option-value">
                        {formatCurrency(row['American Option Value'])}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {expirations.length > 1 && (
              <div className="iv-surface-controls">
                <button
                  type="button"
                  className="submit-button iv-surface-button"
                  onClick={buildIvSurface}
                  disabled={loadingSurface}
                >
                  {loadingSurface
                    ? 'Building 3D IV Surface...'
                    : 'Show 3D Implied Volatility Surface (multiple expirations)'}
                </button>
                {surfaceError && (
                  <div className="error-message iv-surface-error">
                    {surfaceError}
                  </div>
                )}
              </div>
            )}

            {ivSurfaceData && <ImpliedVolSurface surfaceData={ivSurfaceData} />}
          </div>
        )}
      </main>
    </div>
  )
}

export default App


