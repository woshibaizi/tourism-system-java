import Foundation

struct FoodService {
    static let shared = FoodService()
    private let api = APIService.shared

    func searchFoods(placeId: String? = nil, cuisine: String? = nil, search: String? = nil, sortBy: String = "popularity", buildingId: String? = nil, limit: Int = 12) async throws -> APIResult<FoodListResult> {
        var q = ["sortBy": sortBy, "limit": "\(limit)"]
        if let placeId { q["placeId"] = placeId }
        if let cuisine { q["cuisine"] = cuisine }
        if let search { q["search"] = search }
        if let buildingId { q["buildingId"] = buildingId }
        return try await api.request("/foods", query: q)
    }

    func byPlace(_ placeId: String) async throws -> APIResult<[SpotFood]> {
        try await api.request("/foods/place/\(placeId)")
    }

    func byCuisine(_ cuisine: String) async throws -> APIResult<[SpotFood]> {
        try await api.request("/foods/cuisine/\(cuisine)")
    }

    func popular(placeId: String? = nil, limit: Int = 10) async throws -> APIResult<[SpotFood]> {
        var q = ["limit": "\(limit)"]
        if let placeId { q["placeId"] = placeId }
        return try await api.request("/foods/popular", query: q)
    }

    func cuisines(placeId: String? = nil) async throws -> APIResult<[String]> {
        var q: [String: String] = [:]
        if let placeId { q["placeId"] = placeId }
        return try await api.request("/foods/cuisines", query: q.isEmpty ? nil : q)
    }

    func detail(id: String) async throws -> APIResult<SpotFood> {
        try await api.request("/foods/\(id)")
    }
}
