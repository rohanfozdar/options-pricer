# Options Pricer

A web application for calculating option valuations using the binomial tree model. The frontend is built with React and Vite, and the backend uses Python with Flask.

## Features

- Calculate option prices for all strikes at a given expiration date
- Support for both Call and Put options
- Real-time data from Yahoo Finance
- Beautiful, modern UI with responsive design
- Displays comprehensive option pricing data including:
  - Strike prices
  - Bid/Ask prices
  - Mid prices
  - Implied volatility
  - American option values
  - Percentage differences

## Setup

### Backend Setup

1. Navigate to the backend directory:
```bash
cd backend
```

2. Create a virtual environment (recommended):
```bash
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install Python dependencies:
```bash
pip install -r requirements.txt
```

4. Run the Flask server:
```bash
python app.py
```

The backend will run on `http://localhost:5000`

### Frontend Setup

1. Install Node.js dependencies (from the root directory):
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

The frontend will run on `http://localhost:5173` (or another port if 5173 is busy)

## Usage

1. Start the backend server first (see Backend Setup above)
2. Start the frontend development server (see Frontend Setup above)
3. Open your browser and navigate to the frontend URL (usually `http://localhost:5173`)
4. Enter a stock ticker symbol (e.g., AAPL)
5. Select the option type (Call or Put)
6. Choose an expiration date from the dropdown
7. Click "Calculate Option Prices" to see all option valuations

## Project Structure

```
my-options-pricer/
├── backend/
│   ├── app.py              # Flask API server
│   ├── logic.py            # Options pricing logic
│   └── requirements.txt    # Python dependencies
├── src/
│   ├── App.jsx             # Main React component
│   ├── App.css             # Component styles
│   ├── index.css           # Global styles
│   └── main.jsx            # React entry point
├── package.json            # Node.js dependencies
└── README.md               # This file
```

## API Endpoints

- `GET /api/expirations?ticker=AAPL` - Get available expiration dates for a ticker
- `POST /api/price-options` - Calculate option prices
  - Body: `{ "ticker": "AAPL", "optionType": "call", "expiration": "2024-01-19" }`
- `GET /api/health` - Health check endpoint

## Technologies Used

- **Frontend**: React, Vite
- **Backend**: Python, Flask, Flask-CORS
- **Data**: yfinance (Yahoo Finance API)
- **Calculations**: NumPy, SciPy (binomial tree model)
