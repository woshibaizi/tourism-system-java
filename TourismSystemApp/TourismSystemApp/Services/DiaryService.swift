import Foundation

struct DiaryService {
    static let shared = DiaryService()
    private let api = APIService.shared

    func list(page: Int = 1, size: Int = 100, placeId: String? = nil, authorId: Int64? = nil) async throws -> APIResult<PageResult<TravelDiary>> {
        var q = ["page": "\(page)", "size": "\(size)"]
        if let placeId { q["placeId"] = placeId }
        if let authorId { q["authorId"] = "\(authorId)" }
        return try await api.request("/diaries", query: q)
    }

    func detail(id: String) async throws -> APIResult<TravelDiary> {
        try await api.request("/diaries/\(id)")
    }

    func byAuthor(_ authorId: Int64) async throws -> APIResult<[TravelDiary]> {
        try await api.request("/diaries/author/\(authorId)")
    }

    func hot(limit: Int = 10) async throws -> APIResult<[TravelDiary]> {
        try await api.request("/diaries/hot", query: ["limit": "\(limit)"])
    }

    func create(title: String, content: String, placeId: String?, authorId: Int64, tags: [String]? = nil) async throws -> APIResult<TravelDiary> {
        try await api.request("/diaries", method: "POST", body: CreateDiaryBody(title: title, content: content, placeId: placeId, authorId: authorId, tags: tags))
    }

    func update(id: String, title: String?, content: String?, placeId: String?, tags: [String]?) async throws -> APIResult<TravelDiary> {
        try await api.request("/diaries/\(id)", method: "PUT", body: UpdateDiaryBody(title: title, content: content, placeId: placeId, tags: tags))
    }

    func delete(id: String) async throws -> APIResult<DiaryDeleteResult> {
        try await api.request("/diaries/\(id)", method: "DELETE")
    }

    func search(query: String, type: String = "fulltext") async throws -> APIResult<[TravelDiary]> {
        try await api.request("/diaries/search", query: ["query": query, "type": type])
    }

    func recommend(userId: Int64, algorithm: String = "content", topK: Int = 12) async throws -> APIResult<[TravelDiary]> {
        try await api.request("/diaries/recommend", method: "POST", body: DiaryRecommendBody(userId: userId, algorithm: algorithm, topK: topK))
    }

    func rate(diaryId: String, userId: Int64, rating: Double) async throws -> APIResult<RateResult> {
        try await api.request("/diaries/\(diaryId)/rate", method: "POST", body: RateBody(userId: userId, rating: rating))
    }
}

struct CreateDiaryBody: Encodable { let title: String; let content: String; let placeId: String?; let authorId: Int64; let tags: [String]? }
struct UpdateDiaryBody: Encodable { let title: String?; let content: String?; let placeId: String?; let tags: [String]? }
struct DiaryRecommendBody: Encodable { let userId: Int64; let algorithm: String; let topK: Int }
