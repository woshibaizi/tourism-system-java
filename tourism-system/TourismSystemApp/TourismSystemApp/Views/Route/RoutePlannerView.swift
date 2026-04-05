import CoreLocation
import SwiftUI

struct RoutePlannerView: View {
    let selectedPlace: Place?

    @StateObject private var locationManager = LocationManager()
    @StateObject private var routeViewModel = RouteMapViewModel()
    @State private var destinationId: Int?
    @State private var showResult = false

    init(selectedPlace: Place? = nil) {
        self.selectedPlace = selectedPlace
        _destinationId = State(initialValue: selectedPlace?.id ?? MockData.featuredPlaces.first?.id)
    }

    private var destinationOptions: [Place] {
        MockData.featuredPlaces
    }

    private var selectedDestination: Place? {
        destinationOptions.first { $0.id == destinationId }
    }

    private var currentLocationText: String {
        if let location = locationManager.currentLocation {
            let latitude = String(format: "%.5f", location.coordinate.latitude)
            let longitude = String(format: "%.5f", location.coordinate.longitude)
            return "已定位：\(latitude), \(longitude)"
        }

        switch locationManager.authorizationStatus {
        case .denied, .restricted:
            return "定位权限未开启"
        case .authorizedAlways, .authorizedWhenInUse:
            return "正在获取当前位置..."
        case .notDetermined:
            return "等待授权定位"
        @unknown default:
            return "定位状态未知"
        }
    }

    private var canPlanRoute: Bool {
        locationManager.currentLocation != nil && selectedDestination != nil
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                SectionHeaderView(title: "路线规划", subtitle: "已接入 MapKit 定位与步行路线显示")

                if let selectedPlace {
                    Text("当前景点：\(selectedPlace.name)")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }

                VStack(spacing: 16) {
                    VStack(alignment: .leading, spacing: 8) {
                        Label("起点", systemImage: "location.fill")
                            .font(.headline)
                        Text(currentLocationText)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding()
                            .background(Color(.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 16))
                    }

                    VStack(alignment: .leading, spacing: 8) {
                        Label("目的地", systemImage: "flag.fill")
                            .font(.headline)
                        Picker("选择目的地", selection: $destinationId) {
                            ForEach(destinationOptions) { place in
                                Text(place.name).tag(Optional(place.id))
                            }
                        }
                        .pickerStyle(.menu)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding()
                        .background(Color(.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 16))
                    }
                }

                VStack(alignment: .leading, spacing: 10) {
                    Text("规划说明")
                        .font(.headline)
                    Text("当前版本优先打通定位、地图展示与 MapKit 步行路线。后续可以继续叠加多点路径、后端算法结果映射和路线偏好策略。")
                        .foregroundStyle(.secondary)
                }

                HStack(spacing: 12) {
                    Button {
                        locationManager.refreshLocation()
                    } label: {
                        Label("重新定位", systemImage: "location.circle.fill")
                            .font(.headline)
                            .frame(maxWidth: .infinity)
                            .padding()
                            .background(.teal, in: RoundedRectangle(cornerRadius: 18))
                            .foregroundStyle(.white)
                    }

                    Button {
                        Task {
                            await generateRoute()
                        }
                    } label: {
                        if routeViewModel.isLoading {
                            ProgressView()
                                .tint(.white)
                                .frame(maxWidth: .infinity)
                                .padding()
                        } else {
                            Text("生成推荐路线")
                                .font(.headline)
                                .frame(maxWidth: .infinity)
                                .padding()
                        }
                    }
                    .background(canPlanRoute ? .green : .gray, in: RoundedRectangle(cornerRadius: 18))
                    .foregroundStyle(.white)
                    .disabled(!canPlanRoute || routeViewModel.isLoading)
                }

                RouteMapView(
                    currentLocation: locationManager.currentLocation,
                    destination: selectedDestination,
                    route: routeViewModel.route
                )
                .frame(height: 280)

                if let routePlan = routeViewModel.routePlan {
                    routeSummaryCard(routePlan: routePlan)
                }

                if let errorMessage = routeViewModel.errorMessage ?? locationManager.locationErrorMessage {
                    Label(errorMessage, systemImage: "exclamationmark.triangle.fill")
                        .font(.subheadline)
                        .foregroundStyle(.orange)
                        .padding()
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Color.orange.opacity(0.12), in: RoundedRectangle(cornerRadius: 18))
                }
            }
            .padding(20)
        }
        .background(Color(.systemGroupedBackground))
        .navigationTitle("路线")
        .task {
            locationManager.requestPermission()
        }
        .navigationDestination(isPresented: $showResult) {
            if let routePlan = routeViewModel.routePlan {
                RouteResultView(route: routePlan)
            }
        }
    }

    private func generateRoute() async {
        guard let currentLocation = locationManager.currentLocation,
              let destination = selectedDestination else { return }

        await routeViewModel.calculateRoute(from: currentLocation, to: destination)

        if routeViewModel.routePlan != nil {
            showResult = true
        }
    }

    @ViewBuilder
    private func routeSummaryCard(routePlan: RoutePlan) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(routePlan.title)
                .font(.headline)

            HStack {
                Label(routePlan.distanceText, systemImage: "ruler")
                Spacer()
                Label(routePlan.durationText, systemImage: "clock")
            }
            .font(.subheadline)
            .foregroundStyle(.secondary)

            Text(routePlan.summary)
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
        .padding(18)
        .background(Color(.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 20))
    }
}

#Preview {
    NavigationStack {
        RoutePlannerView()
    }
}
