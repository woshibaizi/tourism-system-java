import Foundation

struct SpotBuilding: Identifiable, Codable, Hashable {
    let id: String
    let name: String?
    let placeId: String?
    let lat: Double?
    let lng: Double?
    let description: String?
    let floorCount: Int?
    let createdAt: String?

    var coordinate: (Double, Double)? {
        guard let lat, let lng else { return nil }
        return (lat, lng)
    }

    func hash(into hasher: inout Hasher) { hasher.combine(id) }
    static func == (lhs: SpotBuilding, rhs: SpotBuilding) -> Bool { lhs.id == rhs.id }
}
