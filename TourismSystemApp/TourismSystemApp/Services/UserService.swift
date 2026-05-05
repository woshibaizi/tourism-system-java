import Foundation

struct UserService {
    static let shared = UserService()
    private let api = APIService.shared

    func list() async throws -> APIResult<[UserProfileVO]> {
        try await api.request("/users")
    }

    func detail(id: Int64) async throws -> APIResult<UserProfileVO> {
        try await api.request("/users/\(id)")
    }

    func update(id: Int64, user: UserProfileVO) async throws -> APIResult<String> {
        try await api.request("/users/\(id)", method: "PUT", body: user)
    }

    func recordBehavior(userId: Int64, targetId: String, behaviorType: String, score: Double? = nil) async throws -> APIResult<String> {
        var q: [String: String] = ["targetId": targetId, "behaviorType": behaviorType]
        if let score { q["score"] = "\(score)" }
        return try await api.request("/users/\(userId)/behavior", method: "POST", query: q)
    }

    func viewHistory(userId: Int64) async throws -> APIResult<[UserBehavior]> {
        try await api.request("/users/\(userId)/views")
    }

    func ratingHistory(userId: Int64) async throws -> APIResult<[UserBehavior]> {
        try await api.request("/users/\(userId)/ratings")
    }
}

struct UserBehavior: Codable, Identifiable {
    let id: Int64?
    let userId: Int64?
    let targetId: String?
    let behaviorType: String?
    let score: Double?
    let createdAt: String?
}
