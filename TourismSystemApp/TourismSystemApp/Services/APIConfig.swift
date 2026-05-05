import Foundation

enum APIConfig {
    static let baseURL = "http://localhost:8080/api"
    static let timeout: TimeInterval = 15
}

enum APIError: Error, LocalizedError {
    case invalidURL
    case invalidResponse
    case serverError(code: Int, message: String)
    case decodingError(Error)
    case networkError(Error)
    case unauthorized

    var errorDescription: String? {
        switch self {
        case .invalidURL: "无效的请求地址"
        case .invalidResponse: "服务器未返回有效响应"
        case .serverError(_, let message): message
        case .decodingError: "数据解析失败"
        case .networkError(let err): err.localizedDescription
        case .unauthorized: "登录已过期，请重新登录"
        }
    }
}
