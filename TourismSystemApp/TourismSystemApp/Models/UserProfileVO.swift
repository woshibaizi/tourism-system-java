import Foundation

struct UserProfileVO: Identifiable, Codable, Hashable {
    let id: Int64
    let username: String?
    let avatar: String?
    let interests: [String]?
    let favoriteCategories: [String]?

    var displayName: String { username ?? "用户\(id)" }
    var parsedInterests: [String] { interests ?? [] }
    var parsedCategories: [String] { favoriteCategories ?? [] }

    func hash(into hasher: inout Hasher) { hasher.combine(id) }
    static func == (lhs: UserProfileVO, rhs: UserProfileVO) -> Bool { lhs.id == rhs.id }
}
