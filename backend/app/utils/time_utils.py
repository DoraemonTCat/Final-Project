from datetime import datetime, timedelta
import pytz

bangkok_tz = pytz.timezone("Asia/Bangkok")

def calculate_date_range(period, start_date, end_date):
    now = datetime.now(bangkok_tz)
    if period:
        delta_map = {
            "today": 0,
            "week": 7,
            "month": 30,
            "3months": 90,
            "6months": 180,
            "year": 365
        }
        delta = timedelta(days=delta_map.get(period, 0))
        return now - delta, now
    elif start_date and end_date:
        return (
            bangkok_tz.localize(datetime.fromisoformat(start_date)),
            bangkok_tz.localize(datetime.fromisoformat(end_date + 'T23:59:59'))
        )
    return None, None
