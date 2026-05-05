import Combine
import Foundation

@MainActor
final class ProfileViewModel: ObservableObject {
    @Published var userProfile: UserProfileVO?
    @Published var viewHistory: [UserBehavior] = []
    @Published var ratingHistory: [UserBehavior] = []
    @Published var myDiaries: [TravelDiary] = []
    @Published var isLoading = false
    @Published var errorMessage: String?

    private let userService = UserService.shared
    private let diaryService = DiaryService.shared
    private let authService = AuthService.shared

    func loadProfile() async {
        isLoading = true; errorMessage = nil
        do {
            let result = try await authService.getCurrentUser()
            if result.code == 200 { userProfile = result.data }
            else { errorMessage = result.message }
        } catch {
            errorMessage = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
        isLoading = false
    }

    func loadHistory() async {
        guard let userId = AuthManager.shared.currentUserId else { return }
        do {
            let views = try await userService.viewHistory(userId: userId)
            if views.code == 200 { viewHistory = views.data ?? [] }
            let ratings = try await userService.ratingHistory(userId: userId)
            if ratings.code == 200 { ratingHistory = ratings.data ?? [] }
        } catch { }
    }

    func loadMyDiaries() async {
        guard let userId = AuthManager.shared.currentUserId else { return }
        do {
            let result = try await diaryService.list(authorId: userId)
            if result.code == 200 { myDiaries = result.data?.records ?? [] }
        } catch { }
    }

    var favoriteCount: Int { viewHistory.count }
    var diaryCount: Int { myDiaries.count }
    var routeCount: Int { 0 }
}
