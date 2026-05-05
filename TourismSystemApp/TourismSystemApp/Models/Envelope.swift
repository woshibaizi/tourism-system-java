import Foundation

struct APIResult<T: Decodable>: Decodable {
    let code: Int
    let message: String?
    let data: T?
}

struct APIResultData<T: Decodable>: Decodable {
    let code: Int
    let message: String?
    let data: T
}

struct PageResult<T: Decodable>: Decodable {
    let records: [T]
    let current: Int?
    let size: Int?
    let total: Int?
    let pages: Int?
}

struct FoodListResult: Decodable {
    let items: [SpotFood]
    let total: Int?
    let sortBy: String?
}

struct PlaceDetailVO: Decodable {
    let place: SpotPlace?
    let buildings: [SpotBuilding]?
    let facilities: [SpotFacility]?
}

struct UploadResult: Decodable {
    let filename: String?
    let path: String?
    let size: Int64?
    let contentType: String?
}

struct MediaResponse: Decodable {
    let success: Bool
    let message: String?
    let data: UploadResult?
}

struct RateResult: Decodable {
    let rating: Double?
    let ratingCount: Int?
    let userRating: Double?
}

struct LoginResult: Decodable {
    let token: String?
    let userId: Int64?
    let username: String?
}

struct StatisticsResult: Decodable, Sendable {
    let places: Int?
    let diaries: Int?
    let users: Int?
    let roads: Int?
}

struct DiaryDeleteResult: Decodable {
    let deletedId: String?
}
