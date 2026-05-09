import Foundation

struct TravelDiary: Identifiable, Codable, Hashable {
    let id: String
    let title: String?
    let content: String?
    let placeId: String?
    let authorId: Int64?
    let clickCount: Int?
    let rating: Double?
    let ratingCount: Int?
    let images: String?
    let videos: String?
    let tags: String?
    let createdAt: String?
    let updatedAt: String?

    var parsedImages: [String] { parseJSONArray(images) }
    var parsedVideos: [String] { parseJSONArray(videos) }
    var parsedTags: [String] { parseJSONArray(tags) }

    func hash(into hasher: inout Hasher) { hasher.combine(id) }
    static func == (lhs: TravelDiary, rhs: TravelDiary) -> Bool { lhs.id == rhs.id }
}
