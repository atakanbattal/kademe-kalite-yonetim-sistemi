import requests
import time

BASE_URL = "http://localhost:3002/api"
TIMEOUT = 30
AUTH_URL = "http://localhost:3002/auth/v1/token?grant_type=password"
# Use environment variables or secure vault for real credentials; hardcoded here only for example.
AUTH_EMAIL = "testuser@example.com"
AUTH_PASSWORD = "TestPassword123!"

headers = {
    "Content-Type": "application/json",
    "Accept": "application/json"
}

def authenticate():
    try:
        resp = requests.post(
            AUTH_URL,
            json={"email": AUTH_EMAIL, "password": AUTH_PASSWORD},
            timeout=TIMEOUT
        )
        resp.raise_for_status()
        data = resp.json()
        access_token = data.get("access_token")
        assert access_token is not None and len(access_token) > 0, "Authentication failed: No access token"
        return access_token
    except Exception as e:
        raise RuntimeError(f"Authentication error: {str(e)}")

def create_nc_form(token, form_type, payload):
    url = f"{BASE_URL}/non_conformity_forms"
    hdrs = headers.copy()
    hdrs["Authorization"] = f"Bearer {token}"
    json_payload = payload.copy()
    json_payload["type"] = form_type
    resp = requests.post(url, json=json_payload, headers=hdrs, timeout=TIMEOUT)
    resp.raise_for_status()
    created = resp.json()
    assert "id" in created, "Creation response lacks id"
    return created["id"], created

def get_nc_form(token, form_id):
    url = f"{BASE_URL}/non_conformity_forms?id=eq.{form_id}"
    hdrs = headers.copy()
    hdrs["Authorization"] = f"Bearer {token}"
    resp = requests.get(url, headers=hdrs, timeout=TIMEOUT)
    resp.raise_for_status()
    data = resp.json()
    assert isinstance(data, list) and len(data) == 1, "Get NC form returned unexpected result"
    return data[0]

def update_nc_form_status(token, form_id, new_status):
    url = f"{BASE_URL}/non_conformity_forms?id=eq.{form_id}"
    hdrs = headers.copy()
    hdrs["Authorization"] = f"Bearer {token}"
    payload = {"status": new_status}
    resp = requests.patch(url, json=payload, headers=hdrs, timeout=TIMEOUT)
    resp.raise_for_status()
    return resp.json()

def delete_nc_form(token, form_id):
    url = f"{BASE_URL}/non_conformity_forms?id=eq.{form_id}"
    hdrs = headers.copy()
    hdrs["Authorization"] = f"Bearer {token}"
    resp = requests.delete(url, headers=hdrs, timeout=TIMEOUT)
    resp.raise_for_status()
    return resp

def test_non_conformity_management_api_endpoint_nc_form_workflow():
    token = authenticate()

    # Define form payload base for DF, 8D, MDI
    base_payload = {
        "title": "Test NC Form",
        "description": "Automated test for NC form workflow",
        "created_by": "testuser@example.com",
        "approver": "manager@example.com",
        "status": "draft",
        "workflow_step": 1
    }

    form_types = ["DF", "8D", "MDI"]
    created_ids = []

    try:
        for form_type in form_types:
            # Create NC form
            form_id, created_form = create_nc_form(token, form_type, base_payload)
            assert created_form["type"] == form_type, f"Form type mismatch on creation: expected {form_type}"
            assert created_form["status"] == "draft", "Initial status should be draft"
            created_ids.append(form_id)

            # Progress form workflow: draft -> in_progress -> under_review -> approved
            status_flow = ["in_progress", "under_review", "approved"]
            for idx, status in enumerate(status_flow, start=2):
                update_resp = update_nc_form_status(token, form_id, status)
                # The Supabase patch returns number of updated rows or records, check 1 updated
                # But since Supabase usually returns the updated record, we accept both
                if isinstance(update_resp, list):
                    assert len(update_resp) == 1 and update_resp[0]["status"] == status, f"Status update failed at step {idx} for {form_type}"
                elif isinstance(update_resp, dict):
                    assert update_resp.get("status") == status, f"Status update failed at step {idx} for {form_type}"
                else:
                    assert update_resp == 1, f"Unexpected update response for status {status} of {form_type}"

                # Verify updated status by fetching form
                current_form = get_nc_form(token, form_id)
                assert current_form["status"] == status, f"Status not updated correctly, expected {status}, got {current_form['status']}"

                # Optionally verify workflow_step increments (assuming numeric)
                expected_step = idx
                if "workflow_step" in current_form:
                    assert int(current_form["workflow_step"]) >= expected_step, f"Workflow step not progressed as expected for {form_type}"

            # Test error handling: try to update with invalid status
            invalid_status = "invalid_status_value"
            try:
                update_nc_form_status(token, form_id, invalid_status)
                assert False, "Expected error when updating with invalid status"
            except requests.exceptions.HTTPError as err:
                assert err.response.status_code == 400 or err.response.status_code == 422, "Expected 400 or 422 on invalid status update"

    finally:
        # Cleanup created NC forms
        for form_id in created_ids:
            try:
                delete_nc_form(token, form_id)
            except Exception:
                pass

test_non_conformity_management_api_endpoint_nc_form_workflow()