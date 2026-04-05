import MapKit
import SwiftUI

struct RouteMapView: View {
    let currentLocation: CLLocation?
    let destination: Place?
    let route: MKRoute?

    @State private var position: MapCameraPosition = .automatic

    var body: some View {
        Map(position: $position) {
            if currentLocation != nil {
                UserAnnotation()
            }

            if let destination {
                Marker(destination.name, coordinate: destination.coordinate)
                    .tint(.green)
            }

            if let route {
                MapPolyline(route.polyline)
                    .stroke(.blue, lineWidth: 6)
            }
        }
        .mapControls {
            MapUserLocationButton()
            MapCompass()
            MapScaleView()
        }
        .onAppear {
            updateCamera()
        }
        .onChange(of: route?.distance) { _, _ in
            updateCamera()
        }
        .onChange(of: destination?.id) { _, _ in
            updateCamera()
        }
        .onChange(of: currentLocation?.coordinate.latitude) { _, _ in
            updateCamera()
        }
        .clipShape(RoundedRectangle(cornerRadius: 24))
    }

    private func updateCamera() {
        if let route {
            position = .rect(route.polyline.boundingMapRect)
            return
        }

        if let destination {
            position = .region(
                MKCoordinateRegion(
                    center: destination.coordinate,
                    span: MKCoordinateSpan(latitudeDelta: 0.02, longitudeDelta: 0.02)
                )
            )
            return
        }

        if let currentLocation {
            position = .region(
                MKCoordinateRegion(
                    center: currentLocation.coordinate,
                    span: MKCoordinateSpan(latitudeDelta: 0.01, longitudeDelta: 0.01)
                )
            )
        }
    }
}
