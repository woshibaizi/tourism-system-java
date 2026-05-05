import Combine
import Foundation

@MainActor
final class AuthManager: ObservableObject {
    static let shared = AuthManager()

    @Published var token: String?
    @Published var currentUserId: Int64?
    @Published var currentUsername: String?
    @Published var isLoggedIn = false

    private let tokenKey = "auth_token"
    private let userIdKey = "auth_user_id"
    private let usernameKey = "auth_username"

    init() {
        token = UserDefaults.standard.string(forKey: tokenKey)
        currentUserId = UserDefaults.standard.object(forKey: userIdKey) as? Int64
        currentUsername = UserDefaults.standard.string(forKey: usernameKey)
        isLoggedIn = token != nil
    }

    func saveLogin(token: String, userId: Int64, username: String) {
        self.token = token
        self.currentUserId = userId
        self.currentUsername = username
        self.isLoggedIn = true
        UserDefaults.standard.set(token, forKey: tokenKey)
        UserDefaults.standard.set(userId, forKey: userIdKey)
        UserDefaults.standard.set(username, forKey: usernameKey)
    }

    func logout() {
        token = nil
        currentUserId = nil
        currentUsername = nil
        isLoggedIn = false
        UserDefaults.standard.removeObject(forKey: tokenKey)
        UserDefaults.standard.removeObject(forKey: userIdKey)
        UserDefaults.standard.removeObject(forKey: usernameKey)
    }
}
