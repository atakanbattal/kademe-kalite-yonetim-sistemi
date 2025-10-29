import requests
import uuid

BASE_URL = "http://localhost:3002/api"
TIMEOUT = 30

# For authentication we assume Supabase JWT token is required; placeholder here:
SUPABASE_API_KEY = "YOUR_SUPABASE_SERVICE_ROLE_KEY_OR_ACCESS_TOKEN"
HEADERS = {
    "apikey": SUPABASE_API_KEY,
    "Authorization": f"Bearer {SUPABASE_API_KEY}",
    "Content-Type": "application/json",
    "Accept": "application/json",
}

def test_equipment_calibration_api_endpoint_equipment_status_and_calibration_history():
    equipment_url = f"{BASE_URL}/equipment"
    calibration_url = f"{BASE_URL}/calibration_history"
    maintenance_schedule_url = f"{BASE_URL}/maintenance_schedule"
    
    created_equipment_id = None
    created_calibration_id = None
    created_maintenance_id = None

    try:
        # 1. Create new equipment (POST /equipment)
        equipment_data = {
            "name": f"Test Equipment {uuid.uuid4()}",
            "serial_number": f"SN-{uuid.uuid4()}",
            "status": "active",
            "location": "Test Lab",
            "description": "Automated test equipment entry"
        }
        resp = requests.post(equipment_url, json=equipment_data, headers=HEADERS, timeout=TIMEOUT)
        assert resp.status_code == 201 or resp.status_code == 200, f"Equipment creation failed: {resp.text}"
        created_equipment = resp.json()
        created_equipment_id = created_equipment.get("id") or created_equipment.get("ID")
        assert created_equipment_id is not None, "Created equipment ID missing"

        # 2. Update equipment status (PUT /equipment/{id})
        updated_status = "calibrating"
        status_update_data = {"status": updated_status}
        resp = requests.put(f"{equipment_url}/{created_equipment_id}", json=status_update_data, headers=HEADERS, timeout=TIMEOUT)
        assert resp.status_code == 200, f"Updating equipment status failed: {resp.text}"
        updated_equipment = resp.json()
        assert updated_equipment.get("status") == updated_status, "Equipment status not updated properly"

        # 3. Add a calibration history record (POST /calibration_history)
        calibration_data = {
            "equipment_id": created_equipment_id,
            "calibration_date": "2025-10-29T10:00:00Z",
            "calibrated_by": "Quality Dept",
            "result": "pass",
            "notes": "Calibration successful and within specs"
        }
        resp = requests.post(calibration_url, json=calibration_data, headers=HEADERS, timeout=TIMEOUT)
        assert resp.status_code == 201 or resp.status_code == 200, f"Calibration record creation failed: {resp.text}"
        created_calibration = resp.json()
        created_calibration_id = created_calibration.get("id") or created_calibration.get("ID")
        assert created_calibration_id is not None, "Created calibration ID missing"
        assert created_calibration.get("equipment_id") == created_equipment_id, "Calibration record not linked to equipment"

        # 4. Retrieve calibration history for equipment (GET /calibration_history?equipment_id=...)
        resp = requests.get(f"{calibration_url}", params={"equipment_id": created_equipment_id}, headers=HEADERS, timeout=TIMEOUT)
        assert resp.status_code == 200, f"Failed to retrieve calibration history: {resp.text}"
        history_list = resp.json()
        assert isinstance(history_list, list), "Calibration history should be a list"
        assert any(rec.get("id") == created_calibration_id for rec in history_list), "Calibration record missing from history"

        # 5. Schedule maintenance activity for equipment (POST /maintenance_schedule)
        maintenance_data = {
            "equipment_id": created_equipment_id,
            "scheduled_date": "2025-11-15T09:00:00Z",
            "maintenance_type": "routine check",
            "assigned_to": "Maintenance Team",
            "notes": "Monthly routine maintenance scheduled"
        }
        resp = requests.post(maintenance_schedule_url, json=maintenance_data, headers=HEADERS, timeout=TIMEOUT)
        assert resp.status_code == 201 or resp.status_code == 200, f"Scheduling maintenance failed: {resp.text}"
        created_maintenance = resp.json()
        created_maintenance_id = created_maintenance.get("id") or created_maintenance.get("ID")
        assert created_maintenance_id is not None, "Created maintenance ID missing"
        assert created_maintenance.get("equipment_id") == created_equipment_id, "Maintenance not linked to equipment"

        # 6. Retrieve maintenance schedules for equipment (GET /maintenance_schedule?equipment_id=...)
        resp = requests.get(f"{maintenance_schedule_url}", params={"equipment_id": created_equipment_id}, headers=HEADERS, timeout=TIMEOUT)
        assert resp.status_code == 200, f"Failed to retrieve maintenance schedules: {resp.text}"
        maintenance_list = resp.json()
        assert isinstance(maintenance_list, list), "Maintenance schedule should be a list"
        assert any(item.get("id") == created_maintenance_id for item in maintenance_list), "Maintenance schedule missing"

        # 7. Test error handling: Try to get equipment with invalid ID (GET /equipment/invalid-id)
        resp = requests.get(f"{equipment_url}/invalid-id", headers=HEADERS, timeout=TIMEOUT)
        assert resp.status_code == 404 or resp.status_code == 400, "Invalid equipment ID did not return error"

        # 8. Test RLS & authorization by simulating unauthorized access if possible
        # Here, do a request without auth headers or with invalid token and verify rejection
        resp = requests.get(equipment_url, headers={"apikey": "invalid", "Authorization": "Bearer invalid"}, timeout=TIMEOUT)
        assert resp.status_code == 401 or resp.status_code == 403, "Unauthorized access was not blocked"

    finally:
        # Cleanup created resources to maintain test isolation
        if created_maintenance_id:
            requests.delete(f"{maintenance_schedule_url}/{created_maintenance_id}", headers=HEADERS, timeout=TIMEOUT)
        if created_calibration_id:
            requests.delete(f"{calibration_url}/{created_calibration_id}", headers=HEADERS, timeout=TIMEOUT)
        if created_equipment_id:
            requests.delete(f"{equipment_url}/{created_equipment_id}", headers=HEADERS, timeout=TIMEOUT)


test_equipment_calibration_api_endpoint_equipment_status_and_calibration_history()