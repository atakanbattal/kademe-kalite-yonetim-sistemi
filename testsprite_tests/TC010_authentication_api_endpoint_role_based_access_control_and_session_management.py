import requests
import uuid

BASE_URL = "http://localhost:3002/api"
TIMEOUT = 30

def test_authentication_api_endpoint_role_based_access_control_and_session_management():
    # Sample users with different roles for testing:
    users = [
        {"email": "admin@example.com", "password": "AdminPass123!", "expected_role": "admin"},
        {"email": "user@example.com", "password": "UserPass123!", "expected_role": "user"},
        {"email": "guest@example.com", "password": "GuestPass123!", "expected_role": "guest"},
        # Wrong credentials user
        {"email": "wronguser@example.com", "password": "WrongPass!", "expected_role": None},
    ]

    session_tokens = {}

    # 1. Test user login, role-based access and session management
    try:
        for user in users:
            login_payload = {
                "email": user["email"],
                "password": user["password"]
            }
            login_url = f"{BASE_URL}/auth/login"
            try:
                resp = requests.post(login_url, json=login_payload, timeout=TIMEOUT)
            except requests.RequestException as e:
                assert False, f"Login request failed for {user['email']}: {e}"

            if user["expected_role"] is None:
                # Expected to fail login
                assert resp.status_code == 401 or resp.status_code == 403, \
                    f"Authentication should fail for invalid user {user['email']}, but got {resp.status_code}"
                continue

            # Successful login expected
            assert resp.status_code == 200, f"Login failed for valid user {user['email']}: {resp.text}"
            data = resp.json()
            assert "access_token" in data, "Missing access_token in login response"
            assert "user" in data and "role" in data["user"], "Missing user or role info in login response"
            assert data["user"]["role"] == user["expected_role"], f"Role mismatch for user {user['email']}"

            access_token = data["access_token"]
            session_tokens[user["email"]] = access_token

            # 2. Check role-based access control enforcement
            # Test access to a protected resource that only admins can access:
            admin_resource_url = f"{BASE_URL}/admin/protected-resource"
            headers = {"Authorization": f"Bearer {access_token}"}
            try:
                admin_resp = requests.get(admin_resource_url, headers=headers, timeout=TIMEOUT)
            except requests.RequestException as e:
                assert False, f"Admin resource request failed for {user['email']}: {e}"

            if user["expected_role"] == "admin":
                assert admin_resp.status_code == 200, f"Admin user {user['email']} should access admin resource"
            else:
                assert admin_resp.status_code in [401, 403], f"Non-admin user {user['email']} should be denied admin resource"

            # 3. Test secure session management: Use access_token to access user profile
            profile_url = f"{BASE_URL}/auth/profile"
            try:
                profile_resp = requests.get(profile_url, headers=headers, timeout=TIMEOUT)
            except requests.RequestException as e:
                assert False, f"Profile request failed for {user['email']}: {e}"
            assert profile_resp.status_code == 200, f"Profile fetch failed for user {user['email']}"

            profile_data = profile_resp.json()
            assert profile_data.get("email") == user["email"], f"Profile email mismatch for user {user['email']}"

        # 4. Test logout endpoint invalidates session
        for email, token in session_tokens.items():
            logout_url = f"{BASE_URL}/auth/logout"
            headers = {"Authorization": f"Bearer {token}"}
            try:
                logout_resp = requests.post(logout_url, headers=headers, timeout=TIMEOUT)
            except requests.RequestException as e:
                assert False, f"Logout failed for user {email}: {e}"
            assert logout_resp.status_code in [200, 204], f"Logout failed for user {email}: {logout_resp.text}"

            # After logout, access token should be invalid
            profile_url = f"{BASE_URL}/auth/profile"
            try:
                profile_resp_after_logout = requests.get(profile_url, headers=headers, timeout=TIMEOUT)
            except requests.RequestException as e:
                assert False, f"Profile request after logout failed for {email}: {e}"
            # Session should be invalidated
            assert profile_resp_after_logout.status_code == 401, f"Token still valid after logout for {email}"

        # 5. Test access without authorization header
        protected_urls = [
            f"{BASE_URL}/auth/profile",
            f"{BASE_URL}/admin/protected-resource"
        ]
        for url in protected_urls:
            try:
                no_auth_resp = requests.get(url, timeout=TIMEOUT)
            except requests.RequestException as e:
                assert False, f"Request without auth header failed: {e}"
            assert no_auth_resp.status_code == 401, f"Access without auth header should be unauthorized for {url}"

    except AssertionError as e:
        raise e

test_authentication_api_endpoint_role_based_access_control_and_session_management()