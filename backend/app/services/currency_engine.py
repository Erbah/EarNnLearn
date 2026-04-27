class CurrencyEngine:
    # Hardcoded/Mocked rates for Phase 15
    RATES = {
        "GHS": 1.0,
        "USD": 0.08,  # 1 GHS = 0.08 USD (approx)
        "NGN": 120.0, # 1 GHS = 120 NGN (approx)
        "GBP": 0.06,  # 1 GHS = 0.06 GBP (approx)
    }

    @staticmethod
    def convert(amount: float, from_curr: str, to_curr: str) -> float:
        """Converts amount from one currency to another."""
        if from_curr == to_curr:
            return amount
        
        # Convert to base (GHS)
        if from_curr not in CurrencyEngine.RATES or to_curr not in CurrencyEngine.RATES:
            return amount # Fallback
            
        amount_in_ghs = amount / CurrencyEngine.RATES[from_curr]
        converted = amount_in_ghs * CurrencyEngine.RATES[to_curr]
        
        return round(converted, 2)

    @staticmethod
    def get_supported_currencies():
        return list(CurrencyEngine.RATES.keys())

currency_engine = CurrencyEngine()
