import { test, expect } from "@playwright/test"
import { loginAdmin, createAgent } from "../../fixtures/api"

test("debug admin token", async ({ request }) => {
  const admin = await loginAdmin(request, "superadmin", "SuperPass123!")
  console.log("admin token:", admin.token)
  console.log("admin token length:", admin.token?.length)
  expect(admin.token).toBeDefined()
  expect(admin.token).not.toBe("")

  const agent = await createAgent(request, admin.token!, {
    name: `Debug_Agent_${Date.now()}`,
    description: "debug",
    type: "technical",
    category: "trend",
    is_active: true,
    is_featured: false,
    is_official: true,
  })
  console.log("created agent:", agent)
})
