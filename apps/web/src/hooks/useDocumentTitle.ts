/**
 * 设置文档标题 Hook
 */

import { useEffect } from 'react'

export const useDocumentTitle = (title: string) => {
  useEffect(() => {
    const original = document.title
    document.title = title
    return () => {
      document.title = original
    }
  }, [title])
}
