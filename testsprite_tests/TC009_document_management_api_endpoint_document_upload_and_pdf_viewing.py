import requests
import io

BASE_URL = "http://localhost:3002/api"
TIMEOUT = 30

# Authentication helper - replace with valid credentials or token retrieval
def get_auth_headers():
    # For example purposes, using a placeholder Bearer token
    token = "your_valid_jwt_token_here"
    return {
        "Authorization": f"Bearer {token}"
    }

def test_document_management_api_endpoint_document_upload_and_pdf_viewing():
    headers = get_auth_headers()
    # 1. Upload a document
    upload_url = f"{BASE_URL}/documents"
    # Prepare a sample PDF file content in memory
    sample_pdf_content = b'%PDF-1.4\n%\xe2\xe3\xcf\xd3\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Count 1 /Kids [3 0 R] >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 512 512] /Contents 4 0 R >>\nendobj\n4 0 obj\n<< /Length 55 >>\nstream\nBT\n/F1 24 Tf\n100 500 Td\n(Hello, Supabase PDF Test) Tj\nET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f \n0000000010 00000 n \n0000000067 00000 n \n0000000129 00000 n \n0000000223 00000 n \ntrailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n315\n%%EOF'
    files = {
        "file": ("test_document.pdf", io.BytesIO(sample_pdf_content), "application/pdf")
    }
    # Additional metadata for document if required by API, using multipart form data
    data = {
        "title": "Test Document",
        "description": "Test document upload for API validation"
    }

    doc_id = None
    try:
        # Upload document POST request
        resp_upload = requests.post(upload_url, headers=headers, files=files, data=data, timeout=TIMEOUT)
        assert resp_upload.status_code == 201, f"Upload failed with status {resp_upload.status_code}: {resp_upload.text}"
        upload_resp_json = resp_upload.json()
        assert "id" in upload_resp_json, "Uploaded document response missing 'id'"
        doc_id = upload_resp_json["id"]

        # 2. Validate document version control by uploading a new version
        version_upload_url = f"{BASE_URL}/documents/{doc_id}/upload-version"
        new_pdf_content = b'%PDF-1.4\n%NewVersion\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Count 1 /Kids [3 0 R] >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>\nendobj\n4 0 obj\n<< /Length 60 >>\nstream\nBT\n/F1 18 Tf\n100 700 Td\n(New PDF Version Uploaded) Tj\nET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f \n0000000010 00000 n \n0000000068 00000 n \n0000000131 00000 n \n0000000232 00000 n \ntrailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n327\n%%EOF'
        files_version = {
            "file": ("test_document_v2.pdf", io.BytesIO(new_pdf_content), "application/pdf")
        }
        resp_version = requests.post(version_upload_url, headers=headers, files=files_version, timeout=TIMEOUT)
        assert resp_version.status_code == 201, f"Version upload failed with status {resp_version.status_code}: {resp_version.text}"
        version_resp_json = resp_version.json()
        assert version_resp_json.get("version") is not None, "Version upload response missing 'version' indication"

        # 3. Retrieve PDF viewing URL or content via document endpoint
        view_url = f"{BASE_URL}/documents/{doc_id}/pdf"
        resp_view = requests.get(view_url, headers=headers, timeout=TIMEOUT)
        assert resp_view.status_code == 200, f"PDF viewing endpoint returned status {resp_view.status_code}"
        content_type = resp_view.headers.get("Content-Type", "")
        assert "pdf" in content_type.lower(), f"Expected PDF content type, got: {content_type}"
        assert len(resp_view.content) > 0, "PDF view response content is empty"

        # 4. Retrieve document metadata and version history to confirm version control
        metadata_url = f"{BASE_URL}/documents/{doc_id}/metadata"
        resp_meta = requests.get(metadata_url, headers=headers, timeout=TIMEOUT)
        assert resp_meta.status_code == 200, f"Metadata retrieval failed with status {resp_meta.status_code}"
        meta_json = resp_meta.json()
        assert "versions" in meta_json, "Document metadata missing 'versions'"
        assert isinstance(meta_json["versions"], list) and len(meta_json["versions"]) >= 2, "Expected at least 2 versions in metadata"

    finally:
        # Cleanup: delete the uploaded document
        if doc_id:
            delete_url = f"{BASE_URL}/documents/{doc_id}"
            try:
                resp_delete = requests.delete(delete_url, headers=headers, timeout=TIMEOUT)
                assert resp_delete.status_code in (200,204), f"Document deletion failed with status {resp_delete.status_code}"
            except Exception as e:
                print(f"Cleanup deletion failed: {e}")

test_document_management_api_endpoint_document_upload_and_pdf_viewing()