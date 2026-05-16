import { test } from "@playwright/test"
test("db", async ({page})=>{
  await page.goto("/agents")
  await page.waitForTimeout(3000)
  const c=await page.locator("button").count()
  console.log("btns:",c)
  const t=await page.locator("button").allInnerTexts()
  console.log("texts:",JSON.stringify(t))
})