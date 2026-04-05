import SwiftUI

struct MainTabView: View {
    var body: some View {
        TabView {
            NavigationStack {
                HomeView()
            }
            .tabItem {
                Label("首页", systemImage: "house.fill")
            }

            NavigationStack {
                DiscoverView()
            }
            .tabItem {
                Label("发现", systemImage: "magnifyingglass")
            }

            NavigationStack {
                RoutePlannerView()
            }
            .tabItem {
                Label("路线", systemImage: "map.fill")
            }

            NavigationStack {
                DiaryListView()
            }
            .tabItem {
                Label("日记", systemImage: "book.fill")
            }

            NavigationStack {
                ProfileView()
            }
            .tabItem {
                Label("我的", systemImage: "person.fill")
            }
        }
        .tint(.green)
    }
}

#Preview {
    MainTabView()
}
