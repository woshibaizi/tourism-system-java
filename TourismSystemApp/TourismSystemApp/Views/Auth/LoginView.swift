import SwiftUI

struct LoginView: View {
    @Binding var isLoggedIn: Bool
    @StateObject private var vm = AuthViewModel()
    @State private var showRegister = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Tourism System")
                            .font(.largeTitle.bold())
                        Text("用 iPhone 重新组织你的个性化旅游体验。")
                            .font(.title3)
                            .foregroundStyle(.secondary)
                    }
                    .padding(.top, 40)

                    RoundedRectangle(cornerRadius: 28)
                        .fill(
                            LinearGradient(
                                colors: [.green.opacity(0.95), .teal.opacity(0.75)],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                        .frame(height: 180)
                        .overlay(alignment: .bottomLeading) {
                            VStack(alignment: .leading, spacing: 8) {
                                Text("探索景点").font(.title3.bold())
                                Text("规划路线").font(.title3.bold())
                                Text("记录旅行").font(.title3.bold())
                            }
                            .foregroundStyle(.white)
                            .padding(24)
                        }

                    VStack(spacing: 16) {
                        TextField("用户名", text: $vm.username)
                            .textInputAutocapitalization(.never)
                            .padding()
                            .background(Color(.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 16))

                        SecureField("密码", text: $vm.password)
                            .padding()
                            .background(Color(.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 16))
                    }

                    if let error = vm.errorMessage {
                        Label(error, systemImage: "exclamationmark.triangle.fill")
                            .font(.subheadline)
                            .foregroundStyle(.red)
                    }

                    Button {
                        Task {
                            if await vm.login() { isLoggedIn = true }
                        }
                    } label: {
                        if vm.isLoading {
                            ProgressView().tint(.white)
                                .frame(maxWidth: .infinity).padding()
                        } else {
                            Text("登录并进入 App")
                                .font(.headline)
                                .frame(maxWidth: .infinity)
                                .padding()
                        }
                    }
                    .background(.green, in: RoundedRectangle(cornerRadius: 18))
                    .foregroundStyle(.white)
                    .disabled(vm.isLoading)

                    Button("没有账号？去注册") { showRegister = true }
                        .frame(maxWidth: .infinity, alignment: .center)

                    Button("先用演示模式看看") { isLoggedIn = true }
                        .frame(maxWidth: .infinity, alignment: .center)
                        .foregroundStyle(.secondary)
                }
                .padding(24)
            }
            .background(Color(.systemGroupedBackground))
            .navigationDestination(isPresented: $showRegister) {
                RegisterView(isLoggedIn: $isLoggedIn)
            }
        }
    }
}

#Preview {
    LoginView(isLoggedIn: .constant(false))
}
