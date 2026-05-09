import Combine
import Foundation

@MainActor
final class PlaceDetailViewModel: ObservableObject {
    @Published var detail: PlaceDetailVO?
    @Published var facilities: [SpotFacility] = []
    @Published var foods: [SpotFood] = []
    @Published var isLoading = false
    @Published var errorMessage: String?

    private let placeService = PlaceService.shared
    private let facilityService = FacilityService.shared
    private let foodService = FoodService.shared

    func loadDetail(placeId: String) async {
        isLoading = true; errorMessage = nil
        do {
            let result = try await placeService.detail(id: placeId)
            if result.code == 200 { detail = result.data }
            else { errorMessage = result.message }
        } catch {
            errorMessage = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
        isLoading = false
    }

    func loadFacilities(placeId: String) async {
        do {
            let result = try await facilityService.byPlace(placeId)
            if result.code == 200 { facilities = result.data ?? [] }
        } catch { }
    }

    func loadFoods(placeId: String) async {
        do {
            let result = try await foodService.searchFoods(placeId: placeId, limit: 20)
            if result.code == 200 { foods = result.data?.items ?? [] }
        } catch { }
    }

    func recordVisit(placeId: String) async {
        guard let userId = AuthManager.shared.currentUserId else { return }
        _ = try? await UserService.shared.recordBehavior(userId: userId, targetId: placeId, behaviorType: "VIEW")
    }
}
