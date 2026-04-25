#!/usr/bin/env python3
"""
Quick test script to verify the data validation system works
"""

import asyncio
import sys
from pathlib import Path

# Add the current directory to Python path for imports
sys.path.insert(0, str(Path(__file__).parent))

from main import DataValidationSystem
from core.models import ValidationLevel

async def test_basic_functionality():
    """Test basic system functionality"""
    print("🔍 Testing Data Validation System...")

    # Initialize system
    system = DataValidationSystem()
    await system.initialize()

    # Test data
    test_data = [
        {
            "review_id": "test_001",
            "platform_review_id": "ext_001",
            "platform": "google",
            "business": {
                "business_id": "bus_001",
                "name": "Test Restaurant",
                "address": "123 Test St, Bangkok, Thailand"
            },
            "reviewer": {
                "reviewer_id": "user_001",
                "name": "Test User",
                "email": "test@example.com"
            },
            "rating": 4.5,
            "title": "Great food!",
            "content": "Excellent service and delicious food. Highly recommended!",
            "review_date": "2024-04-26T10:00:00Z",
            "metadata": {
                "source": "direct_api",
                "processed_at": "2024-04-26T10:01:00Z"
            }
        }
    ]

    try:
        print("✅ System initialized successfully")

        # Test validation
        validation_result = await system.validate_data(test_data, ValidationLevel.STANDARD)
        print(f"✅ Validation: {validation_result['summary']['valid_records']}/{validation_result['summary']['total_records']} valid")

        # Test quality check
        quality_result = await system.check_quality(test_data)
        print(f"✅ Quality Score: {quality_result['quality_score']:.2f}")

        # Test profiling
        profile_result = await system.profile_data(test_data)
        print(f"✅ Profiling: {profile_result['total_fields']} fields analyzed")

        print("🎉 All tests passed!")

    except Exception as e:
        print(f"❌ Test failed: {e}")
        import traceback
        traceback.print_exc()

    finally:
        await system.cleanup()

if __name__ == "__main__":
    asyncio.run(test_basic_functionality())