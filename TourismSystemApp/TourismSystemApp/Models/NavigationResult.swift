import Foundation

struct NavigationResult: Codable {
    let path: [String]?
    let cost: Double?
    let nodeCount: Int?
    let vehicle: String?
    let strategy: String?
    let placeType: String?
    let availableVehicles: [String]?
    let totalDistance: Double?
    let totalTime: Double?
    let segments: [RouteSegment]?
    let nodeCoordinates: [String: Coordinate]?
    let algorithm: String?
    let targetPath: [String]?
    let unreachableDestinations: [String]?
}

struct RouteSegment: Codable {
    let from: String?
    let to: String?
    let distance: Double?
    let time: Double?
    let vehicle: String?
}

struct Coordinate: Codable {
    let lat: Double?
    let lng: Double?
    let name: String?
}

struct IndoorNavigationResult: Codable {
    let destination: RoomInfo?
    let path: [String]?
    let navigationSteps: [NavigationStep]?
    let totalDistance: Double?
    let estimatedTimeMinutes: Double?
    let floorAnalysis: String?
    let optimizationTarget: String?
}

struct RoomInfo: Codable {
    let id: String?
    let name: String?
    let floor: Int?
    let type: String?
    let x: Double?
    let y: Double?
}

struct NavigationStep: Codable {
    let step: Int?
    let description: String?
    let distance: Double?
    let floorChange: Bool?
    let fromRoom: String?
    let toRoom: String?
    let direction: String?
}

struct IndoorBuildingInfo: Codable {
    let buildingInfo: BuildingDetail?
    let nodeCount: Int?
    let loaded: Bool?
}

struct BuildingDetail: Codable {
    let name: String?
    let floors: Int?
    let totalRooms: Int?
    let rooms: [String]?
}

struct AIGCResult: Codable {
    let videoPath: String?
    let videoUrl: String?
    let outputFormat: String?
    let frameCount: Int?
    let duration: Double?
    let path: String?
    let filename: String?
    let size: Int64?
    let contentType: String?
}
