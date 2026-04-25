#!/usr/bin/env python3
"""
Test script for the minimal data validation system
"""

import asyncio
import json
from main_minimal import SimpleDataValidationSystem, ValidationLevel

async def test_minimal_system():
    """Test the minimal validation system"""
    print("Testing Minimal Data Validation System...")

    # Initialize system
    system = SimpleDataValidationSystem()
    await system.initialize()

    # Test data - mix of valid and invalid records
    test_data = [
        {
            "review_id": "rev_001",
            "rating": 4.5,
            "review_text": "Great product! Highly recommended.",
            "reviewer_name": "Alice Smith",
            "platform": "google"
        },
        {
            "review_id": "rev_002",
            "rating": 2.0,
            "review_text": "Not great quality, but okay for the price.",
            "reviewer_name": "Bob Johnson",
            "platform": "yelp"
        },
        {
            # Missing review_id (should be invalid)
            "rating": 3.5,
            "review_text": "Average experience.",
            "reviewer_name": "Carol Wilson"
        },
        {
            "review_id": "rev_004",
            "rating": 6.0,  # Invalid rating (too high)
            "review_text": "Amazing!",
            "reviewer_name": "David Brown",
            "platform": "facebook"
        },
        {
            "review_id": "rev_005",
            "rating": 5.0,
            "review_text": "Perfect! No complaints.",
            "reviewer_name": "Emma Davis"
            # Missing platform - should still be valid
        }
    ]

    try:
        print(f"Testing with {len(test_data)} records...")

        # Test validation
        print("\nRunning validation...")
        validation_result = await system.validate_data(test_data, ValidationLevel.STANDARD)
        summary = validation_result['summary']
        print(f"   Valid records: {summary['valid_records']}/{summary['total_records']}")
        print(f"   Success rate: {summary['success_rate']:.1%}")

        # Show validation errors for debugging
        for i, result in enumerate(validation_result['results']):
            if not result['valid']:
                print(f"   Record {i+1} errors: {', '.join(result['errors'])}")

        # Test quality check
        print("\nRunning quality check...")
        quality_result = await system.check_quality(test_data)
        print(f"   Quality score: {quality_result['quality_score']:.1f}%")
        print(f"   Total fields: {quality_result['total_fields']}")
        if quality_result['issues']:
            print("   Quality issues:")
            for issue in quality_result['issues']:
                print(f"      - {issue}")

        # Test profiling
        print("\nRunning data profiling...")
        profile_result = await system.profile_data(test_data)
        print(f"   Records analyzed: {profile_result['total_records']}")
        print(f"   Fields found: {profile_result['total_fields']}")

        print("\n   Field details:")
        for field_name, profile in profile_result['field_profiles'].items():
            completeness = profile['completeness']
            print(f"      {field_name}: {completeness:.1%} complete, {profile['unique_values']} unique values")

        # Test full analysis
        print("\nRunning full analysis...")
        full_result = await system.full_analysis(test_data, ValidationLevel.COMPREHENSIVE)
        full_summary = full_result['summary']
        print(f"   Valid records: {full_summary['validation_passed']}/{full_summary['total_records']}")
        print(f"   Quality score: {full_summary['quality_score']:.1f}%")

        print("\nAll tests completed successfully!")

        # Show a sample of the detailed results
        print("\nSample validation result:")
        print(json.dumps(validation_result['results'][0], indent=2))

    except Exception as e:
        print(f"Test failed: {e}")
        import traceback
        traceback.print_exc()

    finally:
        await system.cleanup()

if __name__ == "__main__":
    asyncio.run(test_minimal_system())