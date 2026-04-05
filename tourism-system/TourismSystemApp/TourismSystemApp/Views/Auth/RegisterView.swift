import SwiftUI

struct RegisterView: View {
    @State private var username = ""
    @State private var email = ""
    @State private var password = ""

    var body: some View {
        Form {
            Section("基本信息") {
                TextField("用户名", text: $username)
                TextField("邮箱", text: $email)
                    .textInputAutocapitalization(.never)
                SecureField("密码", text: $password)
            }

            Section("说明") {
                Text("当前页面用于搭建移动端注册流程，后续可直接对接 Spring Boot 注册接口。")
                    .foregroundStyle(.secondary)
            }
        }
        .navigationTitle("注册")
        .navigationBarTitleDisplayMode(.inline)
    }
}

#Preview {
    NavigationStack {
        RegisterView()
    }
}
