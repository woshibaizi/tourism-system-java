import Combine
import Foundation

@MainActor
final class FacilityViewModel: ObservableObject {
    @Published var facilities: [SpotFacility] = []
    @Published var selectedType: String?
    @Published var searchText = ""
    @Published var isLoading = false
    @Published var errorMessage: String?

    private let facilityService = FacilityService.shared

    func loadByPlace(_ placeId: String) async {
        isLoading = true; errorMessage = nil
        do {
            let result: APIResult<[SpotFacility]>
            if let type = selectedType {
                result = try await facilityService.byPlaceAndType(placeId, type: type)
            } else {
                result = try await facilityService.byPlace(placeId)
            }
            if result.code == 200 { facilities = result.data ?? [] }
            else { errorMessage = result.message }
        } catch {
            errorMessage = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
        isLoading = false
    }

    func loadNearest(buildingId: String, placeId: String, type: String? = nil) async {
        isLoading = true; errorMessage = nil
        do {
            let result = try await facilityService.nearest(buildingId: buildingId, placeId: placeId, facilityType: type)
            if result.code == 200 { facilities = result.data ?? [] }
            else { errorMessage = result.message }
        } catch {
            errorMessage = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
        isLoading = false
    }
}

@MainActor
final class FoodViewModel: ObservableObject {
    @Published var foods: [SpotFood] = []
    @Published var cuisines: [String] = []
    @Published var selectedCuisine: String?
    @Published var searchText = ""
    @Published var sortBy = "popularity"
    @Published var isLoading = false
    @Published var errorMessage: String?

    private let foodService = FoodService.shared

    func loadByPlace(_ placeId: String) async {
        isLoading = true; errorMessage = nil
        do {
            let result = try await foodService.searchFoods(placeId: placeId, cuisine: selectedCuisine, search: searchText.isEmpty ? nil : searchText, sortBy: sortBy, limit: 50)
            if result.code == 200 { foods = result.data?.items ?? [] }
            else { errorMessage = result.message }
        } catch {
            errorMessage = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
        isLoading = false
    }

    func loadCuisines(placeId: String? = nil) async {
        do {
            let result = try await foodService.cuisines(placeId: placeId)
            if result.code == 200 { cuisines = result.data ?? [] }
        } catch { }
    }
}
