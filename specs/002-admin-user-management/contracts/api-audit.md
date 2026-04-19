# Contract: Audit Log API

**Access**: All Admin (role == `super` or `admin`)

## Base URL

`/api/v1/admin/audit-logs`

## Endpoints

### GET /api/v1/admin/audit-logs

获取操作日志列表。支持分页和筛选。

**Query Parameters**:
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| page | int | No | 页码，默认 1 |
| page_size | int | No | 每页条数，默认 20，最大 100 |
| start_date | string | No | 开始日期，格式 `2026-04-01` |
| end_date | string | No | 结束日期，格式 `2026-04-19` |
| admin_name | string | No | 按操作人名称筛选 |
| action | string | No | 按操作类型筛选，如 `disable_user` |

**Response 200**:
```json
{
  "code": 0,
  "data": {
    "list": [
      {
        "id": 1,
        "admin_name": "superadmin",
        "action": "disable_user",
        "target_type": "user",
        "target_name": "张三",
        "detail": {
          "previous_state": { "is_active": true },
          "new_state": { "is_active": false }
        },
        "ip_addr": "192.168.1.1",
        "created_at": "2026-04-19T14:30:00Z"
      }
    ],
    "total": 500,
    "page": 1,
    "page_size": 20
  }
}
```

---

### GET /api/v1/admin/audit-logs/export

导出操作日志。

**Query Parameters**: 同列表接口的筛选参数。

**Response**: CSV/Excel 文件下载。

**Headers**:
```
Content-Type: text/csv
Content-Disposition: attachment; filename="audit-logs-20260419.csv"
```
