import numpy as np

from scipy.stats import norm

from scipy.optimize import brentq

from datetime import datetime, date, timezone

import pandas as pd

import requests
from urllib.parse import quote
import re

# Shared Yahoo Finance session with desktop browser headers
session = requests.Session()
session.headers.update({
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
})

try:
    session.get("https://finance.yahoo.com", timeout=10)
except Exception:
    # Initial warm-up request failed; proceed without cookies
    pass

YAHOO_OPTIONS_URL = "https://query2.finance.yahoo.com/v7/finance/options/{ticker}"
YAHOO_CHART_URL = "https://query1.finance.yahoo.com/v8/finance/chart/{ticker}"
NASDAQ_OPTIONS_URL = "https://api.nasdaq.com/api/quote/{ticker}/option-chain"
DEFAULT_RISK_FREE = 0.03  # 3% fallback if yields cannot be fetched


def yahoo_request(url, params=None):
    """Perform a Yahoo Finance request with consistent headers and error handling."""
    resp = session.get(url, params=params, timeout=15)
    if resp.status_code == 429:
        raise ValueError("Yahoo Finance rate limit reached. Please wait a minute before trying again.")
    if resp.status_code != 200:
        raise ValueError(f"Yahoo Finance request failed ({resp.status_code}): {resp.text[:120]}")
    try:
        return resp.json()
    except ValueError as exc:
        raise ValueError("Yahoo Finance returned invalid JSON. Please try again shortly.") from exc


def nasdaq_option_data(ticker):
    """Call the Nasdaq option chain API for a ticker and return the data payload."""
    headers = {
        'User-Agent': session.headers['User-Agent'],
        'Accept': 'application/json, text/plain, */*',
        'Origin': 'https://www.nasdaq.com',
        'Referer': f'https://www.nasdaq.com/market-activity/stocks/{ticker}/option-chain',
        'Accept-Language': 'en-US,en;q=0.9',
    }
    resp = session.get(
        NASDAQ_OPTIONS_URL.format(ticker=ticker.upper()),
        params={'assetclass': 'stocks', 'limit': '9999'},
        headers=headers,
        timeout=15
    )
    if resp.status_code != 200:
        raise ValueError(f"Nasdaq option chain request failed ({resp.status_code})")
    try:
        payload = resp.json()
    except ValueError as exc:
        raise ValueError("Nasdaq returned invalid data. Please try again.") from exc
    data = payload.get('data')
    if not data:
        raise ValueError(f"No Nasdaq option data found for ticker {ticker}.")
    return data


def nasdaq_option_rows(ticker):
    data = nasdaq_option_data(ticker)
    rows = data.get('table', {}).get('rows')
    if not rows:
        raise ValueError(f"No Nasdaq option rows found for ticker {ticker}.")
    return rows, data


def safe_float(value):
    """Convert common string representations to float."""
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    value = str(value).strip()
    if value in ('', '--'):
        return None
    value = value.replace(',', '').replace('$', '')
    try:
        return float(value)
    except ValueError:
        return None


def fetch_yahoo_options(ticker, expiration_ts=None):
    """Fetch options data from Yahoo Finance for a ticker (and optional expiration timestamp)."""
    encoded = quote(ticker)
    params = {'date': int(expiration_ts)} if expiration_ts is not None else None
    data = yahoo_request(YAHOO_OPTIONS_URL.format(ticker=encoded), params=params)
    results = data.get('optionChain', {}).get('result', [])
    if not results:
        raise ValueError(f"No option data returned for ticker {ticker}. The ticker may be invalid or have no options.")
    return results[0]


def fetch_yahoo_chart_meta(ticker):
    """Fetch chart metadata (includes current price) for a ticker."""
    encoded = quote(ticker)
    data = yahoo_request(YAHOO_CHART_URL.format(ticker=encoded), params={'range': '1d', 'interval': '1d'})
    results = data.get('chart', {}).get('result')
    if not results:
        raise ValueError(f"Unable to fetch chart data for {ticker}")
    return results[0].get('meta', {})


# --- Black-Scholes pricing for implied volatility ---

def bs_price(S, K, T, r, sigma, option_type):

    d1 = (np.log(S / K) + (r + 0.5 * sigma**2) * T) / (sigma * np.sqrt(T))

    d2 = d1 - sigma * np.sqrt(T)

    if option_type == "call":

        return S * norm.cdf(d1) - K * np.exp(-r * T) * norm.cdf(d2)

    else:

        return K * np.exp(-r * T) * norm.cdf(-d2) - S * norm.cdf(-d1)



# --- Implied Volatility from Yahoo Finance (if available) ---

def get_yahoo_iv(options_df, strike):

    row = options_df[options_df['strike'] == strike]

    if not row.empty and 'impliedVolatility' in row.columns:

        iv = row['impliedVolatility'].values[0]

        if iv is not None and not np.isnan(iv) and iv > 0.001:

            return iv

    return None



# --- Fallback Black-Scholes Implied Volatility ---

def implied_vol(S, K, T, r, market_price, option_type):

    return brentq(

        lambda sigma: bs_price(S, K, T, r, sigma, option_type) - market_price,

        1e-6, 5.0

    )



# --- Automatic Risk-Free Rate based on Maturity T ---

def fetch_yield_from_yahoo(ticker):

    try:

        meta = fetch_yahoo_chart_meta(ticker)

        close = meta.get('regularMarketPrice')

        if close is None:

            return None

        return close / 100  # Convert % to decimal

    except Exception:

        return None



def get_risk_free_rate(T):

    yield_sources = {

        0.25: "^IRX",  # 13-week

        5.0: "^FVX",   # 5-year

        10.0: "^TNX",  # 10-year

        30.0: "^TYX",  # 30-year

    }

    term_points = []

    rates = []

    for term, ticker_yield in yield_sources.items():

        rate = fetch_yield_from_yahoo(ticker_yield)

        if rate is not None:

            term_points.append(term)

            rates.append(rate)

    if not term_points:

        # Fallback to default constant if treasury data unavailable

        return DEFAULT_RISK_FREE

    r = np.interp(T, term_points, rates)

    return r



def get_expiration_dates(ticker):

    """Get available expiration dates for a ticker using Nasdaq options API"""

    try:

        rows, _ = nasdaq_option_rows(ticker)

        expiration_dates = []

        for row in rows:

            group = row.get('expirygroup')

            if group and ',' in group:

                try:

                    dt = datetime.strptime(group, "%B %d, %Y")

                    iso = dt.strftime("%Y-%m-%d")

                    if iso not in expiration_dates:

                        expiration_dates.append(iso)

                except ValueError:

                    continue

        if not expiration_dates:

            raise ValueError(f"No option expiration dates found for ticker {ticker}. This ticker may not have options available.")

        return expiration_dates

    except ValueError:

        raise

    except Exception as e:

        raise ValueError(f"Unexpected error fetching expiration dates for {ticker}: {str(e)}")


def rows_for_expiration(rows, expiration):

    """Filter Nasdaq option rows for a specific expiration date (YYYY-MM-DD)."""

    target = datetime.strptime(expiration, "%Y-%m-%d").date()

    matching = []

    current_exp = None

    for row in rows:

        group = row.get('expirygroup')

        if group and ',' in group:

            try:

                current_exp = datetime.strptime(group, "%B %d, %Y").date()

            except ValueError:

                current_exp = None

            continue

        if current_exp != target:

            continue

        strike = row.get('strike')

        if strike is None or strike in ('', '--'):

            continue

        matching.append(row)

    return matching



def parse_last_trade_price(text):

    if not text:

        return None

    match = re.search(r"\$?([0-9]+(?:\.[0-9]+)?)", text)

    if match:

        try:

            return float(match.group(1))

        except ValueError:

            return None

    return None


def get_current_price(ticker, nasdaq_data=None):

    """Get current stock price using Nasdaq data with Yahoo fallback"""

    if nasdaq_data is None:

        try:

            nasdaq_data = nasdaq_option_data(ticker)

        except ValueError:

            nasdaq_data = None

    if nasdaq_data:

        last_trade = nasdaq_data.get('lastTrade')

        price = parse_last_trade_price(last_trade)

        if price is not None:

            return float(price)

    # Fallback to Yahoo Finance quote meta if Nasdaq data missing

    meta = fetch_yahoo_chart_meta(ticker)

    price = meta.get('regularMarketPrice')

    if price is None:

        raise ValueError(f"Could not find current price for {ticker}")

    return float(price)



def calculate_option_prices(ticker, option_type, expiration):

    """Main function to calculate option prices for all strikes at given expiration"""

    # Fetch Nasdaq option data (rows + metadata)

    nasdaq_rows, nasdaq_data = nasdaq_option_rows(ticker)

    # Get current stock price

    S0 = get_current_price(ticker, nasdaq_data)

    # Calculate time to maturity

    expiration_date = datetime.strptime(expiration, "%Y-%m-%d").date()

    today_date = date.today()

    delta_days = (expiration_date - today_date).days

    if delta_days <= 0:

        raise ValueError("Expiration date must be in the future.")

    T = delta_days / 365

    

    # Get risk-free rate

    r = get_risk_free_rate(T)

    

    # Get option chain data from Nasdaq

    contracts = rows_for_expiration(nasdaq_rows, expiration)

    if not contracts:

        raise ValueError(f"No option contracts found for {ticker} on {expiration}.")

    records = []

    for entry in contracts:

        strike = safe_float(entry.get('strike'))

        if strike is None:

            continue

        if option_type == 'call':

            bid = safe_float(entry.get('c_Bid'))

            ask = safe_float(entry.get('c_Ask'))

            last_px = safe_float(entry.get('c_Last'))

        else:

            bid = safe_float(entry.get('p_Bid'))

            ask = safe_float(entry.get('p_Ask'))

            last_px = safe_float(entry.get('p_Last'))

        if bid is None and ask is None:

            continue

        records.append({

            'strike': strike,

            'bid': bid,

            'ask': ask,

            'impliedVolatility': np.nan,

            'lastPrice': last_px

        })

    if not records:

        raise ValueError(f"No usable {option_type} contracts found for {ticker} on {expiration}.")

    df = pd.DataFrame(records)

    df = df.dropna(subset=['bid', 'ask'], how='all')

    
    # Compute Option Values Table

    results = []

    for idx, row in df.iterrows():

        K = float(row['strike'])

        bid = row['bid']

        ask = row['ask']

        last_price_yahoo = row.get('lastPrice', np.nan)

        bid_nan = pd.isna(bid)

        ask_nan = pd.isna(ask)

        if bid_nan and ask_nan:

            continue

        if bid_nan:

            bid = float(ask)

        if ask_nan:

            ask = float(bid)

        market_price = (bid + ask) / 2

        sigma = get_yahoo_iv(df, K)

        if sigma is None:

            try:

                sigma = implied_vol(S0, K, T, r, market_price, option_type)

            except ValueError:

                continue

        # Binomial tree calculation

        N = max(100, int(T * 365))

        dt = T / N

        u = np.exp(sigma * np.sqrt(dt))

        d = 1 / u

        R = np.exp(r * dt)

        p = (R - d) / (u - d)

        j = np.arange(N + 1)

        log_prices = np.log(S0) + j * np.log(u) + (N - j) * np.log(d)

        S_T = np.exp(log_prices)

        if option_type == "call":

            option_values = np.maximum(S_T - K, 0)

        else:

            option_values = np.maximum(K - S_T, 0)

        for i in range(N - 1, -1, -1):

            option_values = (p * option_values[1:i+2] + (1 - p) * option_values[0:i+1]) / R

            S_i = np.exp(np.log(S0) + np.arange(i + 1) * np.log(u) + (i - np.arange(i + 1)) * np.log(d))

            if option_type == "call":

                option_values = np.maximum(option_values, S_i - K)

            else:

                option_values = np.maximum(option_values, K - S_i)

        # Calculate percentage difference safely

        pct_diff = None

        if not np.isnan(last_price_yahoo) and last_price_yahoo > 0 and option_values[0] > 0:

            pct_diff = (option_values[0] - last_price_yahoo) * 100 / option_values[0]

        results.append({

            "Strike": float(K),

            "Bid": float(bid),

            "Ask": float(ask),

            "Mid Price": float(market_price),

            "Implied Vol": float(sigma),

            "Last Yahoo Price": float(last_price_yahoo) if not np.isnan(last_price_yahoo) else None,

            "American Option Value": float(option_values[0]),

            "% difference in pricing": float(pct_diff) if pct_diff is not None else None

        })

    return {

        "currentPrice": float(S0),

        "timeToMaturity": float(T),

        "riskFreeRate": float(r),

        "expiration": expiration,

        "optionType": option_type,

        "results": results

    }



# --- Original script functionality (for command-line use) ---

if __name__ == "__main__":

    # --- Option Type ---

    while True:

        option_type = input("Is this a Call or Put option? (call/put): ").strip().lower()

        if option_type in ["call", "put"]:

            break

        print("Invalid choice, please select 'call' or 'put'.")



    # --- Ticker and Market Data ---

    ticker = input("Enter the stock ticker symbol (e.g., AAPL): ").strip().upper()

    print(f"Fetching 1-year daily data for {ticker}...")

    S0 = get_current_price(ticker)

    print(f"Using current market price (S0): {S0:.2f}")



    # --- Fetch expiration dates and option chain ---

    expirations = get_expiration_dates(ticker)

    print("Available expiration dates:")

    for i, exp in enumerate(expirations):

        print(f"{i+1}: {exp}")

    exp_choice = int(input(f"Select expiration date by number (1-{len(expirations)}): "))

    expiration = expirations[exp_choice - 1]



    # --- Calculate Time to Maturity (date-only) ---

    expiration_date = datetime.strptime(expiration, "%Y-%m-%d").date()

    today_date = date.today()

    delta_days = (expiration_date - today_date).days

    if delta_days <= 0:

        raise ValueError("Expiration date must be in the future.")

    T = delta_days / 365

    print(f"Time to maturity in years (T): {T:.4f}")



    # --- Get Risk-Free Rate ---

    r = get_risk_free_rate(T)

    print(f"Interpolated risk-free rate for T={T:.4f} years: r = {r:.4%}")



    # --- Calculate and display results ---

    result = calculate_option_prices(ticker, option_type, expiration)

    result_df = pd.DataFrame(result['results'])

    print("\n--- Option Pricing Table ---")

    print(result_df.to_string(index=False))
