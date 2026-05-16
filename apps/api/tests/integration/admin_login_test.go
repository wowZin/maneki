//go:build integration

package integration

import (
	"encoding/json"
	"io"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/maneki/api/internal/handler"
	"github.com/maneki/api/internal/model"
	"github.com/maneki/api/internal/testutil"
)

// TestAdminLogin_Integration 测试管理员登录集成场景
func TestAdminLogin_Integration(t *testing.T) {
	ts := testutil.NewTestServer(t)

	// 前置：创建测试管理员
	ts.CreateAdmin(t, "testadmin", "TestPass123!", model.AdminRoleAdmin)

	t.Run("登录成功", func(t *testing.T) {
		resp, err := ts.PostJSON("/api/v1/admin/auth/login", handler.AdminLoginRequest{
			Name:     "testadmin",
			Password: "TestPass123!",
		})
		require.NoError(t, err)
		defer resp.Body.Close()

		assert.Equal(t, http.StatusOK, resp.StatusCode)

		body := readResponse(t, resp)
		assert.Equal(t, float64(0), body["code"])

		data, ok := body["data"].(map[string]interface{})
		require.True(t, ok)
		assert.NotEmpty(t, data["token"])

		admin, ok := data["admin"].(map[string]interface{})
		require.True(t, ok)
		assert.Equal(t, "testadmin", admin["name"])
		assert.Equal(t, "admin", admin["role"])

		// 验证 httpOnly cookie 已设置
		cookies := resp.Cookies()
		found := false
		for _, c := range cookies {
			if c.Name == "admin_token" {
				found = true
				assert.True(t, c.HttpOnly)
				break
			}
		}
		assert.True(t, found, "admin_token cookie should be set")
	})

	t.Run("密码错误", func(t *testing.T) {
		resp, err := ts.PostJSON("/api/v1/admin/auth/login", handler.AdminLoginRequest{
			Name:     "testadmin",
			Password: "WrongPassword!",
		})
		require.NoError(t, err)
		defer resp.Body.Close()

		assert.Equal(t, http.StatusUnauthorized, resp.StatusCode)

		body := readResponse(t, resp)
		assert.Equal(t, float64(1001), body["code"])
		assert.Contains(t, body["message"], "账号或密码错误")
	})

	t.Run("账号不存在", func(t *testing.T) {
		resp, err := ts.PostJSON("/api/v1/admin/auth/login", handler.AdminLoginRequest{
			Name:     "notexist",
			Password: "AnyPassword123!",
		})
		require.NoError(t, err)
		defer resp.Body.Close()

		assert.Equal(t, http.StatusUnauthorized, resp.StatusCode)

		body := readResponse(t, resp)
		assert.Equal(t, float64(1001), body["code"])
	})

	t.Run("被禁用账号无法登录", func(t *testing.T) {
		// 创建被禁用的管理员
		admin := ts.CreateAdmin(t, "disabled_admin", "Pass123!", model.AdminRoleAdmin)
		admin.IsActive = false
		require.NoError(t, ts.DB.Save(admin).Error)

		resp, err := ts.PostJSON("/api/v1/admin/auth/login", handler.AdminLoginRequest{
			Name:     "disabled_admin",
			Password: "Pass123!",
		})
		require.NoError(t, err)
		defer resp.Body.Close()

		assert.Equal(t, http.StatusUnauthorized, resp.StatusCode)
	})

	t.Run("参数校验失败", func(t *testing.T) {
		resp, err := ts.PostJSON("/api/v1/admin/auth/login", map[string]string{
			"name": "testadmin",
			// 缺少 password
		})
		require.NoError(t, err)
		defer resp.Body.Close()

		assert.Equal(t, http.StatusBadRequest, resp.StatusCode)

		body := readResponse(t, resp)
		assert.Equal(t, float64(1000), body["code"])
	})
}

// TestAdminMe_Integration 测试获取当前管理员信息
func TestAdminMe_Integration(t *testing.T) {
	ts := testutil.NewTestServer(t)

	// 前置：创建超级管理员
	ts.CreateSuperAdmin(t, "superadmin", "SuperPass123!")

	// 登录获取 token
	resp, err := ts.PostJSON("/api/v1/admin/auth/login", handler.AdminLoginRequest{
		Name:     "superadmin",
		Password: "SuperPass123!",
	})
	require.NoError(t, err)

	loginBody := readResponse(t, resp)
	resp.Body.Close()

	token := loginBody["data"].(map[string]interface{})["token"].(string)

	t.Run("获取当前管理员信息成功", func(t *testing.T) {
		resp, err := ts.Get("/api/v1/admin/auth/me", map[string]string{
			"Authorization": "Bearer " + token,
		})
		require.NoError(t, err)
		defer resp.Body.Close()

		assert.Equal(t, http.StatusOK, resp.StatusCode)

		body := readResponse(t, resp)
		assert.Equal(t, float64(0), body["code"])

		data, ok := body["data"].(map[string]interface{})
		require.True(t, ok)
		assert.Equal(t, "superadmin", data["name"])
		assert.Equal(t, "super", data["role"])
	})

	t.Run("未登录访问返回401", func(t *testing.T) {
		resp, err := ts.Get("/api/v1/admin/auth/me", nil)
		require.NoError(t, err)
		defer resp.Body.Close()

		assert.Equal(t, http.StatusUnauthorized, resp.StatusCode)
	})
}

// readResponse 读取并解析 JSON 响应
func readResponse(t *testing.T, resp *http.Response) map[string]interface{} {
	t.Helper()
	var result map[string]interface{}
	body, err := io.ReadAll(resp.Body)
	require.NoError(t, err)
	require.NoError(t, json.Unmarshal(body, &result))
	return result
}
