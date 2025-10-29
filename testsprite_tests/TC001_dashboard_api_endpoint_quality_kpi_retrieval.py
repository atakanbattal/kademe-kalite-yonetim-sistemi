import requests
from requests.exceptions import RequestException, HTTPError, Timeout

BASE_URL = "http://localhost:3002/api"
DASHBOARD_KPI_ENDPOINT = f"{BASE_URL}/dashboard/kpi"
TIMEOUT = 30

# Example: Supabase service key or user token (replace with actual valid token)
# For testing, assume we have a bearer token for an authorized user
AUTH_TOKEN = "Bearer eyJhbGciOiJIUzI1NiIsInR..."  # This should be replaced with a valid token

def test_dashboard_api_endpoint_quality_kpi_retrieval():
    headers = {
        "Authorization": AUTH_TOKEN,
        "Accept": "application/json"
    }

    try:
        # Retrieve real-time quality KPIs and statistics from dashboard endpoint
        response = requests.get(DASHBOARD_KPI_ENDPOINT, headers=headers, timeout=TIMEOUT)
        response.raise_for_status()

        # Validate content type
        content_type = response.headers.get("Content-Type", "")
        assert "application/json" in content_type, f"Unexpected Content-Type: {content_type}"

        kpi_data = response.json()

        # Validate top-level structure: must contain keys typical for KPIs
        required_keys = [
            "totalDefects",
            "openDeviations",
            "closedDeviations",
            "qualityCost",
            "kaizenCount",
            "supplierIssues",
            "equipmentStatus",
            "productionQuality",
            "lastUpdated"
        ]

        for key in required_keys:
            assert key in kpi_data, f"Missing key in KPI data: {key}"

        # Validate types of key values (basic sanity checks)
        assert isinstance(kpi_data["totalDefects"], int), "totalDefects should be int"
        assert isinstance(kpi_data["openDeviations"], int), "openDeviations should be int"
        assert isinstance(kpi_data["closedDeviations"], int), "closedDeviations should be int"
        assert isinstance(kpi_data["qualityCost"], (int, float)), "qualityCost should be number"
        assert isinstance(kpi_data["kaizenCount"], int), "kaizenCount should be int"
        assert isinstance(kpi_data["supplierIssues"], int), "supplierIssues should be int"
        assert isinstance(kpi_data["equipmentStatus"], dict), "equipmentStatus should be dict"
        assert isinstance(kpi_data["productionQuality"], dict), "productionQuality should be dict"
        # lastUpdated should be ISO8601 string, basic check
        assert isinstance(kpi_data["lastUpdated"], str) and "T" in kpi_data["lastUpdated"], "lastUpdated should be ISO8601 string"

        # Further validations on nested objects (optional detailed checks)
        equipment_status = kpi_data["equipmentStatus"]
        assert "calibrated" in equipment_status and isinstance(equipment_status["calibrated"], int)
        assert "dueForMaintenance" in equipment_status and isinstance(equipment_status["dueForMaintenance"], int)

        production_quality = kpi_data["productionQuality"]
        assert "vehiclesInspected" in production_quality and isinstance(production_quality["vehiclesInspected"], int)
        assert "defectRate" in production_quality and isinstance(production_quality["defectRate"], (int, float))

    except Timeout:
        assert False, "API request timed out"
    except HTTPError as http_err:
        assert False, f"HTTP error occurred: {http_err}"
    except RequestException as req_err:
        assert False, f"Request exception occurred: {req_err}"
    except ValueError:
        assert False, "Response content is not valid JSON"
    except AssertionError as assert_err:
        raise assert_err

test_dashboard_api_endpoint_quality_kpi_retrieval()