import requests
import uuid

BASE_URL = "http://localhost:3002/api"
TIMEOUT = 30
# Authentication credentials - replace with valid test user credentials
AUTH_EMAIL = "testuser@example.com"
AUTH_PASSWORD = "TestPassword123!"

def authenticate():
    """Authenticate to Supabase and return access token and headers."""
    url = f"{BASE_URL}/auth/v1/token?grant_type=password"
    payload = {
        "email": AUTH_EMAIL,
        "password": AUTH_PASSWORD
    }
    headers = {
        "Content-Type": "application/json",
        "apikey": "public-anonymous-key"  # Replace with your public anon key if needed
    }
    response = requests.post(url, json=payload, headers=headers, timeout=TIMEOUT)
    response.raise_for_status()
    data = response.json()
    access_token = data.get("access_token")
    if not access_token:
        raise Exception("Authentication failed: No access token received")
    return access_token

def test_quarantine_management_api_endpoint_quarantine_record_handling():
    access_token = authenticate()
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
        "apikey": "public-anonymous-key"  # Replace with your public anon key if needed
    }

    quarantine_records_endpoint = f"{BASE_URL}/quarantine_records"
    quarantine_analytics_endpoint = f"{BASE_URL}/quarantine_analytics"

    # Create quarantine record payload - minimal viable valid data
    quarantine_record_data = {
        "part_number": f"PN-{uuid.uuid4().hex[:8]}",
        "description": "Test quarantine part record",
        "quantity": 10,
        "status": "quarantined",
        "logged_by": "testuser",
        "log_date": "2025-10-29T10:00:00Z",
        # Add any additional required fields for your schema here
    }

    quarantine_id = None
    try:
        # 1. Log a new quarantine record (Create)
        response_create = requests.post(
            quarantine_records_endpoint,
            headers=headers,
            json=quarantine_record_data,
            timeout=TIMEOUT,
        )
        assert response_create.status_code == 201, f"Create failed: {response_create.text}"
        created_record = response_create.json()
        quarantine_id = created_record.get("id")
        assert quarantine_id is not None, "Created record missing ID"

        # 2. Update quarantine decision to 'release'
        update_data_release = {"status": "released", "decision_date": "2025-10-30T10:00:00Z"}
        response_update_release = requests.patch(
            f"{quarantine_records_endpoint}?id=eq.{quarantine_id}",
            headers=headers,
            json=update_data_release,
            timeout=TIMEOUT,
        )
        # Supabase returns 204 No Content for successful update
        assert response_update_release.status_code in (200, 204), f"Update release failed: {response_update_release.text}"

        # Verify update by fetching record
        response_get = requests.get(
            f"{quarantine_records_endpoint}?id=eq.{quarantine_id}",
            headers=headers,
            timeout=TIMEOUT,
        )
        assert response_get.status_code == 200, f"Get quarantine record failed: {response_get.text}"
        records = response_get.json()
        assert len(records) == 1, "Expected exactly one quarantine record"
        assert records[0]["status"] == "released", "Status not updated to released"

        # 3. Update quarantine decision to 'scrap'
        update_data_scrap = {"status": "scrapped", "decision_date": "2025-10-31T10:00:00Z"}
        response_update_scrap = requests.patch(
            f"{quarantine_records_endpoint}?id=eq.{quarantine_id}",
            headers=headers,
            json=update_data_scrap,
            timeout=TIMEOUT,
        )
        assert response_update_scrap.status_code in (200, 204), f"Update scrap failed: {response_update_scrap.text}"

        # Verify update to scrap
        response_get_scrap = requests.get(
            f"{quarantine_records_endpoint}?id=eq.{quarantine_id}",
            headers=headers,
            timeout=TIMEOUT,
        )
        assert response_get_scrap.status_code == 200, f"Get quarantine record failed: {response_get_scrap.text}"
        records_scrap = response_get_scrap.json()
        assert len(records_scrap) == 1, "Expected exactly one quarantine record"
        assert records_scrap[0]["status"] == "scrapped", "Status not updated to scrapped"

        # 4. Update quarantine decision to 'rework'
        update_data_rework = {"status": "rework", "decision_date": "2025-11-01T10:00:00Z"}
        response_update_rework = requests.patch(
            f"{quarantine_records_endpoint}?id=eq.{quarantine_id}",
            headers=headers,
            json=update_data_rework,
            timeout=TIMEOUT,
        )
        assert response_update_rework.status_code in (200, 204), f"Update rework failed: {response_update_rework.text}"

        # Verify update to rework
        response_get_rework = requests.get(
            f"{quarantine_records_endpoint}?id=eq.{quarantine_id}",
            headers=headers,
            timeout=TIMEOUT,
        )
        assert response_get_rework.status_code == 200, f"Get quarantine record failed: {response_get_rework.text}"
        records_rework = response_get_rework.json()
        assert len(records_rework) == 1, "Expected exactly one quarantine record"
        assert records_rework[0]["status"] == "rework", "Status not updated to rework"

        # 5. Fetch quarantine analytics
        response_analytics = requests.get(
            quarantine_analytics_endpoint,
            headers=headers,
            timeout=TIMEOUT,
        )
        assert response_analytics.status_code == 200, f"Fetch analytics failed: {response_analytics.text}"
        analytics_data = response_analytics.json()
        # Basic validation of analytics data structure (expects dict or list)
        assert isinstance(analytics_data, (dict, list)), "Analytics data should be dict or list"
        # Further validations can be added if schema is available

    finally:
        # Clean up: delete the created quarantine record
        if quarantine_id:
            response_delete = requests.delete(
                f"{quarantine_records_endpoint}?id=eq.{quarantine_id}",
                headers=headers,
                timeout=TIMEOUT,
            )
            # Supabase returns 204 No Content on success
            assert response_delete.status_code in (200, 204), f"Delete failed: {response_delete.text}"

test_quarantine_management_api_endpoint_quarantine_record_handling()