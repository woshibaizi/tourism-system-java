import Foundation

struct PlaceService {
    static let shared = PlaceService()
    private let api = APIService.shared

    func list(page: Int = 1, size: Int = 100, type: String? = nil, keyword: String? = nil) async throws -> APIResult<PageResult<SpotPlace>> {
        var q = ["page": "\(page)", "size": "\(size)"]
        if let type { q["type"] = type }
        if let keyword { q["keyword"] = keyword }
        return try await api.request("/places", query: q)
    }

    func detail(id: String) async throws -> APIResult<PlaceDetailVO> {
        try await api.request("/places/\(id)")
    }

    func search(query: String, type: String? = nil) async throws -> APIResult<[SpotPlace]> {
        var q = ["query": query]
        if let type { q["type"] = type }
        return try await api.request("/places/search", query: q)
    }

    func hot(limit: Int = 10) async throws -> APIResult<[SpotPlace]> {
        try await api.request("/places/hot", query: ["limit": "\(limit)"])
    }

    func topRated(limit: Int = 10) async throws -> APIResult<[SpotPlace]> {
        try await api.request("/places/top-rated", query: ["limit": "\(limit)"])
    }

    func listByType(_ type: String) async throws -> APIResult<[SpotPlace]> {
        try await api.request("/places/type/\(type)")
    }

    func recommend(userId: Int64, topK: Int = 12) async throws -> APIResult<[SpotPlace]> {
        try await api.request("/places/recommend", method: "POST", body: RecommendBody(userId: userId, topK: topK))
    }

    func sort(sortType: String, topK: Int = 12) async throws -> APIResult<[SpotPlace]> {
        try await api.request("/places/sort", method: "POST", body: SortBody(sortType: sortType, topK: topK))
    }

    func rate(placeId: String, userId: Int64, rating: Double) async throws -> APIResult<RateResult> {
        try await api.request("/places/\(placeId)/rate", method: "POST", body: RateBody(userId: userId, rating: rating))
    }
}

struct RecommendBody: Encodable { let userId: Int64; let topK: Int }
struct SortBody: Encodable { let sortType: String; let topK: Int }
struct RateBody: Encodable { let userId: Int64; let rating: Double }
