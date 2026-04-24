import Foundation

struct SpotFacility: Identifiable, Codable, Hashable {
    let id: String
    let name: String?
    let type: String?
    let placeId: String?
    let lat: Double?
    let lng: Double?
    let description: String?
    let rating: Double?
    let distance: Double?
    let travelTime: Double?

    var coordinate: (Double, Double)? {
        guard let lat, let lng else { return nil }
        return (lat, lng)
    }
    var distanceMeters: Double { distance ?? 0 }

    func hash(into hasher: inout Hasher) { hasher.combine(id) }
    static func == (lhs: SpotFacility, rhs: SpotFacility) -> Bool { lhs.id == rhs.id }
}
