import Combine
import Foundation

@MainActor
final class HomeViewModel: ObservableObject {
    @Published var hotPlaces: [SpotPlace] = []
    @Published var recommendedPlaces: [SpotPlace] = []
    @Published var hotDiaries: [TravelDiary] = []
    @Published var stats: StatisticsResult?
    @Published var isLoading = false
    @Published var errorMessage: String?

    private let placeService = PlaceService.shared
    private let diaryService = DiaryService.shared
    private let mediaService = MediaService.shared

    func loadAll() async {
        isLoading = true; errorMessage = nil
        async let hotTask = placeService.hot(limit: 6)
        async let diaryTask = diaryService.hot(limit: 5)
        async let statsTask = mediaService.getStatistics()

        do {
            let (hot, diaries, stats) = try await (hotTask, diaryTask, statsTask)
            if hot.code == 200 { hotPlaces = hot.data ?? [] }
            if diaries.code == 200 { hotDiaries = diaries.data ?? [] }
            if stats.code == 200 { self.stats = stats.data }
        } catch {
            errorMessage = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }

        let userId = AuthManager.shared.currentUserId
        if let userId {
            do {
                let rec = try await placeService.recommend(userId: userId, topK: 6)
                if rec.code == 200 { recommendedPlaces = rec.data ?? [] }
            } catch { }
        }

        isLoading = false
    }
}
