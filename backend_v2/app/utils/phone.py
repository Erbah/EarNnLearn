import re

def normalize_phone(phone: str) -> str:
    """
    Normalizes a Ghanaian phone number to international format.
    - Removes all non-digit characters (except leading +)
    - Converts 0... to +233...
    - Converts 233... to +233...
    - Adds + to existing 233 numbers if missing
    """
    if not phone:
        return phone
        
    # Remove any whitespace or special characters except '+'
    cleaned = re.sub(r'[^\d+]', '', phone)
    
    # If it starts with 0 and is 10 digits long (standard local format)
    if cleaned.startswith('0') and len(cleaned) == 10:
        return f"+233{cleaned[1:]}"
        
    # If it starts with 233 and is 12 digits long
    if cleaned.startswith('233') and len(cleaned) == 12:
        return f"+{cleaned}"
        
    # If it already starts with +233
    if cleaned.startswith('+233') and len(cleaned) == 13:
        return cleaned
        
    # Fallback for other formats (assuming it's already an international number or needs to be left alone)
    if not cleaned.startswith('+') and len(cleaned) >= 10:
        return f"+{cleaned}"
        
    return cleaned
