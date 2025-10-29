import requests
import uuid

BASE_URL = "http://localhost:3002/api"
TIMEOUT = 30

SERVICE_ROLE_KEY = "your_service_role_key"
HEADERS = {
    "apikey": SERVICE_ROLE_KEY,
    "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
    "Content-Type": "application/json"
}


def test_internal_audit_management_api_endpoint_audit_planning_and_execution():
    audit_id = None
    finding_id = None
    try:
        # 1. Plan a new internal audit
        plan_payload = {
            "title": "Test Audit - Planning",
            "description": "Audit planned for test execution",
            "scheduled_date": "2025-12-01T10:00:00Z",
            "auditor": "tester",  # Changed to valid user identifier string
            "status": "planned"
        }
        plan_resp = requests.post(
            f"{BASE_URL}/internal_audit_plans",
            headers=HEADERS,
            json=plan_payload,
            timeout=TIMEOUT
        )
        assert plan_resp.status_code == 201, f"Planning audit creation failed: {plan_resp.text}"
        audit = plan_resp.json()
        audit_id = audit.get("id")
        assert audit_id is not None, "Audit ID should be returned after planning"

        # 2. Execute the planned audit (update status to 'in_progress')
        exec_payload = {
            "status": "in_progress",
            "started_at": "2025-12-01T10:05:00Z"
        }
        exec_resp = requests.patch(
            f"{BASE_URL}/internal_audit_plans?id=eq.{audit_id}",
            headers=HEADERS,
            json=exec_payload,
            timeout=TIMEOUT
        )
        assert exec_resp.status_code in (200,204), f"Audit execution update failed: {exec_resp.text}"

        # 3. Document an audit finding (create finding linked to audit)
        finding_payload = {
            "audit_id": audit_id,
            "title": "Test Finding",
            "description": "Test finding description for audit",
            "severity": "medium",
            "status": "open",
            "reported_by": "tester"
        }
        finding_resp = requests.post(
            f"{BASE_URL}/internal_audit_findings",
            headers=HEADERS,
            json=finding_payload,
            timeout=TIMEOUT
        )
        assert finding_resp.status_code == 201, f"Audit finding creation failed: {finding_resp.text}"
        finding = finding_resp.json()
        finding_id = finding.get("id")
        assert finding_id is not None, "Finding ID should be returned after creation"

        # 4. Update finding status (e.g., close it)
        update_finding_payload = {
            "status": "closed",
            "closed_at": "2025-12-02T12:00:00Z"
        }
        update_finding_resp = requests.patch(
            f"{BASE_URL}/internal_audit_findings?id=eq.{finding_id}",
            headers=HEADERS,
            json=update_finding_payload,
            timeout=TIMEOUT
        )
        assert update_finding_resp.status_code in (200,204), f"Audit finding update failed: {update_finding_resp.text}"

        # 5. Generate audit report (assuming a GET endpoint that returns JSON/pdf report data)
        report_resp = requests.get(
            f"{BASE_URL}/internal_audit_reports?audit_id=eq.{audit_id}",
            headers=HEADERS,
            timeout=TIMEOUT
        )
        assert report_resp.status_code == 200, f"Audit report retrieval failed: {report_resp.text}"
        report_data = report_resp.json()
        assert isinstance(report_data, list), "Report data should be a list"
        assert any(r.get("audit_id") == audit_id for r in report_data), "No report found for the audit"

        # 6. Test handling of invalid audit update (e.g., invalid status)
        invalid_payload = {
            "status": "invalid_status_value"
        }
        invalid_resp = requests.patch(
            f"{BASE_URL}/internal_audit_plans?id=eq.{audit_id}",
            headers=HEADERS,
            json=invalid_payload,
            timeout=TIMEOUT
        )
        assert invalid_resp.status_code in (400, 422), \
            f"Invalid status update should be rejected, got: {invalid_resp.status_code}"

    finally:
        if finding_id is not None:
            del_finding_resp = requests.delete(
                f"{BASE_URL}/internal_audit_findings?id=eq.{finding_id}",
                headers=HEADERS,
                timeout=TIMEOUT
            )
            assert del_finding_resp.status_code in (200,204), f"Cleanup finding delete failed: {del_finding_resp.text}"

        if audit_id is not None:
            del_audit_resp = requests.delete(
                f"{BASE_URL}/internal_audit_plans?id=eq.{audit_id}",
                headers=HEADERS,
                timeout=TIMEOUT
            )
            assert del_audit_resp.status_code in (200,204), f"Cleanup audit delete failed: {del_audit_resp.text}"


test_internal_audit_management_api_endpoint_audit_planning_and_execution()
