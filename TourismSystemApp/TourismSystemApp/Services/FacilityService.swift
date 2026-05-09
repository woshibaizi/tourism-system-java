import Foundation

struct FacilityService {
    static let shared = FacilityService()
    private let api = APIService.shared

    func list(placeId: String? = nil, type: String? = nil, keyword: String? = nil, page: Int = 1, size: Int = 100) async throws -> APIResult<PageResult<SpotFacility>> {
        var q = ["page": "\(page)", "size": "\(size)"]
        if let placeId { q["placeId"] = placeId }
        if let type { q["type"] = type }
        if let keyword { q["keyword"] = keyword }
        return try await api.request("/facilities", query: q)
    }

    func detail(id: String) async throws -> APIResult<SpotFacility> {
        try await api.request("/facilities/\(id)")
    }

    func byPlace(_ placeId: String) async throws -> APIResult<[SpotFacility]> {
        try await api.request("/facilities/place/\(placeId)")
    }

    func byPlaceAndType(_ placeId: String, type: String) async throws -> APIResult<[SpotFacility]> {
        try await api.request("/facilities/place/\(placeId)/type/\(type)")
    }

    func search(query: String, placeId: String? = nil, type: String? = nil) async throws -> APIResult<[SpotFacility]> {
        var q = ["query": query]
        if let placeId { q["placeId"] = placeId }
        if let type { q["type"] = type }
        return try await api.request("/facilities/search", query: q)
    }

    func nearby(lat: Double, lng: Double, radius: Double = 500, type: String? = nil) async throws -> APIResult<[SpotFacility]> {
        var q = ["lat": "\(lat)", "lng": "\(lng)", "radius": "\(radius)"]
        if let type { q["type"] = type }
        return try await api.request("/facilities/nearby", query: q)
    }

    func nearest(buildingId: String, placeId: String, facilityType: String? = nil) async throws -> APIResult<[SpotFacility]> {
        try await api.request("/facilities/nearest", method: "POST", body: NearestBody(buildingId: buildingId, placeId: placeId, facilityType: facilityType))
    }
}

struct NearestBody: Encodable { let buildingId: String; let placeId: String; let facilityType: String? }
