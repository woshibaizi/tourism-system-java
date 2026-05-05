import Combine
import Foundation

@MainActor
final class DiscoverViewModel: ObservableObject {
    @Published var places: [SpotPlace] = []
    @Published var searchText = ""
    @Published var selectedType: String?
    @Published var sortBy = "popularity"
    @Published var isLoading = false
    @Published var errorMessage: String?

    private let placeService = PlaceService.shared

    func loadPlaces() async {
        isLoading = true; errorMessage = nil
        do {
            if let type = selectedType {
                let result = try await placeService.listByType(type)
                if result.code == 200 { places = result.data ?? [] }
                else { errorMessage = result.message }
            } else {
                let result = try await placeService.list(page: 1, size: 100)
                if result.code == 200 { places = result.data?.records ?? [] }
                else { errorMessage = result.message }
            }
        } catch {
            errorMessage = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
        isLoading = false
    }

    func search() async {
        guard !searchText.isEmpty else { await loadPlaces(); return }
        isLoading = true; errorMessage = nil
        do {
            let result = try await placeService.search(query: searchText)
            if result.code == 200 { places = result.data ?? [] }
            else { errorMessage = result.message }
        } catch {
            errorMessage = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
        isLoading = false
    }

    func sortByRating() async {
        isLoading = true; errorMessage = nil
        do {
            let result = try await placeService.sort(sortType: "rating", topK: 50)
            if result.code == 200 { places = result.data ?? [] }
        } catch {
            errorMessage = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
        isLoading = false
    }

    func sortByPopularity() async {
        isLoading = true; errorMessage = nil
        do {
            let result = try await placeService.sort(sortType: "popularity", topK: 50)
            if result.code == 200 { places = result.data ?? [] }
        } catch {
            errorMessage = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
        isLoading = false
    }

    var filteredPlaces: [SpotPlace] {
        if searchText.isEmpty { return places }
        return places.filter {
            ($0.name ?? "").localizedCaseInsensitiveContains(searchText) ||
            ($0.type ?? "").localizedCaseInsensitiveContains(searchText) ||
            $0.parsedKeywords.joined(separator: " ").localizedCaseInsensitiveContains(searchText)
        }
    }
}
