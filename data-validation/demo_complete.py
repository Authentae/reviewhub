#!/usr/bin/env python3
"""
Complete Demo of the Data Validation System
Demonstrates all capabilities: validation, quality checking, and profiling
"""

import asyncio
import json
from main_minimal import SimpleDataValidationSystem, ValidationLevel

async def complete_demo():
    """Comprehensive demonstration of the data validation system"""
    print("=" * 60)
    print("   DATA VALIDATION SYSTEM - COMPLETE DEMO")
    print("=" * 60)

    # Initialize system
    system = SimpleDataValidationSystem()
    await system.initialize()

    # Demo data with various quality issues for testing
    demo_data = [
        {
            "review_id": "rev_001",
            "rating": 5.0,
            "review_text": "Outstanding Thai restaurant in Bangkok! The pad thai was perfect and service was excellent.",
            "reviewer_name": "Sarah Chen",
            "platform": "google",
            "review_date": "2024-04-20",
            "business_name": "Thai Paradise Restaurant"
        },
        {
            "review_id": "rev_002",
            "rating": 4.2,
            "review_text": "Good food and atmosphere. Will come back again.",
            "reviewer_name": "Michael Rodriguez",
            "platform": "yelp",
            "review_date": "2024-04-19",
            "business_name": "Thai Paradise Restaurant"
        },
        {
            # Missing review_id - validation error
            "rating": 3.5,
            "review_text": "Average experience. Food was okay.",
            "reviewer_name": "Anonymous",
            "platform": "facebook",
            "review_date": "2024-04-18",
            "business_name": "Thai Paradise Restaurant"
        },
        {
            "review_id": "rev_004",
            "rating": 8.0,  # Invalid rating - validation error
            "review_text": "Amazing! Best Thai food ever!",
            "reviewer_name": "David Kim",
            "platform": "google",
            "review_date": "2024-04-17",
            "business_name": "Thai Paradise Restaurant"
        },
        {
            "review_id": "rev_005",
            "rating": 1.5,
            "review_text": "",  # Empty review text
            "reviewer_name": "Lisa Wang",
            "platform": "tripadvisor",
            "review_date": "2024-04-16"
            # Missing business_name
        },
        {
            "review_id": "rev_006",
            "rating": 4.8,
            "review_text": "Authentic flavors and great value. Highly recommended for anyone looking for real Thai cuisine.",
            "reviewer_name": "Carlos Mendoza",
            "platform": "yelp",
            "review_date": "2024-04-15",
            "business_name": "Thai Paradise Restaurant"
        }
    ]

    try:
        print(f"\nProcessing {len(demo_data)} sample review records...")

        print("\n" + "="*50)
        print("1. VALIDATION ANALYSIS")
        print("="*50)

        validation_result = await system.validate_data(demo_data, ValidationLevel.STANDARD)
        v_summary = validation_result['summary']

        print(f"Total Records: {v_summary['total_records']}")
        print(f"Valid Records: {v_summary['valid_records']}")
        print(f"Invalid Records: {v_summary['invalid_records']}")
        print(f"Success Rate: {v_summary['success_rate']:.1%}")

        print("\nValidation Issues Found:")
        for i, result in enumerate(validation_result['results']):
            if not result['valid']:
                print(f"  Record {i+1}: {', '.join(result['errors'])}")

        print("\n" + "="*50)
        print("2. DATA QUALITY ASSESSMENT")
        print("="*50)

        quality_result = await system.check_quality(demo_data)

        print(f"Overall Quality Score: {quality_result['quality_score']:.1f}%")
        print(f"Total Fields Analyzed: {quality_result['total_fields']}")

        print("\nField Completeness Analysis:")
        for field, completeness in quality_result['completeness_scores'].items():
            status = "OK" if completeness >= 0.8 else "LOW"
            print(f"  {field:15}: {completeness:6.1%} [{status}]")

        if quality_result['issues']:
            print("\nQuality Issues:")
            for issue in quality_result['issues']:
                print(f"  - {issue}")
        else:
            print("\nNo critical quality issues detected.")

        print("\n" + "="*50)
        print("3. DATA PROFILING")
        print("="*50)

        profile_result = await system.profile_data(demo_data)

        print(f"Records Profiled: {profile_result['total_records']}")
        print(f"Fields Discovered: {profile_result['total_fields']}")

        print("\nDetailed Field Profiles:")
        for field_name, profile in profile_result['field_profiles'].items():
            print(f"\n  {field_name.upper()}:")
            print(f"    Completeness: {profile['completeness']:.1%}")
            print(f"    Data Type: {', '.join(profile.get('inferred_types', ['Unknown']))}")
            print(f"    Unique Values: {profile['unique_values']}")
            print(f"    Null Count: {profile['null_count']}")

            # Show sample values (truncated)
            if 'sample_values' in profile and profile['sample_values']:
                samples = profile['sample_values'][:3]  # First 3 samples
                sample_str = ', '.join(f'"{str(v)}"' if isinstance(v, str) else str(v) for v in samples)
                if len(profile['sample_values']) > 3:
                    sample_str += "..."
                print(f"    Sample Values: {sample_str}")

        print("\n" + "="*50)
        print("4. COMPREHENSIVE SUMMARY")
        print("="*50)

        full_result = await system.full_analysis(demo_data, ValidationLevel.COMPREHENSIVE)
        summary = full_result['summary']

        print("COMPLETE ANALYSIS RESULTS:")
        print(f"  Data Records Processed: {summary['total_records']}")
        print(f"  Validation Success Rate: {summary['validation_passed']}/{summary['total_records']} ({summary['validation_passed']/summary['total_records']:.1%})")
        print(f"  Quality Score: {summary['quality_score']:.1f}%")
        print(f"  Analysis Level: {summary['analysis_level'].title()}")

        # Data quality assessment
        if summary['quality_score'] >= 90:
            quality_grade = "EXCELLENT"
        elif summary['quality_score'] >= 75:
            quality_grade = "GOOD"
        elif summary['quality_score'] >= 60:
            quality_grade = "FAIR"
        else:
            quality_grade = "POOR"

        print(f"  Data Quality Grade: {quality_grade}")

        # Recommendations based on results
        print("\nRECOMMENDATIONS:")
        if v_summary['invalid_records'] > 0:
            print(f"  - Fix {v_summary['invalid_records']} validation error(s)")

        if quality_result['quality_score'] < 95:
            print(f"  - Improve data completeness for higher quality score")

        if any(c < 0.8 for c in quality_result['completeness_scores'].values()):
            incomplete_fields = [f for f, c in quality_result['completeness_scores'].items() if c < 0.8]
            print(f"  - Address low completeness in: {', '.join(incomplete_fields)}")

        # Save detailed results
        output_file = "complete_demo_results.json"
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(full_result, f, indent=2, default=str)

        print(f"\nDetailed results saved to: {output_file}")

        print("\n" + "="*60)
        print("   DEMO COMPLETED SUCCESSFULLY!")
        print("="*60)

        print("\nThe Data Validation System provides:")
        print("  ✓ Schema validation with detailed error reporting")
        print("  ✓ Data quality assessment with scoring")
        print("  ✓ Comprehensive data profiling")
        print("  ✓ Multi-format support (JSON, CSV)")
        print("  ✓ CLI tools for automation")
        print("  ✓ Production-ready performance")

    except Exception as e:
        print(f"Demo failed with error: {e}")
        import traceback
        traceback.print_exc()

    finally:
        await system.cleanup()

if __name__ == "__main__":
    asyncio.run(complete_demo())