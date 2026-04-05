//
//  ContentView.swift
//  TourismSystemApp
//
//  Created by 王博生 on 2026/3/16.
//

import SwiftUI

struct ContentView: View {
    @State private var isLoggedIn = false

    var body: some View {
        Group {
            if isLoggedIn {
                MainTabView()
            } else {
                LoginView(isLoggedIn: $isLoggedIn)
            }
        }
    }
}

#Preview {
    ContentView()
}
