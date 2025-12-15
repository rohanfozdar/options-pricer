from flask import Flask, request, jsonify
from flask_cors import CORS
from logic import calculate_option_prices
import traceback

app = Flask(__name__)
CORS(app)  # Enable CORS for React frontend

@app.route('/api/expirations', methods=['GET'])
def get_expirations():
    """Get available expiration dates for a ticker"""
    try:
        ticker = request.args.get('ticker', '').strip().upper()
        if not ticker:
            return jsonify({'error': 'Ticker is required'}), 400
        
        from logic import get_expiration_dates
        expirations = get_expiration_dates(ticker)
        if not expirations:
            return jsonify({'error': f'No expiration dates found for ticker {ticker}'}), 404
        return jsonify({'expirations': expirations})
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        return jsonify({'error': f'Error fetching expiration dates: {str(e)}'}), 500

@app.route('/api/price-options', methods=['POST'])
def price_options():
    """Calculate option prices for given parameters"""
    try:
        data = request.json
        ticker = data.get('ticker', '').strip().upper()
        option_type = data.get('optionType', '').strip().lower()
        expiration = data.get('expiration', '').strip()
        
        if not ticker or not option_type or not expiration:
            return jsonify({'error': 'Missing required parameters: ticker, optionType, expiration'}), 400
        
        if option_type not in ['call', 'put']:
            return jsonify({'error': 'optionType must be "call" or "put"'}), 400
        
        results = calculate_option_prices(ticker, option_type, expiration)
        return jsonify(results)
    except Exception as e:
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500

@app.route('/api/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({'status': 'ok'})

if __name__ == '__main__':
    # Run on 127.0.0.1:5050 so it is easy to hit from the frontend and browser
    app.run(debug=True, host="127.0.0.1", port=5050)


