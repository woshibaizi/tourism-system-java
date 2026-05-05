import Foundation

struct AuthService {
    static let shared = AuthService()
    private let api = APIService.shared

    func login(username: String, password: String) async throws -> APIResult<LoginResult> {
        let body = LoginBody(username: username, password: password)
        return try await api.request("/auth/login", method: "POST", body: body)
    }

    func register(username: String, password: String) async throws -> APIResult<String> {
        let body = LoginBody(username: username, password: password)
        return try await api.request("/auth/register", method: "POST", body: body)
    }

    func getCurrentUser() async throws -> APIResult<UserProfileVO> {
        try await api.request("/auth/me")
    }
}

struct LoginBody: Encodable {
    let username: String
    let password: String
}
