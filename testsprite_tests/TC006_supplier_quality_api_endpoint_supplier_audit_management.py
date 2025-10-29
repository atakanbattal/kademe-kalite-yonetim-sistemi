import requests
import uuid

BASE_URL = "http://localhost:3002/api"
TIMEOUT = 30

# Authentication credentials (replace with valid test user credentials)
AUTH_URL = f"http://localhost:3002/auth/v1/token"
AUTH_HEADERS = {
    "Content-Type": "application/json",
    "apikey": "public-anon-key-for-testing"  # Replace with actual Supabase anon/public key if exists
}
AUTH_PAYLOAD = {
    "grant_type": "password",
    "email": "testuser@example.com",
    "password": "TestPassword123!"
}

def authenticate():
    resp = requests.post(AUTH_URL, json=AUTH_PAYLOAD, headers=AUTH_HEADERS, timeout=TIMEOUT)
    resp.raise_for_status()
    data = resp.json()
    if "access_token" not in data:
        raise Exception("Authentication failed: access_token missing")
    return data["access_token"]

def test_supplier_quality_api_endpoint_supplier_audit_management():
    token = authenticate()
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "Accept": "application/json"
    }

    # 1. Create a supplier audit plan (planning phase)
    audit_plan_payload = {
        "supplier_id": str(uuid.uuid4()),
        "audit_date": "2025-11-15T10:00:00Z",
        "audit_type": "Initial",
        "auditor": "Auditor Name",
        "scope": "Quality and Compliance",
        "status": "planned",
        "notes": "Planning first supplier audit"
    }

    audit_plan_resp = requests.post(f"{BASE_URL}/supplier_audits", json=audit_plan_payload, headers=headers, timeout=TIMEOUT)
    assert audit_plan_resp.status_code == 201, f"Expected 201 Created, got {audit_plan_resp.status_code}"
    audit_plan = audit_plan_resp.json()
    assert "id" in audit_plan, "Audit plan creation response missing 'id'"
    audit_id = audit_plan["id"]

    try:
        # 2. Execute supplier audit by updating status and execution details
        execution_update_payload = {
            "status": "executed",
            "execution_date": "2025-11-15T14:00:00Z",
            "auditor_comments": "Audit executed successfully, documented findings."
        }
        execution_resp = requests.patch(f"{BASE_URL}/supplier_audits/{audit_id}", json=execution_update_payload, headers=headers, timeout=TIMEOUT)
        assert execution_resp.status_code in [200, 204], f"Expected 200 or 204 on patch, got {execution_resp.status_code}"

        # 3. Capture audit findings linked to the audit
        findings_payload = {
            "audit_id": audit_id,
            "finding": "Non-compliance in material traceability",
            "severity": "medium",
            "corrective_action_required": True,
            "status": "open",
            "responsible_person": "Supplier Quality Manager",
            "due_date": "2025-12-01"
        }

        findings_resp = requests.post(f"{BASE_URL}/supplier_audit_findings", json=findings_payload, headers=headers, timeout=TIMEOUT)
        assert findings_resp.status_code == 201, f"Expected 201 Created for findings, got {findings_resp.status_code}"
        finding = findings_resp.json()
        assert "id" in finding, "Audit findings creation response missing 'id'"
        finding_id = finding["id"]

        # 4. Track corrective actions by updating the finding with corrective action status
        corrective_action_payload = {
            "status": "in_progress",
            "corrective_action_description": "Implemented new traceability markers and updated logs",
            "action_taken_date": "2025-11-20T09:00:00Z"
        }
        corrective_action_resp = requests.patch(f"{BASE_URL}/supplier_audit_findings/{finding_id}", json=corrective_action_payload, headers=headers, timeout=TIMEOUT)
        assert corrective_action_resp.status_code in [200, 204], f"Expected 200 or 204 on corrective action patch, got {corrective_action_resp.status_code}"

        # 5. Validate error handling by attempting to create audit finding with missing required fields
        invalid_findings_payload = {
            # Missing 'audit_id' and 'finding'
            "severity": "high",
            "corrective_action_required": True,
            "status": "open"
        }
        invalid_findings_resp = requests.post(f"{BASE_URL}/supplier_audit_findings", json=invalid_findings_payload, headers=headers, timeout=TIMEOUT)
        assert invalid_findings_resp.status_code == 400, f"Expected 400 Bad Request for invalid findings creation, got {invalid_findings_resp.status_code}"

        # 6. Validate data retrieval: Get audit with findings populated
        get_audit_resp = requests.get(f"{BASE_URL}/supplier_audits/{audit_id}?select=*,supplier_audit_findings(*)", headers=headers, timeout=TIMEOUT)
        assert get_audit_resp.status_code == 200, f"Expected 200 OK for audit retrieval, got {get_audit_resp.status_code}"
        audit_data = get_audit_resp.json()
        assert audit_data["id"] == audit_id, "Returned audit ID mismatch"
        assert isinstance(audit_data.get("supplier_audit_findings"), list), "Audit findings not returned as list"
        assert any(f["id"] == finding_id for f in audit_data["supplier_audit_findings"]), "Created finding not linked to audit"

        # 7. Test RLS: Try to access audit with insufficient permissions (simulate by no token)
        rls_headers = {
            "Content-Type": "application/json",
            "Accept": "application/json"
        }
        rls_resp = requests.get(f"{BASE_URL}/supplier_audits/{audit_id}", headers=rls_headers, timeout=TIMEOUT)
        assert rls_resp.status_code in [401, 403], f"Expected 401/403 for unauthorized access, got {rls_resp.status_code}"

    finally:
        # Clean up: delete created findings and audit
        try:
            requests.delete(f"{BASE_URL}/supplier_audit_findings/{finding_id}", headers=headers, timeout=TIMEOUT)
        except Exception:
            pass
        try:
            requests.delete(f"{BASE_URL}/supplier_audits/{audit_id}", headers=headers, timeout=TIMEOUT)
        except Exception:
            pass

test_supplier_quality_api_endpoint_supplier_audit_management()
