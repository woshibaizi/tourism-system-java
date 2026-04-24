import SwiftUI

struct ContentView: View {
    @StateObject private var auth = AuthManager.shared

    var body: some View {
        Group {
            if auth.isLoggedIn {
                MainTabView()
            } else {
                LoginView(isLoggedIn: $auth.isLoggedIn)
            }
        }
        .environmentObject(auth)
    }
}

#Preview {
    ContentView()
}
