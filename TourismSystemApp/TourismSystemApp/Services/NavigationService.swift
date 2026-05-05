import Foundation

struct NavigationService {
    static let shared = NavigationService()
    private let api = APIService.shared

    func shortestPath(start: String, end: String, vehicle: String = "步行", strategy: String = "time", placeType: String = "景区") async throws -> APIResult<NavigationResult> {
        try await api.request("/navigation/shortest-path", method: "POST", body: ShortestPathBody(start: start, end: end, vehicle: vehicle, strategy: strategy, placeType: placeType))
    }

    func mixedVehiclePath(start: String, end: String, placeType: String = "景区") async throws -> APIResult<NavigationResult> {
        try await api.request("/navigation/mixed-vehicle-path", method: "POST", body: MixedVehicleBody(start: start, end: end, placeType: placeType))
    }

    func multiDestination(start: String, destinations: [String], algorithm: String = "nearest_neighbor") async throws -> APIResult<NavigationResult> {
        try await api.request("/navigation/multi-destination", method: "POST", body: MultiDestinationBody(start: start, destinations: destinations, algorithm: algorithm))
    }

    func indoorNavigate(roomId: String, avoidCongestion: Bool = true, useTimeWeight: Bool = true) async throws -> APIResult<IndoorNavigationResult> {
        try await api.request("/navigation/indoor", method: "POST", body: IndoorNavigateBody(roomId: roomId, avoidCongestion: avoidCongestion, useTimeWeight: useTimeWeight))
    }

    func indoorRooms() async throws -> APIResult<[RoomInfo]> {
        try await api.request("/navigation/indoor/rooms")
    }

    func indoorBuildingInfo() async throws -> APIResult<IndoorBuildingInfo> {
        try await api.request("/navigation/indoor/building-info")
    }

    func navigateToRoom(_ roomId: String) async throws -> APIResult<IndoorNavigationResult> {
        try await indoorNavigate(roomId: roomId)
    }
}

struct ShortestPathBody: Encodable {
    let start: String; let end: String; let vehicle: String; let strategy: String; let placeType: String
}
struct MixedVehicleBody: Encodable {
    let start: String; let end: String; let placeType: String
}
struct MultiDestinationBody: Encodable {
    let start: String; let destinations: [String]; let algorithm: String
}
struct IndoorNavigateBody: Encodable {
    let roomId: String; let avoidCongestion: Bool; let useTimeWeight: Bool
}
