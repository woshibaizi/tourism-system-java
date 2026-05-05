import SwiftUI

struct RegisterView: View {
    @Binding var isLoggedIn: Bool
    @Environment(\.dismiss) private var dismiss
    @StateObject private var vm = AuthViewModel()

    var body: some View {
        Form {
            Section("基本信息") {
                TextField("用户名", text: $vm.username)
                    .textInputAutocapitalization(.never)
                SecureField("密码", text: $vm.password)
            }

            if let error = vm.errorMessage {
                Section { Label(error, systemImage: "exclamationmark.triangle.fill").foregroundStyle(.red) }
            }

            Section {
                Button {
                    Task {
                        if await vm.register() {
                            if await vm.login() { isLoggedIn = true; dismiss() }
                        }
                    }
                } label: {
                    if vm.isLoading {
                        ProgressView().frame(maxWidth: .infinity)
                    } else {
                        Text("注册并登录").font(.headline).frame(maxWidth: .infinity)
                    }
                }
                .disabled(vm.isLoading)
            }

            Section("说明") {
                Text("注册后将自动登录，后续可直接对接 Spring Boot 注册接口。")
                    .foregroundStyle(.secondary)
            }
        }
        .navigationTitle("注册")
        .navigationBarTitleDisplayMode(.inline)
    }
}

#Preview {
    NavigationStack { RegisterView(isLoggedIn: .constant(false)) }
}
