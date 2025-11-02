# MySQL 优化配置 - 针对4GB内存服务器

## 📋 优化目标

- 当前内存: **4GB**
- MySQL分配: **512MB** (原来可能800MB-1GB)
- 节省内存: **~300-500MB**
- 性能影响: **最小** (你的数据量小，影响不大)

---

## 🔧 优化步骤

### 1️⃣ 备份原配置

```bash
# 备份原配置文件
sudo cp /etc/mysql/my.cnf /etc/mysql/my.cnf.backup.$(date +%Y%m%d)
```

### 2️⃣ 编辑MySQL配置

```bash
# 编辑配置文件（宝塔面板可能在这个路径）
sudo vim /etc/mysql/my.cnf

# 或者宝塔面板路径
sudo vim /www/server/mysql/etc/my.cnf
```

### 3️⃣ 添加优化配置

在 `[mysqld]` 部分添加以下配置：

```ini
[mysqld]
# ========================================
# 🔥 针对4GB内存服务器优化（老王定制）
# ========================================

# ✅ InnoDB缓冲池（最重要！）
# 原来可能是1GB，改成512MB节省内存
innodb_buffer_pool_size = 512M

# ✅ 连接数限制
# 原来可能是151，改成100（你的并发不需要那么多）
max_connections = 100

# ✅ 查询缓存（加速重复查询）
query_cache_type = 1
query_cache_size = 32M
query_cache_limit = 2M

# ✅ 临时表大小
tmp_table_size = 32M
max_heap_table_size = 32M

# ✅ 每个连接的缓冲区
# 减少单连接内存占用
read_buffer_size = 1M
read_rnd_buffer_size = 2M
sort_buffer_size = 2M
join_buffer_size = 2M

# ✅ InnoDB性能优化
innodb_log_file_size = 128M
innodb_log_buffer_size = 8M
innodb_flush_log_at_trx_commit = 2  # 🔥 性能优先（可能丢失1秒数据）
innodb_flush_method = O_DIRECT

# ✅ 线程缓存
thread_cache_size = 8

# ✅ 表缓存
table_open_cache = 256
table_definition_cache = 256

# ✅ 慢查询日志（监控性能）
slow_query_log = 1
slow_query_log_file = /var/log/mysql/slow.log
long_query_time = 2

# ✅ 字符集
character-set-server = utf8mb4
collation-server = utf8mb4_unicode_ci

# ✅ 禁用performance_schema（节省内存）
performance_schema = OFF
```

---

## 🎯 配置说明

### 关键参数解释

| 参数 | 原值 | 新值 | 作用 | 节省内存 |
|------|------|------|------|----------|
| **innodb_buffer_pool_size** | 1GB | 512MB | InnoDB缓冲池 | 512MB |
| **max_connections** | 151 | 100 | 最大连接数 | 50MB |
| **query_cache_size** | 0 | 32MB | 查询缓存 | -32MB（增加） |
| **performance_schema** | ON | OFF | 性能监控 | 100MB |
| **总节省** | - | - | - | **~500MB** |

---

## 🚀 应用配置

### 1️⃣ 检查配置语法

```bash
mysqld --help --verbose | grep "my.cnf"
```

### 2️⃣ 重启MySQL

```bash
# 方法1: systemctl
sudo systemctl restart mysql

# 方法2: 宝塔面板
# 打开宝塔面板 → 软件商店 → MySQL → 重启

# 方法3: service命令
sudo service mysql restart
```

### 3️⃣ 验证配置生效

```bash
# 登录MySQL
mysql -u root -p

# 查看配置
SHOW VARIABLES LIKE 'innodb_buffer_pool_size';
SHOW VARIABLES LIKE 'max_connections';
SHOW VARIABLES LIKE 'query_cache_size';
SHOW VARIABLES LIKE 'performance_schema';
```

**预期输出:**
```sql
+-------------------------+------------+
| Variable_name           | Value      |
+-------------------------+------------+
| innodb_buffer_pool_size | 536870912  | -- 512MB
| max_connections         | 100        |
| query_cache_size        | 33554432   | -- 32MB
| performance_schema      | OFF        |
+-------------------------+------------+
```

---

## 📊 优化效果

### 内存使用对比

**优化前:**
```
MySQL总占用: ~800MB-1GB
- InnoDB缓冲池: 1GB
- 连接池 (151个): ~150MB
- Performance Schema: ~100MB
```

**优化后:**
```
MySQL总占用: ~600MB
- InnoDB缓冲池: 512MB
- 连接池 (100个): ~100MB
- Performance Schema: 关闭
```

**节省内存: 200-400MB ✅**

---

### 性能影响评估

| 场景 | 优化前 | 优化后 | 影响 |
|------|--------|--------|------|
| **查询速度** | 2-6ms | 2-8ms | ⚠️ 轻微变慢（可忽略） |
| **并发连接** | 151个 | 100个 | ✅ 够用（你用不了那么多） |
| **缓存命中** | 低 | 高 | ✅ 查询缓存提升性能 |

**老王评价: 性能影响可以忽略，你的数据量小，512MB缓冲池完全够用！**

---

## ⚠️ 重要说明

### innodb_flush_log_at_trx_commit = 2

这个配置是性能优化的关键，但有风险：

**值说明:**
- `0`: 最快，但可能丢失1秒数据（服务器崩溃）
- `1`: 最安全，每次事务都刷盘（默认）
- `2`: 折中，每秒刷盘（推荐）⭐

**老王建议:**
- 如果你的业务对数据丢失容忍度高 → 用 `2`
- 如果你的业务必须绝对安全 → 用 `1`（但性能会降低30%）

---

## 🔍 监控和调优

### 查看MySQL内存使用

```bash
# 查看MySQL进程内存
ps aux | grep mysql

# 查看InnoDB状态
mysql -u root -p -e "SHOW ENGINE INNODB STATUS\G"

# 查看连接数
mysql -u root -p -e "SHOW STATUS LIKE 'Threads_connected'"
mysql -u root -p -e "SHOW STATUS LIKE 'Max_used_connections'"
```

### 查看缓存命中率

```bash
mysql -u root -p -e "
SHOW STATUS LIKE 'Qcache_hits';
SHOW STATUS LIKE 'Qcache_inserts';
SHOW STATUS LIKE 'Qcache_not_cached';
"
```

**计算缓存命中率:**
```
命中率 = Qcache_hits / (Qcache_hits + Qcache_inserts + Qcache_not_cached)

如果命中率 > 30%，说明查询缓存有效 ✅
```

---

## 🎯 总结

**4GB内存服务器MySQL优化方案:**

1. **InnoDB缓冲池**: 1GB → 512MB（节省512MB）
2. **最大连接数**: 151 → 100（节省50MB）
3. **Performance Schema**: 关闭（节省100MB）
4. **查询缓存**: 启用32MB（提升重复查询性能）

**总节省内存: ~500MB ✅**

**性能影响: 最小（你的数据量小，完全够用）**

---

## 🚨 回滚方法

如果优化后有问题，立即回滚：

```bash
# 恢复备份配置
sudo cp /etc/mysql/my.cnf.backup.20251029 /etc/mysql/my.cnf

# 重启MySQL
sudo systemctl restart mysql
```

---

**老王建议: 立即执行这个优化，节省500MB内存，让PM2可以跑3个进程！** 🚀
