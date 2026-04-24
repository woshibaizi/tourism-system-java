import Combine
import Foundation

@MainActor
final class DiaryViewModel: ObservableObject {
    @Published var diaries: [TravelDiary] = []
    @Published var selectedDiary: TravelDiary?
    @Published var searchText = ""
    @Published var searchType = "fulltext"
    @Published var isLoading = false
    @Published var errorMessage: String?

    @Published var createTitle = ""
    @Published var createContent = ""
    @Published var createPlaceId = ""
    @Published var createTags = ""

    private let diaryService = DiaryService.shared

    func loadDiaries() async {
        isLoading = true; errorMessage = nil
        do {
            let result = try await diaryService.list(page: 1, size: 100)
            if result.code == 200 { diaries = result.data?.records ?? [] }
            else { errorMessage = result.message }
        } catch {
            errorMessage = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
        isLoading = false
    }

    func loadDiaryDetail(id: String) async {
        isLoading = true; errorMessage = nil
        do {
            let result = try await diaryService.detail(id: id)
            if result.code == 200 { selectedDiary = result.data }
            else { errorMessage = result.message }
        } catch {
            errorMessage = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
        isLoading = false
    }

    func search() async {
        guard !searchText.isEmpty else { await loadDiaries(); return }
        isLoading = true; errorMessage = nil
        do {
            let result = try await diaryService.search(query: searchText, type: searchType)
            if result.code == 200 { diaries = result.data ?? [] }
            else { errorMessage = result.message }
        } catch {
            errorMessage = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
        isLoading = false
    }

    func createDiary() async -> Bool {
        guard let userId = AuthManager.shared.currentUserId else { errorMessage = "请先登录"; return false }
        guard !createTitle.isEmpty, !createContent.isEmpty else { errorMessage = "标题和内容不能为空"; return true }
        isLoading = true; errorMessage = nil
        let tags = createTags.split(separator: ",").map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }
        let placeId = createPlaceId.isEmpty ? nil : createPlaceId
        do {
            let result = try await diaryService.create(title: createTitle, content: createContent, placeId: placeId, authorId: userId, tags: tags.isEmpty ? nil : tags)
            if result.code == 200 { clearCreateForm(); isLoading = false; return true }
            errorMessage = result.message
        } catch {
            errorMessage = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
        isLoading = false
        return false
    }

    func deleteDiary(id: String) async -> Bool {
        isLoading = true; errorMessage = nil
        do {
            let result = try await diaryService.delete(id: id)
            if result.code == 200 { diaries.removeAll { $0.id == id }; isLoading = false; return true }
            errorMessage = result.message
        } catch {
            errorMessage = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
        isLoading = false
        return false
    }

    func rateDiary(id: String, rating: Double) async {
        guard let userId = AuthManager.shared.currentUserId else { return }
        do {
            let result = try await diaryService.rate(diaryId: id, userId: userId, rating: rating)
            if result.code == 200 { await loadDiaries() }
        } catch { }
    }

    func clearCreateForm() { createTitle = ""; createContent = ""; createPlaceId = ""; createTags = "" }
}
