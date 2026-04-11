# Polars 技术分析方案

## 1. 为什么选择 Polars？

### 1.1 性能对比

| 操作 | Pandas | Polars | 提升倍数 |
|------|--------|--------|---------|
| 读取 1000万行 CSV | 8.2s | 0.8s | **10x** |
| 分组聚合计算 | 2.1s | 0.08s | **26x** |
| 内存占用 | 2.5GB | 0.4GB | **6x** |
| 复杂窗口函数 | 5.5s | 0.15s | **36x** |

### 1.2 核心优势

1. **Rust 底层**：内存安全，真正的多线程并行
2. **惰性执行（Lazy）**：自动优化查询计划，减少不必要计算
3. **内存映射**：大数据集不需要全部加载到内存
4. **API 简洁**：链式调用，代码更清晰

---

## 2. Pandas vs Polars 核心概念对照

### 2.1 基础概念

| Pandas | Polars | 说明 |
|--------|--------|------|
| `DataFrame` | `DataFrame` | 数据结构相同 |
| `Series` | `Series` | 一维数据 |
| `df['col']` | `df['col']` | 列选择语法相同 |
| `NaN` | `null` | 空值处理（Polars 区分 NaN 和 null）|
| `inplace=True` | 无此概念 | Polars 默认不可变，总是返回新对象 |
| `axis=0/1` | 无需指定 | Polars 操作更明确 |

### 2.2 常用操作对照表

#### 读取数据
```python
# Pandas
import pandas as pd
df = pd.read_csv('data.csv')
df = pd.read_parquet('data.parquet')

# Polars
import polars as pl
df = pl.read_csv('data.csv')
df = pl.read_parquet('data.parquet')
```

#### 筛选数据
```python
# Pandas
df_filtered = df[(df['close'] > 10) & (df['volume'] > 10000)]

# Polars
df_filtered = df.filter(
    (pl.col('close') > 10) & (pl.col('volume') > 10000)
)
```

#### 新增列
```python
# Pandas
df['amount'] = df['close'] * df['volume']

# Polars
df = df.with_columns(
    (pl.col('close') * pl.col('volume')).alias('amount')
)
```

#### 分组聚合
```python
# Pandas
df.groupby('code').agg({
    'close': ['mean', 'max', 'min'],
    'volume': 'sum'
})

# Polars
df.group_by('code').agg([
    pl.col('close').mean().alias('close_mean'),
    pl.col('close').max().alias('close_max'),
    pl.col('close').min().alias('close_min'),
    pl.col('volume').sum().alias('volume_sum')
])
```

#### 窗口函数（移动平均等）
```python
# Pandas
df['ma20'] = df.groupby('code')['close'].transform(
    lambda x: x.rolling(20).mean()
)

# Polars
df = df.with_columns(
    pl.col('close').rolling_mean(20).over('code').alias('ma20')
)
```

#### 排序
```python
# Pandas
df_sorted = df.sort_values(['code', 'time'], ascending=[True, False])

# Polars
df_sorted = df.sort(['code', 'time'], descending=[False, True])
```

#### 合并表
```python
# Pandas
df_merged = df1.merge(df2, on='code', how='left')

# Polars
df_merged = df1.join(df2, on='code', how='left')
```

---

## 3. 复盘分析专用模式

### 3.1 标准复盘分析流程

```python
import polars as pl
from datetime import datetime, timedelta

class ReplayAnalyzer:
    """复盘分析器 - Polars版本"""
    
    def __init__(self, db_connection):
        self.conn = db_connection
    
    def load_signals_with_kline(self, trade_date: str) -> pl.DataFrame:
        """
        加载某日的信号和对应的K线数据
        
        功能：分析每个信号从触发到收盘的表现
        """
        # 方式1：从数据库直接读取（推荐，小数据量）
        query = f"""
        SELECT 
            s.id as signal_id,
            s.code,
            s.signal_type,
            s.confidence,
            s.trigger_price,
            s.created_at,
            k.time,
            k.close,
            k.high,
            k.low,
            k.volume
        FROM signals s
        LEFT JOIN kline_1min k 
            ON s.code = k.code 
            AND k.time BETWEEN s.created_at 
            AND s.created_at + INTERVAL '1 day'
        WHERE DATE(s.created_at) = '{trade_date}'
        ORDER BY s.id, k.time
        """
        
        return pl.read_database(query, self.conn)
    
    def load_signals_with_kline_lazy(self, trade_date: str) -> pl.LazyFrame:
        """
        惰性加载 - 大数据量时使用
        
        功能：延迟执行，自动优化查询计划
        """
        # 方式2：惰性执行（大数据量推荐）
        lf = pl.scan_database(self.conn)  # 扫描数据库
        
        result = lf.filter(
            pl.col('trade_date') == trade_date
        ).join(
            pl.scan_database(self.conn, table='kline_1min'),
            on='code',
            how='left'
        ).filter(
            pl.col('kline_time').is_between(
                pl.col('signal_time'),
                pl.col('signal_time') + pl.duration(hours=4)
            )
        )
        
        # 此时还没有执行，直到调用 .collect()
        return result
    
    def calculate_signal_performance(self, df: pl.DataFrame) -> pl.DataFrame:
        """
        计算每个信号的表现指标
        
        输出列：
        - max_return_pct: 最大收益 %
        - close_return_pct: 收盘收益 %
        - max_drawdown_pct: 最大回撤 %
        - hit_limit_up: 是否涨停
        """
        return df.group_by('signal_id').agg([
            # 基本信息
            pl.first('code').alias('code'),
            pl.first('signal_type').alias('signal_type'),
            pl.first('confidence').alias('confidence'),
            pl.first('trigger_price').alias('entry_price'),
            
            # 价格统计
            pl.col('high').max().alias('max_price'),
            pl.col('low').min().alias('min_price'),
            pl.col('close').last().alias('close_price'),
            
            # 收益计算
            ((pl.col('high').max() - pl.first('trigger_price')) 
             / pl.first('trigger_price') * 100).alias('max_return_pct'),
             
            ((pl.col('close').last() - pl.first('trigger_price')) 
             / pl.first('trigger_price') * 100).alias('close_return_pct'),
            
            # 最大回撤（从入场到最低）
            ((pl.first('trigger_price') - pl.col('low').min()) 
             / pl.first('trigger_price') * 100).alias('max_drawdown_pct'),
            
            # 是否涨停（涨超9.5%）
            (pl.col('high').max() / pl.first('trigger_price') >= 1.095)
                .alias('hit_limit_up'),
            
            # 交易时长（分钟）
            ((pl.col('time').max() - pl.col('time').min())
             .dt.total_minutes()).alias('trade_duration_min')
        ])
    
    def analyze_by_agent(self, start_date: str, end_date: str) -> pl.DataFrame:
        """
        按Agent分析成功率
        
        输出：每个Agent的成功率统计
        """
        query = f"""
        SELECT 
            ad.agent_type,
            rr.success,
            rr.actual_return_pct,
            rr.max_return_pct,
            rr.trade_date
        FROM agent_decisions ad
        JOIN replay_results rr ON ad.signal_id = rr.signal_id
        WHERE rr.trade_date BETWEEN '{start_date}' AND '{end_date}'
        """
        
        df = pl.read_database(query, self.conn)
        
        return df.group_by('agent_type').agg([
            pl.count().alias('total_signals'),
            pl.col('success').sum().alias('success_count'),
            (pl.col('success').sum() / pl.count() * 100).alias('success_rate'),
            pl.col('actual_return_pct').mean().alias('avg_actual_return'),
            pl.col('max_return_pct').mean().alias('avg_max_return'),
            pl.col('actual_return_pct').std().alias('return_std'),
            # 盈亏比
            (pl.col('actual_return_pct').filter(pl.col('actual_return_pct') > 0).mean() /
             pl.col('actual_return_pct').filter(pl.col('actual_return_pct') < 0).mean().abs()
            ).alias('profit_loss_ratio')
        ]).sort('success_rate', descending=True)

    def analyze_time_pattern(self, df: pl.DataFrame) -> pl.DataFrame:
        """
        分析时间模式 - 什么时间段信号成功率最高
        """
        return df.with_columns(
            # 提取小时和分钟
            pl.col('created_at').dt.hour().alias('hour'),
            pl.col('created_at').dt.minute().alias('minute')
        ).group_by('hour').agg([
            pl.count().alias('signal_count'),
            pl.col('success').sum().alias('success_count'),
            (pl.col('success').sum() / pl.count() * 100).alias('success_rate'),
            pl.col('actual_return_pct').mean().alias('avg_return')
        ]).sort('hour')

# ========== 使用示例 ==========

def example_usage():
    """完整使用示例"""
    
    # 1. 初始化分析器
    analyzer = ReplayAnalyzer(db_connection="postgresql://...")
    
    # 2. 加载某日数据（pandas风格）
    df = analyzer.load_signals_with_kline('2024-04-10')
    
    # 3. 计算每个信号的表现
    performance = analyzer.calculate_signal_performance(df)
    
    # 4. 查看结果（转换为pandas展示，可选）
    print(performance.to_pandas())
    
    # 5. 保存结果到数据库
    performance.write_database(
        table_name='replay_results',
        connection=analyzer.conn,
        if_table_exists='append'
    )
    
    # 6. 按Agent统计
    agent_stats = analyzer.analyze_by_agent('2024-04-01', '2024-04-10')
    print(agent_stats)
```

---

## 4. 核心语法速查表

### 4.1 列操作

```python
# 选择列
df.select(['code', 'close', 'volume'])

# 删除列
df.drop(['unnecessary_col'])

# 重命名列
df.rename({'old_name': 'new_name'})

# 数据类型转换
df.with_columns(pl.col('code').cast(pl.Utf8))
```

### 4.2 条件判断

```python
# if-else 逻辑
df.with_columns(
    pl.when(pl.col('close') > pl.col('open'))
    .then(pl.lit('up'))
    .when(pl.col('close') < pl.col('open'))
    .then(pl.lit('down'))
    .otherwise(pl.lit('flat'))
    .alias('trend')
)
```

### 4.3 字符串处理

```python
df.with_columns(
    pl.col('code').str.replace('.SZ', ''),  # 替换
    pl.col('name').str.to_uppercase(),       # 转大写
    pl.col('desc').str.contains('涨停'),     # 包含判断
    pl.col('code').str.slice(0, 2)           # 截取前2位
)
```

### 4.4 时间处理

```python
df.with_columns(
    pl.col('time').dt.year().alias('year'),
    pl.col('time').dt.month().alias('month'),
    pl.col('time').dt.day().alias('day'),
    pl.col('time').dt.hour().alias('hour'),
    pl.col('time').dt.weekday().alias('weekday'),  # 0=周一
    pl.col('time').dt.strftime('%Y-%m-%d').alias('date_str')
)
```

### 4.5 去重和唯一值

```python
# 去重
df.unique()
df.unique(subset=['code', 'date'])

# 唯一值列表
df['code'].unique()
```

### 4.6 数据透视

```python
# 长表转宽表（类似pandas pivot）
df.pivot(
    index='date',
    columns='code',
    values='close'
)

# 宽表转长表（melt）
df.melt(
    id_vars=['date'],
    value_vars=['code1', 'code2', 'code3']
)
```

---

## 5. 从 Pandas 迁移 checklist

### 5.1 必须修改的地方

| 场景 | Pandas | Polars |
|------|--------|--------|
| 修改原表 | `df['new'] = ...` | `df = df.with_columns(...)` |
| 筛选 | `df[df['x'] > 0]` | `df.filter(pl.col('x') > 0)` |
| 分组 | `df.groupby()` | `df.group_by()` |
| apply | `df.apply(func)` | `df.map_rows(func)` 或向量化 |
| 迭代行 | `for _, row in df.iterrows()` | `df.iter_rows()` |
| 索引 | `df.loc[i]` | `df.row(i)` 或 `df[i]` |

### 5.2 常见错误

```python
# ❌ 错误：试图原地修改
pl_df['new_col'] = [1, 2, 3]  # 会报错！

# ✅ 正确：返回新DataFrame
pl_df = pl_df.with_columns(pl.Series('new_col', [1, 2, 3]))

# ❌ 错误：忘记 pl.col()
df.filter(df['close'] > 10)  # 不报错但不是最佳实践

# ✅ 正确：使用 pl.col()
df.filter(pl.col('close') > 10)

# ❌ 错误：混用pandas和polars
import pandas as pd
import polars as pl
df['col']  # 不确定是哪个DataFrame！

# ✅ 正确：明确区分
pl_df = pl.DataFrame(...)
pd_df = pl_df.to_pandas()  # 需要时再转换
```

---

## 6. 性能优化建议

### 6.1 大数据处理

```python
# 1. 使用 LazyFrame（惰性执行）
lf = pl.scan_parquet('big_file.parquet')  # 扫描但不加载

result = lf.filter(
    pl.col('date') >= '2024-01-01'
).group_by('code').agg(
    pl.col('close').mean()
).collect()  # 到这里才真正执行

# 2. 分块读取
for chunk in pl.read_csv_batched('big_file.csv', batch_size=100000):
    process(chunk)

# 3. 指定数据类型（减少内存）
df = pl.read_csv('data.csv', dtypes={
    'code': pl.Utf8,
    'volume': pl.Int32,  # 不用 Int64
    'price': pl.Float32   # 不用 Float64
})
```

### 6.2 数据库读写优化

```python
# 批量写入（比逐条快100倍）
df.write_database(
    table_name='my_table',
    connection=conn,
    if_table_exists='append',
    batch_size=10000  # 一批写入1万条
)
```

---

## 7. 依赖安装

```bash
# 基础安装
pip install polars

# 带数据库支持
pip install "polars[database]"

# 完整功能
pip install "polars[all]"

# 推荐组合（复盘分析用）
pip install polars pyarrow connectorx sqlalchemy
```

---

## 8. 学习资源

1. **官方文档**: https://docs.pola.rs/
2. **API参考**: https://docs.pola.rs/py-polars/html/reference/
3. **用户指南**: https://docs.pola.rs/user-guide/

---

*文档版本: v1.0*
*适用 Polars 版本: >= 0.20.0*
