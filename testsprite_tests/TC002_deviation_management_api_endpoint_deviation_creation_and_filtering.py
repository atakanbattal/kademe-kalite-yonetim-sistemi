import requests
import uuid
import time

BASE_URL = "http://localhost:3002/api"
TIMEOUT = 30

SUPABASE_API_KEY = "your_supabase_api_key_here"
SUPABASE_AUTH_TOKEN = "your_supabase_auth_token_here"

HEADERS = {
    "apikey": SUPABASE_API_KEY,
    "Authorization": f"Bearer {SUPABASE_AUTH_TOKEN}",
    "Content-Type": "application/json",
    "Accept": "application/json",
}

def test_deviation_management_api_endpoint_deviation_creation_and_filtering():
    deviation_endpoint = f"{BASE_URL}/deviations"
    analytics_endpoint = f"{BASE_URL}/deviations_analytics"
    created_deviation_id = None

    deviation_payload = {
        "title": f"Test Deviation {uuid.uuid4().hex[:8]}",
        "description": "Test description for deviation creation via API",
        "status": "open",
        "severity": "minor",
        "deviation_source": "internal",
        "deviation_date": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }

    try:
        create_resp = requests.post(
            deviation_endpoint,
            headers=HEADERS,
            json=deviation_payload,
            timeout=TIMEOUT,
        )
        assert create_resp.status_code in (200, 201), f"Create deviation failed: {create_resp.text}"
        create_data = create_resp.json()
        assert isinstance(create_data, dict), "Create response is not a JSON object"
        created_deviation_id = create_data.get("id") or create_data.get("deviation_id")
        assert created_deviation_id is not None, "Created deviation ID missing in response"

        filter_params = {
            "status": "open",
            "severity": "minor",
            "deviation_source": "internal",
            "limit": 10,
        }
        filter_resp = requests.get(
            deviation_endpoint,
            headers=HEADERS,
            params=filter_params,
            timeout=TIMEOUT,
        )
        assert filter_resp.status_code == 200, f"Filter deviations failed: {filter_resp.text}"
        filter_data = filter_resp.json()
        assert isinstance(filter_data, (list, dict)), "Filter response structure unexpected"
        deviations_list = filter_data if isinstance(filter_data, list) else filter_data.get("data", filter_data)
        assert any((d.get("id") == created_deviation_id or d.get("deviation_id") == created_deviation_id) for d in deviations_list), \
            "Created deviation not found in filtered results"

        analytics_resp = requests.get(
            analytics_endpoint,
            headers=HEADERS,
            timeout=TIMEOUT,
        )
        assert analytics_resp.status_code == 200, f"Retrieve deviation analytics failed: {analytics_resp.text}"
        analytics_data = analytics_resp.json()
        assert isinstance(analytics_data, dict), "Analytics response is not a JSON object"
        expected_keys = ["total_deviations", "by_status", "by_severity", "trend"]
        for key in expected_keys:
            assert key in analytics_data, f"Analytics key '{key}' missing in response"

    finally:
        if created_deviation_id:
            try:
                delete_resp = requests.delete(
                    f"{deviation_endpoint}/{created_deviation_id}",
                    headers=HEADERS,
                    timeout=TIMEOUT,
                )
                assert delete_resp.status_code in (200, 204), f"Failed to delete deviation: {delete_resp.text}"
            except Exception as e:
                print(f"Cleanup deletion error: {e}")


test_deviation_management_api_endpoint_deviation_creation_and_filtering()
