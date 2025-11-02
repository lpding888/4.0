# SSL证书配置说明

## 腾讯云证书放置步骤

### 1. 从腾讯云下载证书

访问：https://console.cloud.tencent.com/ssl

下载 `admin.aizhao.icu` 和 `api.aizhao.icu` 的 **Nginx格式** 证书

### 2. 解压并重命名

下载后会得到：
```
admin.aizhao.icu/
├── admin.aizhao.icu_bundle.crt
└── admin.aizhao.icu.key

api.aizhao.icu/
├── api.aizhao.icu_bundle.crt
└── api.aizhao.icu.key
```

### 3. 重命名并放到项目目录

**艹！把文件重命名并放到这里：**

```
nginx/ssl/aizhao.icu/
├── fullchain.pem   ← 重命名自 admin.aizhao.icu_bundle.crt
└── privkey.pem     ← 重命名自 admin.aizhao.icu.key
```

**注意**：
- 主站和API都用同一套证书即可（admin.aizhao.icu的证书支持主域名）
- 如果你的证书包含泛域名（*.aizhao.icu），那更好，一套搞定所有子域名

### 4. 设置权限（Linux服务器上）

```bash
# 艹！私钥必须是600权限（只有owner能读）
chmod 600 nginx/ssl/aizhao.icu/privkey.pem

# 证书文件644权限
chmod 644 nginx/ssl/aizhao.icu/fullchain.pem
```

### 5. 验证证书

```bash
# 查看证书信息
openssl x509 -in nginx/ssl/aizhao.icu/fullchain.pem -noout -text

# 验证证书和私钥是否匹配
openssl x509 -noout -modulus -in nginx/ssl/aizhao.icu/fullchain.pem | openssl md5
openssl rsa -noout -modulus -in nginx/ssl/aizhao.icu/privkey.pem | openssl md5
# 艹！两个MD5值必须一样
```

---

## 90天后续期怎么办？

### 方案A：手动续期（简单但麻烦）

每90天：
1. 腾讯云自动续期后
2. 重新下载新证书
3. 替换服务器上的旧证书
4. 重启Nginx: `docker-compose -f docker-compose.prod.yml restart nginx`

### 方案B：切换到Let's Encrypt自动化（推荐）

**艹！一劳永逸，再也不用管！**

使用项目中的 `init-letsencrypt.sh` 脚本自动配置Let's Encrypt

---

## 常见问题

**Q: 为什么要重命名？**

A: Nginx配置文件中写的是 `fullchain.pem` 和 `privkey.pem`，统一命名方便管理

**Q: 证书过期了怎么办？**

A: 腾讯云会提前续期，但你需要手动下载新证书并替换

**Q: 能不能自动化？**

A: 用Let's Encrypt + Certbot可以完全自动化，详见项目文档
