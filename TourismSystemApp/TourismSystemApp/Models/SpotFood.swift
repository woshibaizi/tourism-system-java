import Foundation

struct SpotFood: Identifiable, Codable, Hashable {
    let id: String
    let name: String?
    let placeId: String?
    let cuisine: String?
    let popularity: Int?
    let description: String?
    let price: String?
    let location: String?
    let buildingId: String?
    let shopName: String?
    let restaurantName: String?
    let windowName: String?
    let rating: Double?
    let ratingCount: Int?
    let distanceMeters: Double?

    var displayName: String { shopName ?? restaurantName ?? windowName ?? name ?? "未知美食" }
    var ratingValue: Double { rating ?? 0 }
    var popularityValue: Int { popularity ?? 0 }

    func hash(into hasher: inout Hasher) { hasher.combine(id) }
    static func == (lhs: SpotFood, rhs: SpotFood) -> Bool { lhs.id == rhs.id }
}
