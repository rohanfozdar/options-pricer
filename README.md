# Options Pricer

A web application for calculating option valuations using the binomial tree model. The frontend is built with React and Vite, and the backend uses Python with Flask.

## Features

- Calculate option prices for all strikes at a given expiration date
- Support for both Call and Put options
- Real-time data from Yahoo Finance
- Displays the following data:
  - Strike prices
  - Bid/Ask prices
  - Mid prices
  - Implied volatility
  - American option values
  - Percentage differences (vs YFinance)

- **Frontend**: React, Vite
- **Backend**: Python, Flask, Flask-CORS
- **Data**: yfinance (Yahoo Finance API)
- **Calculations**: NumPy, SciPy (binomial tree model)
