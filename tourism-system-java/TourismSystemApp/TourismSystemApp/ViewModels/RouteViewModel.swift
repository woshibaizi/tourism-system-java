import Combine
import Foundation

@MainActor
final class RouteViewModel: ObservableObject {
    @Published var places: [SpotPlace] = []
    @Published var selectedStart: String?
    @Published var selectedEnd: String?
    @Published var destinations: [String] = []
    @Published var vehicle = "步行"
    @Published var strategy = "time"
    @Published var placeType = "景区"
    @Published var algorithm = "nearest_neighbor"
    @Published var navResult: NavigationResult?
    @Published var indoorResult: IndoorNavigationResult?
    @Published var rooms: [RoomInfo] = []
    @Published var buildingInfo: IndoorBuildingInfo?
    @Published var isLoading = false
    @Published var errorMessage: String?

    private let placeService = PlaceService.shared
    private let navService = NavigationService.shared

    func loadPlaces() async {
        do {
            let result = try await placeService.list(page: 1, size: 200)
            if result.code == 200 { places = result.data?.records ?? [] }
        } catch { }
    }

    func calculateShortestPath() async {
        guard let start = selectedStart, let end = selectedEnd else { errorMessage = "请选择起点和终点"; return }
        isLoading = true; errorMessage = nil
        do {
            let result = try await navService.shortestPath(start: start, end: end, vehicle: vehicle, strategy: strategy, placeType: placeType)
            if result.code == 200 { navResult = result.data }
            else { errorMessage = result.message }
        } catch {
            errorMessage = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
        isLoading = false
    }

    func calculateMultiDestination() async {
        guard let start = selectedStart, !destinations.isEmpty else { errorMessage = "请选择起点和目标点"; return }
        isLoading = true; errorMessage = nil
        do {
            let result = try await navService.multiDestination(start: start, destinations: destinations, algorithm: algorithm)
            if result.code == 200 { navResult = result.data }
            else { errorMessage = result.message }
        } catch {
            errorMessage = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
        isLoading = false
    }

    func loadIndoorRooms() async {
        do {
            let result = try await navService.indoorRooms()
            if result.code == 200 { rooms = result.data ?? [] }
        } catch { }
    }

    func loadBuildingInfo() async {
        do {
            let result = try await navService.indoorBuildingInfo()
            if result.code == 200 { buildingInfo = result.data }
        } catch { }
    }

    func navigateToRoom(_ roomId: String) async {
        isLoading = true; errorMessage = nil
        do {
            let result = try await navService.navigateToRoom(roomId)
            if result.code == 200 { indoorResult = result.data }
            else { errorMessage = result.message }
        } catch {
            errorMessage = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
        isLoading = false
    }

    var availableVehicles: [String] { navResult?.availableVehicles ?? ["步行", "自行车", "电瓶车"] }
}
