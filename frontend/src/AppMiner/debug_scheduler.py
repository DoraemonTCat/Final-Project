"""
Script สำหรับ debug ปัญหาการส่งตามระยะเวลาที่หายไป
"""

import requests
import json
from datetime import datetime, timedelta

# Configuration
BASE_URL = "http://localhost:8000"
PAGE_ID = "577695622104397"  # ใส่ Page ID ของคุณที่นี่

def check_conversations():
    """ตรวจสอบ conversations และเวลาข้อความล่าสุด"""
    print("🔍 Checking conversations with last message time...")
    
    response = requests.get(f"{BASE_URL}/conversations-with-last-message/{PAGE_ID}")
    
    if response.status_code != 200:
        print(f"❌ Error: {response.status_code}")
        print(response.text)
        return
    
    data = response.json()
    conversations = data.get('conversations', [])
    
    print(f"✅ Found {len(conversations)} conversations\n")
    
    # แสดง 5 conversations แรก
    for i, conv in enumerate(conversations[:5]):
        print(f"Conversation {i+1}:")
        print(f"  User: {conv.get('user_name', 'Unknown')}")
        print(f"  PSID: {conv.get('raw_psid', 'N/A')}")
        print(f"  Last message time: {conv.get('last_user_message_time', 'Never')}")
        
        # คำนวณว่าหายไปนานเท่าไหร่
        if conv.get('last_user_message_time'):
            last_msg_time = datetime.fromisoformat(conv['last_user_message_time'].replace('T', ' ').split('+')[0])
            time_diff = datetime.now() - last_msg_time
            
            # แปลงเป็นนาที
            minutes_diff = int(time_diff.total_seconds() / 60)
            hours_diff = int(minutes_diff / 60)
            days_diff = int(hours_diff / 24)
            
            if days_diff > 0:
                print(f"  ⏰ หายไป: {days_diff} วัน {hours_diff % 24} ชั่วโมง")
            elif hours_diff > 0:
                print(f"  ⏰ หายไป: {hours_diff} ชั่วโมง {minutes_diff % 60} นาที")
            else:
                print(f"  ⏰ หายไป: {minutes_diff} นาที")
                
            # ตรวจสอบว่าควรส่งข้อความหรือไม่ (ถ้าหายไป > 1 นาที)
            if minutes_diff >= 1:
                print(f"  ✅ ควรได้รับข้อความอัตโนมัติ (หายไปเกิน 1 นาที)")
            else:
                print(f"  ⏳ ยังไม่ถึงเวลาส่ง (หายไปแค่ {minutes_diff} นาที)")
        
        print("-" * 50)

def test_direct_inactivity_check():
    """ทดสอบ API ตรวจสอบ user ที่หายไปโดยตรง"""
    print("\n🧪 Testing direct inactivity check (1 minute)...")
    
    response = requests.get(f"{BASE_URL}/schedule/test-inactivity/{PAGE_ID}?minutes=1")
    
    if response.status_code != 200:
        print(f"❌ Error: {response.status_code}")
        print(response.text)
        return
    
    result = response.json()
    print(json.dumps(result, indent=2))
    
    if result.get('count', 0) > 0:
        print(f"✅ ส่งข้อความให้ {result['count']} users")
    else:
        print("⚠️ ไม่พบ user ที่ตรงเงื่อนไข")

def check_system_status():
    """ตรวจสอบสถานะระบบ"""
    print("\n📊 System Status:")
    
    response = requests.get(f"{BASE_URL}/schedule/system-status")
    
    if response.status_code != 200:
        print(f"❌ Error: {response.status_code}")
        return
    
    status = response.json()
    print(f"  Scheduler running: {status.get('is_running', False)}")
    print(f"  Active pages: {status.get('active_pages', [])}")
    print(f"  Total schedules: {status.get('total_schedules', 0)}")
    
    if not status.get('is_running'):
        print("  ⚠️ Scheduler ไม่ได้ทำงาน! ตรวจสอบ backend logs")

def create_test_schedule_1_minute():
    """สร้าง schedule ทดสอบ 1 นาที"""
    print("\n🚀 Creating test schedule (1 minute inactivity)...")
    
    test_schedule = {
        "id": 9999,
        "type": "user-inactive",
        "inactivityPeriod": "1",
        "inactivityUnit": "minutes",
        "groups": [1],
        "messages": [
            {
                "type": "text",
                "content": "🔔 ข้อความทดสอบ: คุณหายไปมา 1 นาทีแล้วนะคะ",
                "order": 0
            },
            {
                "type": "text",
                "content": "✨ นี่คือข้อความอัตโนมัติจากระบบค่ะ",
                "order": 1
            }
        ]
    }
    
    response = requests.post(
        f"{BASE_URL}/schedule/activate",
        json={
            "page_id": PAGE_ID,
            "schedule": test_schedule
        }
    )
    
    if response.status_code == 200:
        print("✅ Schedule activated successfully!")
        print("⏳ รอ 30-60 วินาที เพื่อให้ระบบตรวจสอบ")
    else:
        print(f"❌ Error: {response.status_code}")
        print(response.text)

def check_active_schedules():
    """ตรวจสอบ schedules ที่กำลังทำงาน"""
    print("\n📋 Active Schedules:")
    
    response = requests.get(f"{BASE_URL}/active-schedules/{PAGE_ID}")
    
    if response.status_code != 200:
        print(f"❌ Error: {response.status_code}")
        return
    
    data = response.json()
    schedules = data.get('active_schedules', [])
    
    if not schedules:
        print("  ⚠️ ไม่มี schedule ที่กำลังทำงาน")
    else:
        for schedule in schedules:
            print(f"  - ID: {schedule['id']}")
            print(f"    Type: {schedule['type']}")
            if schedule['type'] == 'user-inactive':
                print(f"    Period: {schedule.get('inactivityPeriod')} {schedule.get('inactivityUnit')}")
            print(f"    Messages: {len(schedule.get('messages', []))} messages")

def check_page_tokens():
    """ตรวจสอบ page tokens"""
    print("\n🔑 Checking page tokens...")
    
    response = requests.get(f"{BASE_URL}/debug/tokens")
    
    if response.status_code == 200:
        data = response.json()
        print(f"  Page tokens count: {data.get('page_tokens_count', 0)}")
        if PAGE_ID in data.get('page_tokens', {}):
            print(f"  ✅ Token for {PAGE_ID} exists")
        else:
            print(f"  ❌ No token for {PAGE_ID} - ต้องเชื่อมต่อ Facebook Page ก่อน!")

def full_diagnostic():
    """รันการวินิจฉัยแบบเต็ม"""
    print("🏥 Running Full Diagnostic")
    print("=" * 60)
    
    # 1. ตรวจสอบ tokens
    check_page_tokens()
    
    # 2. ตรวจสอบระบบ
    check_system_status()
    
    # 3. ตรวจสอบ conversations
    check_conversations()
    
    # 4. ตรวจสอบ active schedules
    check_active_schedules()
    
    print("\n💡 Recommendations:")
    print("1. ตรวจสอบว่ามี user ที่หายไปเกิน 1 นาทีหรือไม่")
    print("2. ตรวจสอบ backend logs ดูว่ามี error หรือไม่")
    print("3. ลองรัน test_direct_inactivity_check() เพื่อทดสอบการส่งโดยตรง")
    print("4. ถ้ายังไม่ได้ ลองรัน create_test_schedule_1_minute() แล้วรอ 1 นาที")

if __name__ == "__main__":
    # ⚠️ อย่าลืมใส่ PAGE_ID ก่อนรัน!
    if PAGE_ID == "YOUR_PAGE_ID":
        print("❌ ERROR: กรุณาใส่ PAGE_ID ของคุณก่อน!")
        print("แก้ไขบรรทัด: PAGE_ID = 'YOUR_PAGE_ID'")
    else:
        print(f"🎯 Testing with PAGE_ID: {PAGE_ID}\n")
        
        # รันการวินิจฉัยแบบเต็ม
        full_diagnostic()
        
        # ถ้าต้องการทดสอบเฉพาะอย่าง uncomment บรรทัดด้านล่าง:
        # test_direct_inactivity_check()
        # create_test_schedule_1_minute()