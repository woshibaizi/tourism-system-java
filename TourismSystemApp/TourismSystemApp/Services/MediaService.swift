import Foundation

struct MediaService {
    static let shared = MediaService()
    private let api = APIService.shared

    func uploadImage(_ imageData: Data, fileName: String) async throws -> MediaResponse {
        let data = try await api.upload("/upload/image", data: imageData, fieldName: "file", fileName: fileName, mimeType: "image/jpeg")
        return try JSONDecoder().decode(MediaResponse.self, from: data)
    }

    func uploadVideo(_ videoData: Data, fileName: String) async throws -> MediaResponse {
        let data = try await api.upload("/upload/video", data: videoData, fieldName: "file", fileName: fileName, mimeType: "video/mp4")
        return try JSONDecoder().decode(MediaResponse.self, from: data)
    }

    func convertToAnimation(imagePaths: [String], description: String = "", outputFormat: String = "gif", fps: Int = 6, width: Int = 848, height: Int = 480) async throws -> APIResult<AIGCResult> {
        try await api.request("/aigc/convert-to-video", method: "POST", body: AIGCRequestBody(imagePaths: imagePaths, description: description, outputFormat: outputFormat, fps: fps, width: width, height: height))
    }

    func getStatistics() async throws -> APIResult<StatisticsResult> {
        try await api.request("/stats")
    }
}

struct AIGCRequestBody: Encodable {
    let imagePaths: [String]
    let description: String
    let outputFormat: String
    let fps: Int
    let width: Int
    let height: Int
}
