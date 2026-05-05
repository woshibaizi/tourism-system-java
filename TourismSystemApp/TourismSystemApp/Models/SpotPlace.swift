import Foundation

struct SpotPlace: Identifiable, Codable, Hashable {
    let id: String
    let name: String?
    let type: String?
    let keywords: String?
    let features: String?
    let rating: Double?
    let ratingCount: Int?
    let clickCount: Int?
    let lat: Double?
    let lng: Double?
    let address: String?
    let openTime: String?
    let image: String?
    let description: String?
    let createdAt: String?
    let updatedAt: String?

    var parsedKeywords: [String] { parseJSONArray(keywords) }
    var parsedFeatures: [String] { parseJSONArray(features) }
    var ratingValue: Double { rating ?? 0 }
    var coordinate: (Double, Double)? {
        guard let lat, let lng else { return nil }
        return (lat, lng)
    }

    func hash(into hasher: inout Hasher) { hasher.combine(id) }
    static func == (lhs: SpotPlace, rhs: SpotPlace) -> Bool { lhs.id == rhs.id }
}

func parseJSONArray(_ raw: String?) -> [String] {
    guard let raw, let data = raw.data(using: .utf8),
          let arr = try? JSONDecoder().decode([String].self, from: data) else { return [] }
    return arr
}
