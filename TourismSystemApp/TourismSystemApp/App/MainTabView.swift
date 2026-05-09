import SwiftUI

struct MainTabView: View {
    @State private var selectedTab = 0

    var body: some View {
        TabView(selection: $selectedTab) {
            NavigationStack {
                PlacesHomeView()
            }
            .tabItem {
                Label("景点", systemImage: selectedTab == 0 ? "mappin.and.ellipse" : "mappin.and.ellipse")
            }
            .tag(0)

            NavigationStack {
                RoutePlannerView()
            }
            .tabItem {
                Label("路线", systemImage: selectedTab == 1 ? "point.topleft.down.curvedto.point.bottomright.up.fill" : "point.topleft.down.curvedto.point.bottomright.up")
            }
            .tag(1)

            NavigationStack {
                DiaryListView()
            }
            .tabItem {
                Label("日记", systemImage: selectedTab == 2 ? "book.pages.fill" : "book.pages")
            }
            .tag(2)

            NavigationStack {
                ProfileView()
            }
            .tabItem {
                Label("我的", systemImage: selectedTab == 3 ? "person.fill" : "person")
            }
            .tag(3)
        }
        .tint(Color(hex: "667eea"))
    }
}
