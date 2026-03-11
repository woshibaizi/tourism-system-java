package com.tourism.model.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.List;

@Data
public class RegisterDTO {

    @NotBlank(message = "用户名不能为空")
    @Size(min = 2, max = 20, message = "用户名长度2-20字符")
    private String username;

    @NotBlank(message = "密码不能为空")
    @Size(min = 6, max = 32, message = "密码长度6-32字符")
    private String password;

    /** 用户兴趣标签，可选 */
    private List<String> interests;

    /** 偏好分类，可选 */
    private List<String> favoriteCategories;
}
