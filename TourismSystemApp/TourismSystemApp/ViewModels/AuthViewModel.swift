import Combine
import Foundation

@MainActor
final class AuthViewModel: ObservableObject {
    @Published var username = ""
    @Published var password = ""
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var isLoggedIn = false

    private let auth = AuthService.shared

    func login() async -> Bool {
        guard !username.isEmpty, !password.isEmpty else {
            errorMessage = "请输入用户名和密码"
            return false
        }
        isLoading = true; errorMessage = nil
        do {
            let result = try await auth.login(username: username, password: password)
            if result.code == 200, let data = result.data {
                AuthManager.shared.saveLogin(token: data.token ?? "", userId: data.userId ?? 0, username: data.username ?? username)
                isLoggedIn = true; isLoading = false
                return true
            }
            errorMessage = result.message ?? "登录失败"
        } catch {
            errorMessage = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
        isLoading = false
        return false
    }

    func register() async -> Bool {
        guard !username.isEmpty, !password.isEmpty else {
            errorMessage = "请输入用户名和密码"
            return false
        }
        isLoading = true; errorMessage = nil
        do {
            let result = try await auth.register(username: username, password: password)
            if result.code == 200 {
                errorMessage = nil; isLoading = false
                return true
            }
            errorMessage = result.message ?? "注册失败"
        } catch {
            errorMessage = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
        isLoading = false
        return false
    }

    func logout() { AuthManager.shared.logout(); isLoggedIn = false }
    func reset() { username = ""; password = ""; errorMessage = nil }
}
